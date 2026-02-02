/**
 * Global Type Declarations
 */

// bs58 module declaration
declare module 'bs58' {
  const bs58: {
    encode: (source: Uint8Array) => string;
    decode: (source: string) => Uint8Array;
  };
  export = bs58;
}

// Add window extensions for wallet providers
interface Window {
  solana?: {
    isPhantom?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: any) => Promise<any>;
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
    on: (event: string, handler: (...args: any[]) => void) => void;
    removeListener: (event: string, handler: (...args: any[]) => void) => void;
  };
  solflare?: {
    isSolflare?: boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    publicKey: { toString: () => string };
    signTransaction: (transaction: any) => Promise<any>;
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
    on: (event: string, handler: (...args: any[]) => void) => void;
    off: (event: string, handler: (...args: any[]) => void) => void;
  };
  backpack?: {
    isBackpack?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: any) => Promise<any>;
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
    on: (event: string, handler: (...args: any[]) => void) => void;
    off: (event: string, handler: (...args: any[]) => void) => void;
  };
  jupiter?: {
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: any) => Promise<any>;
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  };
}
