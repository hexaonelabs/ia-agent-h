import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export const createRandomAccount = () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, account };
};
