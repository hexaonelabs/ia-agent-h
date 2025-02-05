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
export const defaultChain = sepolia;

export const getChainById = (chainId: number): Chain | undefined => {
  const chain = Object.values(chains).find((chain) => chain.id === chainId);
  return chain;
};
export const getChainByName = (network: string) => {
  // normalize names
  if (network === 'matic') {
    network = 'polygon';
  }
  if (network === 'eth' || network === 'mainnet') {
    network = 'ethereum';
  }
  if (network.toLocaleLowerCase() === 'arbitrum') {
    network = 'arbitrum one';
  }
  if (
    network.toLocaleLowerCase() === 'optimism' ||
    network.toLocaleLowerCase() === 'op' ||
    network.toLocaleLowerCase() === 'optimistic'
  ) {
    network = 'OP Mainnet';
  }
  if (
    network.toLocaleLowerCase() === 'zk' ||
    network.toLocaleLowerCase() === 'zkrollup' ||
    network.toLocaleLowerCase() === 'zKsync'
  ) {
    network = 'ZKsync Era';
  }
  // check if network.toLowerCase() is in the list of chains and return the chain
  const exactTypo = chains.find(
    (chain) => chain.name.toLowerCase() === network.toLowerCase(),
  );
  if (exactTypo) {
    return exactTypo;
  }
  // check if network.toLowerCase() is a substring of any chain name and return the chain
  const typo = chains.find((chain) =>
    chain.name.toLowerCase().includes(network.toLowerCase()),
  );
  if (typo) {
    return typo;
  }
  // return the default chain
  return defaultChain;
};
