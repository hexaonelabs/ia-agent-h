import { Address } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';
import { getNetworkByName } from '../utils';

interface ReadContractArgs {
  contract: Address;
  functionName: string;
  args?: any[];
  abi: any[];
  network: string;
}

export async function readContract({
  contract,
  functionName,
  args,
  abi,
  network,
}: ReadContractArgs) {
  const chain = getNetworkByName(network);
  if (!chain) {
    throw new Error('Invalid chainId');
  }
  const publicClient = createViemPublicClient(chain);
  const result = (await publicClient.readContract({
    address: contract,
    abi,
    functionName,
    args,
  })) as string | number | bigint | boolean | object;
  if (typeof result === 'bigint') {
    return result.toString();
  }
  return result;
}
