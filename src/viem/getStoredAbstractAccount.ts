import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { privateKeyToAccount } from 'viem/accounts';
import { createRandomAccount } from './createRandomAccount';
import { storeAbstractAccount } from './storeAbstractAcount';

export const STORAGE_FILE = join(process.cwd(), '_private', 'account.json');

export interface StoredAccount {
  privateKey: string;
  address: string;
}
export function getStoredAbstractAccount() {
  try {
    if (existsSync(STORAGE_FILE)) {
      const data = readFileSync(STORAGE_FILE, 'utf8');
      const { privateKey, address }: StoredAccount = JSON.parse(data);

      if (privateKey && address) {
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        return { account, address, privateKey };
      }
    } else {
      const result = createRandomAccount();
      // store result data
      storeAbstractAccount(result.privateKey, result.account.address);
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
