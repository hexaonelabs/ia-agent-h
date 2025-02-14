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
import { SseSubjectService } from './sse-subject.service';
import { Observable } from 'rxjs';
import { EvmAuthGuard } from './evm-auth.guard';
import { TokenHolderGuard } from './token-holder.guard';

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
