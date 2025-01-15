import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { AgentService } from '../agents/agent.service';
import * as fs from 'fs';
import * as p from 'path';
import { Response } from 'express';
import {
  ApiTags,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SendPromptDto } from './dto/send-prompt.dto';
import { PromptAPIResponse } from './entities/prompt-api-response.entity';

// @ApiBearerAuth()
@ApiTags('Agent-H')
@Controller()
export class AppController {
  constructor(
    private readonly _appService: AppService,
    private readonly _agentService: AgentService,
  ) {}

  @ApiExcludeEndpoint()
  @Get('')
  serveStaticHtml(@Res() res: Response) {
    res.sendFile(
      p.join(process.cwd(), 'dist', 'platforms', 'browser', 'index.html'),
    );
  }

  @Get('/ping')
  async test() {
    return {
      data: 'Hello World',
      success: true,
    };
  }

  @Post('/auth/evm-signin')
  async evmSignIn(
    @Body() body: { address: string; signature: string; message: string },
  ) {
    return this._appService.evmSignIn(
      body.address,
      body.signature,
      body.message,
    );
  }

  // @UseGuards(EvmAuthGuard)
  @ApiOperation({ summary: `Send a prompt to ia agent manager` })
  @ApiResponse({
    status: 200,
    description: 'The prompt was sent successfully',
    type: PromptAPIResponse,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @Post('/prompt')
  async chat(@Body() body: SendPromptDto): Promise<{
    data:
      | {
          threadId: string;
          message: string;
        }
      | string;
    success: boolean;
  }> {
    const response = await this._agentService
      .sendMessage(body)
      .then((data) => ({ data, success: true }))
      .catch((error) => ({
        data: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }));
    return response;
  }

  // @UseGuards(EvmAuthGuard)
  @Get('/logs')
  async getLogs() {
    try {
      // read logs from app.logs
      const path = p.join(process.cwd(), 'public/logs', 'app.log');
      const logs = fs.readFileSync(path, 'utf8');
      const logsArray = logs.split('\n');
      // only return the last 100 logs
      if (logsArray.length > 100) {
        logsArray.splice(0, logsArray.length - 100);
      }
      return {
        data: logsArray,
        success: true,
      };
    } catch (error) {
      return {
        data: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  }
}
