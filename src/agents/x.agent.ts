import OpenAI from 'openai';
import { assistantPrompt, xAgentPrompt } from '../const/prompt';
import { TweetV2, TwitterApi, UserV1 } from 'twitter-api-v2';
import * as dayjs from 'dayjs';
import * as fs from 'fs';
import * as p from 'path';
import { CustomLogger } from 'src/logger.service';

export class XAgent {
  private readonly _client: OpenAI;
  private readonly _xClient: TwitterApi;
  private readonly _mentionsToReply: Record<string, TweetV2> = {};
  private _currentUser: UserV1 | undefined = undefined;
  private readonly _REPLYED_TWEET_DATE_FILE_PATH = p.join(
    process.cwd(),
    'public',
    'logs',
    'last_replied_tweet_date.log',
  );
  private readonly _LAST_GM_TWEET_DATE_FILE_PATH = p.join(
    process.cwd(),
    'public',
    'logs',
    'last_gm_tweet_date.log',
  );
  private readonly _IMGS_DIRECTORY_PATH = p.join(
    process.cwd(),
    'public',
    'images',
    'h-medias',
    'square',
  );

  private readonly _logger = new CustomLogger(XAgent.name);

  constructor(client: OpenAI) {
    this._client = client;
    this._logger.log(`🏗  Building Twitter client...`);
    this._xClient = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    this._logger.log(`ℹ️  Twitter client ready!`);
  }

  async start() {
    this._logger.log(`🚀 Starting IA Agent...`);
    const rwClient = this._xClient.readWrite;
    await rwClient.appLogin();
    this._currentUser = await rwClient.currentUser();
    this._logger.log(
      `👤 IA Agent is connected as @${this._currentUser?.screen_name}`,
    );
    // ensure that the `_REPLYED_TWEET_IDS_FILE_PATH` file exist
    if (!fs.existsSync(this._REPLYED_TWEET_DATE_FILE_PATH)) {
      fs.writeFileSync(this._REPLYED_TWEET_DATE_FILE_PATH, '');
    }
    // ensure that the `_LAST_GM_TWEET_DATE_FILE_PATH` file exist
    if (!fs.existsSync(this._LAST_GM_TWEET_DATE_FILE_PATH)) {
      fs.writeFileSync(this._LAST_GM_TWEET_DATE_FILE_PATH, '');
    }
    this._mentionsMonitoring();
    this._sayGM();
    this._searchForNewAccountsToConnectWith();
  }

  private async _mentionsMonitoring() {
    const TIMEOUT = 60 * 15 * 1000;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let t;
    try {
      // const userId = process.env.TWITTER_ACCOUNT_ID;
      const rwClient = this._xClient.readWrite;
      await delay(10000);

      this._logger.log(`🔍 Searching for mentions...`);
      // check if agent have existing pending mentions to reply
      const pendingMentions = Object.values(this._mentionsToReply);
      // get mentions from API if no pending mentions
      const response =
        pendingMentions.length > 0
          ? pendingMentions
          : await this._xClient.readOnly.v2
              .search({
                query: `${process.env.TWITTER_USERNAME} -is:retweet`,
                'tweet.fields': [
                  'author_id',
                  'created_at',
                  'referenced_tweets',
                ],
                expansions: [
                  'author_id',
                  'in_reply_to_user_id',
                  'referenced_tweets.id',
                ],
                max_results: 10,
              })
              .then((m) => {
                for (const mention of m?.data?.data) {
                  this._mentionsToReply[mention.id] = mention;
                }
                return Object.values(this._mentionsToReply);
              });
      this._logger.log(
        `📦 Received ${response?.length} mentions ${response[0].created_at}`,
      );
      this._logger.log(`🧹 Exclude mentions already replyed...`);
      // load file with latest tweet date
      const latestTweetDate = fs.readFileSync(
        p.join(this._REPLYED_TWEET_DATE_FILE_PATH),
        'utf-8',
      );
      // create mentions list
      const mentions = response
        // exclude mentions older than the latest tweet date
        .filter(
          (mention: any) =>
            Date.parse(mention.created_at) > Date.parse(latestTweetDate),
        )
        // exclude mention without text.includes(process.env.TWITTER_USERNAME)
        .filter((mention: any) => {
          return mention.text.includes(process.env.TWITTER_USERNAME);
        })
        // sort mentions by oldest first
        .sort(
          (a: any, b: any) =>
            Date.parse(a.created_at) - Date.parse(b.created_at),
        );
      // Ensure that the pending mentions are not older than last tweet date
      if (pendingMentions.length > 0) {
        for (const mention of pendingMentions) {
          if (Date.parse(mention.created_at) < Date.parse(latestTweetDate)) {
            delete this._mentionsToReply[mention.id];
          }
        }
      }
      // perform reply to mentions
      if (mentions.length === 0) {
        this._logger.log('ℹ️ No mentions found. Check again in 15 minutes');
      } else {
        // loop over mentions
        for (const mention of mentions) {
          this._logger.log(`🛎 Found Mention with post ID: ${mention.id}`);
          const response = await this._generateResponse(mention.text);
          this._logger.log(
            `📣 Responding to mention ID ${mention.id}: ${response}`,
          );
          const replyDate = new Date().toISOString();
          const result = await rwClient.v2.reply(response, mention.id);
          if (result.errors) {
            this._logger.error(
              `❌ Error responding to mention ID ${mention.id}: ${result.errors}`,
            );
            continue;
          }
          this._logger.log(`✅ Replied to mention ID ${mention.id}`);
          // save tweet id to file
          fs.writeFileSync(this._REPLYED_TWEET_DATE_FILE_PATH, replyDate);
          // remove mention from pending list
          delete this._mentionsToReply[mention.id];
          // wait for 5 seconds before next reply
          await delay(5000);
        }
      }
      t = setTimeout(async () => {
        await this._mentionsMonitoring();
        clearTimeout(t);
      }, TIMEOUT);
    } catch (error) {
      clearTimeout(t);
      this._logger.error(
        `❌ Error responding to mentions: ${error?.data?.detail || error.message}`,
      );
      const limit = error?.rateLimit?.reset
        ? error?.rateLimit?.reset * 1000 - Date.now()
        : TIMEOUT;
      this._logger.log(
        `🕒 Retrying searching for mentions in approximately ${this._getTimeRemaining(limit)}`,
      );
      t = setTimeout(async () => {
        await this._mentionsMonitoring();
        clearTimeout(t);
      }, limit);
    }
  }

  private async _generateResponse(
    prompt: string,
    role: 'user' | 'system' = 'user',
  ): Promise<string> {
    // disable logging on development mode
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    const DEFAULT_RESPONSE = `Eh dude, I'm not sure what you mean by that. Tell me more!`;
    try {
      const completion = await this._client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        store: false,
        n: 1,
        max_tokens: 100,
        messages: [
          { role: 'system', content: assistantPrompt },
          {
            role: 'system',
            content: xAgentPrompt,
          },
          { role: role, content: prompt },
        ],
      });
      return completion.choices[0].message.content || DEFAULT_RESPONSE;
    } catch (error) {
      this._logger.error(`❌ Error generating response: ${error.message}`);
      return DEFAULT_RESPONSE;
    }
  }

  private _getTimeRemaining(milliseconds: number): string {
    const now = dayjs();
    const futureTime = dayjs().add(milliseconds, 'millisecond');
    const duration = futureTime.diff(now, 'minute');
    if (duration > 1440) {
      return `${futureTime.diff(now, 'day')} days`;
    }
    if (duration > 60) {
      return `${futureTime.diff(now, 'hour')} hours`;
    }
    if (duration < 1) {
      return `${futureTime.diff(now, 'second')} seconds`;
    }
    return `${duration} minutes`;
  }

  private async _searchForNewAccountsToConnectWith() {
    const TIMEOUT = 6 * 60 * 1000;
    try {
      const response = await this._xClient.v2.search({
        query: `crypto OR blockchain OR NFT OR DeFi OR Web3 -is:retweet -is:reply -has:hashtags`,
        'user.fields': ['username', 'name', 'description'],
        expansions: [
          'author_id',
          'in_reply_to_user_id',
          'referenced_tweets.id',
        ],
        max_results: 10,
      });
      for (const tweet of response.data.data) {
        // connect with account
        this._logger.log(`🔗 Connecting with @${tweet.author_id}`);
        await this._xClient.v2.follow(
          this._currentUser.id.toString(),
          tweet.author_id.toString(),
        );
      }
      const t = setTimeout(async () => {
        clearTimeout(t);
        await this._searchForNewAccountsToConnectWith();
      }, TIMEOUT);
    } catch (error) {
      this._logger.error(
        `❌ Error searching for new accounts: ${error?.data?.detail || error.message}`,
      );
      const limit = error?.rateLimit?.reset
        ? error?.rateLimit?.reset * 1000 - Date.now()
        : TIMEOUT;
      this._logger.log(
        `🕒 Retrying searching for new accounts in approximately ${this._getTimeRemaining(limit)}`,
      );
      // run again in limit time
      const t = setTimeout(async () => {
        clearTimeout(t);
        await this._searchForNewAccountsToConnectWith();
      }, limit);
    }
  }

  private async _sayGM() {
    this._logger.log(`🔍 Searching for last GM tweet date...`);
    const lastGMTwwetDate = fs
      .readFileSync(p.join(this._LAST_GM_TWEET_DATE_FILE_PATH), 'utf-8')
      .trim();
    this._logger.log(`📅 Last GM tweet date: ${lastGMTwwetDate}`);
    const diffDay = dayjs().diff(dayjs(lastGMTwwetDate), 'day');
    if (diffDay < 1) {
      const msUntilNexDay = dayjs(lastGMTwwetDate).add(1, 'day').diff(dayjs());
      this._logger.log(
        `🌞 Good Morning tweet already sent today! Wait ${this._getTimeRemaining(msUntilNexDay)} for next post...`,
      );
      // run again in 1 day
      const t = setTimeout(async () => {
        clearTimeout(t);
        await this._sayGM();
      }, msUntilNexDay);
      return;
    }
    try {
      // disable logging on development mode
      if (process.env.NODE_ENV !== 'production') {
        return;
      }
      this._logger.log(`🌞 Saying Good Morning...`);
      // get random media from `public/images/square` directory
      const directoryPath = this._IMGS_DIRECTORY_PATH;
      this._logger.log(`📂 Reading images from ${directoryPath}...`);
      const filesCount = fs.readdirSync(directoryPath).length;
      if (filesCount === 0) {
        console.error('❌ No images found in the directory');
        return;
      }
      this._logger.log(`🔍  Found ${filesCount} images`);
      // random number between 0 and filesCount
      this._logger.log(`🎲 Selecting random image...`);
      const randomIndex = Math.floor(Math.random() * filesCount);
      const filePath = fs.readdirSync(directoryPath)[randomIndex];
      const imagePath = p.join(directoryPath, filePath);
      this._logger.log(`🖼️ Selected image: ${filePath}`);
      // upload image
      this._logger.log(`📤 Uploading image to twitter...`);
      const mediaId = await this._xClient.v1.uploadMedia(imagePath);
      // generate response
      this._logger.log(`🧠 Generating GM tweet...`);
      const response = await this._generateResponse(
        `Generate a tweet based on the trend of #GM. You tweet should start with "GM web3 Degen!"; "GM web3 family!"; "GM web3 community!"; "GM web3 friends!"; "GM web3 homies!"; "GM web3 squad!"; "GM web3 gang!"; "GM web3 team!"; "GM web3 crew!"; "GM web3 fam!"; fowllowed by a short funny positive message about the current crypto ia agent trends OR upcoming benefits of be a part of crypto family. The tweet should not include any hashtags, links or mentions and no special caracters like symbols or quotes.`,
      );
      // send tweet
      this._logger.log(`✉️  Sending GM tweet...`);
      const result = await this._xClient.readWrite.v2.tweet(response, {
        media: {
          media_ids: [mediaId],
        },
      });
      // save tweet date to file
      try {
        const tweetDate = new Date().toISOString();
        fs.writeFileSync(this._LAST_GM_TWEET_DATE_FILE_PATH, tweetDate);
      } catch (error) {
        this._logger.error(
          `❌ Error writing last GM tweet date to file: ${error.message}`,
        );
      }
      if (result.errors) {
        this._logger.error(
          `❌ Error sending GM tweet: ${JSON.stringify(result.errors)}`,
        );
      } else {
        this._logger.log(`✅ GM tweet sent!`);
      }
    } catch (error) {
      this._logger.error(`❌ Error sending GM tweet: ${error?.message}`);
    }
    // run again in 1 day
    const t = setTimeout(
      async () => {
        clearTimeout(t);
        await this._sayGM();
      },
      1000 * 60 * 60 * 24,
    );
  }
}
