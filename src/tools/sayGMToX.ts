import * as dayjs from 'dayjs';
import * as fs from 'fs';
import * as p from 'path';
import { CustomLogger } from 'src/logger.service';
import { getTimeDifference } from './getTimeDifference';
import { sendPostToX } from './sendPostToX';
import { TwitterApi } from 'twitter-api-v2';

const REPLYED_TWEET_DATE_FILE_PATH = p.join(
  process.cwd(),
  'public',
  'logs',
  'last_replied_tweet_date.log',
);
const LAST_GM_TWEET_DATE_FILE_PATH = p.join(
  process.cwd(),
  'public',
  'logs',
  'last_gm_tweet_date.log',
);
const IMGS_DIRECTORY_PATH = p.join(
  process.cwd(),
  'public',
  'images',
  'h-medias',
  'square',
);
// ensure that the `_LAST_GM_TWEET_DATE_FILE_PATH` file exist
if (!fs.existsSync(LAST_GM_TWEET_DATE_FILE_PATH)) {
  fs.writeFileSync(LAST_GM_TWEET_DATE_FILE_PATH, '');
}
// ensure that the `IMGS_DIRECTORY_PATH` directory exist
if (!fs.existsSync(IMGS_DIRECTORY_PATH)) {
  fs.mkdirSync(IMGS_DIRECTORY_PATH, { recursive: true });
}
if (!fs.existsSync(REPLYED_TWEET_DATE_FILE_PATH)) {
  fs.writeFileSync(REPLYED_TWEET_DATE_FILE_PATH, '');
}

export const sayGMToX = async (args: { message: string }) => {
  const { message } = args;
  const logger = new CustomLogger(sayGMToX.name);
  const lastGMTwwetDate = fs
    .readFileSync(p.join(LAST_GM_TWEET_DATE_FILE_PATH), 'utf-8')
    .trim();
  logger.log(`📅 Last GM tweet date: ${lastGMTwwetDate}`);
  const diffDay = dayjs().diff(dayjs(lastGMTwwetDate), 'day');
  if (diffDay < 1) {
    const msUntilNexDay = dayjs(lastGMTwwetDate).add(1, 'day').diff(dayjs());
    logger.log(
      `🌞 Good Morning tweet already sent today! Wait ${getTimeRemaining(msUntilNexDay)} for next post...`,
    );
    // run again in 1 day
    const timestamp = await getTimeDifference({
      diffHours: dayjs(lastGMTwwetDate).add(1, 'day').diff(dayjs(), 'hours'),
      diffMinutes: dayjs(lastGMTwwetDate)
        .add(1, 'day')
        .diff(dayjs(), 'minutes'),
      diffSeconds: dayjs(lastGMTwwetDate)
        .add(1, 'day')
        .diff(dayjs(), 'seconds'),
    });
    const prompt = `Generate and send a tweet based on the trend of #GM using "say_gm_to_x" tool. You tweet should start with "GM web3 Degen!"; "GM web3 family!"; "GM web3 community!"; "GM web3 friends!"; "GM web3 homies!"; "GM web3 squad!"; "GM web3 gang!"; "GM web3 team!"; "GM web3 crew!"; "GM web3 fam!"; fowllowed by a short funny positive message about the current crypto ia agent trends OR upcoming benefits of be a part of crypto family. The tweet should not include any hashtags, links or mentions and no special caracters like symbols or quotes.`;
    return `execute tool call "plan_execution" with the following args: 
    - prompt: ${prompt} 
    - timestamp: ${timestamp}`;
  }
  // send GM tweet
  // disable on development mode
  logger.log(`🌞 Saying Good Morning is disable on development mode`);
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  logger.log(`🌞 Saying Good Morning...`);
  // get random media from `public/images/square` directory
  const directoryPath = IMGS_DIRECTORY_PATH;
  logger.log(`📂 Reading images from ${directoryPath}...`);
  const filesCount = fs.readdirSync(directoryPath).length;
  logger.log(`🔍  Found ${filesCount} images`);
  if (filesCount === 0) {
    logger.log(`✉️  Sending GM tweet without media...`);
    const result = await sendPostToX({
      message,
    });
    return result;
  }
  // random number between 0 and filesCount
  logger.log(`🎲 Selecting random image...`);
  const randomIndex = Math.floor(Math.random() * filesCount);
  const filePath = fs.readdirSync(directoryPath)[randomIndex];
  const imagePath = p.join(directoryPath, filePath);
  logger.log(`🖼️ Selected image: ${filePath}`);
  // upload image
  logger.log(`📤 Uploading image to twitter...`);
  const xClient = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
  const mediaId = await xClient.v1.uploadMedia(imagePath);
  // send tweet
  logger.log(`✉️  Sending GM tweet with media...`);
  const result = await sendPostToX({
    message,
    mediaIds: [mediaId],
  });
  return result;
};

const getTimeRemaining = (milliseconds: number): string => {
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
};
