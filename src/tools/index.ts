import { getBalanceTool } from './getBalance.js';
import { getWalletAddressTool } from './getWalletAddress.js';
import { readContractTool } from './readContract.js';
import { getContractAbiTool } from './getContractAbi.js';
import { getTransactionReceiptTool } from './getTransactionReceipt.js';
import { getTokenBalanceTool } from './getTokenBalance.js';
import { getMarketDataTool } from './getMarketData.js';
import { depositAaveTool } from './depositToAAVE.js';
import { writeCodeToFileTool } from './writeCodeToFile.js';
import { executeUnitTestTool } from './executeUnitTest.js';
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

export const readTools: Record<string, any> = {
  get_balance: getBalanceTool,
  get_wallet_address: getWalletAddressTool,
  get_contract_abi: getContractAbiTool,
  read_contract: readContractTool,
  get_transaction_receipt: getTransactionReceiptTool,
  get_token_balance: getTokenBalanceTool,
  get_market_data: getMarketDataTool,
  // get_contract_bytecode: getContractBytecodeTool,
};

export const writeTools: Record<string, ToolConfig> = {
  deposit_to_aave: depositAaveTool,
  // send_transaction: sendTransactionTool,
  // write_contract: writeContractTool,
  // deploy_erc20: deployErc20Tool,
  // create_uniswap_v3_pool: uniswapV3CreatePoolTool,
  // approve_token_allowance: approveTokenAllowanceTool,
  write_code_to_file: writeCodeToFileTool,
  execute_unit_test: executeUnitTestTool,
};

export const tools: Record<string, ToolConfig> = {
  // READ tools
  ...readTools,
  // WRITE tools
  ...writeTools,
};
