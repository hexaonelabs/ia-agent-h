import { Address } from 'viem';
import { readContract } from './readContract';
import { formatUnits } from 'viem';
import { ERC20_ABI } from '../const/contractDetails';

interface GetTokenBalanceArgs {
  tokenAddress: Address;
  walletAddress: Address;
  network: string;
}

/**
 * Function to get the balance of a ERC20 token for a wallet on a specific chain
 * @param params GetTokenBalanceArgs
 * @returns String with the balance of the token
 */
export const getTokenBalance = async ({
  tokenAddress,
  walletAddress,
  network,
}: GetTokenBalanceArgs) => {
  // Get decimals first
  const decimals = await readContract({
    contract: tokenAddress,
    functionName: 'decimals',
    args: [],
    abi: ERC20_ABI,
    network,
  });
  // Get balance
  const balance = await readContract({
    contract: tokenAddress,
    functionName: 'balanceOf',
    args: [walletAddress],
    abi: ERC20_ABI,
    network,
  });
  // Format the balance with proper decimals
  const formattedBalance = formatUnits(
    BigInt(balance.toString()),
    Number(decimals),
  );
  return formattedBalance;
};
