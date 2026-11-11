/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARWEAVE_GATEWAY?: string;
  readonly VITE_ARWEAVE_GQL?: string;
  readonly VITE_ARWEAVE_GQL_BACKUP?: string;
  readonly VITE_WORLD_INDEX_URL?: string;
  readonly VITE_GITHUB_REPO?: string;
}

type ArweaveWalletPermission =
  | "ACCESS_ADDRESS"
  | "ACCESS_PUBLIC_KEY"
  | "SIGN_TRANSACTION"
  | "DISPATCH"
  | "SIGNATURE"
  | "ACCESS_ARWEAVE_CONFIG";

interface ArweaveWalletApi {
  connect(permissions: ArweaveWalletPermission[], appInfo?: { name: string; logo?: string }): Promise<void>;
  disconnect(): Promise<void>;
  getActiveAddress(): Promise<string>;
  dispatch(transaction: unknown): Promise<{ id: string }>;
  sign(transaction: unknown): Promise<unknown>;
}

interface Window {
  arweaveWallet?: ArweaveWalletApi;
}
