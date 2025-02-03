import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { BehaviorSubject, firstValueFrom, share } from 'rxjs';
import Provider, { EthereumProvider } from '@walletconnect/ethereum-provider';
import { arbitrum, base, mainnet, optimism, sepolia } from 'viem/chains';
import { LoadingController } from '@ionic/angular/standalone';
import { createWalletClient, custom, WalletClient } from 'viem';
import { getTotalWalletValue } from './app.utils';

export const AVAILABLE_CHAINS = [
  { ...mainnet, logoURI: '/mainnet.svg' },
  { ...arbitrum, logoURI: '/arb.svg' },
  { ...base, logoURI: '/base.svg' },
  { ...optimism, logoURI: '/op.svg' },
  // TESTNETS
  { ...sepolia, logoURI: '/sepolia.svg' },
];

export const DEFAULT_CHAIN =
  AVAILABLE_CHAINS.find((c) => c.id === 11_155_111) ?? AVAILABLE_CHAINS[0];

@Injectable({
  providedIn: 'root',
})
export class AppService {
  private _web3Provider: Provider | undefined;
  public walletClient: WalletClient | null = null;
  private readonly _account$ = new BehaviorSubject<`0x${string}` | undefined>(
    undefined,
  );
  public readonly account$ = this._account$.asObservable().pipe(share());
  public signature$ = new BehaviorSubject<string | undefined>(undefined);
  constructor(
    private readonly _http: HttpClient,
    private readonly _loadingController: LoadingController,
  ) {
    this._init();
  }

  private async _init() {
    // initialize wallet provider
    const chains: number[] = AVAILABLE_CHAINS.map((c) => c.id);
    this._web3Provider = await EthereumProvider.init({
      projectId: environment.walletConnectProjectId,
      showQrModal: true,
      optionalChains: chains as any,
    });
    // chain changed
    this._web3Provider.on('chainChanged', async (hexChainId) => {
      console.log('Chain Changed', hexChainId);
      const chainId = parseInt(hexChainId, 16);
      const chain = AVAILABLE_CHAINS.find((c) => c.id === chainId);
      if (!chain) {
        return;
      }
      if (this.walletClient) {
        this.walletClient.chain = chain;
      }
    });
    // accounts changed
    this._web3Provider.on('accountsChanged', async (accounts) => {
      console.log('Accounts Changed', accounts);
      if (
        !accounts ||
        accounts.length === 0 ||
        !this._account$.value ||
        accounts[0] === this._account$.value
      ) {
        return;
      }
      // new account connected, sign message and request token
      const messsage = `Connect to Agent-H`;
      await this.signMessage(accounts[0] as `0x${string}`, messsage);
      await this.requestToken(
        accounts[0] as `0x${string}`,
        this.signature$.value as string,
      );
    });
    // session established
    this._web3Provider.on('connect', async (event) => {
      console.log('Session Connected', event);
    });
    // session event - chainChanged/accountsChanged/custom events
    this._web3Provider.on('session_event', (event) => {
      console.log('Session Event', event);
    });
    // connection uri
    this._web3Provider.on('display_uri', async (event) => {
      console.log('Display URI', event);
      const loader = await this._loadingController.getTop();
      loader?.dismiss();
    });
    // session disconnect
    this._web3Provider.on('disconnect', (event) => {
      console.log('Session Disconnected', event);
      this._account$.next(undefined);
      this.signature$.next(undefined);
    });
    this._web3Provider.on('session_delete', (event) => {
      console.log('Session Disconnected', event);
      this._account$.next(undefined);
      this.signature$.next(undefined);
    });
    // check if user is already connected
    const isConnected = this._web3Provider?.connected;
    if (!isConnected) {
      return;
    }
    // get accounts
    const result: `0x${string}`[] | undefined =
      await this._web3Provider?.request({
        method: 'eth_requestAccounts',
      });
    const account = result?.[0];
    console.log({ result, isConnected });
    if (!account) {
      return;
    }
    await this._createWalletClient(this._web3Provider!);
    await this.signMessage(account, 'Connect to Agent-H');
    // request to get OR update token if user is authenticated
    await this.requestToken(account, this.signature$.value as string);
    // set BehaviorSubject values
    this._account$.next(account);
  }

  async ping() {
    const url = environment.apiEndpoint + '/ping';
    const request = this._http.get<{ data: string }>(url);
    const response = await firstValueFrom(request);
    return response;
  }

  async logs() {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
    const url = environment.apiEndpoint + '/logs';
    const request = this._http.get<{ data: string[] }>(url, { headers });
    const response = await firstValueFrom(request);
    return response;
  }

  async prompt({
    userInput,
    chatHistory = [],
  }: {
    userInput: string;
    chatHistory: { role: string; content: string }[];
  }) {
    const token = localStorage.getItem('token');
    const url = environment.apiEndpoint + '/agent-prompt';
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
    const request = this._http.post<{
      statusCode: number;
      message: string;
      data: {
        answer: string;
        chat_history: any[];
      };
    }>(
      url,
      {
        messages: [
          ...chatHistory,
          {
            role: 'user',
            content: userInput,
          },
        ],
      },
      {
        headers,
      },
    );
    const response = await firstValueFrom(request);
    return response;
  }

  async connectWalletAndAuthenticate() {
    if (!this._web3Provider) {
      throw new Error('Wallet provider not initialized');
    }
    const loader = await this._loadingController.create();
    await loader.present();
    // call connect method
    try {
      await this._web3Provider.connect({
        chains: [DEFAULT_CHAIN.id],
      });
    } catch (error) {
      await this.disconnectWallet();
      return;
    }
    const account = this._web3Provider.accounts[0] as `0x${string}`;
    // create read only provider client
    await this._createWalletClient(this._web3Provider);
    if (!account) {
      loader?.dismiss();
      throw new Error('Account not found');
    }
    // sign message
    const messsage = `Connect to Agent-H`;
    await this.signMessage(account, messsage);
    // request token
    await this.requestToken(account, this.signature$.value as string);
    // update value
    this._account$.next(account);
    // ensure loader is dismissed
    loader?.dismiss();
    // end of method. User is connected and authenticated with the server
  }

  async disconnectWallet() {
    await this._web3Provider?.disconnect();
    this.signature$.next(undefined);
    this._account$.next(undefined);
  }

  async requestToken(address: `0x${string}`, signature: string) {
    const url = environment.apiEndpoint + '/auth/evm-signin';
    const body = {
      address,
      signature,
      message: 'Connect to Agent-H',
    };
    const request = this._http.post<{ access_token: string }>(url, body);
    const response = await firstValueFrom(request).catch(async (error) => {
      await this.disconnectWallet();
      throw error;
    });
    // store
    localStorage.setItem('token', response.access_token);
    return response;
  }

  async signMessage(account: `0x${string}`, message: string) {
    if (!this.walletClient) {
      throw new Error('Wallet not connected');
    }
    if (!environment.production) {
      this.signature$.next(environment.defaultEVMSignature);
      return;
    }
    const loader = await new LoadingController().create({
      message: 'Waiting for signature...',
    });
    await loader.present();
    try {
      const result = await this.walletClient?.signMessage({
        message,
        account,
      });
      this.signature$.next(result);
      loader.dismiss();
    } catch (error) {
      await this.disconnectWallet();
      loader.dismiss();
      throw error;
    }
  }

  private async _createWalletClient(provider: Provider) {
    try {
      const account = this._web3Provider?.accounts[0] as `0x${string}`;
      const chainId = this._web3Provider!.chainId;
      const chain = AVAILABLE_CHAINS.find((c) => c.id === chainId);
      this.walletClient = createWalletClient({
        chain,
        transport: custom(provider),
        account,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate the total worth of the wallet across all chains.
   */
  public async getTotalWalletWorth() {
    const result = await getTotalWalletValue(
      '0x1399b9c0228D4430b5cA9e9CCC21D594CBb6447A',
    );
    return result;
  }
}
