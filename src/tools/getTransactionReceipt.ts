import { Hash } from 'viem';
import { createViemPublicClient } from '../viem/createViemPublicClient';
import { getChainById } from 'src/const/chains';

interface GetTransactionReceiptArgs {
  hash: Hash;
  chainId: number;
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
  chainId,
}: GetTransactionReceiptArgs) {
  const chain = getChainById(chainId);
  const publicClient = createViemPublicClient(chain);
  const receipt = await publicClient.getTransactionReceipt({ hash });
  return extractReceiptInfo(receipt);
}
