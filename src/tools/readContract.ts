import { Address } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';
import { arbitrum, base, mainnet, optimism, sepolia } from 'viem/chains';

interface ReadContractArgs {
  contract: Address;
  functionName: string;
  args?: any[];
  abi: any[];
  chainId: number;
}

export async function readContract({
  contract,
  functionName,
  args,
  abi,
  chainId,
}: ReadContractArgs) {
  const chain = [mainnet, optimism, arbitrum, base, sepolia].find(
    (c) => c.id === chainId,
  );
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
