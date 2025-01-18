import { Address } from 'viem';
import { ethers } from 'ethers';
import { getNetworkByName } from '../utils';

interface GetTokenHoldersArgs {
  tokenAddress: Address;
  walletAddress: Address;
  network: string;
}
export async function getERC20TokenBalance({
  tokenAddress,
  walletAddress,
  network,
}: GetTokenHoldersArgs) {
  const chain = getNetworkByName(network);
  const rppcUrl = chain.rpcUrls.default.http[0];
  const provider = new ethers.providers.JsonRpcProvider(rppcUrl);
  const tokenContract = new ethers.Contract(
    tokenAddress,
    [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ],
    provider,
  );
  const tokenBalance = await tokenContract['balanceOf'](walletAddress);
  const tokenDecimals = await tokenContract['decimals']();
  const tokenBalanceInUnits = ethers.utils.formatUnits(
    tokenBalance,
    tokenDecimals,
  );
  return tokenBalanceInUnits;
}
