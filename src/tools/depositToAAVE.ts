import { Address, parseUnits, TransactionRequest } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';
import { ToolConfig } from './index.js';
import { createViemWalletClient } from '../viem/createViemWalletClient';
import { Pool } from '@aave/contract-helpers';
import { AaveV3Sepolia } from '@bgd-labs/aave-address-book';

interface DepositAaveArgs {
  assetAddress: Address;
  amountToSupply: string;
}

export const depositAaveTool: ToolConfig<DepositAaveArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'deposit_aave',
      description: 'Deposit tokens into AAVE V3 Pool to generate yield',
      parameters: {
        type: 'object',
        properties: {
          assetAddress: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'The token address to deposit',
          },
          amountToSupply: {
            type: 'string',
            description: 'The amount of tokens to deposit',
          },
        },
        required: ['assetAddress', 'amountToSupply'],
      },
    },
  },
  handler: async ({ assetAddress, amountToSupply }) => {
    return await supplyToAave({ assetAddress, amountToSupply });
  },
};

export async function supplyToAave({
  assetAddress,
  amountToSupply,
}: {
  assetAddress: string;
  amountToSupply: string;
}): Promise<string[]> {
  const { asset, amount } = { asset: assetAddress, amount: amountToSupply };
  try {
    // Create or recover wallet
    const walletClient = createViemWalletClient();
    const address = walletClient.account.address;

    // Initialize Pool contract
    const pool = new Pool(walletClient as any, {
      POOL: AaveV3Sepolia.POOL,
      WETH_GATEWAY: AaveV3Sepolia.WETH_GATEWAY,
    });

    const amountWei = parseUnits(amount, 18);

    const supplyParams = {
      user: address,
      reserve: asset,
      amount: amountWei.toString(),
      onBehalfOf: address,
      referralCode: '0',
    };

    const txs = await pool.supply(supplyParams);
    const txHashes = [];

    for (const tx of txs) {
      const txData = await tx.tx();
      const txRequest: TransactionRequest = {
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || 0),
      };

      const hash = await walletClient.sendTransaction(txRequest as any);

      const receipt = await createViemPublicClient().waitForTransactionReceipt({
        hash,
      });
      txHashes.push(receipt.transactionHash);
    }

    return txHashes;
  } catch (error) {
    console.error('Error supplying to Aave:', error);
    throw error;
  }
}
