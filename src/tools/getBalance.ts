import { Address } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';
import { formatEther } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

interface GetBalanceArgs {
  wallet: Address;
  network: string;
}

export async function getBalance({ wallet, network }: GetBalanceArgs) {
  const chain = getNetworkByName(network);
  const publicClient = createViemPublicClient(chain);
  const balance = await publicClient.getBalance({ address: wallet });
  return formatEther(balance);
}

const getNetworkByName = (network: string) => {
  switch (network) {
    case 'mainnet':
      return mainnet;
    default:
      return sepolia;
  }
};
