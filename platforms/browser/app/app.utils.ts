import { ethers } from 'ethers';
import axios from 'axios';
import { arbitrum, base, mainnet, optimism } from 'viem/chains';

export async function getTotalWalletValue(address: string): Promise<number> {
  const chains = [mainnet, arbitrum, optimism, base];

  let totalValue = 0;

  for (const chain of chains) {
    const rppcUrl = chain.rpcUrls.default.http[0];
    const provider = new ethers.providers.JsonRpcProvider(rppcUrl);
    const balance = await provider.getBalance(address);
    const balanceInEth = ethers.utils.formatEther(balance);
    const price = await getCryptoPrice('ethereum');
    const value = parseFloat(balanceInEth) * price;
    totalValue += value;
    console.log(
      `${chain.name} balance: ${balanceInEth} (${value.toFixed(2)} USD)`,
    );
    // // Get ERC20 token balances
    // for (const token of erc20Tokens) {
    //   const tokenContract = new ethers.Contract(
    //     token.address,
    //     [
    //       'function balanceOf(address owner) view returns (uint256)',
    //       'function decimals() view returns (uint8)',
    //     ],
    //     provider,
    //   );
    //   const tokenBalance = await tokenContract['balanceOf'](address);
    //   const tokenDecimals = await tokenContract['decimals']();
    //   const tokenBalanceInUnits = ethers.utils.formatUnits(
    //     tokenBalance,
    //     tokenDecimals,
    //   );
    //   const tokenPrice = await getCryptoPrice(token.symbol);
    //   const tokenValue = parseFloat(tokenBalanceInUnits) * tokenPrice;
    //   totalValue += tokenValue;
    //   console.log(
    //     `${chain.name} ${token.symbol} balance: ${tokenBalanceInUnits} (${tokenValue.toFixed(2)} USD)`,
    //   );
    // }
  }
  return totalValue;
}

async function getCryptoPrice(cryptoName: string): Promise<number> {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoName.toLowerCase()}&vs_currencies=usd`,
    );
    return response.data[cryptoName.toLowerCase()].usd;
  } catch (error) {
    console.error(`Error fetching price for ${cryptoName}:`, error);
    return 0;
  }
}
