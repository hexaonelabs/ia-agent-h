export interface ElectronAPI {
  send: (channel: string, data: any) => void;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  once: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
