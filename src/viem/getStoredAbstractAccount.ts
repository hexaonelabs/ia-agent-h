import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createDecipheriv, scryptSync } from 'crypto';

import { privateKeyToAccount } from 'viem/accounts';
import { createRandomAccount } from './createRandomAccount';
import { storeAbstractAccount } from './storeAbstractAcount';

export interface StoredAccount {
  privateKey: string;
  address: string;
}

const algorithm = 'aes-256-ctr';
const password =
  process.env.WALLET_MNEMONIC?.replace(' ', '')?.trim() || 'your-password';
const key = scryptSync(password, 'salt', 32);

function decrypt(encryptedText: string): string {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString();
}

export function getStoredAbstractAccount(fileName = 'account.log') {
  const STORAGE_FILE = join(
    process.cwd(),
    'private',
    fileName.includes('.log') ? fileName : `${fileName}.log`,
  );
  try {
    if (existsSync(STORAGE_FILE)) {
      const encryptedData = readFileSync(STORAGE_FILE, 'utf8');
      const encodedAdata = decrypt(encryptedData);
      const data = Buffer.from(encodedAdata, 'base64').toString('utf8');
      const { privateKey, address }: StoredAccount = JSON.parse(data);

      if (privateKey && address) {
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        return { account, address, privateKey };
      }
    } else {
      const result = createRandomAccount();
      // store result data
      storeAbstractAccount(
        result.privateKey,
        result.account.address,
        STORAGE_FILE,
      );
      return {
        account: result.account,
        address: result.account.address,
        privateKey: result.privateKey,
      };
    }
  } catch (error) {
    console.error('Error reading stored account:', error);
    throw error;
  }
}
