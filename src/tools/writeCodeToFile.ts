import * as fs from 'fs';
import * as path from 'path';
import { ToolConfig } from '.';

interface WriteCodeToFileParams {
  code: string;
  filename: string;
  directory?: string;
}

export const writeCodeToFileTool: ToolConfig<WriteCodeToFileParams> = {
  definition: {
    type: 'function',
    function: {
      name: 'write_code_to_file',
      description: 'Write code to a file on the filesystem',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code to write to the file',
          },
          filename: {
            type: 'string',
            description: 'Name of the file to write the code to',
          },
          directory: {
            type: 'string',
            description: 'Directory to write the file to',
          },
        },
        required: ['code', 'filename', 'directory'],
      },
    },
  },
  handler: async ({
    code,
    filename,
    directory,
  }: {
    code: string;
    filename: string;
    directory: string;
  }) => {
    const result = writeCodeToFile({ code, filename, directory });
    return result;
  },
};

export const writeCodeToFile = ({
  code,
  filename,
  directory,
}: WriteCodeToFileParams): string => {
  try {
    // Assume that the directory is relative to the current working directory
    fs.mkdirSync(directory, { recursive: true });
    // build the file path
    const filePath = path.join(directory, filename);
    // write the code to the file
    fs.writeFileSync(filePath, code);
    return `Successfully wrote code to file: ${filePath}`;
  } catch (error) {
    throw new Error(
      `Error writing code to file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
