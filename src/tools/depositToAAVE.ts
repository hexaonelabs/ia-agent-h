import { Address } from 'viem';
import { providers, Wallet } from 'ethers';
import { Pool } from '@aave/contract-helpers';
import { AaveV3Sepolia } from '@bgd-labs/aave-address-book';
import { sepolia } from 'viem/chains';
import { ConsoleLogger } from '@nestjs/common';

interface DepositAaveArgs {
  underlyingToken: Address;
  amountToSupply: string;
  chainId: number;
}

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

export const depositToAAVE = async ({
  underlyingToken,
  amountToSupply,
  chainId,
}: DepositAaveArgs) => {
  // if is testnet, use testnet pool
  if (chainId === sepolia.id) {
    return supply({
      underlyingToken,
      amountToSupply,
    });
  } else {
    return supplyWithPermit({
      underlyingToken,
      amountToSupply,
    });
  }
};

export async function supply({
  underlyingToken,
  amountToSupply,
}: {
  underlyingToken: string;
  amountToSupply: string;
}): Promise<string[]> {
  const logger = new ConsoleLogger('depositToAAVE - supply');
  try {
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
    // parse amount to supply
    // build query params
    const supplyParams = {
      user: wallet.address,
      reserve: underlyingToken,
      amount: amountToSupply,
      onBehalfOf: wallet.address,
      referralCode: '0',
    };
    // supply to aave
    logger.log(
      `🚰 Supplying to Aave pool of underlying asset: ${underlyingToken} - ${JSON.stringify(supplyParams)}`,
    );
    // call supply function
    const txs = await pool.supply({
      ...supplyParams,
    });
    const txHashes = [];
    // send transactions
    for (const tx of txs) {
      const txData = await tx.tx();
      const txRequest = {
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || 0),
      };
      logger.log(`✉️ Sending transaction: ${txRequest}`);
      const txResponse = await wallet.sendTransaction({
        ...txRequest,
      });
      logger.log(`⌛ Wait for transaction receipt...`);
      const receipt = await wallet.provider.waitForTransaction(txResponse.hash);
      logger.log(`✅ Transaction mined: ${receipt.transactionHash}`);
      txHashes.push(receipt.transactionHash);
    }
    // return transactions hash
    return txHashes;
  } catch (error) {
    logger.error(
      `❌ Error supplying to Aave: ${error.message || error?.details || error || 'An error occurred while supplying action.'}`,
    );
    throw error;
  }
}

export async function supplyWithPermit({
  underlyingToken,
  amountToSupply,
}: {
  underlyingToken: string;
  amountToSupply: string;
}): Promise<string[]> {
  const logger = new ConsoleLogger('depositToAAVE - supplyWithPermit');
  try {
    // Create or recover wallet
    const walletClient = createEtherWalletClient();
    const provider = createEthersProvider();
    const wallet = walletClient.connect(provider);
    // Initialize Pool contract`)
    const pool = new Pool(wallet.provider, {
      POOL: AaveV3Sepolia.POOL,
      WETH_GATEWAY: AaveV3Sepolia.WETH_GATEWAY,
    });
    // create timestamp of 10 minutes from now
    const deadline = `${new Date().setMinutes(new Date().getMinutes() + 10)}`;
    // sign permit approval
    logger.log(`💋 Sign permi approval for Aave pool: ${underlyingToken}...`);
    const dataToSign: string = await pool.signERC20Approval({
      user: wallet.address,
      reserve: underlyingToken,
      amount: amountToSupply,
      deadline,
    });
    logger.log(`💋 Sign tx data... `);
    const signature = await wallet.signMessage(dataToSign);
    // supply to pool with permit
    logger.log(`🚰 Supplying to Aave pool with permit: ${underlyingToken}`);
    const txs = await pool.supplyWithPermit({
      user: wallet.address,
      reserve: underlyingToken,
      amount: amountToSupply,
      signature,
      onBehalfOf: wallet.address,
      deadline,
    });
    const txResponses = [] as providers.TransactionResponse[];
    for (const tx of txs) {
      const txData = await tx.tx();
      const txRequest = {
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || 0),
      };
      logger.log(`✉️  Sending transaction: ${JSON.stringify(txRequest)}`);
      const txResponse = await wallet.sendTransaction({
        ...txRequest,
      });
      txResponses.push(txResponse);
    }
    logger.log(`✅ Transactions sent to Aave pool: ${underlyingToken}`);
    const txReceipts = await Promise.all(txResponses.map((tx) => tx.wait()));
    return txReceipts.map((tx) => tx.transactionHash);
  } catch (error) {
    logger.error(`❌ Error supplying to Aave with permit: ${error.message}`);
    throw error;
  }
}
