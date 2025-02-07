import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  LangchainChatService,
  VercelChatMessage,
} from './langchain-chat.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PromptAPIResponse } from '../entities/prompt-api-response.entity';
import { EvmAuthGuard } from '../evm-auth.guard';
import { TokenHolderGuard } from '../token-holder.guard';
import { convertJSONToYAML } from '../../utils';
import { readFileSync, writeFileSync } from 'fs';
import { Request } from 'express';
import { getAgentsAndToolsConfig } from '../../agents/agents-utils';
import { SendPromptDto } from '../dto/send-prompt.dto';

const PDF_BASE_PATH = join(process.cwd(), 'uploads', 'files');

@ApiTags('Agents')
@Controller('')
export class LangchainChatController {
  constructor(private readonly langchainChatService: LangchainChatService) {}

  @ApiBearerAuth()
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
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
  @Post('basic-prompt')
  async basicChat(@Body() data: { input: string }) {
    const message = data.input;
    return await this.langchainChatService.basicChat(message);
  }

  @ApiBearerAuth()
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
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
  @Post('context-aware-prompt')
  async contextAwareChat(
    @Body() contextAwareMessages: { messages: VercelChatMessage[] },
  ) {
    return await this.langchainChatService.contextAwareChat(
      contextAwareMessages,
    );
  }

  @ApiBearerAuth()
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
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
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

  @ApiBearerAuth()
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
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
  @Post('document-prompt')
  async documentChat(@Body() data: { message: string }) {
    const message = data.message;
    return await this.langchainChatService.documentChat(message);
  }

  @ApiBearerAuth()
  @ApiBody({
    type: SendPromptDto,
  })
  @ApiOperation({ summary: `Send a prompt to ai agent manager` })
  @ApiResponse({
    status: 200,
    description: 'The prompt was sent successfully',
    type: PromptAPIResponse,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
  @Post('agent-prompt')
  async agentChat(@Req() request: Request) {
    const contextAwareMessagesDto = request.body;
    const userAddress = request['user'].address;
    return await this.langchainChatService.agentChat({
      ...contextAwareMessagesDto,
      userAddress,
    });
  }

  @ApiBearerAuth()
  @UseGuards(EvmAuthGuard)
  @Get('/setup')
  async getConfig(@Req() request: Request) {
    // check if setup.log exists
    const path = join(process.cwd(), 'public/logs', 'setup.log');
    let setupLog = '';
    try {
      setupLog = readFileSync(path, 'utf8');
    } catch (error) {
      // console.log('Setup log not found');
    }
    if (setupLog.length > 0 && setupLog !== request['user'].address) {
      throw new ForbiddenException(
        'Setup already done. Delete `setup.log` to run setup again or use another wallet address.',
      );
    }
    const data = await getAgentsAndToolsConfig();
    // sort `Agent H` at the first position and the rest after by alphabetically
    const agentsConfig = data.agentsConfig.sort((a, b) =>
      a.Name === 'Agent H'
        ? -1
        : b.Name === 'Agent H'
          ? 1
          : a.Name.localeCompare(b.Name),
    );
    const toolsAvailable = data.toolsAvailable;
    return {
      agentsConfig,
      toolsAvailable,
    };
  }

  @ApiBearerAuth()
  @UseGuards(EvmAuthGuard)
  @Post('/setup')
  async updateConfig(@Req() request: Request) {
    // check if setup.log exists
    const path = join(process.cwd(), 'public/logs', 'setup.log');
    let setupLog = '';
    try {
      setupLog = readFileSync(path, 'utf8');
    } catch (error) {
      // console.log('Setup log not found');
    }
    if (setupLog.length > 0 && setupLog !== request['user'].address) {
      throw new ForbiddenException(
        'Setup already done. Delete `setup.log` to run setup again or use another wallet address.',
      );
    }
    const body = request.body;
    const agentsConfig: {
      fileName: string;
      Name: string;
      Enabled: boolean;
      Description: string;
      Instructions: string;
      Tools: {
        Name: string;
      }[];
      Ctrl: string | undefined;
    }[] = body.agentsConfig || [];
    if (agentsConfig.length === 0) {
      throw new BadRequestException('No agents config found');
    }
    // set files config
    agentsConfig.forEach(({ fileName, ...agent }) => {
      const filePath = join(
        process.cwd(),
        'characters',
        `${fileName.includes('yml') ? fileName : `${fileName}.yml`}`,
      );
      // convert `agent` to yaml
      const yamlString = convertJSONToYAML(agent);
      // write to file if exists or create new file
      writeFileSync(filePath, yamlString);
    });
    // create OR write to `setup.log` the address of the user
    writeFileSync(path, request['user'].address);
    console.log(`Write config done! Executed by: ${request['user'].address}`);
    // restart all agents
    await this.langchainChatService.restartTeam();
    // return default response
    return {
      data: 'success',
      success: true,
    };
  }

  @ApiBearerAuth()
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
  @Post('/restart-agents')
  async restartAgents(@Req() request: Request) {
    const path = join(process.cwd(), 'public/logs', 'setup.log');
    let setupLog = '';
    try {
      setupLog = readFileSync(path, 'utf8');
    } catch (error) {
      throw new BadRequestException(
        'Setup not done. Run setup before restarting agents. Visit `/setup`',
      );
    }
    if (setupLog.length > 0 && setupLog !== request['user'].address) {
      throw new ForbiddenException(
        'Not authorized to restart agents. Use another wallet address.',
      );
    }
    await this.langchainChatService.restartTeam();
    // return default response
    return {
      data: 'success',
      success: true,
    };
  }
}
