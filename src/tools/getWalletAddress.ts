import { Address } from 'viem';
import { createViemWalletClient } from '../viem/createViemWalletClient';

export async function getWalletAddress(): Promise<Address> {
  const walletClient = createViemWalletClient();
  const [address] = await walletClient.getAddresses();
  return address;
}
