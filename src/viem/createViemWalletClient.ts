import { createWalletClient, http, WalletClient } from 'viem';
import {
  english,
  generateMnemonic,
  mnemonicToAccount,
  privateKeyToAccount,
} from 'viem/accounts';
import { sepolia } from 'viem/chains';
// import { eip712WalletActions } from 'viem/zksync';

export const createViemWalletClient = (): WalletClient => {
  if (!process.env.PRIVATE_KEY && !process.env.WALLET_MNEMONIC) {
    throw new Error(
      '⛔ You must provide a PRIVATE_KEY or WALLET_MNEMONIC in your environment variables.',
    );
  }
  const account =
    process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length !== 0
      ? privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
      : process.env.WALLET_MNEMONIC
        ? mnemonicToAccount(process.env.WALLET_MNEMONIC)
        : mnemonicToAccount(generateMnemonic(english));

  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  }); //.extend(eip712WalletActions());
  return wallet;
};
