import { getMarketData, IMarketData } from '../tools/getMarketData';
import { CustomLogger } from 'src/logger.service';

export class MarketAgent {
  private readonly _logger = new CustomLogger(MarketAgent.name);

  async start() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this._logger.log(`🚀 Starting ${MarketAgent.name} Agent...`);
    await this._monitoring();
  }

  private async _monitoring() {
    const TIMEOUT = 60 * 30 * 1000;
    // request coin market data every 30 minutes
    this._logger.log(`🔄 Fetching market data...`);
    const { result } = await getMarketData({
      ticker: 'BTC',
      forceRefresh: false,
    });
    try {
      const marketData: IMarketData = result?.[0];
      // build a message to send to the user
      const message = `The current price of ${marketData.name} is $${marketData.current_price} USD with a 24h change of ${marketData.price_change_percentage_24h}%`;
      // send the message to the user
      this._logger.log(`📈 ${message}`);
    } catch (error) {
      this._logger.error(`❌ Error: ${error.message}`);
    }
    setTimeout(() => {
      this._monitoring();
    }, TIMEOUT);
  }
}
