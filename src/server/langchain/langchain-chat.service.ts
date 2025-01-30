import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { HttpResponseOutputParser } from 'langchain/output_parsers';
import { AgentExecutor } from 'langchain/agents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { initDB } from '../../rag';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Document } from '@langchain/core/documents';
import * as pdf from 'pdf-parse';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import {
  callbacks,
  createSpecializedAgent,
  createSupervisorAgent,
  getAssistantCtrl,
  getAssistantsFileName,
} from '../../utils';

export enum TEMPLATES {
  BASIC_CHAT_TEMPLATE = `You are an expert software engineer, give concise response.
   User: {input}
   AI:`,
  CONTEXT_AWARE_CHAT_TEMPLATE = `You are an expert software engineer, give concise response.
  
   Current conversation:
   {chat_history}
   
   User: {input}
   AI:`,

  DOCUMENT_CONTEXT_CHAT_TEMPLATE = `Answer the question based only on the following context:
   {context}
   
   Question: {question}`,
}
// Initialize memory to persist state between graph runs
// const agentCheckpointer = new MemorySaver();

export interface VercelChatMessage {
  role: string;
  content: string;
}

@Injectable()
export class LangchainChatService {
  db: {
    search: (query: string, table?: string) => Promise<any[]>;
    save: (data: Document[], table?: string) => Promise<void>;
  };
  constructor() {
    initDB().then((res) => {
      this.db = res;
    });
  }

  async basicChat(input: string) {
    console.log('input', input);

    try {
      const chain = this.loadSingleChain(TEMPLATES.BASIC_CHAT_TEMPLATE);
      const response = await chain.invoke({
        input,
      });
      return await this.successResponse(input, response);
    } catch (e: unknown) {
      this.exceptionHandling(e);
    }
  }

  async contextAwareChat(contextAwareMessagesDto: {
    messages: VercelChatMessage[];
  }) {
    try {
      const messages = contextAwareMessagesDto.messages ?? [];
      const formattedPreviousMessages = messages
        .slice(0, -1)
        .map(this.formatMessage);
      const currentMessageContent = messages[messages.length - 1].content;

      const chain = this.loadSingleChain(TEMPLATES.CONTEXT_AWARE_CHAT_TEMPLATE);
      const response = await chain.invoke({
        chat_history: formattedPreviousMessages.join('\n'),
        input: currentMessageContent,
      });
      return await this.successResponse(
        currentMessageContent,
        response,
        formattedPreviousMessages,
      );
    } catch (e: unknown) {
      this.exceptionHandling(e);
    }
  }

  async documentChat(query: string, chat_history = []) {
    try {
      const documentContext = await this.db.search(query);
      const chain = this.loadSingleChain(
        TEMPLATES.DOCUMENT_CONTEXT_CHAT_TEMPLATE,
      );
      console.log('documentContext', documentContext);
      const response = await chain.invoke({
        context: JSON.stringify(documentContext),
        question: query,
      });
      const successResponse = await this.successResponse(
        query,
        response,
        chat_history,
      );
      return successResponse;
    } catch (e: unknown) {
      this.exceptionHandling(e);
    }
  }

  async uploadPDF(filePath: string) {
    try {
      const resolvedPath = resolve(filePath);
      // Check if the file exists
      if (!existsSync(resolvedPath)) {
        throw new BadRequestException('File does not exist.');
      }

      // Load the PDF using pdf-parse
      const dataBuffer = readFileSync(resolvedPath);
      const result: Document = await pdf(dataBuffer).then((data) => {
        const doc: Document = {
          pageContent: data.text,
          metadata: data.metadata || [],
        };
        return doc;
      });
      // console.log('PDF parser result', result);
      // Split the PDF into texts using RecursiveCharacterTextSplitter
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 50,
      });
      const texts = await textSplitter.splitDocuments([result]);
      // console.log('Result texts', texts);
      let embeddings: Document[] = [];
      for (let index = 0; index < texts.length; index++) {
        const page = texts[index];
        const splitTexts = await textSplitter.splitText(page.pageContent);
        const pageEmbeddings = splitTexts
          // limit to 10 pages
          .slice(0, 10)
          .filter((text) => text.length > 0)
          .map((text) => ({
            pageContent: text,
            metadata: {
              pageNumber: index,
            },
          }));
        embeddings = embeddings.concat(pageEmbeddings);
      }
      await this.db.save(embeddings);
      return {
        statusCode: HttpStatus.OK,
        message: 'success',
        data: 'Document uploaded successfully',
      };
    } catch (e: unknown) {
      console.log(e);

      this.exceptionHandling(e);
    }
  }

  async agentChat(contextAwareMessagesDto: { messages: VercelChatMessage[] }) {
    try {
      const { supervisor } = await buildTeamOfAgents();
      console.log('supervisor', supervisor);

      // extract messages
      const messages = contextAwareMessagesDto.messages ?? [];
      const formattedPreviousMessages = messages
        .slice(0, -1)
        .map(this.formatBaseMessages);
      // get current message
      const currentMessageContent = messages[messages.length - 1].content;
      // invoke supervisor agent
      const response = await supervisor.invoke(
        {
          input: currentMessageContent,
          chat_history: formattedPreviousMessages,
        },
        { callbacks },
      );
      // build response and return
      const successResponse = await this.successResponse(
        currentMessageContent,
        response.output,
        formattedPreviousMessages,
      );
      return successResponse;
    } catch (e: unknown) {
      this.exceptionHandling(e);
    }
  }

  private loadSingleChain = (template: string) => {
    const prompt = PromptTemplate.fromTemplate(template);

    const model = new ChatOpenAI({
      temperature: 0.7,
      modelName: 'gpt-3.5-turbo',
      n: 1,
      maxTokens: 100,
    });
    const outputParser = new HttpResponseOutputParser();
    return prompt.pipe(model).pipe(outputParser);
  };

  private formatMessage = (message: { role: string; content: string }) =>
    `${message.role}: ${message.content}`;

  private formatBaseMessages = (message: { role: string; content: string }) =>
    message.role === 'user'
      ? new HumanMessage({ content: message.content, additional_kwargs: {} })
      : new AIMessage({ content: message.content, additional_kwargs: {} });

  private successResponse = async (
    query: string,
    response: string | Uint8Array,
    chat_history = [],
  ) => {
    let answer = response as string;
    if (response instanceof Uint8Array) {
      answer = Object.values(response)
        .map((code) => String.fromCharCode(code))
        .join('')
        .trim();
    }
    // build output
    const history = new InMemoryChatMessageHistory();
    await history.addMessage(new HumanMessage(query));
    await history.addMessage(new AIMessage(answer));
    const messages = await history.getMessages();
    chat_history.push(...messages);
    // return response
    return {
      statusCode: HttpStatus.OK,
      message: 'success',
      data: {
        answer,
        chat_history,
      },
    };
  };

  private exceptionHandling = (e: unknown) => {
    Logger.error(e);
    throw new HttpException(
      'Internal Server Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
      e,
    );
  };
}

async function buildTeamOfAgents() {
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
  // search for specialized agents
  const agentsFileName = getAssistantsFileName();
  // return if no agents found
  if (!agentsFileName) {
    return team;
  }
  // else create specialized agents
  try {
    if (agentsFileName.length === 0) {
      console.log('🤖 No more assistant found');
      return team;
    }
    console.log(
      `🤖 Others assistants enabled:\n${agentsFileName.map((a) => `-${a}`).join('\n')}`,
    );
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
  return team;
}
