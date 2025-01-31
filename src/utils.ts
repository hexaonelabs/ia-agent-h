import * as yaml from 'js-yaml';
import { arbitrum, mainnet, sepolia } from 'viem/chains';

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

export const convertJSONToYAML = (json: any) => {
  return yaml.dump(json);
};
