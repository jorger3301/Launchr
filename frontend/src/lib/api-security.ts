/**
 * API Security Utilities
 *
 * Provides signed request functionality for secure API calls.
 * Uses wallet signatures for authentication.
 */

import bs58 from 'bs58';

// =============================================================================
// TYPES
// =============================================================================

export interface SignedRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  walletAddress: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface ApiClient {
  getNonce: (walletAddress: string) => Promise<string>;
  baseUrl: string;
}

// =============================================================================
// SIGNED REQUESTS
// =============================================================================

/**
 * Create a message for signing
 */
function createSignMessage(
  action: string,
  nonce: string,
  timestamp: number,
  data?: Record<string, unknown>
): string {
  const parts = [
    `Launchr: ${action}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
  ];

  if (data) {
    parts.push(`Data: ${JSON.stringify(data)}`);
  }

  return parts.join('\n');
}

/**
 * Get a nonce from the API
 */
export async function getNonce(baseUrl: string, walletAddress: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/nonce?address=${walletAddress}`);

  if (!response.ok) {
    throw new Error('Failed to get nonce');
  }

  const data = await response.json();
  return data.nonce;
}

/**
 * Make a signed API request
 */
export async function signedFetch(
  baseUrl: string,
  options: SignedRequestOptions
): Promise<Response> {
  // Get nonce
  const nonce = await getNonce(baseUrl, options.walletAddress);
  const timestamp = Date.now();

  // Create message
  const action = `${options.method} ${options.path}`;
  const message = createSignMessage(action, nonce, timestamp, options.body);

  // Sign message
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = await options.signMessage(messageBytes);
  const signature = bs58.encode(signatureBytes);

  // Make request with auth headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-wallet-address': options.walletAddress,
    'x-signature': signature,
    'x-nonce': nonce,
    'x-timestamp': timestamp.toString(),
  };

  const fetchOptions: RequestInit = {
    method: options.method,
    headers,
  };

  if (options.body && options.method !== 'GET') {
    fetchOptions.body = JSON.stringify(options.body);
  }

  return fetch(`${baseUrl}${options.path}`, fetchOptions);
}

// =============================================================================
// API CLIENT FACTORY
// =============================================================================

/**
 * Create an authenticated API client
 */
export function createAuthenticatedClient(
  baseUrl: string,
  walletAddress: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
) {
  return {
    async get(path: string): Promise<Response> {
      return signedFetch(baseUrl, {
        method: 'GET',
        path,
        walletAddress,
        signMessage,
      });
    },

    async post(path: string, body: Record<string, unknown>): Promise<Response> {
      return signedFetch(baseUrl, {
        method: 'POST',
        path,
        body,
        walletAddress,
        signMessage,
      });
    },

    async put(path: string, body: Record<string, unknown>): Promise<Response> {
      return signedFetch(baseUrl, {
        method: 'PUT',
        path,
        body,
        walletAddress,
        signMessage,
      });
    },

    async delete(path: string): Promise<Response> {
      return signedFetch(baseUrl, {
        method: 'DELETE',
        path,
        walletAddress,
        signMessage,
      });
    },
  };
}

// =============================================================================
// REACT HOOK
// =============================================================================

/**
 * Hook usage example:
 *
 * const { signMessage } = useWallet();
 * const apiClient = useAuthenticatedApi(signMessage);
 *
 * // Make authenticated request
 * const response = await apiClient.post('/api/protected', { data: 'value' });
 */
export function createUseAuthenticatedApi(baseUrl: string) {
  return function useAuthenticatedApi(
    walletAddress: string | null,
    signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null
  ) {
    if (!walletAddress || !signMessage) {
      return null;
    }

    return createAuthenticatedClient(baseUrl, walletAddress, signMessage);
  };
}

export default {
  getNonce,
  signedFetch,
  createAuthenticatedClient,
  createUseAuthenticatedApi,
};
