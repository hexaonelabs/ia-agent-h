import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class AppService {
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
}
