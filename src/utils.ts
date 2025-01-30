import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as p from 'path';
import { arbitrum, mainnet, sepolia } from 'viem/chains';
import { TaskSchedulerService } from './server/task-scheduler.service';
import OpenAI from 'openai';
import { z } from 'zod';
import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';

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
 * @deprecated Use getDynamicStructuredTools instead. Will be removed
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
 * Function that returns the assistant tools function from the assistant file name
 */
export const getDynamicStructuredTools = async (assistantFileName: string) => {
  const { Tools } = getAssistantConfig(assistantFileName);
  const toolsNames = Tools?.map(({ Name }) => Name) || [];
  const tools: DynamicStructuredTool[] = [];
  await Promise.all(
    toolsNames.map(async (name) => {
      const tool = await yamlToDynamicStructuredToolParser(
        `${toCamelCase(name)}.yml`,
      );
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
 * @deprecated Use yamlToDynamicStructuredToolParser() instead. Will be removed.
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
 * Function that returns the dynamic structured tool from the assistant file name
 * @param fileName
 * @returns
 */
export const yamlToDynamicStructuredToolParser = async (
  fileName: string,
): Promise<DynamicStructuredTool> => {
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
  // add args as params with dynamic structure using zod
  const schema = z.object(
    data?.Args?.reduce(
      (acc, { Name, Required, Items, Type, ...arg }) => {
        acc[Name] = z[Type || 'string']().describe(arg.Description || '');
        if (!Required) {
          acc[Name] = acc[Name].optional();
        }
        if (Items) {
          acc[Name] = acc[Name].array();
        }
        return acc;
      },
      {} as Record<string, any>,
    ),
  );
  // return tool config object with definition & handler
  return tool(functionHandler, {
    name: data.Name,
    description: data.Description,
    schema,
  });
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
  const tools: DynamicStructuredTool[] = [];
  await Promise.all(
    toolsFilesPath.map(async (filePath) => {
      const tool = await yamlToDynamicStructuredToolParser(filePath);
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
${tools.length > 0 ? tools.map((tool) => `- "${tool.name}": ${tool.description}`).join('\n') : ''}

${Instructions ? '## INSTRUCTIONS:' : ''}
${Instructions ? Instructions : ''}`;
  // return prompt string text
  return assistantPrompt;
};

export const getNetworkByName = (network: string) => {
  switch (network.toLowerCase()) {
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

export const createEmbedding = async (
  input: string,
  model = 'text-embedding-3-small',
  encoding_format = 'float' as 'float' | 'base64',
) => {
  const openai = new OpenAI();
  const embedding = await openai.embeddings.create({
    model,
    encoding_format,
    input,
  });
  return embedding;
};

export async function createSpecializedAgent(fileName: string) {
  const promptTemmplate = await getAssistantPrompt(fileName);
  const tools = await getDynamicStructuredTools(fileName);
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `${promptTemmplate}
      Always use your tools to complete tasks. 
      If you cannot complete a task, explain why and what additional information you need.`,
    ],
    new MessagesPlaceholder({ variableName: 'chat_history' }),
    ['human', '{input}'],
    new MessagesPlaceholder({ variableName: 'agent_scratchpad' }),
  ]);

  const llm = new ChatOpenAI({
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo',
    n: 1,
    maxTokens: 100,
  });

  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
    memory: undefined,
  });
}

export async function createSupervisorAgent(teamAgents: {
  [key: string]: AgentExecutor;
}) {
  const supervisorTools = await Promise.all(
    Object.entries(teamAgents).map(async ([name, agent]) => {
      return new DynamicStructuredTool({
        name,
        description: `Use this tool to delegate tasks to ${name}`,
        schema: z.object({
          input: z.string().describe(`The task to delegate to ${name}`),
        }),
        func: async ({ input }) => {
          console.log(`Task delegated to ""${name}": ${input}`);
          const result = await agent.invoke(
            { input, chat_history: [] },
            { callbacks },
          );
          console.log(`Task completed by "${name}": ${result.output}`);
          return `${name} response: ${result.output}`;
        },
      });
    }),
  ).then((tools) => tools || []);
  // const promptTemmplate = await getAssistantPrompt();
  const tools = await getDynamicStructuredTools('agent-h.yml');
  const allTTools = [...tools, ...supervisorTools];
  // list all tools from each agent to let the supervisor agent
  // delegate tasks to the specialized agents that can handle them
  const teamTools = Object.entries(teamAgents).map(([name, agent]) => {
    return `
    Agent CV for "${name}":
    Skills:
    ${agent.tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')}
    End of CV for "${name}".
    `;
  });
  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are a supervisor agent. Your role is to:
    1. Always delegate tasks to your specialized agents.
    2. Wait for their responses to each task before proceeding to the next.
    3. Summarize and integrate their findings into a final answer.
    4. Provide a final, comprehensive answer to the user.
    5. Use the scratchpad to keep track of the conversation and any additional information needed.
    6. Use the chat history to keep track of the conversation.`.trim(),
    ],
    [
      'system',
      `Remember the following rules:
      IMPORTANT: 
      - Never modify or reinterpret the original input. 
      - Never postpone or delay tasks. If more information is needed, specify exactly what is required.
      - Always pass the exact instructions to the specialized agents.

      AND THE MOST IMPORTANT:
      - Ensure that the specialized agents execute and complete the tasks correctly, otherwise, provide the correct information to them or ask them to re-execute the task.
      - Always await the response from the specialized agents before proceeding to the next task or providing a final answer.
      
      Here are the specialized agents in your team with their skills:
      ${teamTools.join('\n')}
    `,
    ],
    new MessagesPlaceholder({ variableName: 'chat_history' }),
    ['human', '{input}'],
    new MessagesPlaceholder({ variableName: 'agent_scratchpad' }),
  ]);

  const llm = new ChatOpenAI({
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo',
    n: 1,
    maxTokens: 100,
  });

  const supervisorAgent = await createOpenAIFunctionsAgent({
    llm,
    tools: allTTools,
    prompt: supervisorPrompt,
  });
  return new AgentExecutor({
    agent: supervisorAgent,
    tools: allTTools,
    memory: undefined,
  });
}

export const callbacks = [
  {
    handleToolStart: async () => {
      console.log(`💾 Agent executing tool...`);
    },
    handleToolEnd(output) {
      console.log(`🔧 Agent tool output: ${JSON.stringify({ output })}`);
    },
    handleAgentAction(action) {
      console.log(`🚀  Handling action calls: ${action.log}`);
    },
    handleAgentEnd(action) {
      console.log(
        `✅ Agent end action: 
        ${action.log} 
        ${JSON.stringify(action.returnValues)}
      `.trim(),
      );
    },
    // handleChainStart(chain, runId) {
    //   const data = runId;
    //   // console.log(data);
    //   if (
    //     !data.input ||
    //     !data.input.length ||
    //     !data?.steps ||
    //     data.steps.length === 0
    //   ) {
    //     return;
    //   }
    //   console.log(`🚀 Performing run ${data.input}`);
    // },
  },
];
