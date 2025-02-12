import { writeFileSync } from 'fs';
import { StoredAccount } from './getStoredAbstractAccount';

export function storeAbstractAccount(
  privateKey: string,
  address: string,
  filepath: string,
) {
  const data: StoredAccount = { privateKey, address };
  writeFileSync(filepath, JSON.stringify(data), 'utf8');
}
