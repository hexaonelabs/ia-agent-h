import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { ethers } from 'ethers';
import { JwtService } from '@nestjs/jwt';
import {
  getAllAssistantsFileName,
  getAllTools,
  getAssistantConfig,
} from '../utils';

@Injectable()
export class AppService {
  constructor(private readonly jwtService: JwtService) {}

  async getHello() {
    const file = createReadStream(join(process.cwd(), 'package.json'));
    const data = await new Promise((resolve, reject) => {
      let data = '';
      file.on('data', (chunk) => (data += chunk));
      file.on('end', () => resolve(data));
      file.on('error', reject);
    });
    const pkg = JSON.parse(data as string);
    return `Hello World! I'm ${(pkg?.name as string).replace('ia-', '').toUpperCase()} v${pkg?.version}.`;
  }

  async evmSignIn(address: string, signature: string, message: string) {
    // Vérifiez la signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Générez un JWT
    const payload = { address: address };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async getAgentsAndToolsConfig() {
    const files = getAllAssistantsFileName();
    const agentsConfig = files.map((file) => {
      const { Name, Description, Tools } = getAssistantConfig(file);
      console.log({ Name, Description, Tools });
      return { Name, Description, Tools };
    });
    const toolsAvailable = getAllTools();
    return { agentsConfig, toolsAvailable };
  }
}
