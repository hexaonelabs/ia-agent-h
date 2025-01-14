import * as fs from 'fs';
import * as path from 'path';

interface WriteCodeToFileParams {
  filePath: string;
  code: string;
}

export const writeCodeToFile = ({
  code,
  filePath,
}: WriteCodeToFileParams): string => {
  try {
    // ensure file exist in the provided path with multiples directories
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    // write code to file
    fs.writeFileSync(filePath, code);
    // return success message
    return `Successfully wrote code to file: ${filePath}`;
  } catch (error) {
    throw new Error(
      `Error writing code to file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
