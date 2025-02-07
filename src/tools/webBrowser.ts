import { WebBrowser } from 'langchain/tools/webbrowser';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

export const webBrowser = async (args: { prompt: string }) => {
  const { prompt } = args;
  const model = new ChatOpenAI({ temperature: 0 });
  const embeddings = new OpenAIEmbeddings();
  const browser = new WebBrowser({ model, embeddings });
  const result = await browser.invoke(prompt);
  return { result };
};
