import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as p from 'path';

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
  handler: (args: T) => Promise<any>;
}

interface Arg {
  Name: string;
  Description: string;
  Required: boolean;
  Type: string;
  Pattern: string;
  Default?: string;
  Items?: any;
}

interface YamlData {
  Name: string;
  Description: string;
  Handler: string;
  Args: Arg[];
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
    const { Enabled } = yaml.load(fileContent);
    return Enabled;
  });
  return enabledFilesName;
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
    Enabled,
    Description,
    Instructions,
    Tools,
    Ctrl = undefined,
  } = yaml.load(fileContent);
  return { Name, Enabled, Description, Instructions, Tools, Ctrl };
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
  const data: YamlData = yaml.load(fileContents) as YamlData;
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
  const { Name, Description, Instructions, Tools } =
    getAssistantConfig(fileName);

  // get all tools names, group by type & normalize to camel case
  const readToolsNames =
    Tools?.filter(({ type }) => type === 'read')
      ?.map(({ Name }) => Name)
      .filter(Boolean) || [];
  const readToolsFilesPath = readToolsNames.map(
    (name) => `${toCamelCase(name)}.yml`,
  );
  const writeToolsNames =
    Tools?.filter(({ type }) => type === 'write')
      ?.map(({ Name }) => Name)
      .filter(Boolean) || [];
  const writeToolsFilesPath = writeToolsNames.map(
    (name) => `${toCamelCase(name)}.yml`,
  );
  // load all tools from yaml files
  const readTools = [];
  await Promise.all(
    readToolsFilesPath.map(async (filePath) => {
      const { definition: tool } = await yamlToToolParser(filePath);
      readTools.push(tool);
    }),
  );
  const writeTools = [];
  await Promise.all(
    writeToolsFilesPath.map(async (filePath) => {
      const { definition: tool } = await yamlToToolParser(filePath);
      writeTools.push(tool);
    }),
  );
  // build prompt string text
  const assistantPrompt = `# ${Name}
${Description}

Your wallet is your identity, you are the owner of your data and none can access it.
You can share your public wallet address with anyone to prove your identity or to receive funds.

${[...readTools, ...writeTools].length > 0 ? 'To acompish this mission you have access & you can perform allo these tools to execute multiples operations:' : ''}  
${readTools.length > 0 ? '## 1 READ OPERATIONS:' : ''}
${readTools.length > 0 ? readTools.map((tool) => `- "${tool.function.name}": ${tool.function.description}`).join('\n') : ''}

${writeTools.length > 0 ? '## 2 WRITE OPERATIONS:' : ''}
${writeTools.length > 0 ? writeTools.map((tool) => `- "${tool.function.name}": ${tool.function.description}`).join('\n') : ''}

${Instructions ? '# INSTRUCTIONS:' : ''}
${Instructions ? Instructions : ''}`;
  // return prompt string text
  return assistantPrompt;
};
