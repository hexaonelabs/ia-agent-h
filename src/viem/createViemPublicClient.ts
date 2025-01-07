import { createPublicClient, http, PublicClient } from 'viem';
import { abstractTestnet } from 'viem/chains';

export const createViemPublicClient = (): PublicClient => {
  const pubicClient = createPublicClient({
    chain: abstractTestnet,
    transport: http(),
  }) as any;
  return pubicClient;
};
