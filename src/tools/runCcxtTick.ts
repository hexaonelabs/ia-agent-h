import * as ccxt from 'ccxt';
import { Exchange, version } from 'ccxt';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { CustomLogger } from 'src/logger.service';
import { getStoredAbstractAccount } from 'src/viem/getStoredAbstractAccount';

/**
 * The configuration for the tick strategy
 */
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
}

/**
 * The configuration for the CCXT tools
 */
export interface CCXTConfig {
  broker: string;
  walletAddress?: string;
  privateKey?: string;
}

/**
 * The response of the strategy
 * Each strategy have to return this response to be used by the bot
 */
export type CCXTStrategyResponse = Promise<{
  totalBaseBalance: number;
  totalAssetBalanceAsBaseValue: number;
  base: string;
  asset: string;
  action: 0 | 1 | -1;
}>;

/**
 * The arguments to run the CCXT tools
 * It combines the tick configuration and the CCXT configuration
 */
export type CCXTToolsArgs = TickConfig & CCXTConfig;

interface MovingAverages {
  ma14: number;
  ma20: number;
  ma50: number;
}

let bootIsRuning: NodeJS.Timeout | null = null;

const writeToFile = (
  data: {
    lastBuyPrice: number | null;
    lastHigerBuyPrice: number | null;
    lastCrossoverType: 'bullish' | 'bearish' | null;
  },
  filename: string,
) => {
  const name = 'trading_bot_' + filename.replace(':', '_').replace('/', '_');
  const formattedName = name.includes('.json') ? name : `${name}.json`;
  // ensure folder exist
  const dir = dirname(join(process.cwd(), 'public', 'logs'));
  mkdirSync(dir, { recursive: true });
  // save data to file
  const path = join(process.cwd(), 'public', 'logs', formattedName);
  writeFileSync(path, JSON.stringify(data), 'utf8');
};
const getFromFile = (
  filename: string,
): {
  lastBuyPrice: number | null;
  lastHigerBuyPrice: number | null;
  lastCrossoverType: 'bullish' | 'bearish' | null;
} => {
  const name = 'trading_bot_' + filename.replace(':', '_').replace('/', '_');
  const formattedName = name.includes('.json') ? name : `${name}.json`;
  const path = join(process.cwd(), 'public', 'logs', formattedName);
  try {
    const data = readFileSync(path, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {
      lastBuyPrice: null,
      lastHigerBuyPrice: null,
      lastCrossoverType: null,
    };
  }
};

async function calculateMovingAverages(
  ohlcv: any[],
  periods: number[] = [14, 20, 50],
): Promise<MovingAverages> {
  const closePrices = ohlcv.map((candle) => candle[4]); // Prix de clôture
  const mas = periods.map((period) => {
    return {
      period,
      value:
        closePrices.slice(-period).reduce((sum, price) => sum + price, 0) /
        period,
    };
  });
  return mas.reduce((acc, ma) => {
    acc[`ma${ma.period}`] = ma.value;
    return acc;
  }, {} as MovingAverages);
}

const marketMomentumStrategy = async (
  config: CCXTToolsArgs & { tickInterval: number },
  exchange: Exchange,
): CCXTStrategyResponse => {
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
  let action: 0 | 1 | -1 = 0;
  if (!config.privateKey) {
    logger.log(
      '🚨 Running in dry mode. No orders will be placed you have to provide privateKey to place orders',
    );
  }
  if (shouldSell && config.privateKey) {
    // Place a sell order
    logger.log(`📉 Place a Sell order: ${sellVolume} ${asset}`);
    await exchange.createOrder(market, 'limit', 'sell', sellVolume, sellPrice);
    action = -1;
  }
  if (souldBuy && config.privateKey) {
    // Place a buy order
    logger.log(`📈 Place a Buy order ${buyVolume} ${asset}`);
    await exchange.createOrder(market, 'limit', 'buy', buyVolume, buyPrice);
    action = 1;
  }
  logger.log(
    `✅ Done! Tick completed for ${market} market. Waiting for next tick in ${config.tickInterval}ms ...`,
  );
  const balance = await exchange.fetchBalance();
  const totalBaseBalance = balance.total[base];
  const totalAssetBalanceAsBaseValue = balance.total[asset] * ticker.bid;
  const response = {
    totalBaseBalance,
    totalAssetBalanceAsBaseValue,
    base,
    asset,
    action,
  };
  return response;
};

/**
 * Strategy to trade using Moving Averages and price action
 * Backtested with:
 *  - BTC/USDC market
 *  - HyperLiquid Broker
 *  - 0.3 allocation
 *  - 1h timeframe
 *  - 1h tick interval
 *  - 6 months historical data (August 2024 to February 2025)
 * Results: ~ +70% PnL
 *
 * @param config
 * @param exchange
 * @param isBackTest
 * @returns
 */
const mmaBulishStrategy = async (
  config: TickConfig & {
    timeframe?: string;
    privateKey?: string;
    tickInterval: number;
  },
  exchange: Pick<
    Exchange,
    | 'fetchBalance'
    | 'fetchOHLCV'
    | 'createMarketBuyOrder'
    | 'createMarketSellOrder'
  >,
  isBackTest: boolean = false,
): CCXTStrategyResponse => {
  const logger = new CustomLogger(isBackTest ? 'CCXT Backtest' : 'CCXT');
  const { asset, base, timeframe } = config;
  const market = `${asset}/${base}:${base}`;
  const mmaTimeframe = timeframe ?? '1h';
  // eslint-disable-next-line prefer-const
  let { lastBuyPrice, lastHigerBuyPrice, lastCrossoverType } = getFromFile(
    isBackTest ? `_backtest_` + market : market,
  );
  try {
    // logger.log(`👨‍💻 Calculate positions for ${market} market using strategy...`);
    // Récupération des données OHLCV
    if (!isBackTest) {
      logger.log(`=======================================`);
      logger.log(`📄 Trading with the following parametters:`);
      logger.log(`📈 Market: ${market}`);
      logger.log(`🕒 Timeframe: ${mmaTimeframe}`);
      logger.log(`🔍 Fetching last 50 candles...`);
    }
    const ohlcv = await exchange.fetchOHLCV(
      market,
      mmaTimeframe,
      undefined,
      50,
    );
    if (ohlcv.length === 0) {
      throw new Error('No historical data available for the given period.');
    }
    if (!isBackTest) {
      logger.log(`📊 Calculating moving averages for ${market} market...`);
    }
    const { ma14, ma20, ma50 } = await calculateMovingAverages(ohlcv);
    const currentPrice = ohlcv[ohlcv.length - 1][4];
    const currentDate = new Date(
      ohlcv[ohlcv.length - 1][0],
    ).toLocaleDateString();
    // Vérification du portfolio
    const balance = await exchange.fetchBalance();
    // logger.log(`💰 Wallet Balance: ${JSON.stringify(balance)}`);
    const baseBalance = balance?.[base]?.free ?? 0;
    const assetBalance = balance?.[asset]?.free ?? 0;
    // is current price spread lower than last buy price
    const isCurrentPriceLowerUsingSpreadThanLastBuyPrice = lastBuyPrice
      ? lastBuyPrice - lastBuyPrice * config.spread > currentPrice
      : true;
    if (!config.privateKey) {
      logger.log(
        '🚨 Running in dry mode. No orders will be placed you have to provide privateKey to place orders',
      );
    }
    // display collected data
    if (!isBackTest) {
      logger.log(`📈 Current Price: ${currentPrice}`);
      logger.log(`📈 MA20: ${ma20}`);
      logger.log(`📈 MA50: ${ma50}`);
      logger.log(`📅 Date: ${currentDate}`);
      logger.log(
        `💰 Portfolio: ${baseBalance} ${base} | ${assetBalance} ${asset}`,
      );
      logger.log(`📊 Last buy price: ${lastBuyPrice}`);
      logger.log(`📊 Last higher buy price: ${lastHigerBuyPrice}`);
      logger.log(`📊 Last crossover type: ${lastCrossoverType}`);
      logger.log(`📊 is current price >= ma20: ${currentPrice >= ma20}`);
      logger.log(`📊 is ma14 >= ma20: ${ma14 >= ma20}`);
      logger.log(`📊 is base balance > 0: ${baseBalance > 0}`);
      logger.log(
        `📊 is current price lower than previous buy more than ${config.spread}%: ${isCurrentPriceLowerUsingSpreadThanLastBuyPrice}`,
      );
    }
    let action: -1 | 0 | 1 = 0; // 0: no action, 1: buy, -1: sell
    switch (true) {
      // Bullish cross (buy)
      case currentPrice >= ma20 &&
        currentPrice <= (lastBuyPrice || currentPrice) &&
        ma14 >= ma20 &&
        isCurrentPriceLowerUsingSpreadThanLastBuyPrice &&
        baseBalance > 0 &&
        baseBalance * config.allocation > 10: {
        const amountToBuy = baseBalance * config.allocation; // X% Base portfolio
        const assetBought = amountToBuy / currentPrice;
        logger.log(
          `📈 [${currentDate}] Buy at ${currentPrice.toFixed(2)} | Bought ${assetBought.toFixed(
            4,
          )} ${asset} | - ${amountToBuy.toFixed(2)} ${base}`,
        );
        if (config.privateKey) {
          await exchange.createMarketBuyOrder(market, assetBought);
        }
        // update last values
        action = 1;
        lastCrossoverType = 'bullish';
        lastBuyPrice = currentPrice;
        lastHigerBuyPrice =
          currentPrice > (lastHigerBuyPrice || 0)
            ? currentPrice
            : lastHigerBuyPrice;
        break;
      }
      // bearish cross (sell)
      case (lastHigerBuyPrice ?? currentPrice) <= currentPrice &&
        currentPrice < ma50 &&
        lastCrossoverType !== 'bearish' &&
        assetBalance > 0: {
        if (config.privateKey) {
          const amountToSell =
            assetBalance *
            (config.allocation * 5 >= 1 ? 1 : config.allocation * 5); // X%  portfolio asset
          const baseGained = amountToSell * currentPrice;
          logger.log(
            `📉 [${currentDate}] Sell at ${currentPrice.toFixed(2)} | Sold ${amountToSell.toFixed(
              4,
            )} ${asset} | Gained ${baseGained.toFixed(2)} ${base}`,
          );
          await exchange.createMarketSellOrder(market, amountToSell);
        }
        // update last values
        action = -1;
        lastCrossoverType = 'bearish';
        lastBuyPrice = null;
        break;
      }
      default:
        action = 0;
        if (!isBackTest) {
          logger.log(`📊 No action for ${market} market.`);
        }
        break;
    }
    const totalBaseBalance =
      assetBalance * ohlcv[ohlcv.length - 1][4] + baseBalance;
    const totalAssetBalanceAsBaseValue =
      assetBalance * ohlcv[ohlcv.length - 1][4];
    if (!isBackTest) {
      logger.log(`📊 Portfolio:`);
      logger.log(`💰 Total ${base} Balance: ${totalBaseBalance}`);
      logger.log(`💰 Total ${asset} Balance: ${totalAssetBalanceAsBaseValue}`);
      logger.log(
        `💰 Total Balance: ${(totalBaseBalance + totalAssetBalanceAsBaseValue).toFixed(2)}`,
      );
      logger.log(`Run tick in ${config.tickInterval}ms`);
      logger.log(`=======================================`);
    }
    // save last values
    writeToFile(
      {
        lastBuyPrice,
        lastHigerBuyPrice,
        lastCrossoverType,
      },
      isBackTest ? `_backtest_` + market : market,
    );
    const response = {
      totalBaseBalance,
      totalAssetBalanceAsBaseValue,
      base,
      asset,
      action,
    };
    return response;
  } catch (error) {
    logger.error(`Error: ${error.message}`);
  }
};

const TRADING_STRATEGIES = {
  mmaBulishStrategy,
  marketMomentumStrategy,
};

const initCCXT = async (config: CCXTToolsArgs) => {
  const logger = new CustomLogger('CCXT');
  logger.log(`ℹ️  Initializing v${version} trading bot `);
  // Check if wallet address and private key are provided
  // If not, try to get them from the stored account
  if (!config.walletAddress && !config.privateKey) {
    const account = getStoredAbstractAccount(config.broker);
    config.walletAddress = account.address;
    config.privateKey = account.privateKey;
  }
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
  return {
    exchange,
    logger,
  };
};

/**
 * 
 * @param config 
 * @returns 
 * @example
 * ```
 *  const config: CCXTToolsArgs = {
      asset: 'BTC',
      base: 'USDC',
      allocation: 0.1,
      spread: 0.1,
      tickInterval: 1 * 60 * 60 * 1000,
      broker: 'hyperliquid',
    };
    await runCCXTTick(config);

  ```
  Read more on the documentation and Github: 
  https://docs.ccxt.com/#/exchanges/hyperliquid
  https://github.com/ccxt/ccxt/blob/master/ts/src/test/tests.ts
 */
export const runCCXTBot = async (
  config: CCXTToolsArgs & { tickInterval: number },
) => {
  const { exchange, logger } = await initCCXT(config);
  // exchange.verbose = true;
  logger.log(`⚙ Running bot with config: 
    Market: ${config.asset}/${config.base}
    Broker: HyperLiqud
    Allocation: ${config.allocation}
    Spread: ${config.spread}
    Tick interval: ${config.tickInterval}ms
  `);
  if (bootIsRuning) {
    const message = '❌ Bot is already running';
    logger.error(message);
    return { success: false, message, data: null };
  }
  // execute backtest before running the bot
  const backtestResult = await backtest(
    config,
    exchange,
    TRADING_STRATEGIES.mmaBulishStrategy,
  );
  if (backtestResult.totalTrades <= 0 || backtestResult.pnlPercentage <= 5) {
    throw new Error(
      `Backtest failed. Please check the strategy: ${backtestResult}`,
    );
  }
  // execute strategy
  if (config.tickInterval > 0) {
    logger.log(`🚀 Starting bot with interval of ${config.tickInterval}ms`);
    bootIsRuning = setInterval(
      async () => await TRADING_STRATEGIES.mmaBulishStrategy(config, exchange),
      config.tickInterval,
    );
    await TRADING_STRATEGIES.mmaBulishStrategy(config, exchange);
  } else {
    logger.log('🚀 Running bot once');
    await TRADING_STRATEGIES.mmaBulishStrategy(config, exchange);
    bootIsRuning = null;
  }
  return {
    success: true,
    message: '✅ Bot is running',
    data: backtestResult,
  };
};

export const stopCCXTBot = () => {
  // eslint-disable-next-line prefer-const
  if (bootIsRuning) {
    clearInterval(bootIsRuning);
    bootIsRuning = null;
    return {
      success: true,
      message: '✅ Bot is stopped',
    };
  }
  return {
    success: false,
    message: '❌ Bot is not running',
  };
};

export const backtestBot = async (
  config: CCXTToolsArgs & { tickInterval: number },
) => {
  const { exchange } = await initCCXT(config);
  const backtestResult = await backtest(
    config,
    exchange,
    TRADING_STRATEGIES.mmaBulishStrategy,
  );
  return {
    success: true,
    message: '✅ Backtest completed',
    data: backtestResult,
  };
};

const backtest = async (
  config: TickConfig & { timeframe?: string },
  exchange: Exchange,
  strategy: (
    config: TickConfig,
    exchange: Pick<
      Exchange,
      | 'fetchBalance'
      | 'fetchOHLCV'
      | 'createMarketBuyOrder'
      | 'createMarketSellOrder'
    >,
    isBackTest: boolean,
  ) => Promise<{ action: number }>,
) => {
  const logger = new CustomLogger('CCXT Backtest');
  logger.log(`🔍 Running backtest for ${config.asset}/${config.base} market`);
  const { asset, base, timeframe } = config;
  const market = `${asset}/${base}:${base}`;
  const mmaTimeframe = timeframe ?? '1h';
  const now = Date.now();
  const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000; // Approximation : 6 mois en millisecondes
  const ohlcv = await exchange.fetchOHLCV(market, mmaTimeframe, sixMonthsAgo);

  if (ohlcv.length === 0) {
    throw new Error('No historical data available for the given period.');
  }
  const INITIAL_BASE_BALANCE = 1000;
  let baseBalance = INITIAL_BASE_BALANCE;
  let assetBalance = 0;
  let totalTrades = 0;
  // Boucle sur chaque bougie pour simuler la stratégie
  for (let i = 50; i < ohlcv.length; i++) {
    const { action } = await strategy(
      config,
      {
        fetchBalance: async () => {
          return {
            total: { total: baseBalance },
            [base]: { free: baseBalance },
            [asset]: { free: assetBalance },
          } as any;
        },
        fetchOHLCV: async () => {
          return ohlcv.slice(i - 50, i);
        },
        createMarketBuyOrder: async (...args) => {
          const amount = args[1];
          const price = ohlcv[i][4];
          const cost = amount * price;
          baseBalance -= cost;
          assetBalance += amount;
          return {} as any;
        },
        createMarketSellOrder: async (...args) => {
          const amount = args[1];
          baseBalance += amount * ohlcv[i][4];
          assetBalance -= amount;
          return {} as any;
        },
      },
      true,
    );
    if (action !== 0) {
      totalTrades++;
    }
  }
  // reset backtest logs
  writeToFile(
    {
      lastBuyPrice: null,
      lastHigerBuyPrice: null,
      lastCrossoverType: null,
    },
    `_backtest_` + market,
  );
  // Backtest results
  const totalAssetBalanceAsBaseValue =
    assetBalance * ohlcv[ohlcv.length - 1][4];
  const totalBalance = totalAssetBalanceAsBaseValue + baseBalance;
  const pnl = totalBalance - INITIAL_BASE_BALANCE;
  const pnlPercentage = (pnl / INITIAL_BASE_BALANCE) * 100;
  logger.log('📊 Backtest Results:');
  logger.log(`Total Trades: ${totalTrades}`);
  logger.log(`PnL: ${pnl.toFixed(2)} ${base} (${pnlPercentage.toFixed(2)}%)`);
  logger.log(
    `Final Balance: ${totalBalance.toFixed(2)} ${base} (${assetBalance.toFixed(4)} ${asset} + ${baseBalance.toFixed(2)} ${base}) `,
  );
  return {
    totalTrades,
    totalBalance,
    pnlPercentage,
    assetBalance,
    baseBalance,
  };
};

export const fetchFutures = async () => {
  const exchange = new ccxt.hyperliquid({
    enableRateLimit: true,
  });
  exchange.markets = await exchange.loadMarkets(true);
  for (const symbol in exchange.markets) {
    console.log('----------------------------------------------------');
    console.log(`symbol = ${symbol}`);
    try {
      const market = exchange.markets[symbol];
      if (market['future']) {
        const ticker = await exchange.fetchTicker(symbol);
        console.log('----------------------------------------------------');
        console.log(symbol, ticker);
        const CCXT = ccxt as any;
        await CCXT?.sleep(exchange.rateLimit); // Missing type information.
      }
    } catch (error) {
      console.log('error =', error);
    }
  }
};

/**
 * Tool to execute Execute a trading tick using the CCXT library
 * @param config
 */
export const runCCXTTick = async (
  config: CCXTToolsArgs & {
    orderType: 'buy' | 'sell';
  },
) => {
  const { exchange, logger } = await initCCXT(config);
  const { asset, base, orderType } = config;
  const market = `${asset}/${base}:${base}`;
  const ticker = await exchange.fetchTicker(market);
  const balances = await exchange.fetchBalance();
  const assetBalance: number = balances.free[asset] || 0;
  const baseBalance: number = balances.free[base] || 0;
  const sellPrice = ticker.bid;
  const buyPrice = ticker.ask;
  const sellVolume = assetBalance;
  const buyVolume = baseBalance / buyPrice;
  logger.log(`⚙ Running tick for ${market} market`);
  logger.log(`📄 Resume trading with the following positions:
  Asset balance: ${assetBalance}
  Base balance: ${baseBalance}
  Selling order: ${sellVolume} ${asset} at ${sellPrice}
  Buying order ${buyVolume} ${asset} at ${buyPrice}
  `);
  if (orderType === 'sell') {
    logger.log(`📉 Place a Sell order: ${sellVolume} ${asset}`);
    await exchange.createOrder(market, 'limit', 'sell', sellVolume, sellPrice);
  } else {
    logger.log(`📈 Place a Buy order ${buyVolume} ${asset}`);
    await exchange.createOrder(market, 'limit', 'buy', buyVolume, buyPrice);
  }
  logger.log('✅ Done! Tick completed');
  const balance = await exchange.fetchBalance();
  return {
    success: true,
    message: '✅ Tick completed',
    data: {
      balance,
      orderType,
      orderAmount: orderType === 'sell' ? sellVolume : buyVolume,
      orderPrice: orderType === 'sell' ? sellPrice : buyPrice,
      market,
    },
  };
};
