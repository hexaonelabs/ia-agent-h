import { Address } from 'viem';
import { ToolConfig } from './index.js';
import { readContract } from './readContract.js';
import { formatUnits } from 'viem';
import { ERC20_ABI } from '../const/contractDetails.js';

interface GetTokenBalanceArgs {
  tokenAddress: Address;
  walletAddress: Address;
}

export const getTokenBalanceTool: ToolConfig<GetTokenBalanceArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'get_token_balance',
      description: 'Get the ERC20 token balance of a wallet address',
      parameters: {
        type: 'object',
        properties: {
          tokenAddress: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'The ERC20 token contract address',
          },
          walletAddress: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'The wallet address to check the balance of',
          },
        },
        required: ['tokenAddress', 'walletAddress'],
      },
    },
  },
  handler: async ({ tokenAddress, walletAddress }) => {
    // Get decimals first
    const decimals = await readContract(
      tokenAddress,
      'decimals',
      [],
      ERC20_ABI,
    );

    // Get balance
    const balance = await readContract(
      tokenAddress,
      'balanceOf',
      [walletAddress],
      ERC20_ABI,
    );

    // Format the balance with proper decimals
    const formattedBalance = formatUnits(
      BigInt(balance.toString()),
      Number(decimals),
    );
    return formattedBalance;
  },
};
