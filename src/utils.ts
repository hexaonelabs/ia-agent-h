import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as p from 'path';
import { arbitrum, mainnet, sepolia } from 'viem/chains';
import { TaskSchedulerService } from './server/task-scheduler.service';

export interface ToolConfig<T = any> {
  definition: {
    type: 'function';
    function: {
      strict?: boolean;
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties?: boolean;
      };
    };
  };
  handler: (
    args: T,
    taskSchedulerService?: TaskSchedulerService,
    userAddress?: string,
  ) => Promise<any>;
}

export interface ToolsArg {
  Name: string;
  Description: string;
  Required: boolean;
  Type: string;
  Pattern: string;
  Default?: string;
  Items?: any;
}

export interface YamlTool {
  Name: string;
  Description: string;
  Handler: string;
  Args: ToolsArg[];
}

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
  const filesName = files
    .filter((file) => file.includes('.yml'))
    .filter((file) => !file.includes('agent-h'))
    .map((file) => file.split('.yml')[0]);
  // chek if files content contain `Enabled: false` config
  // and remove it from the list
  const enabledFilesName = filesName.filter((file) => {
    const fileContent = fs.readFileSync(
      p.join(filePath, `${file}.yml`),
      'utf-8',
    );
    const { Enabled } = yaml.load(fileContent) as any;
    return Enabled;
  });
  return enabledFilesName;
};

export const getAllAssistantsFileName = () => {
  const filePath = p.join(process.cwd(), 'characters');
  const files = fs.readdirSync(filePath);
  const filesName = files
    .filter((file) => file.includes('.yml'))
    .map((file) => file.split('.yml')[0]);
  return filesName;
};

export const getAllTools = () => {
  const filePath = p.join(process.cwd(), 'tools');
  const files = fs.readdirSync(filePath);
  const filesName = files
    .filter((file) => file.includes('.yml'))
    .map((file) => file.split('.yml')[0]);
  const tools: YamlTool[] = [];
  for (const file of filesName) {
    const fileContent = fs.readFileSync(`${filePath}/${file}.yml`, 'utf-8');
    const tool = yaml.load(fileContent) as any;
    tools.push(tool);
  }
  return tools;
};

/**
 * Function that returns the assistant config object from the assistant file name
 * @param assistantFileName
 * @returns
 */
export const getAssistantConfig = (
  assistantFileName: string,
): {
  Name: string;
  Enabled: boolean;
  Description: string;
  Personality: string;
  Roleplay: string;
  Skills: string;
  Mission: string;
  Instructions: string;
  Tools: {
    Name: string;
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
  return yaml.load(fileContent) as any;
};

/**
 * Function that returns the assistant tools function from the assistant file name
 * @param assistantFileName
 * @returns
 */
export const getAssistantToolsFunction = async (assistantFileName: string) => {
  const { Tools } = getAssistantConfig(assistantFileName);
  const toolsNames = Tools?.map(({ Name }) => Name) || [];
  const tools: ToolConfig<any>[] = [];
  await Promise.all(
    toolsNames.map(async (name) => {
      const tool = await yamlToToolParser(`${toCamelCase(name)}.yml`);
      tools.push(tool);
    }),
  );
  return tools;
};

/**
 * Function that returns the assistant ctrl function from the assistant file name
 * @param assistantFileName
 * @returns
 */
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

/**
 * Function that returns the tool config object from the assistant file name
 * @param fileName
 * @returns
 */
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
  const data: YamlTool = yaml.load(fileContents) as YamlTool;
  const importPath = `./tools/${data.Handler.includes('/') ? data.Handler.split('/').pop() : data.Handler}`;

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
        properties: {} as Record<string, any>,
        required: [],
      },
    },
  } as Pick<ToolConfig['definition'], 'function' | 'type'>;
  // add args as params
  data?.Args?.forEach(({ Name, Required, Items, ...arg }) => {
    functionDefinition.function.parameters.properties[Name] = {
      // convert key to lowercase
      ...Object.keys(arg).reduce((acc, key) => {
        acc[key.toLowerCase()] = arg[key];
        return acc;
      }, {}),
    };
    if (Required) {
      functionDefinition.function.parameters.required.push(Name);
    }
    if (Items && functionDefinition.function.parameters.properties[Name]) {
      functionDefinition.function.parameters.properties[Name].items = Items;
    }
  });
  // return tool config object with definition & handler
  return {
    definition: functionDefinition,
    handler: functionHandler,
  };
};

/**
 * Function that returns the assistant prompt string text from the assistant file name
 * @param fileName
 * @returns
 */
export const getAssistantPrompt = async (fileName: string = 'agent-h.yml') => {
  // load file content from `characters/name.yml` file
  const {
    Name,
    Description,
    Instructions,
    Tools,
    Mission,
    Personality,
    Roleplay,
    Skills,
  } = getAssistantConfig(fileName);

  // get all tools names, group by type & normalize to camel case
  const toolsNames = Tools?.map(({ Name }) => Name).filter(Boolean) || [];
  const toolsFilesPath = toolsNames.map((name) => `${toCamelCase(name)}.yml`);
  // load all tools from yaml files
  const tools = [];
  await Promise.all(
    toolsFilesPath.map(async (filePath) => {
      const { definition: tool } = await yamlToToolParser(filePath);
      tools.push(tool);
    }),
  );
  // build prompt string text
  const assistantPrompt = `# You are ${Name}

## Description:
${Description}

## Personality:
${Personality}

## Roleplay:
${Roleplay}

## Skills: 
${Skills}

## Mission:
${Mission}

${tools.length > 0 ? 'To acompish this mission you have access & you can perform allo these tools to execute multiples actions:' : ''}  
${tools.length > 0 ? '## TOOLS ACTION LIST CAPABILITIES:' : ''}
${tools.length > 0 ? tools.map((tool) => `- "${tool.function.name}": ${tool.function.description}`).join('\n') : ''}

${Instructions ? '## INSTRUCTIONS:' : ''}
${Instructions ? Instructions : ''}`;
  // return prompt string text
  return assistantPrompt;
};

export const getNetworkByName = (network: string) => {
  switch (network) {
    case 'mainnet':
      return mainnet;
    case 'arbitrum':
      return arbitrum;
    default:
      return sepolia;
  }
};

export const convertJSONToYAML = (json: any) => {
  return yaml.dump(json);
};
