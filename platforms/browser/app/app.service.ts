import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import Provider, { EthereumProvider } from '@walletconnect/ethereum-provider';
import { arbitrum, base, mainnet, optimism, sepolia } from 'viem/chains';
import { LoadingController } from '@ionic/angular/standalone';
import { createWalletClient, custom, WalletClient } from 'viem';

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
  public account$ = new BehaviorSubject<`0x${string}` | undefined>(undefined);
  public signature$ = new BehaviorSubject<string | undefined>(undefined);
  constructor(private readonly _http: HttpClient) {
    console.log('AppService constructor');
  }

  async ping() {
    const url = environment.apiEndpoint + '/ping';
    const request = this._http.get<{ data: string }>(url);
    const response = await firstValueFrom(request);
    return response;
  }

  async logs() {
    const url = environment.apiEndpoint + '/logs';
    const request = this._http.get<{ data: string[] }>(url);
    const response = await firstValueFrom(request);
    return response;
  }

  async prompt({
    userInput,
    threadId,
  }: {
    userInput: string;
    threadId?: string;
  }) {
    const token = localStorage.getItem('token');
    const url = environment.apiEndpoint + '/prompt';
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
    const request = this._http.post<{
      data: { threadId: string; message: string };
    }>(
      url,
      {
        userInput,
        threadId,
      },
      {
        headers,
      },
    );
    const response = await firstValueFrom(request);
    return response;
  }

  async connectWalletAndSignMessage() {
    const loader = await new LoadingController().create();
    await loader.present();
    const chains: number[] = AVAILABLE_CHAINS.map((c) => c.id);
    if (!this._web3Provider) {
      this._web3Provider = await EthereumProvider.init({
        projectId: '434d438ca5da706dc5cbf4f0ccdf89df',
        showQrModal: true,
        optionalChains: chains as any,
      });
    }
    // chain changed
    // this._web3Provider.on('chainChanged', async (hexChainId) => {});
    // accounts changed
    this._web3Provider.on('accountsChanged', async (accounts) => {
      console.log('Accounts Changed', accounts);
      if (
        !accounts ||
        accounts.length === 0 ||
        accounts[0] === this.account$.value
      ) {
        return;
      }
      if (!this.walletClient) {
        // create read only provider client
        const chain =
          AVAILABLE_CHAINS.find(
            (c) =>
              c.id ===
              (this._web3Provider?.chainId ||
                this._web3Provider?.chainId ||
                DEFAULT_CHAIN.id),
          ) ?? DEFAULT_CHAIN;
        this.walletClient = createWalletClient({
          chain,
          transport: custom(this._web3Provider as any),
          account: accounts[0] as `0x${string}`,
        });
      }
      const messsage = `Authenticated on Agent-H platform`;
      await this.signMessage(accounts[0] as `0x${string}`, messsage);
      await this.requestToken();
      // update value
      this.account$.next(accounts[0] as `0x${string}`);
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
    this._web3Provider.on('display_uri', (event) => {
      console.log('Display URI', event);
      // ensure loader is dismissed
      loader?.dismiss();
    });
    // session disconnect
    this._web3Provider.on('disconnect', (event) => {
      console.log('Session Disconnected', event);
      this.account$.next(undefined);
      this.signature$.next(undefined);
      loader?.dismiss();
    });
    this._web3Provider.on('session_delete', (event) => {
      console.log('Session Disconnected', event);
      this.account$.next(undefined);
      this.signature$.next(undefined);
      loader?.dismiss();
    });
    // call connect method
    try {
      await this._web3Provider.connect({
        chains: [DEFAULT_CHAIN.id],
      });
    } catch (error) {
      await this.disconnectWallet();
      return;
    }
    // create read only provider client
    const chain =
      AVAILABLE_CHAINS.find(
        (c) =>
          c.id ===
          (this._web3Provider?.chainId ||
            this._web3Provider?.chainId ||
            DEFAULT_CHAIN.id),
      ) ?? DEFAULT_CHAIN;
    this.walletClient = createWalletClient({
      chain,
      transport: custom(this._web3Provider),
      account: this._web3Provider.accounts[0] as `0x${string}`,
    });
  }

  async disconnectWallet() {
    await this._web3Provider?.disconnect();
    this.signature$.next(undefined);
    this.account$.next(undefined);
  }

  async requestToken() {
    const url = environment.apiEndpoint + '/evmSignIn';
    const body = {
      address: this.account$.value,
      signature: this.signature$.value,
      message: 'Authenticated on Agent-H platform',
    };
    const request = this._http.post<{ access_token: string }>(url, body);
    const response = await firstValueFrom(request);
    // store
    localStorage.setItem('token', response.access_token);
    return response;
  }

  async signMessage(account: `0x${string}`, message: string) {
    if (!this.walletClient) {
      throw new Error('Wallet not connected');
    }
    const loader = await new LoadingController().create();
    await loader.present();
    try {
      const result = await this.walletClient?.signMessage({
        message,
        account,
      });
      this.signature$.next(result);
      loader.dismiss();
    } catch (error) {
      this.signature$.next(undefined);
      loader.dismiss();
      throw error;
    }
  }
}
