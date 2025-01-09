import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { assistantPrompt, xAgentPrompt } from '../const/prompt';
import { TweetV2, TwitterApi, UserV1 } from 'twitter-api-v2';
import * as dayjs from 'dayjs';
import * as fs from 'fs';
import * as p from 'path';

@Injectable()
export class XAgentService {
  private readonly _client: OpenAI;
  private readonly _xClient: TwitterApi;
  private readonly _mentionsToReply: Record<string, TweetV2> = {};
  private _currentUser: UserV1 | undefined = undefined;
  // file located to root `public` directory
  private readonly _REPLYED_TWEET_IDS_FILE_PATH = p.join(
    process.cwd(),
    'public',
    'replied_tweet_ids.json',
  );

  constructor(client: OpenAI) {
    this._client = client;
    console.log(`[XAgent] ${dayjs().format()} 🏗  Building Twitter client...`);
    this._xClient = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    console.log(`[XAgent] ${dayjs().format()} ℹ️  Twitter client ready!`);
  }

  async start() {
    console.log(`[XAgent] ${dayjs().format()} 🚀 Starting IA Agent...`);
    const rwClient = this._xClient.readWrite;
    await rwClient.appLogin();
    this._currentUser = await rwClient.currentUser();
    console.log(
      `[XAgent] ${dayjs().format()} 👤 IA Agent is connected as @${this._currentUser?.screen_name}`,
    );
    // ensure that the `_REPLYED_TWEET_IDS_FILE_PATH` file exist
    if (!fs.existsSync(this._REPLYED_TWEET_IDS_FILE_PATH)) {
      fs.writeFileSync(this._REPLYED_TWEET_IDS_FILE_PATH, '');
    }
    await this._mentionsMonitoring();
  }

  private async _mentionsMonitoring() {
    const TIMEOUT = 60 * 5 * 1000;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let t;
    try {
      // const userId = process.env.TWITTER_ACCOUNT_ID;
      const rwClient = this._xClient.readWrite;
      await delay(10000);

      console.log(`[XAgent] ${dayjs().format()} 🔍 Searching for mentions...`);
      // check if agent have existing pending mentions to reply
      const pendingMentions = Object.values(this._mentionsToReply);
      // get mentions from API if no pending mentions
      const response =
        pendingMentions.length > 0
          ? Object.values(this._mentionsToReply)
          : await this._xClient.readOnly.v2
              .search({
                query: `${process.env.TWITTER_USERNAME} -is:reply -is:retweet`,
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
      // const response = await rwClient.v2.search({
      //   query: `${process.env.TWITTER_USERNAME} -is:reply -is:retweet`,
      //   'tweet.fields': ['author_id', 'created_at', 'referenced_tweets'],
      //   expansions: [
      //     'author_id',
      //     'in_reply_to_user_id',
      //     'referenced_tweets.id',
      //   ],
      //   max_results: 10,
      // });
      console.log(
        `[XAgent] ${dayjs().format()} 📦 Received ${response?.length} mentions`,
      );
      console.log(
        `[XAgent] ${dayjs().format()} 🧹 Exclude mentions already replyed...`,
      );
      // load file with tweet ids already replied
      const repliedTweetsResponse = fs.readFileSync(
        p.join(this._REPLYED_TWEET_IDS_FILE_PATH),
        'utf-8',
      );
      // convert csv to Array
      const repliedTweets = repliedTweetsResponse.split(',');
      // exclude already replied tweets
      const mentions = response.filter(
        (mention: any) => !repliedTweets.includes(mention.id),
      );
      // loop over mentions
      for (const mention of mentions) {
        if (mention.text.includes(process.env.TWITTER_USERNAME)) {
          console.log(
            `[XAgent] ${dayjs().format()} 🛎 Found Mention with post ID: ${mention.id}`,
          );
          const response = await this._generateResponse(mention.text);
          console.log(
            `[XAgent] ${dayjs().format()} 📣 Responding to mention ID ${mention.id}: ${response}`,
          );
          await rwClient.v2.reply(response, mention.id);
          console.log(
            `[XAgent] ${dayjs().format()} ✅ Replied to  mention ID ${mention.id}`,
          );
          // save tweet id to file
          fs.appendFileSync(
            this._REPLYED_TWEET_IDS_FILE_PATH,
            `${mention.id},`,
          );
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
      console.error(
        `[XAgent] ${dayjs().format()} ❌ Error responding to mentions:`,
        error?.data?.detail || error.message,
      );
      const limit = error?.rateLimit?.reset
        ? error?.rateLimit?.reset * 1000 - Date.now()
        : TIMEOUT;
      console.log(
        `[XAgent] ${dayjs().format()} 🕒 Retrying in approximately ${this._getTimeRemaining(limit)}`,
      );
      t = setTimeout(async () => {
        await this._mentionsMonitoring();
        clearTimeout(t);
      }, limit);
    }
  }

  private async _generateResponse(prompt: string): Promise<string> {
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
          { role: 'user', content: prompt },
        ],
      });
      return completion.choices[0].message.content || DEFAULT_RESPONSE;
    } catch (error) {
      console.error(
        `[XAgent] ${dayjs().format()} ❌ Error generating response:`,
        error.message,
      );
      return DEFAULT_RESPONSE;
    }
  }

  private _getTimeRemaining(milliseconds: number): string {
    const now = dayjs();
    const futureTime = dayjs().add(milliseconds, 'millisecond');
    const duration = futureTime.diff(now, 'minute');
    if (duration < 1) {
      return `${futureTime.diff(now, 'second')} seconds`;
    }
    return `${duration} minutes`;
  }
}
