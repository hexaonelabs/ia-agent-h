import { ethers, providers, Wallet } from 'ethers';
import { EthereumTransactionTypeExtended, Pool } from '@aave/contract-helpers';
import {
  AaveV3Arbitrum,
  AaveV3ArbitrumSepolia,
  AaveV3Avalanche,
  AaveV3Base,
  AaveV3BNB,
  AaveV3Ethereum,
  AaveV3Gnosis,
  AaveV3Optimism,
  AaveV3Polygon,
  AaveV3Scroll,
  AaveV3Sepolia,
  AaveV3ZkSync,
} from '@bgd-labs/aave-address-book';
import { getChainById } from '../utils';
import { ConsoleLogger } from '@nestjs/common';

const createEthersProvider = (chainId: number) => {
  const chain = getChainById(chainId);
  if (!chain) {
    throw new Error('Chain not found');
  }
  const provider = new providers.JsonRpcProvider(chain.rpcUrls.default.http[0]);
  return provider;
};

const createEtherWalletClient = () => {
  const mnemonic = process.env.WALLET_MNEMONIC;
  return Wallet.fromMnemonic(mnemonic);
};

const getAAVEFullMarketData = (chainId: number) => {
  const markets = [
    AaveV3Sepolia,
    AaveV3ArbitrumSepolia,
    // mainnet,
    AaveV3Ethereum,
    AaveV3Arbitrum,
    AaveV3Avalanche,
    AaveV3BNB,
    AaveV3Base,
    AaveV3Gnosis,
    AaveV3Optimism,
    AaveV3Polygon,
    AaveV3Scroll,
    AaveV3ZkSync,
  ];
  const market = markets.find((market) => market.CHAIN_ID === chainId);
  if (!market) {
    throw new Error('Market not found');
  }
  return market;
};

export const withdrawFromAAVE = async (ops: {
  underlyingToken: string;
  aToken: string;
  amount: string;
  chainId: number;
}) => {
  const logger = new ConsoleLogger('withdrawFromAAVE - withdraw');
  const { underlyingToken, amount, aToken, chainId } = ops;
  // Create or recover wallet
  const walletClient = createEtherWalletClient();
  const provider = createEthersProvider(chainId);
  const wallet = walletClient.connect(provider);
  const user = await wallet.getAddress();
  // Initialize Pool contract
  const market = getAAVEFullMarketData(chainId);
  const pool = new Pool(wallet.provider, {
    POOL: market.POOL,
    WETH_GATEWAY: market.WETH_GATEWAY,
  });

  /*
  - @param `user` The ethereum address that will make the deposit 
  - @param `reserve` The ethereum address of the reserve 
  - @param `amount` The amount to be deposited 
  - @param `aTokenAddress` The aToken to redeem for underlying asset
  - @param @optional `onBehalfOf` The ethereum address for which user is depositing. It will default to the user address
  */
  const txs: EthereumTransactionTypeExtended[] = [];
  try {
    logger.log(
      `💰 Withdraw ${amount} unit of ${underlyingToken} token from AAVE V3 pool...`,
    );
    const temps = await pool.withdraw({
      user,
      reserve: underlyingToken,
      amount,
      aTokenAddress: aToken,
      onBehalfOf: user,
    });
    txs.push(...temps);
  } catch (error) {
    const message = error.message || error;
    throw new Error(`Error while creating transactions: ${message}`);
  }
  if (!txs.length) {
    throw new Error('No transactions to send.');
  }
  // Send transactions
  const txResponses: ethers.providers.TransactionResponse[] = [];
  try {
    for (const element of txs) {
      const extendedTxData = await element.tx();
      logger.log(`✉️ Sending transaction: ${element.txType}`);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { from, ...txData } = extendedTxData;
      const tx = await wallet.sendTransaction({
        ...txData,
        value: txData.value || undefined,
      });
      txResponses.push(tx);
    }
  } catch (error) {
    const message =
      error.message ||
      error?.details ||
      error ||
      'An error occurred while withdrawing action.';
    logger.error(`❌ Error withdraw from Aave: ${message}`);
    throw new Error(`Error while sending transactions: ${message}`);
  }
  logger.log(`⌛ Wait for transaction receipt...`);
  const receipts = await Promise.all(txResponses.map((tx) => tx.wait()));
  logger.log(
    `✅ Transactions mined: ${receipts.map((r) => r.transactionHash)}`,
  );
  return receipts;
};
