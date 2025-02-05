import * as yaml from 'js-yaml';

// replace `_` & `-` by convert to camel case
export const toCamelCase = (value: string) => {
  return value.replace(/[-_](.)/g, (_, group) => group.toUpperCase());
};

export const convertJSONToYAML = (json: any) => {
  return yaml.dump(json);
};
