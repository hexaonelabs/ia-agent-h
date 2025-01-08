import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { assistantPrompt } from '../const/prompt';
import { TweetV2, TwitterApi } from 'twitter-api-v2';
import * as dayjs from 'dayjs';

@Injectable()
export class XAgentService {
  private readonly _client: OpenAI;
  private readonly _xClient: TwitterApi;
  private readonly _mentionsToReply: Record<string, TweetV2> = {};

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
    const currentUser = await rwClient.currentUser();
    console.log(
      `[XAgent] ${dayjs().format()} 👤 IA Agent is connected as @${currentUser.screen_name}`,
    );
    await this._mentionsMonitoring();
  }

  private async _mentionsMonitoring() {
    const TIMEOUT = 60 * 5 * 1000;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let t;
    try {
      const userId = process.env.TWITTER_ACCOUNT_ID;
      const rwClient = this._xClient.readWrite;
      await delay(10000);
      console.log(`[XAgent] ${dayjs().format()} 🔍 Searching for mentions...`);
      // check if agent have existing pending mentions to reply
      const pendingMentions = Object.values(this._mentionsToReply);
      // get mentions from API if no pending mentions
      const mentions =
        pendingMentions.length > 0
          ? Object.values(this._mentionsToReply)
          : await this._xClient.readOnly.v2
              .userMentionTimeline(userId)
              .then((m) => {
                for (const mention of m) {
                  this._mentionsToReply[mention.id] = mention;
                }
                return Object.values(this._mentionsToReply);
              });
      await delay(5000);
      for (const mention of mentions) {
        if (mention.text.includes(process.env.TWITTER_USERNAME)) {
          console.log(
            `[XAgent] ${dayjs().format()} 🛎 Found Mention with post ID: ${mention.id}:`,
            mention,
          );
          console.log(
            `[XAgent] ${dayjs().format()} ⌛ Loading tweet details...`,
          );
          // get tweet details to find author_id
          const tweetDetails = await rwClient.v2.singleTweet(mention.id, {
            expansions: ['author_id'],
          });
          await delay(5000);
          const authorId = tweetDetails.data.author_id;
          console.log(`[XAgent] ${dayjs().format()} ⌛ User details...`);
          // get user details from author_id
          const user = await rwClient.v2.user(authorId);
          const userName = user.data.name;
          await delay(5000);
          console.log(
            `[XAgent] ${dayjs().format()} ⌛ filtering mention without reply...`,
          );
          // check if the tweet already has a response from the current user
          const currentUser = await rwClient.currentUser();
          const replies = await rwClient.v2.search(
            `to:${currentUser.screen_name} conversation_id:${mention.id}`,
          );
          const hasReplied = replies?.data?.data?.some(
            (reply) => reply.author_id === userId,
          );
          if (!hasReplied) {
            const iaResponse = await this._generateResponse(mention.text);
            const response = `@${userName} ${iaResponse}`;
            console.log(
              `[XAgent] ${dayjs().format()} 📣 Responding to @${userName}: ${iaResponse}`,
            );
            await rwClient.v2.reply(response, mention.id);
            console.log(
              `[XAgent] ${dayjs().format()} ✅ Replied to @${userName}`,
            );
            // remove mention from pending mentions
            delete this._mentionsToReply[mention.id];
          }
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
        max_tokens: 150,
        messages: [
          { role: 'system', content: assistantPrompt },
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

    return `${duration} minutes`;
  }
}
