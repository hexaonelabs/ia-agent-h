import { Address } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';
import { formatEther } from 'viem';
import { getChainByName } from '../const/chains';

interface GetBalanceArgs {
  wallet: Address;
  network: string;
}

export async function getBalance({ wallet, network }: GetBalanceArgs) {
  const chain = getChainByName(network);
  const publicClient = createViemPublicClient(chain);
  const balance = await publicClient.getBalance({ address: wallet });
  return formatEther(balance);
}
