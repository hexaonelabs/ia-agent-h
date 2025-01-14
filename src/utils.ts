import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as p from 'path';
import { ToolConfig, yamlToToolParser } from './tools';

// replace `_` & `-` by convert to camel case
export const toCamelCase = (value: string) => {
  return value.replace(/[-_](.)/g, (_, group) => group.toUpperCase());
};

/**
 * Function that returns the list of assistant file names excluding `agent-h`
 * because it is a reserved agent use for the main agent orchestrator
 * @returns {string[]} List of assistant file names
 */
export const getAssistantsFileName = () => {
  const filePath = p.join(process.cwd(), 'characters');
  const files = fs.readdirSync(filePath);
  return files
    .filter((file) => file.includes('.yml'))
    .filter((file) => !file.includes('agent-h'))
    .map((file) => file.split('.yml')[0]);
};

export const getAssistantConfig = (
  assistantFileName: string,
): {
  Name: string;
  Description: string;
  Instructions: string;
  Tools: {
    Name: string;
    type: string;
  }[];
  Ctrl: string | undefined;
} => {
  const filePath = p.join(
    process.cwd(),
    'characters',
    !assistantFileName.includes('.yml')
      ? `${assistantFileName}.yml`
      : assistantFileName,
  );
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const {
    Name,
    Description,
    Instructions,
    Tools,
    Ctrl = undefined,
  } = yaml.load(fileContent);
  return { Name, Description, Instructions, Tools, Ctrl };
};

export const getAssistantToolsFunction = async (assistantFileName: string) => {
  const filePath = p.join(
    process.cwd(),
    'characters',
    !assistantFileName.includes('.yml')
      ? `${assistantFileName}.yml`
      : assistantFileName,
  );
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { Tools } = yaml.load(fileContent);
  const toolsNames = Tools?.map(({ Name }) => Name);
  const tools: ToolConfig<any>[] = [];
  await Promise.all(
    toolsNames.map(async (name) => {
      const tool = await yamlToToolParser(`${toCamelCase(name)}.yml`);
      tools.push(tool);
    }),
  );
  return tools;
};

export const getAssistantCtrl = async (
  assistantFileName: string,
): Promise<{
  start: () => Promise<void>;
} | null> => {
  const { Ctrl } = getAssistantConfig(assistantFileName);
  if (!Ctrl) {
    return null;
  }
  const modulePath = `./${Ctrl}`;
  const moduleName = `${Ctrl.split('/').pop().toUpperCase()[0]}${toCamelCase(Ctrl.split('/').pop().split('.')[0].slice(1))}Agent`;
  const ctrl = await import(modulePath).then((module) => {
    return module?.[moduleName];
  });
  if (!ctrl) {
    throw new Error(
      `❌ Ctrl module ${moduleName} not found at path ${modulePath}`,
    );
  }
  const i = new ctrl() as { start: () => Promise<void> };
  return i;
};
