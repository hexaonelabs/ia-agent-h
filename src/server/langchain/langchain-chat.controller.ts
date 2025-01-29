import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  LangchainChatService,
  VercelChatMessage,
} from './langchain-chat.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

const PDF_BASE_PATH = join(process.cwd(), 'uploads', 'files');

@Controller('langchain-chat')
export class LangchainChatController {
  constructor(private readonly langchainChatService: LangchainChatService) {}

  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          example: 'Hello, how are you?',
        },
      },
    },
  })
  @Post('basic-chat')
  @HttpCode(200)
  async basicChat(@Body() data: { input: string }) {
    const message = data.input;
    return await this.langchainChatService.basicChat(message);
  }

  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                example: 'Hello, how are you?',
              },
              role: {
                type: 'string',
                example: 'user',
              },
            },
          },
        },
      },
    },
  })
  @Post('context-aware-chat')
  @HttpCode(200)
  async contextAwareChat(
    @Body() contextAwareMessages: { messages: VercelChatMessage[] },
  ) {
    return await this.langchainChatService.contextAwareChat(
      contextAwareMessages,
    );
  }

  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'document.pdf',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiConsumes('multipart/form-data')
  @Post('upload-document')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: PDF_BASE_PATH,
        filename: (req, file, callback) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          callback(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @HttpCode(200)
  async loadPDF(
    @Body() document: { name: string },
    @UploadedFile() file: File,
  ) {
    if ((file as any)?.filename) {
      document.name = (file as any)?.filename;
    }
    const filePath = join(PDF_BASE_PATH, document.name);
    return await this.langchainChatService.uploadPDF(filePath);
  }

  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Hello, how are you?',
        },
      },
    },
  })
  @Post('document-chat')
  @HttpCode(200)
  async documentChat(@Body() data: { message: string }) {
    const message = data.message;
    return await this.langchainChatService.documentChat(message);
  }

  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                example: 'Hello, how are you?',
              },
              role: {
                type: 'string',
                example: 'user',
              },
            },
          },
        },
      },
    },
  })
  @Post('agent-chat')
  @HttpCode(200)
  async agentChat(
    @Body() contextAwareMessagesDto: { messages: VercelChatMessage[] },
  ) {
    return await this.langchainChatService.agentChat(contextAwareMessagesDto);
  }
}
