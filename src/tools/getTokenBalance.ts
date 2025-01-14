import { Address } from 'viem';
import { readContract } from './readContract';
import { formatUnits } from 'viem';
import { ERC20_ABI } from '../const/contractDetails';

interface GetTokenBalanceArgs {
  tokenAddress: Address;
  walletAddress: Address;
}

export const getTokenBalance = async ({
  tokenAddress,
  walletAddress,
}: GetTokenBalanceArgs) => {
  // Get decimals first
  const decimals = await readContract({
    contract: tokenAddress,
    functionName: 'decimals',
    args: [],
    abi: ERC20_ABI,
  });
  // Get balance
  const balance = await readContract({
    contract: tokenAddress,
    functionName: 'balanceOf',
    args: [walletAddress],
    abi: ERC20_ABI,
  });
  // Format the balance with proper decimals
  const formattedBalance = formatUnits(
    BigInt(balance.toString()),
    Number(decimals),
  );
  return formattedBalance;
};
