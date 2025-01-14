import { Address } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';

interface GetContractBytecodeArgs {
  contract: Address;
}

export async function getContractBytecode({
  contract,
}: GetContractBytecodeArgs) {
  const publicClient = createViemPublicClient();
  const code = await publicClient.getCode({ address: contract });
  return code || '0x';
}
