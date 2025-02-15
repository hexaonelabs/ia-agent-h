import { writeFileSync } from 'fs';
import { StoredAccount } from './getStoredAbstractAccount';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';

const algorithm = 'aes-256-ctr';
const password =
  process.env.WALLET_MNEMONIC?.replace(' ', '')?.trim() || 'your-password';
const key = scryptSync(password, 'salt', 32);
const iv = randomBytes(16);

function encrypt(text: string): string {
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function storeAbstractAccount(
  privateKey: string,
  address: string,
  filepath: string,
) {
  const data: StoredAccount = { privateKey, address };
  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64');
  const encryptedData = encrypt(encodedData);
  writeFileSync(filepath, encryptedData, 'utf8');
}
