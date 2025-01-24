import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getTokenBalance } from '../tools/getTokenBalance';

@Injectable()
export class TokenHolderGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const address = await this.extractAddressFromRequest(request);
    const isWhiteListed = await this.isWhiteListed(address);
    if (!address) {
      return false;
    }
    if (isWhiteListed) {
      return true;
    }
    try {
      const result = await getTokenBalance({
        walletAddress: address as `0x${string}`,
        tokenAddress: process.env.ENZYME_FUND_ADDRESS as `0x${string}`,
        network: 'arbirtrum',
      });
      return Number(result) > 10 ? true : false;
    } catch {
      return false;
    }
  }

  private async extractAddressFromRequest(
    request: any,
  ): Promise<string | undefined> {
    const headerToken = this.extractTokenFromHeader(request);
    const urlToken = this.extractTokenFromUrl(request);
    const headerValid = headerToken
      ? await this.jwtService.verify(headerToken)
      : undefined;
    const urlValid = urlToken
      ? await this.jwtService.verify(urlToken)
      : undefined;
    return (
      request?.body?.address ||
      request['user']?.address ||
      headerValid?.address ||
      urlValid?.address
    );
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractTokenFromUrl(request: any): string | undefined {
    return request.query.token;
  }

  private async isWhiteListed(address: string): Promise<boolean> {
    return (
      process.env.WHITE_LISTED_ADDRESSES?.split(',')?.includes(address) || false
    );
  }
}
