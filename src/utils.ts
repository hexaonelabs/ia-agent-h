import * as yaml from 'js-yaml';
import { arbitrum, Chain, mainnet, sepolia } from 'viem/chains';

// replace `_` & `-` by convert to camel case
export const toCamelCase = (value: string) => {
  return value.replace(/[-_](.)/g, (_, group) => group.toUpperCase());
};

export const getNetworkByName = (network: string) => {
  switch (network.toLowerCase()) {
    case 'mainnet':
      return mainnet;
    case 'arbitrum':
      return arbitrum;
    default:
      return sepolia;
  }
};

export const getChainById = (chainId: number): Chain | undefined => {
  const chains = [arbitrum, mainnet, sepolia];
  const chain = Object.values(chains).find((chain) => chain.id === chainId);
  return chain;
};

export const convertJSONToYAML = (json: any) => {
  return yaml.dump(json);
};
