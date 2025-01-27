import { TwitterApi } from 'twitter-api-v2';
import { CustomLogger } from '../logger.service';

export const sendPostToX = async (args: {
  message: string;
  mediaIds?: [string];
}) => {
  const { message, mediaIds = [] } = args;
  const logger = new CustomLogger(sendPostToX.name);
  const xClient = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
  // send tweet
  logger.log(`✉️  Sending tweet post...`);
  const media =
    mediaIds.length > 0 ? { media_ids: mediaIds as [string] } : undefined;
  const result = await xClient.readWrite.v2.tweet(message, {
    media,
  });
  logger.log(`✅ Tweet sent!`);
  return result;
};
