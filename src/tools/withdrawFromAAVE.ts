import { ethers, providers, Wallet } from 'ethers';
import { EthereumTransactionTypeExtended, Pool } from '@aave/contract-helpers';
import { AaveV3Sepolia } from '@bgd-labs/aave-address-book';
import { sepolia } from 'viem/chains';

const createEthersProvider = () => {
  const provider = new providers.JsonRpcProvider(
    sepolia.rpcUrls.default.http[0],
  );
  return provider;
};
const createEtherWalletClient = () => {
  const mnemonic = process.env.WALLET_MNEMONIC;
  return Wallet.fromMnemonic(mnemonic);
};

export const withdrawFromAAVE = async (ops: {
  underlyingToken: string;
  aToken: string;
  amount: string;
  chainId: number;
}) => {
  const { underlyingToken, amount } = ops;
  // Create or recover wallet
  const walletClient = createEtherWalletClient();
  const provider = createEthersProvider();
  const wallet = walletClient.connect(provider);
  // TODO: use chainId to set the network
  // Initialize Pool contract
  const pool = new Pool(wallet.provider, {
    POOL: AaveV3Sepolia.POOL,
    WETH_GATEWAY: AaveV3Sepolia.WETH_GATEWAY,
  });

  const user = await wallet.getAddress();

  /*
  - @param `user` The ethereum address that will make the deposit 
  - @param `reserve` The ethereum address of the reserve 
  - @param `amount` The amount to be deposited 
  - @param `aTokenAddress` The aToken to redeem for underlying asset
  - @param @optional `onBehalfOf` The ethereum address for which user is depositing. It will default to the user address
  */
  const txs: EthereumTransactionTypeExtended[] = await pool.withdraw({
    user,
    reserve: underlyingToken,
    amount,
    aTokenAddress: 'aTokenAddress',
    onBehalfOf: user,
  });

  const txResponses: ethers.providers.TransactionResponse[] = [];
  txs.forEach(async (element) => {
    const extendedTxData = await element.tx();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { from, ...txData } = extendedTxData;
    const tx = await wallet.sendTransaction({
      ...txData,
      value: txData.value || undefined,
    });
    txResponses.push(tx);
  });
  console.log('result: ', txResponses);
  return await Promise.all(txResponses.map((tx) => tx.wait()));
};
