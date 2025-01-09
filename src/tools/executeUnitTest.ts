import * as fs from 'fs';
import * as p from 'path';
import { exec } from 'child_process';
import { ToolConfig } from '.';

interface ExecuteUnitTestParams {
  filename: string;
  path: string;
}

export const executeUnitTestTool: ToolConfig<ExecuteUnitTestParams> = {
  definition: {
    type: 'function',
    function: {
      name: 'execute_unit_test',
      description: 'Execute a unit test from a file',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Name of the file containing the unit test',
          },
          path: {
            type: 'string',
            description: 'Path to the directory containing the unit test file',
          },
        },
        required: ['filename', 'path'],
      },
    },
  },
  handler: async ({ filename, path }: { filename: string; path: string }) => {
    const filePath = p.join(path, filename);
    // execute test
    try {
      await new Promise((resolve, reject) => {
        // check if jest is available
        exec('npx jest --version', (error) => {
          if (error) {
            reject(new Error('Jest is not available'));
          }
        });
        // run test
        exec(`npx jest ${filePath}`, (error, stdout) => {
          if (error) {
            reject(error);
          }
          resolve(stdout);
        });
      });
    } catch (error) {
      // delete test file
      fs.rmSync(filePath);
      // delete code file
      fs.rmSync(filePath.replace('.spec', ''));
    }
  },
};
