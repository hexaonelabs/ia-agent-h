import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AgentService } from '../agents/agent.service';
import * as fs from 'fs';
import * as p from 'path';
import { Response, Request } from 'express';
import {
  ApiTags,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { SendPromptDto } from './dto/send-prompt.dto';
import { PromptAPIResponse } from './entities/prompt-api-response.entity';
import { EvmAuthGuard } from './evm-auth.guard';
import { TokenHolderGuard } from './token-holder.guard';
import { SseSubjectService } from './sse-subject.service';
import { Observable } from 'rxjs';
import { convertJSONToYAML } from 'src/utils';

@ApiTags('Agent-H')
@Controller()
export class AppController {
  constructor(
    private readonly _appService: AppService,
    private readonly _agentService: AgentService,
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

  @ApiBearerAuth()
  @ApiOperation({ summary: `Send a prompt to ia agent manager` })
  @ApiBody({ type: SendPromptDto })
  @ApiResponse({
    status: 200,
    description: 'The prompt was sent successfully',
    type: PromptAPIResponse,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
  @Post('/prompt')
  async chat(@Req() request: Request): Promise<{
    data: {
      threadId: string;
      message: string;
    };
    success: boolean;
  }> {
    const body = request.body;
    let threadId = body.threadId;
    if (!threadId) {
      const thread = await this._agentService.createThread();
      threadId = thread.id;
    }
    const userAddress = request['user'].address;
    const response = await this._agentService
      .sendMessage({ ...body, threadId }, userAddress)
      .then((data) => ({ data, success: true }))
      .catch((error) => ({
        data: {
          threadId,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        success: false,
      }));
    return response;
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

  @ApiBearerAuth()
  @UseGuards(EvmAuthGuard)
  @Get('/setup')
  async getConfig(@Req() request: Request) {
    // check if setup.log exists
    const path = p.join(process.cwd(), 'public/logs', 'setup.log');
    let setupLog = '';
    try {
      setupLog = fs.readFileSync(path, 'utf8');
    } catch (error) {
      // console.log('Setup log not found');
    }
    if (setupLog.length > 0 && setupLog !== request['user'].address) {
      throw new ForbiddenException(
        'Setup already done. Delete `setup.log` to run setup again or use another wallet address.',
      );
    }
    return this._appService.getAgentsAndToolsConfig().then((data) => ({
      // sort `Agent H` at the first position and the rest after by alphabetically
      agentsConfig: data.agentsConfig.sort((a, b) =>
        a.Name === 'Agent H'
          ? -1
          : b.Name === 'Agent H'
            ? 1
            : a.Name.localeCompare(b.Name),
      ),
      toolsAvailable: data.toolsAvailable,
    }));
  }

  @ApiBearerAuth()
  @UseGuards(EvmAuthGuard)
  @Post('/setup')
  async updateConfig(@Req() request: Request) {
    // check if setup.log exists
    const path = p.join(process.cwd(), 'public/logs', 'setup.log');
    let setupLog = '';
    try {
      setupLog = fs.readFileSync(path, 'utf8');
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
      const filePath = p.join(
        process.cwd(),
        'characters',
        `${fileName.includes('yml') ? fileName : `${fileName}.yml`}`,
      );
      // convert `agent` to yaml
      const yamlString = convertJSONToYAML(agent);
      // write to file if exists or create new file
      fs.writeFileSync(filePath, yamlString);
    });
    // create OR write to `setup.log` the address of the user
    fs.writeFileSync(path, request['user'].address);
    console.log(`Write config done! Executed by: ${request['user'].address}`);
    // restart all agents
    await this._agentService.restartAgents();
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
    const path = p.join(process.cwd(), 'public/logs', 'setup.log');
    let setupLog = '';
    try {
      setupLog = fs.readFileSync(path, 'utf8');
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
    await this._agentService.restartAgents();
    // return default response
    return {
      data: 'success',
      success: true,
    };
  }
}
