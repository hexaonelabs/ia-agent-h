import axios from 'axios';
import { ToolConfig } from '.';

interface GetMarketDataArgs {
  ticker: string;
  forceRefresh?: boolean;
}

interface IMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: Date;
  atl: number;
  atl_change_percentage: number;
  atl_date: Date;
  roi: any;
  last_updated: Date;
}

let cachedCoins: any[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const getMarketDataTool: ToolConfig<GetMarketDataArgs> = {
  definition: {
    type: 'function',
    function: {
      strict: true,
      name: 'get_market_data',
      description: `Get the current market data for a cryptocurrency using ticker symbol to request Coingecko API.
      `,
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description:
              'The ticker symbol of the cryptocurrency to get market data for',
          },
        },
        required: ['ticker'],
        additionalProperties: false,
      },
    },
  },
  handler: async ({ ticker, forceRefresh }): Promise<string> => {
    const coinId = await getCoinIdFromTicker(ticker, forceRefresh);
    if (!coinId) {
      throw new Error(`Coin ID not found for ticker: ${ticker}`);
    }
    const data = await getMarketData(coinId);
    return JSON.stringify(data);
  },
};

async function getCoinIdFromTicker(
  ticker: string,
  forceRefresh: boolean,
): Promise<string | null> {
  if (
    !forceRefresh &&
    cachedCoins &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_DURATION
  ) {
    const coin = cachedCoins.find(
      (c: any) => c.symbol.toLowerCase() === ticker.toLowerCase(),
    );
    return coin ? coin.id : null;
  }

  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/list',
    );
    cachedCoins = response.data;
    cacheTimestamp = Date.now();
    const coin = cachedCoins.find(
      (c: any) => c.symbol.toLowerCase() === ticker.toLowerCase(),
    );
    return coin ? coin.id : null;
  } catch (error) {
    console.error('Error fetching coin list:', error);
    throw new Error('Failed to fetch coin list');
  }
}

async function getMarketData(coinId: string): Promise<IMarketData> {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/markets`,
      {
        params: {
          vs_currency: 'usd',
          ids: coinId,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw new Error('Failed to fetch market data');
  }
}
