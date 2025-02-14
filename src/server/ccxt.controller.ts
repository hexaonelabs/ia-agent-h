import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { ApiTags, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { EvmAuthGuard } from './evm-auth.guard';
import { TokenHolderGuard } from './token-holder.guard';
import {
  backtestBot,
  CCXTToolsArgs,
  runCCXTBot,
  stopCCXTBot,
} from '../tools/runCcxtTick';

@ApiTags('CCXT')
@Controller()
export class CCXTController {
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        asset: {
          type: 'string',
          example: 'BTC',
        },
        base: {
          type: 'string',
          example: 'USDC',
        },
        allocation: {
          type: 'number',
          example: 0.1,
        },
        spread: {
          type: 'number',
          example: 0.1,
        },
        broker: {
          type: 'string',
          example: 'hyperliquid',
        },
        tickInterval: {
          type: 'number',
          example: 3600000,
        },
      },
      required: [
        'asset',
        'base',
        'allocation',
        'spread',
        'broker',
        'tickInterval',
      ],
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @UseGuards(TokenHolderGuard)
  @Post('/startBot')
  async startBot(@Body() body: CCXTToolsArgs) {
    const { message, success, data } = await runCCXTBot(body);
    return {
      data,
      message,
      success,
    };
  }

  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        asset: {
          type: 'string',
          example: 'BTC',
        },
        base: {
          type: 'string',
          example: 'USDC',
        },
        allocation: {
          type: 'number',
          example: 0.1,
        },
        spread: {
          type: 'number',
          example: 0.1,
        },
        broker: {
          type: 'string',
          example: 'hyperliquid',
        },
        tickInterval: {
          type: 'number',
          example: 3600000,
        },
      },
      required: [
        'asset',
        'base',
        'allocation',
        'spread',
        'broker',
        'tickInterval',
      ],
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @Post('/backtestBot')
  async backtestBot(@Body() body: CCXTToolsArgs) {
    const { message, success, data } = await backtestBot(body);
    return {
      data,
      message,
      success,
    };
  }

  @ApiBearerAuth()
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseGuards(EvmAuthGuard)
  @Get('/stopBot')
  async stopBot() {
    const { message, success } = stopCCXTBot();
    return {
      message: message,
      success,
      data: null,
    };
  }
}
