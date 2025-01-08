import { createPublicClient, http, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';

export const createViemPublicClient = (): PublicClient => {
  const pubicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  }) as any;
  return pubicClient;
};
