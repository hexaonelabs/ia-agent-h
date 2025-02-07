import { writeFileSync } from 'fs';
import { STORAGE_FILE, StoredAccount } from './getStoredAbstractAccount';

export function storeAbstractAccount(privateKey: string, address: string) {
  const data: StoredAccount = { privateKey, address };
  writeFileSync(STORAGE_FILE, JSON.stringify(data), 'utf8');
}
