import { Address } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';
import { getChainById } from '../const/chains';

interface GetContractBytecodeArgs {
  contract: Address;
  chainId: number;
}

export async function getContractBytecode({
  contract,
  chainId,
}: GetContractBytecodeArgs) {
  const chain = getChainById(chainId);
  const publicClient = createViemPublicClient(chain);
  const code = await publicClient.getCode({ address: contract });
  return code || '0x';
}
