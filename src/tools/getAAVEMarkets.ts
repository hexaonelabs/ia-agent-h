import * as MARKETS from '@bgd-labs/aave-address-book';
import { getNetworkByName } from 'src/utils';

interface GetAAVEMarketsArgs {
  networkName: string;
}
export const getAAVEMarkets = async (
  args: GetAAVEMarketsArgs,
): Promise<
  {
    symbol: string;
    tokenAddress: string;
  }[]
> => {
  const chain = getNetworkByName(args.networkName);
  if (!chain) {
    throw new Error('Invalid chainId');
  }
  let selectedMarket;
  // lookup into MARKETS object to find the markets that have `CHAIN_ID` equal to the chainId
  for (const key in MARKETS) {
    if (Object.prototype.hasOwnProperty.call(MARKETS, key)) {
      const market = MARKETS[key];
      if (market.CHAIN_ID === chain.id) {
        selectedMarket = market;
        break;
      }
    }
  }
  if (!selectedMarket) {
    throw new Error('No markets found');
  }
  const market = selectedMarket || MARKETS.AaveV3Sepolia;
  const tokens = [];
  for (const key in market.ASSETS) {
    if (Object.prototype.hasOwnProperty.call(market.ASSETS, key)) {
      const token = market.ASSETS[key];
      const tokenData = {
        symbol: key,
        tokenAddress: token.UNDERLYING,
        aToken: token.A_TOKEN,
      };
      tokens.push(tokenData);
    }
  }
  return tokens;
};
