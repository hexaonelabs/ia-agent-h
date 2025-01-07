import { Body, Controller, Get, Post, Render } from '@nestjs/common';
import { AppService } from './app.service';
import { AgentService } from '../agents/agent.service';
import { createViemWalletClient } from 'src/viem/createViemWalletClient';

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

  @Get('api')
  async getHello() {
    const { account } = createViemWalletClient();
    return `${await this._appService.getHello()} My wallet address is ${account.address}`;
  }

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
    return {
      data: {
        message: body.userInput,
        threadId: body.threadId,
      },
      success: true,
    };
    // const response = await this._agentService
    //   .sendMessage(body)
    //   .then((data) => ({ data, success: true }))
    //   .catch((error) => ({
    //     data: error instanceof Error ? error.message : 'Unknown error',
    //     success: false,
    //   }));
    // return response;
  }
}
