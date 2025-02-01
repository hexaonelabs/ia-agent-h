import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import * as fs from 'fs';
import * as p from 'path';
import { Response, Request } from 'express';
import { ApiTags, ApiExcludeEndpoint, ApiBearerAuth } from '@nestjs/swagger';
import { EvmAuthGuard } from './evm-auth.guard';
import { TokenHolderGuard } from './token-holder.guard';
import { SseSubjectService } from './sse-subject.service';
import { Observable } from 'rxjs';

@ApiTags('Core')
@Controller()
export class AppController {
  constructor(
    private readonly _appService: AppService,
    private readonly _sseSubjectService: SseSubjectService,
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
    // const config: TickConfig = {
    //   asset: 'BTC',
    //   base: 'USDC',
    //   allocation: 0.1,
    //   spread: 0.1,
    //   tickInterval: 30 * 1000,
    // };
    // const wallet = createViemWalletClient();
    // await run({ ...config, walletAddress: wallet.account.address });
    return {
      data: 'success',
      success: true,
    };
  }

  @UseGuards(TokenHolderGuard)
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

  // @ApiBearerAuth()
  // @ApiOperation({ summary: `Send a prompt to ia agent manager` })
  // @ApiBody({ type: SendPromptDto })
  // @ApiResponse({
  //   status: 200,
  //   description: 'The prompt was sent successfully',
  //   type: PromptAPIResponse,
  // })
  // @ApiResponse({ status: 403, description: 'Forbidden.' })
  // @UseGuards(EvmAuthGuard)
  // @UseGuards(TokenHolderGuard)
  // @Post('/prompt')
  // async chat(@Req() request: Request): Promise<{
  //   data: {
  //     threadId: string;
  //     message: string;
  //   };
  //   success: boolean;
  // }> {
  //   const body = request.body;
  //   let threadId = body.threadId;
  //   if (!threadId) {
  //     const thread = await this._agentService.createThread();
  //     threadId = thread.id;
  //   }
  //   const userAddress = request['user'].address;
  //   const response = await this._agentService
  //     .sendMessage({ ...body, threadId }, userAddress)
  //     .then((data) => ({ data, success: true }))
  //     .catch((error) => ({
  //       data: {
  //         threadId,
  //         message: error instanceof Error ? error.message : 'Unknown error',
  //       },
  //       success: false,
  //     }));
  //   return response;
  // }

  /**
   * Message event from server using SSE.
   * @return an observable that emit message to the client
   */
  @ApiExcludeEndpoint()
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
  @Sse('/sse')
  sse(@Req() request: Request): Observable<MessageEvent> {
    const usserAddress = request['user'].address;
    return this._sseSubjectService.getUserSubject$(usserAddress);
  }

  @ApiBearerAuth()
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
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

  @Get('/is-setup')
  async isSetup() {
    // check if setup.log exists
    const path = p.join(process.cwd(), 'public/logs', 'setup.log');
    try {
      const setupLog = fs.readFileSync(path, 'utf8');
      return {
        success: setupLog.length > 0,
      };
    } catch (error) {
      return {
        success: false,
      };
    }
  }
}
