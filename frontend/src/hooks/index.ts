/**
 * Launchr - Custom Hooks
 *
 * Launch into Orbit 🚀
 * React hooks for wallet connection, launches, trading, and real-time updates.
 *
 * Data fetching uses the backend API for indexed/cached data.
 * Wallet operations use direct Solana RPC.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import BN from 'bn.js';
import { LaunchData, TradeData, UserPositionData } from '../components/molecules';
import { api, wsClient, NormalizedMessage } from '../services/api';
import { LaunchrClient, initLaunchrClient, getLaunchrClient } from '../program/client';
import { BuyParams, SellParams, CreateLaunchParams as ProgramCreateLaunchParams } from '../program/idl';
import { validateTransaction, isTransactionSafe } from '../lib/transaction-validator';

// =============================================================================
// TYPES
// =============================================================================

export interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}

export interface UseWalletResult {
  address: string | null;
  balance: number;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  refreshBalance: () => Promise<void>;
}

export interface UseLaunchesResult {
  launches: LaunchData[];
  trendingLaunches: LaunchData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getLaunch: (publicKey: string) => LaunchData | undefined;
}

export interface UseTradeResult {
  buy: (launchPk: string, solAmount: number, slippage: number) => Promise<string>;
  sell: (launchPk: string, tokenAmount: number, slippage: number) => Promise<string>;
  loading: boolean;
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RPC_ENDPOINT = process.env.REACT_APP_RPC_ENDPOINT || 'https://api.devnet.solana.com';

// Use System Program as placeholder if no valid program ID is configured
// This is safe because mock mode doesn't use PROGRAM_ID anyway
const PROGRAM_ID_STRING = process.env.REACT_APP_PROGRAM_ID || '11111111111111111111111111111111';
const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

// Default compute budget for transactions
const DEFAULT_COMPUTE_UNITS = 200_000;
const DEFAULT_PRIORITY_FEE = 50_000; // microlamports per compute unit

// =============================================================================
// TRANSACTION HELPERS
// =============================================================================

/**
 * Prepares a transaction with compute budget, validation, simulation, and proper blockhash handling.
 * This is required for Phantom, Solflare, Backpack, and Jupiter wallets.
 */
async function prepareAndSimulateTransaction(
  connection: Connection,
  transaction: Transaction,
  feePayer: PublicKey,
  computeUnits: number = DEFAULT_COMPUTE_UNITS,
  priorityFee: number = DEFAULT_PRIORITY_FEE
): Promise<{ transaction: Transaction; blockhash: string; lastValidBlockHeight: number }> {
  // Step 0: SECURITY - Validate all program IDs before proceeding
  const safetyCheck = isTransactionSafe(transaction);
  if (!safetyCheck.safe) {
    console.error('Transaction security check failed:', safetyCheck);
    throw new Error(
      `SECURITY: Transaction rejected - unauthorized program(s) detected: ${safetyCheck.unauthorizedPrograms?.join(', ')}`
    );
  }

  // Step 1: Add compute budget instructions at the beginning
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: computeUnits,
  });
  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: priorityFee,
  });

  // Prepend compute budget instructions
  transaction.instructions = [computeBudgetIx, priorityFeeIx, ...transaction.instructions];

  // Step 2: Get latest blockhash with lastValidBlockHeight for expiry tracking
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = feePayer;

  // Step 3: Simulate transaction to verify it will succeed
  const simulation = await connection.simulateTransaction(transaction);

  if (simulation.value.err) {
    const errorMsg = typeof simulation.value.err === 'string'
      ? simulation.value.err
      : JSON.stringify(simulation.value.err);
    throw new Error(`Transaction simulation failed: ${errorMsg}`);
  }

  // Log compute units used for debugging
  if (simulation.value.unitsConsumed) {
    console.log(`Simulation consumed ${simulation.value.unitsConsumed} compute units`);
  }

  return { transaction, blockhash, lastValidBlockHeight };
}

/**
 * Sends a signed transaction and confirms it with retry logic.
 */
async function sendAndConfirmTransactionWithRetry(
  connection: Connection,
  signedTransaction: Transaction,
  blockhash: string,
  lastValidBlockHeight: number,
  maxRetries: number = 3
): Promise<string> {
  let signature: string | null = null;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Send transaction
      signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false, // Enable preflight for additional validation
        preflightCommitment: 'confirmed',
        maxRetries: 0, // We handle retries ourselves
      });

      // Confirm with blockhash expiry check
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    } catch (err) {
      retries++;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Check if blockhash expired
      if (errorMessage.includes('blockhash') && errorMessage.includes('expired')) {
        throw new Error('Transaction expired. Please try again.');
      }

      // Check if we should retry
      if (retries >= maxRetries) {
        throw err;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      console.log(`Retrying transaction (attempt ${retries + 1}/${maxRetries})...`);
    }
  }

  throw new Error('Transaction failed after max retries');
}

/**
 * Verifies transaction success by checking account state changes.
 */
async function verifyTransactionSuccess(
  connection: Connection,
  signature: string
): Promise<boolean> {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return false;
    }

    if (tx.meta?.err) {
      console.error('Transaction failed:', tx.meta.err);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// WALLET TYPES & DETECTION
// =============================================================================

export type WalletType = 'phantom' | 'solflare' | 'backpack' | 'jupiter' | null;

interface WalletInfo {
  type: WalletType;
  name: string;
  icon: string;
  url: string;
  detected: boolean;
}

// Wallet provider detection
function detectWallets(): WalletInfo[] {
  const wallets: WalletInfo[] = [
    {
      type: 'phantom',
      name: 'Phantom',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIGZpbGw9IiNBQjlGRjIiLz48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTU1LjY0MTYgODIuMTQ3N0M1MC44NzQ0IDg5LjQ1MjUgNDIuODg2MiA5OC42OTY2IDMyLjI1NjggOTguNjk2NkMyNy4yMzIgOTguNjk2NiAyMi40MDA0IDk2LjYyOCAyMi40MDA0IDg3LjY0MjRDMjIuNDAwNCA2NC43NTg0IDUzLjY0NDUgMjkuMzMzNSA4Mi42MzM5IDI5LjMzMzVDOTkuMTI1NyAyOS4zMzM1IDEwNS42OTcgNDAuNzc1NSAxMDUuNjk3IDUzLjc2ODlDMTA1LjY5NyA3MC40NDcxIDk0Ljg3MzkgODkuNTE3MSA4NC4xMTU2IDg5LjUxNzFDODAuNzAxMyA4OS41MTcxIDc5LjAyNjQgODcuNjQyNCA3OS4wMjY0IDg0LjY2ODhDNzkuMDI2NCA4My44OTMxIDc5LjE1NTIgODMuMDUyNyA3OS40MTI5IDgyLjE0NzdDNzUuNzQwOSA4OC40MTgyIDY4LjY1NDYgOTQuMjM2MSA2Mi4wMTkyIDk0LjIzNjFDNTcuMTg3NyA5NC4yMzYxIDU0LjczOTcgOTEuMTk3OSA1NC43Mzk3IDg2LjkzMTRDNTQuNzM5NyA4NS4zNzk5IDU1LjA2MTggODMuNzYzOCA1NS42NDE2IDgyLjE0NzdaTTgwLjYxMzMgNTMuMzE4MkM4MC42MTMzIDU3LjEwNDQgNzguMzc5NSA1OC45OTc1IDc1Ljg4MDYgNTguOTk3NUM3My4zNDM4IDU4Ljk5NzUgNzEuMTQ3OSA1Ny4xMDQ0IDcxLjE0NzkgNTMuMzE4MkM3MS4xNDc5IDQ5LjUzMiA3My4zNDM4IDQ3LjYzODkgNzUuODgwNiA0Ny42Mzg5Qzc4LjM3OTUgNDcuNjM4OSA4MC42MTMzIDQ5LjUzMiA4MC42MTMzIDUzLjMxODJaTTk0LjgxMDIgNTMuMzE4NEM5NC44MTAyIDU3LjEwNDYgOTIuNTc2MyA1OC45OTc3IDkwLjA3NzUgNTguOTk3N0M4Ny41NDA3IDU4Ljk5NzcgODUuMzQ0NyA1Ny4xMDQ2IDg1LjM0NDcgNTMuMzE4NEM4NS4zNDQ3IDQ5LjUzMjMgODcuNTQwNyA0Ny42MzkyIDkwLjA3NzUgNDcuNjM5MkM5Mi41NzYzIDQ3LjYzOTIgOTQuODEwMiA0OS41MzIzIDk0LjgxMDIgNTMuMzE4NFoiIGZpbGw9IiNGRkZERjgiLz48L3N2Zz4=',
      url: 'https://phantom.app/',
      detected: typeof window !== 'undefined' && !!(window as any).solana?.isPhantom,
    },
    {
      type: 'solflare',
      name: 'Solflare',
      icon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJTIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCA1MCI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiMwMjA1MGE7c3Ryb2tlOiNmZmVmNDY7c3Ryb2tlLW1pdGVybGltaXQ6MTA7c3Ryb2tlLXdpZHRoOi41cHg7fS5jbHMtMntmaWxsOiNmZmVmNDY7fTwvc3R5bGU+PC9kZWZzPjxyZWN0IGNsYXNzPSJjbHMtMiIgeD0iMCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiByeD0iMTIiIHJ5PSIxMiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTI0LjIzLDI2LjQybDIuNDYtMi4zOCw0LjU5LDEuNWMzLjAxLDEsNC41MSwyLjg0LDQuNTEsNS40MywwLDEuOTYtLjc1LDMuMjYtMi4yNSw0LjkzbC0uNDYuNS4xNy0xLjE3Yy42Ny00LjI2LS41OC02LjA5LTQuNzItNy40M2wtNC4zLTEuMzhoMFpNMTguMDUsMTEuODVsMTIuNTIsNC4xNy0yLjcxLDIuNTktNi41MS0yLjE3Yy0yLjI1LS43NS0zLjAxLTEuOTYtMy4zLTQuNTF2LS4wOGgwWk0xNy4zLDMzLjA2bDIuODQtMi43MSw1LjM0LDEuNzVjMi44LjkyLDMuNzYsMi4xMywzLjQ2LDUuMThsLTExLjY1LTQuMjJoMFpNMTMuNzEsMjAuOTVjMC0uNzkuNDItMS41NCwxLjEzLTIuMTcuNzUsMS4wOSwyLjA1LDIuMDUsNC4wOSwyLjcxbDQuNDIsMS40Ni0yLjQ2LDIuMzgtNC4zNC0xLjQyYy0yLS42Ny0yLjg0LTEuNjctMi44NC0yLjk2TTI2LjgyLDQyLjg3YzkuMTgtNi4wOSwxNC4xMS0xMC4yMywxNC4xMS0xNS4zMiwwLTMuMzgtMi01LjI2LTYuNDMtNi43MmwtMy4zNC0xLjEzLDkuMTQtOC43Ny0xLjg0LTEuOTYtMi43MSwyLjM4LTEyLjgxLTQuMjJjLTMuOTcsMS4yOS04Ljk3LDUuMDktOC45Nyw4Ljg5LDAsLjQyLjA0LjgzLjE3LDEuMjktMy4zLDEuODgtNC42MywzLjYzLTQuNjMsNS44LDAsMi4wNSwxLjA5LDQuMDksNC41NSw1LjIybDIuNzUuOTItOS41Miw5LjE0LDEuODQsMS45NiwyLjk2LTIuNzEsMTQuNzMsNS4yMmgwWiIvPjwvc3ZnPg==',
      url: 'https://solflare.com/',
      detected: typeof window !== 'undefined' && !!(window as any).solflare?.isSolflare,
    },
    {
      type: 'backpack',
      name: 'Backpack',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMSAxNS45OTk3OTk3MjgzOTM1NTUiPjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xXzgwMykiPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNi41NDIwMSAxLjI1ODA1QzcuMTIzNTYgMS4yNTgwNSA3LjY2OTA1IDEuMzM2MDEgOC4xNzQxIDEuNDgwNTlDNy42Nzk2MyAwLjMyODE2OSA2LjY1Mjk3IDAgNS41MTAzOCAwQzQuMzY1NTUgMCAzLjMzNzEgMC4zMjk0NTkgMi44NDM3NSAxLjQ4NzM4QzMuMzQ1MSAxLjMzNzcxIDMuODg4MjQgMS4yNTgwNSA0LjQ2NzggMS4yNTgwNUg2LjU0MjAxWk00LjMzNDc4IDIuNDE1MDRDMS41NzMzNSAyLjQxNTA0IDAgNC41ODc0MyAwIDcuMjY3MlYxMC4wMkMwIDEwLjI4OCAwLjIyMzg1OCAxMC41IDAuNSAxMC41SDEwLjVDMTAuNzc2MSAxMC41IDExIDEwLjI4OCAxMSAxMC4wMlY3LjI2NzJDMTEgNC41ODc0MyA5LjE3MDQxIDIuNDE1MDQgNi40MDg5OSAyLjQxNTA0SDQuMzM0NzhaTTUuNDk2MDkgNy4yOTEwMkM2LjQ2MjU5IDcuMjkxMDIgNy4yNDYwOSA2LjUwNzUxIDcuMjQ2MDkgNS41NDEwMkM3LjI0NjA5IDQuNTc0NTIgNi40NjI1OSAzLjc5MTAyIDUuNDk2MDkgMy43OTEwMkM0LjUyOTYgMy43OTEwMiAzLjc0NjA5IDQuNTc0NTIgMy43NDYwOSA1LjU0MTAyQzMuNzQ2MDkgNi41MDc1MSA0LjUyOTYgNy4yOTEwMiA1LjQ5NjA5IDcuMjkxMDJaTTAgMTIuMTE4QzAgMTEuODUwMSAwLjIyMzg1OCAxMS42MzI4IDAuNSAxMS42MzI4SDEwLjVDMTAuNzc2MSAxMS42MzI4IDExIDExLjg1MDEgMTEgMTIuMTE4VjE1LjAyOTNDMTEgMTUuNTY1MyAxMC41NTIzIDE1Ljk5OTggMTAgMTUuOTk5OEgxQzAuNDQ3NzE1IDE1Ljk5OTggMCAxNS41NjUzIDAgMTUuMDI5M1YxMi4xMThaIiBmaWxsPSIjRTMzRTNGIj48L3BhdGg+PC9nPjwvc3ZnPgo=',
      url: 'https://backpack.app/',
      detected: typeof window !== 'undefined' && !!(window as any).backpack?.isBackpack,
    },
    {
      type: 'jupiter',
      name: 'Jupiter',
      icon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDI0LjAuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9ImthdG1hbl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgODAwIDgwMCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgODAwIDgwMDsiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiMxNDE3MjY7fQoJLnN0MXtmaWxsOnVybCgjU1ZHSURfMV8pO30KCS5zdDJ7ZmlsbDp1cmwoI1NWR0lEXzJfKTt9Cgkuc3Qze2ZpbGw6dXJsKCNTVkdJRF8zXyk7fQoJLnN0NHtmaWxsOnVybCgjU1ZHSURfNF8pO30KCS5zdDV7ZmlsbDp1cmwoI1NWR0lEXzVfKTt9Cgkuc3Q2e2ZpbGw6dXJsKCNTVkdJRF82Xyk7fQo8L3N0eWxlPgo8Y2lyY2xlIGNsYXNzPSJzdDAiIGN4PSI0MDAiIGN5PSI0MDAiIHI9IjQwMCIvPgo8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzFfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjU3NC45MjU3IiB5MT0iNjY1Ljg3MjciIHgyPSIyNDguNTI1NyIgeTI9IjE0Mi4zMTI3IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgODAwKSI+Cgk8c3RvcCAgb2Zmc2V0PSIwLjE2IiBzdHlsZT0ic3RvcC1jb2xvcjojQzZGNDYyIi8+Cgk8c3RvcCAgb2Zmc2V0PSIwLjg5IiBzdHlsZT0ic3RvcC1jb2xvcjojMzNEOUZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik01MzYsNTY4LjljLTY2LjgtMTA4LjUtMTY2LjQtMTcwLTI4OS40LTE5NS42Yy00My41LTktODcuMi04LjktMTI5LjQsNy43Yy0yOC45LDExLjQtMzMuMywyMy40LTE5LjcsNTMuNwoJYzkyLjQtMjEuOSwxNzguNC0xLjUsMjU4LjksNDVjODEuMSw0Ni45LDE0MS42LDExMi4yLDE2OS4xLDIwNWMzOC42LTExLjgsNDMuNi0xOC4zLDM0LjMtNTQuMkM1NTQuMyw2MDkuNCw1NDcuNCw1ODcuNCw1MzYsNTY4LjkKCUw1MzYsNTY4Ljl6Ii8+CjxsaW5lYXJHcmFkaWVudCBpZD0iU1ZHSURfMl8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iNTcyLjU4OTYiIHkxPSI2NjcuMzMwMyIgeDI9IjI0Ni4xOTk2IiB5Mj0iMTQzLjc3MDMiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSAwIDAgLTEgMCA4MDApIj4KCTxzdG9wICBvZmZzZXQ9IjAuMTYiIHN0eWxlPSJzdG9wLWNvbG9yOiNDNkY0NjIiLz4KCTxzdG9wICBvZmZzZXQ9IjAuODkiIHN0eWxlPSJzdG9wLWNvbG9yOiMzM0Q5RkYiLz4KPC9saW5lYXJHcmFkaWVudD4KPHBhdGggY2xhc3M9InN0MiIgZD0iTTYwOS4xLDQ4MC42Yy04NS44LTEyNS0yMDcuMy0xOTQuOS0zNTUuOC0yMTguM2MtMzkuMy02LjItNzkuNC00LjUtMTE2LjIsMTQuM2MtMTcuNiw5LTMzLjIsMjAuNS0zNy40LDQ0LjkKCWMxMTUuOC0zMS45LDIxOS43LTMuNywzMTcuNSw1M2M5OC4zLDU3LDE3NS4xLDEzMy41LDIwNSwyNTEuMWMyMC44LTE4LjQsMjQuNS00MSwxOS4xLTYyQzYzMy45LDUzNC44LDYyNS41LDUwNC41LDYwOS4xLDQ4MC42CglMNjA5LjEsNDgwLjZ6Ii8+CjxsaW5lYXJHcmFkaWVudCBpZD0iU1ZHSURfM18iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iNTc3LjAxNDgiIHkxPSI2NjQuNTY3MSIgeDI9IjI1MC42MjQ3IiB5Mj0iMTQxLjAwNzEiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSAwIDAgLTEgMCA4MDApIj4KCTxzdG9wICBvZmZzZXQ9IjAuMTYiIHN0eWxlPSJzdG9wLWNvbG9yOiNDNkY0NjIiLz4KCTxzdG9wICBvZmZzZXQ9IjAuODkiIHN0eWxlPSJzdG9wLWNvbG9yOiMzM0Q5RkYiLz4KPC9saW5lYXJHcmFkaWVudD4KPHBhdGggY2xhc3M9InN0MyIgZD0iTTEwNSw0ODguNmM3LjMsMTYuMiwxMi4xLDM0LjUsMjMsNDcuNmM1LjUsNi43LDIyLjIsNC4xLDMzLjgsNS43YzEuOCwwLjIsMy42LDAuNSw1LjQsMC43CgljMTAyLjksMTUuMywxODQuMSw2NS4xLDI0Mi4xLDE1MmMzLjQsNS4xLDguOSwxMi43LDEzLjQsMTIuN2MxNy40LTAuMSwzNC45LTIuOCw1Mi41LTQuNUM0NDksNTU3LjUsMjMyLjgsNDM4LjMsMTA1LDQ4OC42CglMMTA1LDQ4OC42eiIvPgo8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzRfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjU2OS4wMjcyIiB5MT0iNjY5LjU1MTgiIHgyPSIyNDIuNjI3MiIgeTI9IjE0NS45OTE3IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgODAwKSI+Cgk8c3RvcCAgb2Zmc2V0PSIwLjE2IiBzdHlsZT0ic3RvcC1jb2xvcjojQzZGNDYyIi8+Cgk8c3RvcCAgb2Zmc2V0PSIwLjg5IiBzdHlsZT0ic3RvcC1jb2xvcjojMzNEOUZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik02NTYuNiwzNjYuN0M1OTkuOSwyODcuNCw1MjEuNywyMzQuNiw0MzIuOSwxOTdjLTYxLjUtMjYuMS0xMjUuMi00MS44LTE5Mi44LTMzLjcKCWMtMjMuNCwyLjgtNDUuMyw5LjUtNjMuNCwyNC43YzIzMC45LDUuOCw0MDQuNiwxMDUuOCw1MjQsMzAzLjNjMC4yLTEzLjEsMi4yLTI3LjctMi42LTM5LjVDNjg2LjEsNDIyLjUsNjc0LjcsMzkyLDY1Ni42LDM2Ni43eiIvPgo8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzVfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjU3MS42OTczIiB5MT0iNjY3Ljg5MTciIHgyPSIyNDUuMjk3MyIgeTI9IjE0NC4zMzE3IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgODAwKSI+Cgk8c3RvcCAgb2Zmc2V0PSIwLjE2IiBzdHlsZT0ic3RvcC1jb2xvcjojQzZGNDYyIi8+Cgk8c3RvcCAgb2Zmc2V0PSIwLjg5IiBzdHlsZT0ic3RvcC1jb2xvcjojMzNEOUZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxwYXRoIGNsYXNzPSJzdDUiIGQ9Ik03MDkuOCwzMjUuM2MtNDctMTc4LjktMjM4LTI2NS0zNzkuMi0yMjEuNEM0ODIuNywxMzMuOSw2MDcuNSwyMDYuNCw3MDkuOCwzMjUuM3oiLz4KPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF82XyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI1NzkuMDM4MiIgeTE9IjY2My4zMTExIiB4Mj0iMjUyLjY0ODIiIHkyPSIxMzkuNzUxMSIgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxIDAgMCAtMSAwIDgwMCkiPgoJPHN0b3AgIG9mZnNldD0iMC4xNiIgc3R5bGU9InN0b3AtY29sb3I6I0M2RjQ2MiIvPgoJPHN0b3AgIG9mZnNldD0iMC44OSIgc3R5bGU9InN0b3AtY29sb3I6IzMzRDlGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8cGF0aCBjbGFzcz0ic3Q2IiBkPSJNMTU1LjQsNTgzLjljNTQuNiw2OS4zLDEyNCwxMDkuNywyMTMsMTIyLjhDMzM0LjQsNjQzLjIsMjE0LjYsNTc0LjUsMTU1LjQsNTgzLjlMMTU1LjQsNTgzLjl6Ii8+Cjwvc3ZnPgo=',
      url: 'https://jup.ag/',
      detected: typeof window !== 'undefined' && !!(window as any).jupiter,
    },
  ];

  return wallets;
}

// Get wallet provider by type
function getWalletProvider(type: WalletType): any {
  if (typeof window === 'undefined') return null;

  switch (type) {
    case 'phantom':
      return (window as any).solana?.isPhantom ? (window as any).solana : null;
    case 'solflare':
      return (window as any).solflare?.isSolflare ? (window as any).solflare : null;
    case 'backpack':
      return (window as any).backpack?.isBackpack ? (window as any).backpack : null;
    case 'jupiter':
      return (window as any).jupiter || null;
    default:
      return null;
  }
}

// =============================================================================
// CONNECTION HOOK
// =============================================================================

export function useConnection(): Connection {
  const connectionRef = useRef<Connection | null>(null);

  if (!connectionRef.current) {
    connectionRef.current = new Connection(RPC_ENDPOINT, 'confirmed');
  }

  return connectionRef.current;
}

// =============================================================================
// AVAILABLE WALLETS HOOK
// =============================================================================

export function useAvailableWallets(): WalletInfo[] {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);

  useEffect(() => {
    // Initial detection
    setWallets(detectWallets());

    // Re-detect after a short delay (some wallets inject late)
    const timer = setTimeout(() => {
      setWallets(detectWallets());
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return wallets;
}

// =============================================================================
// MULTI-WALLET HOOK
// =============================================================================

export interface UseMultiWalletResult extends UseWalletResult {
  walletType: WalletType;
  availableWallets: WalletInfo[];
  connectWallet: (type: WalletType) => Promise<void>;
  showWalletSelector: boolean;
  setShowWalletSelector: (show: boolean) => void;
}

export function useWallet(): UseWalletResult {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [activeWallet, setActiveWallet] = useState<WalletType>(null);
  const connection = useConnection();

  // Get active wallet provider
  const getProvider = useCallback(() => {
    return getWalletProvider(activeWallet);
  }, [activeWallet]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const pubkey = new PublicKey(address);
      const lamports = await connection.getBalance(pubkey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, [address, connection]);

  // Connect to specific wallet
  const connectToWallet = useCallback(async (type: WalletType) => {
    const provider = getWalletProvider(type);

    if (!provider) {
      // Open wallet's website if not installed
      const wallets = detectWallets();
      const wallet = wallets.find(w => w.type === type);
      if (wallet) {
        window.open(wallet.url, '_blank');
      }
      return;
    }

    setConnecting(true);
    setActiveWallet(type);

    try {
      let response;

      // Different wallets have slightly different APIs
      if (type === 'solflare') {
        await provider.connect();
        response = { publicKey: provider.publicKey };
      } else if (type === 'backpack') {
        response = await provider.connect();
      } else if (type === 'jupiter') {
        response = await provider.connect();
      } else {
        // Phantom and default
        response = await provider.connect();
      }

      const pubkey = response.publicKey.toString();
      setAddress(pubkey);
      setConnected(true);

      // Store wallet preference
      localStorage.setItem('launchr_wallet', type || '');

      // Fetch balance
      const lamports = await connection.getBalance(new PublicKey(pubkey));
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error(`Failed to connect to ${type}:`, err);
      setActiveWallet(null);
    } finally {
      setConnecting(false);
    }
  }, [connection]);

  // Connect - tries last used wallet or shows selector
  const connect = useCallback(async () => {
    // Check for previously used wallet
    const lastWallet = localStorage.getItem('launchr_wallet') as WalletType;
    const availableWallets = detectWallets().filter(w => w.detected);

    if (lastWallet && availableWallets.some(w => w.type === lastWallet)) {
      await connectToWallet(lastWallet);
      return;
    }

    // If only one wallet is available, connect to it
    if (availableWallets.length === 1) {
      await connectToWallet(availableWallets[0].type);
      return;
    }

    // Try Phantom first (most common)
    if (availableWallets.some(w => w.type === 'phantom')) {
      await connectToWallet('phantom');
      return;
    }

    // Connect to first available
    if (availableWallets.length > 0) {
      await connectToWallet(availableWallets[0].type);
      return;
    }

    // No wallets available, open Phantom download page
    window.open('https://phantom.app/', '_blank');
  }, [connectToWallet]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) {
      try {
        await provider.disconnect();
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
    }
    setAddress(null);
    setBalance(0);
    setConnected(false);
    setActiveWallet(null);
    localStorage.removeItem('launchr_wallet');
  }, [getProvider]);

  // Sign transaction
  const signTransaction = useCallback(async (tx: Transaction): Promise<Transaction> => {
    const provider = getProvider();
    if (!provider) {
      throw new Error('Wallet not connected');
    }
    return provider.signTransaction(tx);
  }, [getProvider]);

  // Auto-connect on mount
  useEffect(() => {
    const lastWallet = localStorage.getItem('launchr_wallet') as WalletType;
    if (lastWallet) {
      const provider = getWalletProvider(lastWallet);
      if (provider?.isConnected || provider?.connected) {
        connectToWallet(lastWallet);
      }
    }
  }, [connectToWallet]);

  // Listen for account changes
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountChange = (publicKey: PublicKey | null) => {
      if (publicKey) {
        setAddress(publicKey.toString());
        refreshBalance();
      } else {
        disconnect();
      }
    };

    // Different wallets use different event names
    provider.on?.('accountChanged', handleAccountChange);
    provider.on?.('disconnect', disconnect);

    return () => {
      provider.removeListener?.('accountChanged', handleAccountChange);
      provider.removeListener?.('disconnect', disconnect);
      provider.off?.('accountChanged', handleAccountChange);
      provider.off?.('disconnect', disconnect);
    };
  }, [activeWallet, disconnect, getProvider, refreshBalance]);

  // Refresh balance periodically
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(refreshBalance, 30000);
    return () => clearInterval(interval);
  }, [connected, refreshBalance]);

  return {
    address,
    balance,
    connected,
    connecting,
    connect,
    disconnect,
    signTransaction,
    refreshBalance,
  };
}

// =============================================================================
// LAUNCHES HOOK (Uses Backend API)
// =============================================================================

export function useLaunches(): UseLaunchesResult {
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [trendingLaunches, setTrendingLaunches] = useState<LaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all launches from backend API
  const fetchLaunches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch launches and trending in parallel
      const [launchesRes, trendingRes] = await Promise.all([
        api.getLaunches({ limit: 100, sort: 'created', order: 'desc' }),
        api.getTrendingLaunches(),
      ]);

      if (launchesRes.error) {
        throw new Error(launchesRes.error);
      }

      setLaunches(launchesRes.data?.launches || []);
      setTrendingLaunches(trendingRes.data?.launches || []);
    } catch (err) {
      console.error('Failed to fetch launches:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch launches');
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single launch from cache
  const getLaunch = useCallback((publicKey: string) => {
    return launches.find(l => l.publicKey === publicKey);
  }, [launches]);

  // Fetch on mount
  useEffect(() => {
    fetchLaunches();
  }, [fetchLaunches]);

  // Subscribe to real-time updates via WebSocket
  useEffect(() => {
    wsClient.connect();
    wsClient.subscribeChannel('launches');

    const unsubscribe = wsClient.onMessage((message: NormalizedMessage) => {
      if (message.type === 'launch_created') {
        // Add new launch to the list
        setLaunches(prev => [message.data, ...prev]);
      } else if (message.type === 'launch_graduated') {
        // Update graduated launch
        setLaunches(prev =>
          prev.map(l => (l.publicKey === message.data.publicKey ? message.data : l))
        );
        // Remove from trending
        setTrendingLaunches(prev =>
          prev.filter(l => l.publicKey !== message.data.publicKey)
        );
      }
    });

    return () => {
      wsClient.unsubscribeChannel('launches');
      unsubscribe();
    };
  }, []);

  return {
    launches,
    trendingLaunches,
    loading,
    error,
    refetch: fetchLaunches,
    getLaunch,
  };
}

// =============================================================================
// SINGLE LAUNCH HOOK (Uses Backend API)
// =============================================================================

export function useLaunch(publicKey: string | undefined) {
  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [holders, setHolders] = useState<Array<{ address: string; balance: number; percentage: number }>>([]);
  const [priceHistory, setPriceHistory] = useState<Array<{ timestamp: number; price: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch launch details from backend API
  const fetchLaunch = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch launch data and trades in parallel from backend
      const [launchRes, tradesRes] = await Promise.all([
        api.getLaunch(publicKey),
        api.getLaunchTrades(publicKey, 50),
      ]);

      if (launchRes.error) {
        throw new Error(launchRes.error);
      }

      if (!launchRes.data) {
        throw new Error('Launch not found');
      }

      setLaunch(launchRes.data);
      setTrades(tradesRes.data?.trades || []);

      // Build price history from trades
      const history = (tradesRes.data?.trades || [])
        .filter(t => t.price !== undefined)
        .map(t => ({
          timestamp: t.timestamp,
          price: t.price || 0,
        }))
        .reverse(); // Oldest first
      setPriceHistory(history);

      // Holders would come from a dedicated endpoint if available
      // For now, placeholder until backend provides holder data
      setHolders([]);

    } catch (err) {
      console.error('Failed to fetch launch:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch launch');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Fetch on mount and when publicKey changes
  useEffect(() => {
    fetchLaunch();
  }, [fetchLaunch]);

  // Subscribe to real-time updates via WebSocket
  useEffect(() => {
    if (!publicKey) return;

    wsClient.connect();
    wsClient.subscribeChannel('trades');
    wsClient.subscribeChannel('launches');

    const unsubscribe = wsClient.onMessage((message: NormalizedMessage) => {
      if (message.type === 'trade' && message.launchPk === publicKey) {
        // Add new trade to the list
        setTrades(prev => [message.data, ...prev].slice(0, 50));
        // Update price history
        if (message.data.price !== undefined) {
          setPriceHistory(prev => [
            ...prev,
            { timestamp: message.data.timestamp, price: message.data.price || 0 },
          ]);
        }
      } else if (message.type === 'launch_graduated' && message.data.publicKey === publicKey) {
        // Update launch with graduated status
        setLaunch(message.data);
      }
    });

    return () => {
      wsClient.unsubscribeChannel('trades');
      wsClient.unsubscribeChannel('launches');
      unsubscribe();
    };
  }, [publicKey]);

  return {
    launch,
    trades,
    holders,
    priceHistory,
    loading,
    error,
    refetch: fetchLaunch,
  };
}

// =============================================================================
// USER POSITION HOOK
// =============================================================================

export function useUserPosition(launchPk: string | undefined, userAddress: string | undefined) {
  const [position, setPosition] = useState<UserPositionData | null>(null);
  const [loading, setLoading] = useState(false);
  const connection = useConnection();

  const fetchPosition = useCallback(async () => {
    if (!launchPk || !userAddress) {
      setPosition(null);
      return;
    }

    setLoading(true);

    try {
      // Derive user position PDA
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('user_position'),
          new PublicKey(launchPk).toBuffer(),
          new PublicKey(userAddress).toBuffer(),
        ],
        PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(positionPda);

      if (!accountInfo) {
        setPosition(null);
        return;
      }

      // Parse position data (would use Anchor deserialization)
      // Placeholder
      const parsedPosition: UserPositionData = {
        tokenBalance: 0,
        solSpent: 0,
        solReceived: 0,
        avgBuyPrice: 0,
        costBasis: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        totalPnl: 0,
        roiPercent: 0,
      };

      setPosition(parsedPosition);
    } catch (err) {
      console.error('Failed to fetch position:', err);
      setPosition(null);
    } finally {
      setLoading(false);
    }
  }, [launchPk, userAddress, connection]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  return {
    position,
    loading,
    refetch: fetchPosition,
  };
}

// =============================================================================
// TRADE HOOK
// =============================================================================

export interface TradeContext {
  mint: string;
  creator: string;
  virtualSolReserve?: number;
  virtualTokenReserve?: number;
  protocolFeeBps?: number;
  creatorFeeBps?: number;
}

export function useTrade(wallet: UseWalletResult): UseTradeResult & {
  buyWithContext: (launchPk: string, solAmount: number, slippage: number, context: TradeContext) => Promise<string>;
  sellWithContext: (launchPk: string, tokenAmount: number, slippage: number, context: TradeContext) => Promise<string>;
  estimateBuy: (solAmount: number, context: TradeContext) => { tokensOut: number; priceImpact: number };
  estimateSell: (tokenAmount: number, context: TradeContext) => { solOut: number; priceImpact: number };
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = useConnection();
  const clientRef = useRef<LaunchrClient | null>(null);

  // Initialize client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = getLaunchrClient() || initLaunchrClient(connection);
    }
  }, [connection]);

  // Estimate buy output
  const estimateBuy = useCallback((solAmount: number, context: TradeContext) => {
    const client = clientRef.current;
    if (!client) {
      return { tokensOut: 0, priceImpact: 0 };
    }

    const solLamports = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));
    const virtualSolReserve = new BN(context.virtualSolReserve || 30 * LAMPORTS_PER_SOL);
    const virtualTokenReserve = new BN(context.virtualTokenReserve || 800_000_000 * 1e9);

    const { tokensOut, priceImpact } = client.calculateBuyOutput(
      solLamports,
      virtualSolReserve,
      virtualTokenReserve,
      context.protocolFeeBps || 100,
      context.creatorFeeBps || 0
    );

    return {
      tokensOut: tokensOut.toNumber() / 1e9,
      priceImpact,
    };
  }, []);

  // Estimate sell output
  const estimateSell = useCallback((tokenAmount: number, context: TradeContext) => {
    const client = clientRef.current;
    if (!client) {
      return { solOut: 0, priceImpact: 0 };
    }

    const tokenLamports = new BN(Math.floor(tokenAmount * 1e9));
    const virtualSolReserve = new BN(context.virtualSolReserve || 30 * LAMPORTS_PER_SOL);
    const virtualTokenReserve = new BN(context.virtualTokenReserve || 800_000_000 * 1e9);

    const { solOut, priceImpact } = client.calculateSellOutput(
      tokenLamports,
      virtualSolReserve,
      virtualTokenReserve,
      context.protocolFeeBps || 100,
      context.creatorFeeBps || 0
    );

    return {
      solOut: solOut.toNumber() / LAMPORTS_PER_SOL,
      priceImpact,
    };
  }, []);

  // Execute buy with full context
  const buyWithContext = useCallback(async (
    launchPk: string,
    solAmount: number,
    slippage: number,
    context: TradeContext
  ): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const client = clientRef.current;
    if (!client) {
      throw new Error('Program client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const buyer = new PublicKey(wallet.address);
      const launchPubkey = new PublicKey(launchPk);
      const mint = new PublicKey(context.mint);
      const creator = new PublicKey(context.creator);

      // Calculate expected output and apply slippage
      const estimate = estimateBuy(solAmount, context);
      const minTokensOut = Math.floor(estimate.tokensOut * (1 - slippage / 100) * 1e9);

      const params: BuyParams = {
        solAmount: new BN(Math.floor(solAmount * LAMPORTS_PER_SOL)),
        minTokensOut: new BN(minTokensOut),
      };

      // Step 1: Build transaction using LaunchrClient
      const tx = await client.buildBuyTx(buyer, launchPubkey, mint, creator, params);

      // Step 2: Prepare transaction with compute budget and simulate
      // This is required for Phantom, Solflare, Backpack, and Jupiter wallets
      const { transaction: preparedTx, blockhash, lastValidBlockHeight } =
        await prepareAndSimulateTransaction(connection, tx, buyer);

      // Step 3: Sign transaction with wallet
      const signedTx = await wallet.signTransaction(preparedTx);

      // Step 4: Send transaction with retry logic and confirmation
      const signature = await sendAndConfirmTransactionWithRetry(
        connection,
        signedTx,
        blockhash,
        lastValidBlockHeight
      );

      // Step 5: Verify transaction success
      const verified = await verifyTransactionSuccess(connection, signature);
      if (!verified) {
        console.warn('Transaction verification returned false, but transaction was confirmed');
      }

      // Refresh balance
      await wallet.refreshBalance();

      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, estimateBuy]);

  // Execute sell with full context
  const sellWithContext = useCallback(async (
    launchPk: string,
    tokenAmount: number,
    slippage: number,
    context: TradeContext
  ): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const client = clientRef.current;
    if (!client) {
      throw new Error('Program client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const seller = new PublicKey(wallet.address);
      const launchPubkey = new PublicKey(launchPk);
      const mint = new PublicKey(context.mint);
      const creator = new PublicKey(context.creator);

      // Calculate expected output and apply slippage
      const estimate = estimateSell(tokenAmount, context);
      const minSolOut = Math.floor(estimate.solOut * (1 - slippage / 100) * LAMPORTS_PER_SOL);

      const params: SellParams = {
        tokenAmount: new BN(Math.floor(tokenAmount * 1e9)),
        minSolOut: new BN(minSolOut),
      };

      // Step 1: Build transaction using LaunchrClient
      const tx = await client.buildSellTx(seller, launchPubkey, mint, creator, params);

      // Step 2: Prepare transaction with compute budget and simulate
      // This is required for Phantom, Solflare, Backpack, and Jupiter wallets
      const { transaction: preparedTx, blockhash, lastValidBlockHeight } =
        await prepareAndSimulateTransaction(connection, tx, seller);

      // Step 3: Sign transaction with wallet
      const signedTx = await wallet.signTransaction(preparedTx);

      // Step 4: Send transaction with retry logic and confirmation
      const signature = await sendAndConfirmTransactionWithRetry(
        connection,
        signedTx,
        blockhash,
        lastValidBlockHeight
      );

      // Step 5: Verify transaction success
      const verified = await verifyTransactionSuccess(connection, signature);
      if (!verified) {
        console.warn('Transaction verification returned false, but transaction was confirmed');
      }

      // Refresh balance
      await wallet.refreshBalance();

      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, estimateSell]);

  // Legacy buy (uses API to fetch context)
  const buy = useCallback(async (
    launchPk: string,
    solAmount: number,
    slippage: number
  ): Promise<string> => {
    // Fetch launch data to get context
    const launchRes = await api.getLaunch(launchPk);
    if (!launchRes.data) {
      throw new Error('Launch not found');
    }

    const launch = launchRes.data;
    const context: TradeContext = {
      mint: launch.mint,
      creator: launch.creator,
      virtualSolReserve: launch.virtualSolReserve,
      virtualTokenReserve: launch.virtualTokenReserve,
      protocolFeeBps: 100,
      creatorFeeBps: launch.creatorFeeBps || 0,
    };

    return buyWithContext(launchPk, solAmount, slippage, context);
  }, [buyWithContext]);

  // Legacy sell (uses API to fetch context)
  const sell = useCallback(async (
    launchPk: string,
    tokenAmount: number,
    slippage: number
  ): Promise<string> => {
    // Fetch launch data to get context
    const launchRes = await api.getLaunch(launchPk);
    if (!launchRes.data) {
      throw new Error('Launch not found');
    }

    const launch = launchRes.data;
    const context: TradeContext = {
      mint: launch.mint,
      creator: launch.creator,
      virtualSolReserve: launch.virtualSolReserve,
      virtualTokenReserve: launch.virtualTokenReserve,
      protocolFeeBps: 100,
      creatorFeeBps: launch.creatorFeeBps || 0,
    };

    return sellWithContext(launchPk, tokenAmount, slippage, context);
  }, [sellWithContext]);

  return {
    buy,
    sell,
    buyWithContext,
    sellWithContext,
    estimateBuy,
    estimateSell,
    loading,
    error,
  };
}

// =============================================================================
// CREATE LAUNCH HOOK
// =============================================================================

export interface CreateLaunchParams {
  name: string;
  symbol: string;
  uri: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  creatorFeeBps: number;
}

export interface CreateLaunchResult {
  signature: string;
  mint: string;
  launchPda: string;
}

export function useCreateLaunch(wallet: UseWalletResult) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = useConnection();
  const clientRef = useRef<LaunchrClient | null>(null);

  // Initialize client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = getLaunchrClient() || initLaunchrClient(connection);
    }
  }, [connection]);

  const createLaunch = useCallback(async (params: CreateLaunchParams): Promise<string> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const client = clientRef.current;
    if (!client) {
      throw new Error('Program client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const creator = new PublicKey(wallet.address);

      // Build program params
      const programParams: ProgramCreateLaunchParams = {
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        twitter: params.twitter || null,
        telegram: params.telegram || null,
        website: params.website || null,
        creatorFeeBps: params.creatorFeeBps,
      };

      // Step 1: Build transaction using LaunchrClient
      const { transaction, mint } = await client.buildCreateLaunchTx(creator, programParams);

      // Step 2: Prepare transaction with compute budget and simulate
      // Use higher compute units for launch creation (more complex operation)
      const { transaction: preparedTx, blockhash, lastValidBlockHeight } =
        await prepareAndSimulateTransaction(connection, transaction, creator, 400_000);

      // Step 3: Partially sign with mint keypair (required for mint creation)
      preparedTx.partialSign(mint);

      // Step 4: Sign with wallet
      const signedTx = await wallet.signTransaction(preparedTx);

      // Step 5: Send transaction with retry logic and confirmation
      const signature = await sendAndConfirmTransactionWithRetry(
        connection,
        signedTx,
        blockhash,
        lastValidBlockHeight
      );

      // Step 6: Verify transaction success
      const verified = await verifyTransactionSuccess(connection, signature);
      if (!verified) {
        console.warn('Transaction verification returned false, but transaction was confirmed');
      }

      await wallet.refreshBalance();

      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create launch';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection]);

  // Extended create that returns mint and launch addresses
  const createLaunchFull = useCallback(async (params: CreateLaunchParams): Promise<CreateLaunchResult> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const client = clientRef.current;
    if (!client) {
      throw new Error('Program client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const creator = new PublicKey(wallet.address);

      // Build program params
      const programParams: ProgramCreateLaunchParams = {
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        twitter: params.twitter || null,
        telegram: params.telegram || null,
        website: params.website || null,
        creatorFeeBps: params.creatorFeeBps,
      };

      // Step 1: Build transaction using LaunchrClient
      const { transaction, mint } = await client.buildCreateLaunchTx(creator, programParams);

      // Get launch PDA
      const launchPda = client.getLaunchPda(mint.publicKey);

      // Step 2: Prepare transaction with compute budget and simulate
      // Use higher compute units for launch creation (more complex operation)
      const { transaction: preparedTx, blockhash, lastValidBlockHeight } =
        await prepareAndSimulateTransaction(connection, transaction, creator, 400_000);

      // Step 3: Partially sign with mint keypair
      preparedTx.partialSign(mint);

      // Step 4: Sign with wallet
      const signedTx = await wallet.signTransaction(preparedTx);

      // Step 5: Send transaction with retry logic and confirmation
      const signature = await sendAndConfirmTransactionWithRetry(
        connection,
        signedTx,
        blockhash,
        lastValidBlockHeight
      );

      // Step 6: Verify transaction success
      const verified = await verifyTransactionSuccess(connection, signature);
      if (!verified) {
        console.warn('Transaction verification returned false, but transaction was confirmed');
      }

      await wallet.refreshBalance();

      return {
        signature,
        mint: mint.publicKey.toBase58(),
        launchPda: launchPda.toBase58(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create launch';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, connection]);

  return {
    createLaunch,
    createLaunchFull,
    loading,
    error,
  };
}

// =============================================================================
// GLOBAL STATS HOOK (Uses Backend API)
// =============================================================================

export interface GlobalStats {
  totalLaunches: number;
  totalGraduated: number;
  totalVolume: number;
  totalFees: number;
}

export function useGlobalStats() {
  const [stats, setStats] = useState<GlobalStats>({
    totalLaunches: 0,
    totalGraduated: 0,
    totalVolume: 0,
    totalFees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getGlobalStats();

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data?.stats) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch global stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

// =============================================================================
// REAL-TIME UPDATES HOOK (Uses WebSocket)
// =============================================================================

export function useRealtimeUpdates(launchPk: string | undefined) {
  const [lastTrade, setLastTrade] = useState<TradeData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<LaunchData | null>(null);

  useEffect(() => {
    if (!launchPk) return;

    // Subscribe to launch updates via WebSocket
    wsClient.connect();
    wsClient.subscribeChannel('trades');
    wsClient.subscribeChannel('launches');

    const unsubscribe = wsClient.onMessage((message: NormalizedMessage) => {
      if (message.type === 'trade' && message.launchPk === launchPk) {
        setLastTrade(message.data);
      } else if (message.type === 'launch_graduated' && message.data.publicKey === launchPk) {
        setLastUpdate(message.data);
      } else if (message.type === 'launch_created' && message.data.publicKey === launchPk) {
        setLastUpdate(message.data);
      }
    });

    return () => {
      wsClient.unsubscribeChannel('trades');
      wsClient.unsubscribeChannel('launches');
      unsubscribe();
    };
  }, [launchPk]);

  return {
    lastTrade,
    lastUpdate,
  };
}

// =============================================================================
// LOCAL STORAGE HOOK
// =============================================================================

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  }, [key, value]);

  return [value, setValue] as const;
}

// =============================================================================
// DEBOUNCE HOOK
// =============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// =============================================================================
// SOL PRICE HOOK (Pyth Oracle)
// =============================================================================

export interface SolPriceData {
  price: number;
  change24h: number;
  confidence: number;
  lastUpdate: number;
}

export function useSolPrice(refreshInterval: number = 10000): {
  solPrice: SolPriceData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [solPrice, setSolPrice] = useState<SolPriceData>({
    price: 0,
    change24h: 0,
    confidence: 0,
    lastUpdate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousPriceRef = useRef<number>(0);

  const fetchSolPrice = useCallback(async () => {
    try {
      const response = await api.getSolPrice();

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        const prevPrice = previousPriceRef.current;
        const newPrice = response.data.price;

        // Calculate 24h change based on previous price
        // In production, this would come from the API
        const change24h = prevPrice > 0
          ? ((newPrice - prevPrice) / prevPrice) * 100
          : 0;

        previousPriceRef.current = newPrice;

        setSolPrice({
          price: newPrice,
          change24h,
          confidence: response.data.confidence,
          lastUpdate: response.data.publishTime,
        });
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch SOL price:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolPrice();

    const interval = setInterval(fetchSolPrice, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchSolPrice, refreshInterval]);

  return { solPrice, loading, error, refetch: fetchSolPrice };
}

// =============================================================================
// TOKEN METADATA HOOK (Metaplex DAS)
// =============================================================================

export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  description?: string;
  uri: string;
  attributes?: { trait_type: string; value: string | number }[];
  collection?: { verified: boolean; key: string; name?: string };
  creators?: { address: string; share: number; verified: boolean }[];
  royalty?: number;
  isMutable: boolean;
}

export function useTokenMetadata(mintAddress: string | undefined): {
  metadata: TokenMetadata | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async () => {
    if (!mintAddress) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getTokenMetadata(mintAddress);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setMetadata({
          mint: response.data.mint,
          name: response.data.name,
          symbol: response.data.symbol,
          image: response.data.image,
          description: response.data.description,
          uri: response.data.uri,
          attributes: response.data.attributes,
          collection: response.data.collection,
          creators: response.data.creators,
          royalty: response.data.royalty,
          isMutable: response.data.isMutable,
        });
      }
    } catch (err) {
      console.error('Failed to fetch token metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metadata');
    } finally {
      setLoading(false);
    }
  }, [mintAddress]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return { metadata, loading, error, refetch: fetchMetadata };
}

// =============================================================================
// MULTI-TOKEN METADATA HOOK
// =============================================================================

export function useMultipleTokenMetadata(mintAddresses: string[]): {
  metadataMap: Map<string, TokenMetadata>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [metadataMap, setMetadataMap] = useState<Map<string, TokenMetadata>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllMetadata = useCallback(async () => {
    if (mintAddresses.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getMultipleTokenMetadata(mintAddresses);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data?.metadata) {
        const newMap = new Map<string, TokenMetadata>();
        Object.entries(response.data.metadata).forEach(([mint, data]) => {
          newMap.set(mint, {
            mint: data.mint,
            name: data.name,
            symbol: data.symbol,
            image: data.image,
            description: data.description,
            uri: data.uri,
            attributes: data.attributes,
            collection: data.collection,
            creators: data.creators,
            royalty: data.royalty,
            isMutable: data.isMutable,
          });
        });
        setMetadataMap(newMap);
      }
    } catch (err) {
      console.error('Failed to fetch token metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metadata');
    } finally {
      setLoading(false);
    }
  }, [mintAddresses]);

  useEffect(() => {
    fetchAllMetadata();
  }, [fetchAllMetadata]);

  return { metadataMap, loading, error, refetch: fetchAllMetadata };
}

// =============================================================================
// LAUNCH HOLDERS HOOK (Uses Backend API)
// =============================================================================

export interface HolderData {
  address: string;
  balance: number;
  percentage: number;
  rank: number;
}

export function useLaunchHolders(launchPk: string | undefined): {
  holders: HolderData[];
  totalHolders: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [holders, setHolders] = useState<HolderData[]>([]);
  const [totalHolders, setTotalHolders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHolders = useCallback(async () => {
    if (!launchPk) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getLaunchHolders(launchPk);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        // Map topHolders to holders array
        setHolders(response.data.topHolders || []);
        setTotalHolders(response.data.totalHolders || 0);
      }
    } catch (err) {
      console.error('Failed to fetch holders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch holders');
    } finally {
      setLoading(false);
    }
  }, [launchPk]);

  useEffect(() => {
    fetchHolders();
  }, [fetchHolders]);

  return { holders, totalHolders, loading, error, refetch: fetchHolders };
}

// =============================================================================
// LAUNCH CHART HOOK (Uses Backend API)
// =============================================================================

export type ChartTimeframe = '1H' | '4H' | '1D' | '7D' | '30D';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function useLaunchChart(
  launchPk: string | undefined,
  timeframe: ChartTimeframe = '1D'
): {
  candles: CandleData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChart = useCallback(async () => {
    if (!launchPk) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getLaunchChart(launchPk, timeframe);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data?.candles) {
        // Map 'time' to 'timestamp' for consistency
        setCandles(response.data.candles.map(c => ({
          timestamp: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch chart');
    } finally {
      setLoading(false);
    }
  }, [launchPk, timeframe]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  return { candles, loading, error, refetch: fetchChart };
}

// =============================================================================
// USER BALANCES HOOK (Uses Backend API)
// =============================================================================

export interface UserBalanceData {
  solBalance: number;
  tokenBalance: number;
  tokenSymbol: string;
  tokenValue: number;
  position: {
    tokenBalance: number;
    solSpent: number;
    solReceived: number;
    buyCount: number;
    sellCount: number;
    costBasis: number;
  } | null;
}

export function useUserBalances(
  userAddress: string | undefined,
  launchPk: string | undefined
): {
  balances: UserBalanceData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [balances, setBalances] = useState<UserBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!userAddress || !launchPk) {
      setBalances(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getUserBalances(userAddress, launchPk);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setBalances(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch user balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      setLoading(false);
    }
  }, [userAddress, launchPk]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Refresh balances periodically when user is connected
  useEffect(() => {
    if (!userAddress || !launchPk) return;

    const interval = setInterval(fetchBalances, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [userAddress, launchPk, fetchBalances]);

  return { balances, loading, error, refetch: fetchBalances };
}

// =============================================================================
// USER ACTIVITY HOOK (Uses Backend API)
// =============================================================================

export interface ActivityData {
  type: 'buy' | 'sell';
  launch: {
    publicKey: string;
    name: string;
    symbol: string;
    mint: string;
  };
  solAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
  signature: string;
}

export function useUserActivity(
  userAddress: string | undefined,
  limit: number = 50
): {
  activity: ActivityData[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [activity, setActivity] = useState<ActivityData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!userAddress) {
      setActivity([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getUserActivity(userAddress, limit);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setActivity(response.data.activity || []);
        setTotal(response.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch user activity:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activity');
    } finally {
      setLoading(false);
    }
  }, [userAddress, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activity, total, loading, error, refetch: fetchActivity };
}

// =============================================================================
// USER STATS HOOK (Uses Backend API)
// =============================================================================

export interface UserStats {
  address: string;
  positionsCount: number;
  launchesCreated: number;
  totalTrades: number;
  totalBuys: number;
  totalSells: number;
  totalSolSpent: number;
  totalSolReceived: number;
  netSol: number;
}

export function useUserStats(userAddress: string | undefined): {
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userAddress) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getUserStats(userAddress);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// =============================================================================
// USER POSITIONS HOOK (Uses Backend API)
// =============================================================================

export interface PositionWithLaunch {
  tokenBalance: number;
  solSpent: number;
  solReceived: number;
  buyCount: number;
  sellCount: number;
  costBasis: number;
  pnl: number;
  pnlPercent: number;
  currentValue: number;
  launch: {
    id: string;
    publicKey: string;
    name: string;
    symbol: string;
    mint: string;
    imageUri?: string;
    currentPrice?: number;
    gi?: number;
    status?: 'active' | 'graduated' | 'failed';
    price?: number;
    creator?: string;
    marketCap?: number;
    volume24h?: number;
    progress?: number;
    holderCount?: number;
    trades?: number;
    createdAt?: number;
    graduatedAt?: number | null;
  };
}

export function useUserPositions(userAddress: string | undefined): {
  positions: PositionWithLaunch[];
  totalValue: number;
  totalPnl: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [positions, setPositions] = useState<PositionWithLaunch[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalPnl, setTotalPnl] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!userAddress) {
      setPositions([]);
      setTotalValue(0);
      setTotalPnl(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getUserPositions(userAddress);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setPositions(response.data.positions || []);
        setTotalValue(response.data.totalValue || 0);
        setTotalPnl(response.data.totalPnl || 0);
      }
    } catch (err) {
      console.error('Failed to fetch user positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Refresh positions when trading activity happens via WebSocket
  useEffect(() => {
    if (!userAddress) return;

    wsClient.connect();
    wsClient.subscribeChannel('trades');

    const unsubscribe = wsClient.onMessage((message: NormalizedMessage) => {
      if (message.type === 'trade' && message.data.user === userAddress) {
        // Refresh positions when user trades
        fetchPositions();
      }
    });

    return () => {
      wsClient.unsubscribeChannel('trades');
      unsubscribe();
    };
  }, [userAddress, fetchPositions]);

  return { positions, totalValue, totalPnl, loading, error, refetch: fetchPositions };
}
