import { Chain, createPublicClient, http, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';

export const createViemPublicClient = (
  chain: Chain = sepolia,
): PublicClient => {
  const pubicClient = createPublicClient({
    chain,
    transport: http(),
  }) as any;
  return pubicClient;
};
