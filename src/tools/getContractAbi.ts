import { Address } from 'viem';
import fetch from 'node-fetch';

interface GetContractAbiArgs {
  contract: Address;
  functionName?: string;
}

export async function getContractAbi({
  contract,
  functionName,
}: GetContractAbiArgs) {
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
