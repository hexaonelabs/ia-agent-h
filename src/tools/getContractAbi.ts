import { Address } from 'viem';
import { ToolConfig } from './index.js';
import fetch from 'node-fetch';

interface GetContractAbiArgs {
  contract: Address;
  functionName?: string;
}

export const getContractAbiTool: ToolConfig<GetContractAbiArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'get_contract_abi',
      description:
        'Get the ABI or specific function signature of a deployed contract',
      parameters: {
        type: 'object',
        properties: {
          contract: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'The contract address to get the ABI from',
          },
          functionName: {
            type: 'string',
            description: 'Optional: Get signature for a specific function name',
          },
        },
        required: ['contract'],
      },
    },
  },
  handler: async ({ contract, functionName }) => {
    return await getContractAbi(contract, functionName);
  },
};

async function getContractAbi(contract: Address, functionName?: string) {
  const BLOCK_EXPLORER_API = 'https://block-explorer-api.testnet.abs.xyz';
  const url = `${BLOCK_EXPLORER_API}/api?module=contract&action=getabi&address=${contract}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1') {
      return extractFunctionSignatures(data.result, functionName);
    }
    return `Contract not verified`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function extractFunctionSignatures(
  abiString: string,
  functionName?: string,
): string {
  try {
    const abi = JSON.parse(abiString);
    const functions = abi
      .filter((item: any) => item.type === 'function')
      .map(
        (fn: any) =>
          `${fn.name}(${(fn.inputs || []).map((i: any) => i.type).join(',')})`,
      );

    // If looking for specific function
    if (functionName) {
      // Try exact match first
      const exact = functions.find((f: string) =>
        f.toLowerCase().startsWith(`${functionName.toLowerCase()}(`),
      );
      if (exact) return exact;

      // Try partial match
      const partial = functions.find((f: string) =>
        f.toLowerCase().includes(functionName.toLowerCase()),
      );
      if (partial) return partial;

      return 'Function not found';
    }

    return functions;
  } catch {
    return 'Invalid ABI format';
  }
}
