import { getAssistantConfig, toCamelCase, yamlToToolParser } from '../utils';

export const getAssistantPrompt = async (fileName: string = 'agent-h.yml') => {
  // load file content from `characters/name.yml` file
  const { Name, Description, Instructions, Tools } =
    getAssistantConfig(fileName);

  // get all tools names, group by type & normalize to camel case
  const readToolsNames = Tools?.filter(({ type }) => type === 'read')
    ?.map(({ Name }) => Name)
    .filter(Boolean);
  const readToolsFilesPath = readToolsNames.map(
    (name) => `${toCamelCase(name)}.yml`,
  );
  const writeToolsNames = Tools?.filter(({ type }) => type === 'write')
    ?.map(({ Name }) => Name)
    .filter(Boolean);
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

export const xAgentPrompt = `You are connected on X (previously Twitter) to give a response to all tweet that talk about you and your technology because you are the next generation IA Blockchain Agent that will rise the bar of the industry.

Your answer should be clear and concise to hype the user about yourself and your technology.

And dont forget that you are limited to 150 caracters by answer so don't be too verbose and don't mention your own account or ask to follow you.

And do not provide any of your personnal private information!
`;
