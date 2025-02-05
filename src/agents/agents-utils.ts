import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { toCamelCase } from '../utils';
import * as yaml from 'js-yaml';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { CustomLogger } from 'src/logger.service';

export interface AgentToolYmlConfig {
  Name: string;
  Description: string;
  Handler: string;
  Args: AgentToolArgYmlConfig[];
}

export interface AgentToolArgYmlConfig {
  Name: string;
  Description: string;
  Required: boolean;
  Type: string;
  Pattern: string;
  Default?: string;
  Items?: any;
}

const LLM_MODEL = 'gpt-4o-mini';
const TEMP = 0.7;
const console = new CustomLogger('AgentsUtils');

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
  const filePath = join(
    process.cwd(),
    'characters',
    !assistantFileName.includes('.yml')
      ? `${assistantFileName}.yml`
      : assistantFileName,
  );
  const fileContent = readFileSync(filePath, 'utf-8');
  return yaml.load(fileContent) as any;
};

/**
 *  Function that returns the list of agents and tools config
 * User for the setup page
 * @returns
 */
export const getAgentsAndToolsConfig = () => {
  const files = getAllAssistantsFileName();
  const agentsConfig = files.map((file) => {
    const config = getAssistantConfig(file);
    return {
      ...config,
      fileName: file,
    };
  });
  const toolsAvailable = getAllTools();
  return { agentsConfig, toolsAvailable };
};

/**
 * Function that returns all tools from the `tools` YML directory
 * @returns
 */
export const getAllTools = () => {
  const filePath = join(process.cwd(), 'tools');
  const files = readdirSync(filePath);
  const filesName = files
    .filter((file) => file.includes('.yml'))
    .map((file) => file.split('.yml')[0]);
  const tools: AgentToolYmlConfig[] = [];
  for (const file of filesName) {
    const fileContent = readFileSync(`${filePath}/${file}.yml`, 'utf-8');
    const tool = yaml.load(fileContent) as any;
    tools.push(tool);
  }
  return tools;
};

/**
 * Function that generte a team of agents based on the YML files
 * in the directory `characters` and `tools`
 * Files configs can be edited with frontend UI or by editing the YML files
 * @returns
 */
export async function buildTeamOfAgents() {
  const team: {
    agents: Record<
      string,
      {
        agent: AgentExecutor;
        ctrl?: {
          start: () => Promise<void>;
          stop?: () => Promise<void>;
        };
      }
    >;
    supervisor: AgentExecutor;
  } = {
    agents: {},
    supervisor: undefined,
  };
  console.log('🤖 Building team of agents...');
  // search for specialized agents
  const agentsFileName = getAssistantsFileName() || [];
  // else create specialized agents
  try {
    if (agentsFileName.length > 0) {
      console.log(
        `🤖 Specialized agents enabled:\n${agentsFileName.map((a) => `-${a}`).join('\n')}`,
      );
    }
    for (const fileName of agentsFileName) {
      const agent = await createSpecializedAgent(fileName);
      const ctrl = await getAssistantCtrl(fileName);
      // start agent befor store it
      if (ctrl) {
        await ctrl?.start(); // start the agent controller
        console.log(`✅  ${agent} Assistant controler started`);
      }
      team.agents[fileName] = { agent, ctrl };
    }
  } catch (e) {
    console.error(
      `❌ Create Specialized Assistant error: ${e?.message ? e?.message : ''}`,
    );
  }
  // create supervisor agent
  try {
    const supervisorAgent = await createSupervisorAgent(
      Object.values(team.agents)
        .map((a) => a.agent)
        .reduce((acc, a) => {
          acc[a.name] = a;
          return acc;
        }, {}),
    );
    team.supervisor = supervisorAgent;
  } catch (e) {
    console.error(
      `❌ Create Supervisor Assistant error: ${e?.message ? e?.message : ''}`,
    );
  }
  console.log(`✅  Done! Your AI Agent team is ready to use!`);
  return team;
}

/**
 * Function that creates a specialized agent based on the YML file name
 * @param fileName
 * @returns
 */
export async function createSpecializedAgent(fileName: string) {
  console.log('🤖 Creating Specialized agent...');
  console.log(
    `🏗  Build tools for specialized agent: ${fileName.replace('.yml', '')}`,
  );
  const tools = await getDynamicStructuredTools(fileName);
  console.log(
    `📦 Packages ${tools.length} tools for supervisor: ${fileName.replace('.yml', '')}`,
  );
  console.log(
    `💬 Configure LLM model: ${LLM_MODEL} with ${TEMP} sampling temperature`,
  );
  const promptTemmplate = await getAssistantPrompt(fileName);
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `${promptTemmplate}
      Always use your tools to complete tasks. 
      If you cannot complete a task, explain why and what additional information you need.`,
    ],
    new MessagesPlaceholder({ variableName: 'chat_history' }),
    ['system', '{context}'],
    new MessagesPlaceholder({ variableName: 'agent_scratchpad' }),
    ['human', '{input}'],
    new MessagesPlaceholder({ variableName: 'agent_scratchpad' }),
  ]);
  const llm = new ChatOpenAI({
    temperature: TEMP,
    modelName: LLM_MODEL,
    n: 1,
    maxTokens: 1000,
  });
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });
  const executor = new AgentExecutor({
    agent,
    tools,
    memory: undefined,
    // returnIntermediateSteps: true,
    maxIterations: 10,
  });
  executor.name = fileName.replace('.yml', '');
  return executor;
}

/**
 * Function that creates a supervisor agent based on the team agents
 * @param teamAgents
 * @returns
 */
export async function createSupervisorAgent(
  teamAgents: {
    [key: string]: AgentExecutor;
  },
  fileName = 'agent-h.yml',
) {
  console.log('🤖 Creating Supervisor agent...');
  const supervisorTools = await Promise.all(
    Object.entries(teamAgents).map(async ([name, agent]) => {
      const schema = z.object({
        input: z.string().describe(`The task to delegate to ${name}`),
        context: z.string().optional().describe('The context of the task'),
        chat_history: z
          .array(z.string())
          .optional()
          .describe('The chat history'),
      });
      const agentTool = tool(
        async ({ input, context, chat_history = [] }) => {
          console.log(
            `🦸‍♂️ Task delegated to "${name}": ${input} - Chat History: ${JSON.stringify(chat_history)}`,
          );
          try {
            const result = await agent.invoke(
              {
                name: `delegate_task_to_${name}`,
                context,
                input,
                chat_history,
              },
              { callbacks },
            );
            console.log(`✅ Task completed by "${name}"`);
            return JSON.stringify(result);
          } catch (e) {
            console.error(`❌ Task error by "${name}": ${e.message}`);
            return `${name} response: Error: ${e.message}`;
          }
        },
        {
          name: `delegate_task_to_${name}`,
          description: `Use this tool to delegate tasks to ${name}`,
          schema,
        },
      );
      return agentTool;
    }),
  ).then((tools) => tools || []);
  console.log(
    `🏗  Build tools for supervisor: ${fileName.replace('.yml', '')}`,
  );
  const tools = await getDynamicStructuredTools('agent-h.yml');
  const allTTools = [...tools, ...supervisorTools];
  console.log(
    `📦 Packages ${allTTools.length} tools for supervisor: ${fileName.replace('.yml', '')}`,
  );
  console.log(
    `💬 Configure LLM model: ${LLM_MODEL} with ${TEMP} sampling temperature`,
  );
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
  const promptTemmplate = await getAssistantPrompt();
  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    ['system', promptTemmplate],
    [
      'system',
      `You have a access to a team of multiples others agents with different skills and abilities. 
      You can delegate tasks to them and they will provide you with the information you need to complete your mission and goals.

      As the master supervizor your role is to:
      1. Always delegate tasks to your specialized agents based on their skills.
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
      - If an agent ask for confirmation and you have all the information needed, provide it to them to proceed.
      - Never response to the user without the specialized agents' responses. ALWAYS WAIT FOR THEM!!
      
      Here are the specialized agents in your team with their skills:
      ${teamTools.join('\n')}
    `,
    ],
    new MessagesPlaceholder({ variableName: 'chat_history' }),
    ['human', '{input}'],
    new MessagesPlaceholder({ variableName: 'agent_scratchpad' }),
  ]);
  const llm = new ChatOpenAI({
    temperature: TEMP,
    modelName: LLM_MODEL,
    n: 1,
    maxTokens: 1000,
  });

  const supervisorAgent = await createOpenAIFunctionsAgent({
    llm,
    tools: allTTools,
    prompt: supervisorPrompt,
  });
  const executor = new AgentExecutor({
    agent: supervisorAgent,
    tools: allTTools,
    memory: undefined,
    // returnIntermediateSteps: true,
    maxIterations: 10,
  });
  console.log('🎉 Supervisor agent created!');
  return executor;
}

/**
 * Function that returns the list of assistant file names excluding `agent-h`
 * because it is a reserved agent use for the main agent orchestrator
 * @returns {string[]} List of assistant file names
 */
export const getAssistantsFileName = () => {
  const filePath = join(process.cwd(), 'characters');
  const files = readdirSync(filePath);
  const filesName = files
    .filter((file) => file.includes('.yml'))
    .filter((file) => !file.includes('agent-h'))
    .map((file) => file.split('.yml')[0]);
  // chek if files content contain `Enabled: false` config
  // and remove it from the list
  const enabledFilesName = filesName.filter((file) => {
    const fileContent = readFileSync(join(filePath, `${file}.yml`), 'utf-8');
    const { Enabled } = yaml.load(fileContent) as any;
    return Enabled;
  });
  return enabledFilesName;
};

/**
 * Function that returns the list of all assistant file names
 * @returns
 */
export const getAllAssistantsFileName = () => {
  const filePath = join(process.cwd(), 'characters');
  const files = readdirSync(filePath);
  const filesName = files
    .filter((file) => file.includes('.yml'))
    .map((file) => file.split('.yml')[0]);
  return filesName;
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

/**
 * Function that returns the assistant tools function from the assistant file name
 */
export const getDynamicStructuredTools = async (assistantFileName: string) => {
  console.log(
    `📄 Get tools config form YAML file for : ${assistantFileName.replace('.yml', '')}`,
  );
  const { Tools } = getAssistantConfig(assistantFileName);
  const toolsNames = Tools?.map(({ Name }) => Name) || [];
  const tools: DynamicStructuredTool[] = [];
  await Promise.all(
    toolsNames.map(async (name) => {
      console.log(`🔧 Build tool ${name}`);
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
  const importPath = join(__dirname, '..', Ctrl);
  const moduleName = `${Ctrl.split('/').pop().toUpperCase()[0]}${toCamelCase(Ctrl.split('/').pop().split('.')[0].slice(1))}Agent`;
  const ctrl = await import(importPath)
    .then((module) => {
      return module?.[moduleName];
    })
    .catch(() => null);
  if (!ctrl) {
    throw new Error(
      `❌ Ctrl module ${moduleName} not found at path ${importPath}`,
    );
  }
  const i = new ctrl() as { start: () => Promise<void> };
  return i;
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

/**
 * Callbacks for the agent tool execution used into the `.invoke` method
 */
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
  const filePath = join(
    process.cwd(),
    'tools',
    normalizedName.endsWith('.yml') ? normalizedName : `${normalizedName}.yml`,
  );
  const fileContents = readFileSync(filePath, 'utf8');
  const data: AgentToolYmlConfig = yaml.load(
    fileContents,
  ) as AgentToolYmlConfig;
  const importPath = join(__dirname, '..', data.Handler);
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
          acc[Name] = {
            anyOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' },
              { type: 'object' },
            ],
          };
        }
        return acc;
      },
      {} as Record<string, any>,
    ),
  );
  // return tool config object with definition & handler
  const agentTool = tool(
    // functionHandler,
    async (...args) =>
      await functionHandler(...args).then((r) => JSON.stringify(r)),
    {
      name: data.Name,
      description: data.Description,
      schema,
    },
  );
  return agentTool;
};
