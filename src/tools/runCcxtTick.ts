import * as ccxt from 'ccxt';
import { Exchange, version } from 'ccxt';
import { CustomLogger } from 'src/logger.service';

export interface TickConfig {
  /**
   * The asset to trade with
   * Example: BTC => BTC/USDC
   */
  asset: string;
  /**
   * The base asset to trade against
   * Example: USDC => BTC/USDC
   */
  base: string;
  /**
   * The percentage of the asset to sell or buy
   */
  allocation: number;
  /**
   * The percentage spread to use for the buy and sell orders
   * Example: 0.1 => 10%
   */
  spread: number;
  /**
   * The interval in milliseconds to run the tick
   */
  tickInterval?: number;
}

export interface CCXTConfig {
  broker: string;
  walletAddress: string;
  privateKey?: string;
}

export type CCXTToolsArgs = TickConfig & CCXTConfig;

// TODO: use variables from file config
let bootIsRuning = null;

const tick = async (config: CCXTToolsArgs, exchange: Exchange) => {
  const { asset, base, allocation, spread } = config;
  const logger = new CustomLogger('CCXT');
  logger.log(`⚙ Running tick for ${asset}/${base}:${base} market`);
  const market = `${asset}/${base}:${base}`;
  const ticker = await exchange.fetchTicker(market);
  const balances = await exchange.fetchBalance();
  // Cancel all orders
  const orders = await exchange.fetchOrders(market);
  if (orders.length > 0) {
    logger.log('🗑️ Cancelling all previous orders...');
    orders.forEach(async (order) => {
      await exchange.cancelOrder(order.id, market);
    });
    logger.log('✅ Done! Orders cancelled.');
  }
  logger.log(`👨‍💻 Calculate positions for ${market} market using strategy...`);
  // Calculate orders
  const sellPrice = ticker.bid * (1 + spread);
  const buyPrice = ticker.bid * (1 - spread);
  const accountTotalWorth =
    balances.total[base] + balances.total[asset] * ticker.bid || 0;
  const maxThreshold = 0.8;
  const assetBalance = balances.free[asset] || 0;
  const baseBalance = balances.free[base] || 0;
  const sellVolume = assetBalance * allocation;
  const buyVolume = (baseBalance * allocation) / buyPrice;
  logger.log(`📄 Resume trading with the following positions:
  Account Total Worth: ${accountTotalWorth}
  Asset balance: ${assetBalance}
  Base balance: ${baseBalance}
  Selling order: ${sellVolume} ${asset} at ${sellPrice}
  Buying order ${buyVolume} ${asset} at ${buyPrice}
  `);
  // evaluate if we should sell
  const maxThresholdValue = accountTotalWorth * maxThreshold;
  const shouldSell = sellVolume > 0;
  const souldBuy = buyVolume > 0 && assetBalance < maxThresholdValue;
  if (!config.privateKey) {
    logger.log(
      '🚨 Running in dry mode. No orders will be placed you have to provide privateKey to place orders',
    );
  }
  if (shouldSell && config.privateKey) {
    // Place a sell order
    logger.log(`📉 Place a Sell order: ${sellVolume} ${asset}`);
    await exchange.createOrder(market, 'limit', 'sell', sellVolume, sellPrice);
  }
  if (souldBuy && config.privateKey) {
    // Place a buy order
    logger.log(`📈 Place a Buy order ${buyVolume} ${asset}`);
    await exchange.createOrder(market, 'limit', 'buy', buyVolume, buyPrice);
  }
  logger.log(
    `✅ Done! Tick completed for ${market} market. Waiting for next tick in ${config.tickInterval}ms ...`,
  );
};

/**
 * 
 * @param config 
 * @returns 
 * @example
 * ```
 *  const config: TickConfig = {
      asset: 'BTC',
      base: 'USDC',
      allocation: 0.1,
      spread: 0.1,
      tickInterval: 30 * 1000,
    };
    const interval = await run(config);

  ```
  Read more on the documentation and Github: 
  https://docs.ccxt.com/#/exchanges/hyperliquid
  https://github.com/ccxt/ccxt/blob/master/ts/src/test/tests.ts
 */
export const runCCXTTick = async (config: CCXTToolsArgs) => {
  const logger = new CustomLogger('CCXT');
  logger.log(`ℹ️  Initializing v${version} trading bot `);
  if (!config.walletAddress) {
    logger.error('❌ Wallet address is required to run the bot');
    return;
  }
  logger.log(
    `✉️  Wallet address to connect with: ${config.walletAddress} on HyperLiquid`,
  );
  const CCXT = ccxt as any;
  const exchange = new CCXT[config.broker ? config.broker : 'hyperliquid']({
    enableRateLimit: true,
    walletAddress: config.walletAddress,
    privateKey: config.privateKey,
  }) as ccxt.Exchange;
  // enable testnet mode if not in production
  if (process.env.NODE_ENV !== 'production') {
    logger.log('🧪 Enabling testnet mode');
    exchange.setSandboxMode(true);
  }
  // exchange.verbose = true;
  logger.log(`⚙ Running bot with config: 
    Market: ${config.asset}/${config.base}
    Broker: HyperLiqud
    Allocation: ${config.allocation}
    Spread: ${config.spread}
    Tick interval: ${config.tickInterval}ms
  `);
  await tick(config, exchange);
  if (bootIsRuning) {
    const message = '❌ Bot is already running';
    logger.error(message);
    return { success: false, message };
  }
  if (config.tickInterval) {
    console.log(`🚀 Starting bot with interval of ${config.tickInterval}ms`);
    bootIsRuning = setInterval(
      () => tick(config, exchange),
      config.tickInterval,
    );
    return { success: true, message: '✅ Bot is running' };
  }
};

// // import asciichart from 'asciichart';
// // // import asTable from 'as-table';
// // import ololog from 'ololog';
// // import ansicolor from 'ansicolor';

// // const log = ololog.configure({ locate: false });
// // (async function main() {
// //   // experimental, not yet implemented for all exchanges
// //   // your contributions are welcome ;)

// //   const index = 4; // [ timestamp, open, high, low, close, volume ]
// //   const ohlcv = await new ccxt.okcoin().fetchOHLCV('BTC/USD', '15m');
// //   const lastPrice = ohlcv[ohlcv.length - 1][index]; // closing price
// //   const series = ohlcv.map((x) => x[index]); // closing price
// //   const bitcoinRate = ansicolor('₿ = $' + lastPrice).green;
// //   const chart = asciichart.plot(series, {
// //     height: 15,
// //     padding: '            ',
// //   });
// //   log.yellow('\n' + chart, bitcoinRate, '\n');
// //   process.exit();
// // })();
