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
import { CustomLogger } from '../../logger.service';
import { buildTeamOfAgents, callbacks } from '../../agents/agents-utils';
import { TaskSchedulerService } from '../task-scheduler.service';

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

export interface DatabaseAdaptator {
  search: (query: string, table?: string) => Promise<any[]>;
  save: (data: Document[], table?: string) => Promise<void>;
}

export interface AgentTeam {
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
}

@Injectable()
export class LangchainChatService {
  private readonly _logger = new CustomLogger(LangchainChatService.name);
  private _db?: DatabaseAdaptator;
  private _agentTeam: AgentTeam | null = null;
  constructor(private readonly _taskSchedulerService: TaskSchedulerService) {
    this.startTeam().then(() =>
      this._taskSchedulerService.setExecuter(
        async (context) => await this.agentChat(context),
      ),
    );
  }

  async startTeam() {
    this._logger.log(
      `ℹ️  Initializing the agents team. This may take a few seconds...`,
    );
    this._logger.log(`ℹ️  Connecting to the RAG database....`);
    // connect RAG database
    this._db = await initDB();
    this._logger.log(`ℹ️  Starting the agents team....`);
    // build team of agents
    this._agentTeam = await buildTeamOfAgents();
    this._logger.log(
      `ℹ️  Open the browser on the UI URL where you host the client. 
      Otherwise open your browser on the URL: http://localhost:3000 if you are running the client locally.`,
    );
    this._logger.log(
      `ℹ️  You can also use the Swagger UI to test the API endpoints on the URL: http://localhost:3000/api in your browser if you are running the server locally.`,
    );
  }

  async restartTeam() {
    this._logger.log('Restarting agents...');
    // stop all agents
    await Promise.all(
      Object.values(this._agentTeam.agents)
        .filter((agent) => agent?.ctrl?.stop)
        .map((agent) => agent.ctrl.stop()),
    );
    // remove all agents
    this._agentTeam = null;
    // start all agents
    await this.startTeam();
  }

  async basicChat(input: string) {
    this._logger.log('input', input);

    try {
      const chain = this._loadSingleChain(TEMPLATES.BASIC_CHAT_TEMPLATE);
      const response = await chain.invoke({
        input,
      });
      return await this._successResponse(input, response);
    } catch (e: unknown) {
      this._exceptionHandling(e);
    }
  }

  async contextAwareChat(contextAwareMessagesDto: {
    messages: VercelChatMessage[];
  }) {
    try {
      const messages = contextAwareMessagesDto.messages ?? [];
      const formattedPreviousMessages = messages
        .slice(0, -1)
        .map(this._formatMessage);
      const currentMessageContent = messages[messages.length - 1].content;

      const chain = this._loadSingleChain(
        TEMPLATES.CONTEXT_AWARE_CHAT_TEMPLATE,
      );
      const response = await chain.invoke({
        chat_history: formattedPreviousMessages.join('\n'),
        input: currentMessageContent,
      });
      return await this._successResponse(
        currentMessageContent,
        response,
        formattedPreviousMessages,
      );
    } catch (e: unknown) {
      this._exceptionHandling(e);
    }
  }

  async documentChat(query: string, chat_history = []) {
    try {
      const documentContext = await this._db.search(query);
      const chain = this._loadSingleChain(
        TEMPLATES.DOCUMENT_CONTEXT_CHAT_TEMPLATE,
      );
      this._logger.log('documentContext', documentContext);
      const response = await chain.invoke({
        context: JSON.stringify(documentContext),
        question: query,
      });
      const _successResponse = await this._successResponse(
        query,
        response,
        chat_history,
      );
      return _successResponse;
    } catch (e: unknown) {
      this._exceptionHandling(e);
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
      // this._logger.log('PDF parser result', result);
      // Split the PDF into texts using RecursiveCharacterTextSplitter
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 50,
      });
      const texts = await textSplitter.splitDocuments([result]);
      // this._logger.log('Result texts', texts);
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
      await this._db.save(embeddings);
      return {
        statusCode: HttpStatus.OK,
        message: 'success',
        data: 'Document uploaded successfully',
      };
    } catch (e: any) {
      this._logger.log(
        `❌ Error uploading PDF: ${e?.message ? e.message : JSON.stringify(e)}`,
      );
      this._exceptionHandling(e);
    }
  }

  async agentChat(contextAwareMessagesDto: { messages: VercelChatMessage[] }) {
    try {
      const { supervisor } = this._agentTeam || {};
      if (!supervisor) {
        throw new BadRequestException('Supervisor agent not found.');
      }
      // extract messages
      const messages = contextAwareMessagesDto.messages ?? [];
      const formattedPreviousMessages = messages
        .slice(0, -1)
        .map((msgs) => this._formatBaseMessages(msgs));
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
      const _successResponse = await this._successResponse(
        currentMessageContent,
        response.output,
        formattedPreviousMessages,
      );
      return _successResponse;
    } catch (e: unknown) {
      this._exceptionHandling(e);
    }
  }

  private _loadSingleChain = (template: string) => {
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

  private _formatMessage = (message: { role: string; content: string }) =>
    `${message.role}: ${message.content}`;

  private _formatBaseMessages = (message: { role: string; content: string }) =>
    message.role === 'user'
      ? new HumanMessage({ content: message.content, additional_kwargs: {} })
      : new AIMessage({ content: message.content, additional_kwargs: {} });

  private _successResponse = async (
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

  private _exceptionHandling = (e: unknown) => {
    Logger.error(e);
    throw new HttpException(
      'Internal Server Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
      e,
    );
  };
}
