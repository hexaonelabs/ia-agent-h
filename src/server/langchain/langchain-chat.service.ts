import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
// import { BasicMessageDto } from './dtos/basic-message.dto';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { HttpResponseOutputParser } from 'langchain/output_parsers';
// import { DocumentDto } from './dtos/document.dto';
// import { PDF_BASE_PATH } from 'src/utils/constants/common.constants';
// import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { initDB } from '../../rag';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Document } from '@langchain/core/documents';
import * as pdf from 'pdf-parse';

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
      return this.successResponse(response);
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
      return this.successResponse(response);
    } catch (e: unknown) {
      this.exceptionHandling(e);
    }
  }

  async documentChat(query: string) {
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
      return this.successResponse(response);
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
      const tools = [];
      const messages = contextAwareMessagesDto.messages ?? [];
      const formattedPreviousMessages = messages
        .slice(0, -1)
        .map(this.formatBaseMessages);
      const currentMessageContent = messages[messages.length - 1].content;
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          'You are an agent that follows SI system standards and responds responds normally',
        ],
        new MessagesPlaceholder({ variableName: 'chat_history' }),
        ['user', '{input}'],
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
      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        memory: undefined,
      });
      const response = await agentExecutor.invoke({
        input: currentMessageContent,
        chat_history: formattedPreviousMessages,
      });
      return {
        statusCode: HttpStatus.OK,
        message: 'Success',
        data: response.output,
      };
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

  private successResponse = (response: Uint8Array) => ({
    statusCode: HttpStatus.OK,
    message: 'success',
    data: Object.values(response)
      .map((code) => String.fromCharCode(code))
      .join(''),
  });

  private exceptionHandling = (e: unknown) => {
    Logger.error(e);
    throw new HttpException(
      'Internal Server Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
      e,
    );
  };
}
