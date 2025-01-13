import { Body, Controller, Get, Post, Render, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AgentService } from '../agents/agent.service';
import { createViemWalletClient } from 'src/viem/createViemWalletClient';
import * as fs from 'fs';
import * as p from 'path';
import { EvmAuthGuard } from './evm-auth.guard';

@Controller()
export class AppController {
  constructor(
    private readonly _appService: AppService,
    private readonly _agentService: AgentService,
  ) {}

  @Get()
  @Render('index')
  async root() {
    const { account } = createViemWalletClient();
    return {
      message: `${await this._appService.getHello()} My wallet address is ${account.address}`,
    };
  }

  @UseGuards(EvmAuthGuard)
  @Get('api')
  async getHello() {
    const { account } = createViemWalletClient();
    return `${await this._appService.getHello()} My wallet address is ${account.address}`;
  }

  @Get('api/test')
  async test() {
    return {
      data: 'Hello World',
      success: true,
    };
  }

  @Post('/api/auth/evm-signin')
  async evmSignIn(
    @Body() body: { address: string; signature: string; message: string },
  ) {
    return this._appService.evmSignIn(
      body.address,
      body.signature,
      body.message,
    );
  }

  @UseGuards(EvmAuthGuard)
  @Post('api/prompt')
  async chat(@Body() body: { threadId?: string; userInput: string }): Promise<{
    data:
      | {
          threadId: string;
          message: string;
        }
      | string;
    success: boolean;
  }> {
    // return {
    //   data: {
    //     message: body.userInput,
    //     threadId: body.threadId,
    //   },
    //   success: true,
    // };
    const response = await this._agentService
      .sendMessage(body)
      .then((data) => ({ data, success: true }))
      .catch((error) => ({
        data: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }));
    return response;
  }

  @UseGuards(EvmAuthGuard)
  @Get('api/logs')
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
