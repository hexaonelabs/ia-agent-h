import * as fs from 'fs';
import * as yaml from 'js-yaml';

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
