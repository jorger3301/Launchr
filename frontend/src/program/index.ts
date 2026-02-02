/**
 * Launchr Program Module
 *
 * Exports all program-related types, constants, and the client.
 */

export * from './idl';
export * from './client';

// Orbit Finance DEX IDL (for graduation)
export type { OrbitFinance } from './orbit-finance';

// Orbit Finance JSON IDL (for Anchor client initialization)
import OrbitFinanceIdl from './orbit-finance.json';
export { OrbitFinanceIdl };

// Orbit Finance Program ID
export const ORBIT_FINANCE_PROGRAM_ID = 'Fn3fA3fjsmpULNL7E9U79jKTe1KHxPtQeWdURCbJXCnM';
