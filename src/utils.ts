import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as p from 'path';
import { ToolConfig, yamlToToolParser } from './tools';
import { CustomLogger } from './logger.service';

export const upsertAgent = (
  filePath: string,
  agentName: string,
  enabled: boolean,
  additionalProperties: { [key: string]: any } = {},
) => {
  // Read the YAML file
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const data = yaml.load(fileContents);
  // Find the agent by its name
  const agent = data.Agents_list.find((agent: any) => agent.Name === agentName);
  if (agent) {
    // Update the `enabled` value
    agent.enabled = enabled;
  } else {
    // Add the new agent to the list
    const newAgent = { Name: agentName, enabled, ...additionalProperties };
    data.Agents_list.push(newAgent);
  }
  // Convert the data to YAML
  const newYaml = yaml.dump(data, { indent: 2 });
  // Write the modified data back to the YAML file
  fs.writeFileSync(filePath, newYaml, 'utf8');
};

export const getAgentsEnabled = (
  filePath: string,
): { name: string; enabled: true }[] => {
  // Read the YAML file
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const data = yaml.load(fileContents);
  // Filter the agents by their `enabled` value
  return data.Agents_list.filter((agent: any) => agent.enabled);
};

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

export const getAssistantCtrl = async (assistantFileName: string) => ({
  start: async () => new CustomLogger(assistantFileName).log('Started!'),
});
