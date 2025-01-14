import * as p from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
// import { getBalanceTool } from './getBalance.js';
// import { getWalletAddressTool } from './getWalletAddress.js';
// import { readContractTool } from './readContract.js';
// import { getContractAbiTool } from './getContractAbi.js';
// import { getTransactionReceiptTool } from './getTransactionReceipt.js';
// import { getTokenBalanceTool } from './getTokenBalance.js';
// import { getMarketDataTool } from './getMarketData.js';
// import { depositAaveTool } from './depositToAAVE.js';
// import { writeCodeToFileTool } from './writeCodeToFile.js';
// import { executeUnitTestTool } from './executeUnitTest.js';
// import { sendTransactionTool } from './sendTransaction.js';
// import { writeContractTool } from './writeContract.js';
// import { deployErc20Tool } from './deployErc20.js';
// import { uniswapV3CreatePoolTool } from './uniswapV3createPool.js';
// import { approveTokenAllowanceTool } from './approveTokenAllowance.js';

export interface ToolConfig<T = any> {
  definition: {
    type: 'function';
    function: {
      strict?: boolean;
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
        additionalProperties?: boolean;
      };
    };
  };
  handler: (args: T) => Promise<any>;
}

// export const readTools: Record<string, any> = {
//   get_balance: getBalanceTool,
//   get_wallet_address: getWalletAddressTool,
//   get_contract_abi: getContractAbiTool,
//   read_contract: readContractTool,
//   get_transaction_receipt: getTransactionReceiptTool,
//   get_token_balance: getTokenBalanceTool,
//   get_market_data: getMarketDataTool,
//   // get_contract_bytecode: getContractBytecodeTool,
// };

// export const writeTools: Record<string, ToolConfig> = {
//   deposit_to_aave: depositAaveTool,
//   // send_transaction: sendTransactionTool,
//   // write_contract: writeContractTool,
//   // deploy_erc20: deployErc20Tool,
//   // create_uniswap_v3_pool: uniswapV3CreatePoolTool,
//   // approve_token_allowance: approveTokenAllowanceTool,
//   write_code_to_file: writeCodeToFileTool,
//   execute_unit_test: executeUnitTestTool,
// };

// export const tools: Record<string, ToolConfig> = {
//   // READ tools
//   ...readTools,
//   // WRITE tools
//   ...writeTools,
// };

interface Arg {
  Name: string;
  Description: string;
  Required: boolean;
  Type: string;
  Pattern: string;
  Default?: string;
}

interface YamlData {
  Name: string;
  Description: string;
  Handler: string;
  Args: Arg[];
}

export const yamlToToolParser = async (
  fileName: string,
): Promise<ToolConfig<any>> => {
  const normalizedName = fileName.includes('Tool')
    ? fileName
    : `${fileName.split('.yml')[0]}Tool`;
  const filePath = p.join(
    process.cwd(),
    'tools',
    normalizedName.endsWith('.yml') ? normalizedName : `${normalizedName}.yml`,
  );
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const data: YamlData = yaml.load(fileContents) as YamlData;
  const importPath = `./${data.Handler.includes('/') ? data.Handler.split('/').pop() : data.Handler}`;

  // load handler function from file
  const functionHandler = await import(importPath).then((module) => {
    return module[data.Handler.split('/').pop()];
  });
  // build definition object
  const functionDefinition = {
    type: 'function' as const,
    function: {
      name: data.Name,
      description: data.Description,
      parameters: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  };
  // add args as params
  data.Args.forEach((arg) => {
    functionDefinition.function.parameters.properties[arg.Name] = {
      type: arg.Type,
      pattern: arg.Pattern,
      description: arg.Description,
    };
    if (arg.Required) {
      functionDefinition.function.parameters.required.push(arg.Name);
    }
  });
  // return tool config object with definition & handler
  return {
    definition: functionDefinition,
    handler: functionHandler,
  };
};
