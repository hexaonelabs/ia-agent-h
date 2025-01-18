import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getTokenBalance } from 'src/tools/getTokenBalance';
import { arbitrum } from 'viem/chains';

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
        chainId: arbitrum.id,
      });
      return Number(result) > 10 ? true : false;
    } catch {
      return false;
    }
  }

  private async extractAddressFromRequest(
    request: any,
  ): Promise<string | undefined> {
    return (
      request?.body?.address ||
      request['user']?.address ||
      (await this.jwtService.verify(this.extractTokenFromHeader(request)))
        ?.address
    );
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async isWhiteListed(address: string): Promise<boolean> {
    return (
      process.env.WHITE_LISTED_ADDRESSES?.split(',')?.includes(address) || false
    );
  }
}
