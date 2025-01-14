import { Address } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';

interface ReadContractArgs {
  contract: Address;
  functionName: string;
  args?: any[];
  abi: any[];
}

export async function readContract({
  contract,
  functionName,
  args,
  abi,
}: ReadContractArgs) {
  const publicClient = createViemPublicClient();
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
