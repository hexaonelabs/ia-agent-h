import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { getERC20TokenBalance } from 'src/tools/getTokenERC20Balance';

@Injectable()
export class TokenHolderGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const address = this.extractAddressFromBody(request);
    const whiteListed = await this.isWhiteListed(address);
    if (whiteListed) {
      return true;
    }
    if (!address) {
      return false;
    }
    try {
      const result = await getERC20TokenBalance({
        walletAddress: address as `0x${string}`,
        tokenAddress: '0x20b199a2874440c652d9f18e5768d1a1ef76938d',
        network: 'arbitrum',
      });
      return Number(result) > 10 ? true : false;
    } catch {
      return false;
    }
  }

  private extractAddressFromBody(request: any): string | undefined {
    return request?.body?.address;
  }

  private async isWhiteListed(address: string): Promise<boolean> {
    return (
      process.env.WHITE_LISTED_ADDRESSES?.split(',')?.includes(address) || false
    );
  }
}
