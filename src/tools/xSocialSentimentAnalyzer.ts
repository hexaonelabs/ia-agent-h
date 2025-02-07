import axios, { AxiosResponse } from 'axios';
import Sentiment from 'sentiment';
import { CustomLogger } from 'src/logger.service';

interface Tweet {
  text: string;
  retweet_count: number;
  favorite_count: number;
}

interface TrendData {
  tweetCount: number;
  averageSentiment: number;
  totalEngagement: number;
}

export interface Trends {
  [keyword: string]: TrendData;
}

const analyzeSentiment = (text: string): number => {
  return new Sentiment().analyze(text).score;
};

const getTwitterAccessToken = async (): Promise<string> => {
  const response: AxiosResponse = await axios.post(
    'https://api.twitter.com/oauth2/token',
    'grant_type=client_credentials',
    {
      auth: {
        username: process.env.TWITTER_USERNAME,
        password: process.env.TWITTER_PASSWORD,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    },
  );
  return response.data.access_token;
};

const searchTweets = async (keyword: string, accessToken: string) => {
  const response: AxiosResponse = await axios.get(
    'https://api.twitter.com/1.1/search/tweets.json',
    {
      params: {
        q: keyword,
        count: 100,
        result_type: 'recent',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data.statuses;
};

export const xSocialSentimentAnalyzer = async (args: {
  keywords: string[];
}) => {
  const logger = new CustomLogger('xSocialSentimentAnalyzer');
  logger.log(`🔍 Searching & analyze latest trends on social X...`);
  const { keywords } = args;
  const accessToken =
    process.env.TWITTER_BEARER_TOKEN || (await getTwitterAccessToken());
  const trends: Trends = {};
  for (const keyword of keywords) {
    const tweets: Tweet[] = await searchTweets(keyword, accessToken);
    let totalSentiment: number = 0;
    let totalEngagement: number = 0;

    tweets.forEach((tweet) => {
      const sentimentScore: number = analyzeSentiment(tweet.text);
      totalSentiment += sentimentScore;
      totalEngagement += tweet.retweet_count + tweet.favorite_count;
    });

    trends[keyword] = {
      tweetCount: tweets.length,
      averageSentiment: totalSentiment / tweets.length || 0,
      totalEngagement: totalEngagement,
    };
  }
  logger.log(`✅ Trends analyzed successfully! ${JSON.stringify(trends)}`);
  return { result: trends };
};
