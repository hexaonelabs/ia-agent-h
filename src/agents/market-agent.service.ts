import { Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';
import OpenAI from 'openai';
import { getMarketDataTool, IMarketData } from '../tools/getMarketData';

@Injectable()
export class MarketAgentService {
  private readonly _client: OpenAI;

  constructor(client: OpenAI) {
    this._client = client;
  }

  async start() {
    console.log(`[MarketAgent] ${dayjs().format()} 🚀 Starting IA Agent...`);
    await this._monitoring();
  }

  private async _monitoring() {
    const TIMEOUT = 60 * 30 * 1000;
    // request coin market data every 30 minutes
    console.log(`[MarketAgent] ${dayjs().format()} 🔄 Fetching market data...`);
    const response = await getMarketDataTool.handler({
      ticker: 'BTC',
      forceRefresh: false,
    });
    try {
      const marketData: IMarketData = JSON.parse(response)?.[0];
      // build a message to send to the user
      const message = `The current price of ${marketData.name} is $${marketData.current_price} USD with a 24h change of ${marketData.price_change_percentage_24h}%`;
      // send the message to the user
      console.log(`[MarketAgent] ${dayjs().format()} 📈 ${message}`);
    } catch (error) {
      console.error(
        `[MarketAgent] ${dayjs().format()} ❌ Error: ${error.message}`,
      );
    }
    setTimeout(() => {
      this._monitoring();
    }, TIMEOUT);
  }
}
