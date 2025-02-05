import {
  arbitrum,
  Chain,
  mainnet,
  sepolia,
  arbitrumSepolia,
  zksyncSepoliaTestnet,
  abstractTestnet,
  optimism,
  base,
  polygon,
  zksync,
  gnosis,
  avalanche,
  scroll,
} from 'viem/chains';

const testnets = [
  abstractTestnet,
  sepolia,
  arbitrumSepolia,
  zksyncSepoliaTestnet,
];
const mainnets = [
  mainnet,
  arbitrum,
  optimism,
  base,
  polygon,
  zksync,
  gnosis,
  avalanche,
  scroll,
];
export const chains = [...testnets, ...mainnets];

export const getChainById = (chainId: number): Chain | undefined => {
  const chain = Object.values(chains).find((chain) => chain.id === chainId);
  return chain;
};
