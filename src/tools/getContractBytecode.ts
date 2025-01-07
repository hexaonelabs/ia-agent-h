import { Address } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient.js';
import { ToolConfig } from './index.js';

interface GetContractBytecodeArgs {
  contract: Address;
}

export const getContractBytecodeTool: ToolConfig<GetContractBytecodeArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'get_contract_bytecode',
      description: 'Get the bytecode of a deployed contract',
      parameters: {
        type: 'object',
        properties: {
          contract: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'The contract address to get the bytecode from',
          },
        },
        required: ['contract'],
      },
    },
  },
  handler: async ({ contract }) => {
    return await getContractBytecode(contract);
  },
};

async function getContractBytecode(contract: Address) {
  const publicClient = createViemPublicClient();
  const code = await publicClient.getCode({ address: contract });
  return code || '0x';
}
