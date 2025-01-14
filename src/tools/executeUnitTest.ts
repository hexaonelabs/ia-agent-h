import * as fs from 'fs';
// import * as p from 'path';
import { exec } from 'child_process';

interface ExecuteUnitTestParams {
  filePath: string;
}

export const executeUnitTest = async ({ filePath }: ExecuteUnitTestParams) => {
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
};
