import { Hash } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';

interface GetTransactionReceiptArgs {
  hash: Hash;
}

function extractReceiptInfo(receipt: any) {
  return {
    status: receipt.status,
    hash: receipt.transactionHash,
    ...(receipt.status === 'reverted' && { error: 'Transaction reverted' }),
  };
}

export async function getTransactionReceipt({
  hash,
}: GetTransactionReceiptArgs) {
  const publicClient = createViemPublicClient();
  const receipt = await publicClient.getTransactionReceipt({ hash });
  return extractReceiptInfo(receipt);
}
