import { Hash } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient.js';
import { ToolConfig } from './index.js';

interface GetTransactionReceiptArgs {
  hash: Hash;
}

export const getTransactionReceiptTool: ToolConfig<GetTransactionReceiptArgs> =
  {
    definition: {
      type: 'function',
      function: {
        name: 'get_transaction_receipt',
        description:
          'Get the receipt of a transaction to check its status and details',
        parameters: {
          type: 'object',
          properties: {
            hash: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{64}$',
              description: 'The transaction hash to get the receipt for',
            },
          },
          required: ['hash'],
        },
      },
    },
    handler: async ({ hash }) => {
      return await getTransactionReceipt(hash);
    },
  };

function extractReceiptInfo(receipt: any) {
  return {
    status: receipt.status,
    hash: receipt.transactionHash,
    ...(receipt.status === 'reverted' && { error: 'Transaction reverted' }),
  };
}

async function getTransactionReceipt(hash: Hash) {
  const publicClient = createViemPublicClient();
  const receipt = await publicClient.getTransactionReceipt({ hash });

  return extractReceiptInfo(receipt);
}
