# Launchr - Development Rules

## Project Structure
- `program/` — Solana Anchor smart contract (Rust)
- `backend/` — Express.js API server (TypeScript)
- `frontend/` — React 18 web app (TypeScript)

## Before Completing Any Task

Run these checks before considering work done:

### 1. Security Scan
- Scan for hardcoded secrets, API keys, passwords, private keys in all changed files
- Check for SQL injection, shell injection (no `child_process.exec` with user input), path traversal
- Verify all user inputs are validated with Zod schemas (backend) or runtime checks (frontend)
- No secrets in logs, error messages, or client-facing responses
- No `eval()`, `Function()`, or `innerHTML` with dynamic content
- Solana program: verify all signer checks, PDA seed validation, and account ownership checks

### 2. Type Safety
- Run `cd backend && npx tsc --noEmit` — zero type errors
- Run `cd frontend && npx tsc --noEmit` — zero type errors
- No `any` types unless explicitly justified with a comment

### 3. Linting
- Run `cd backend && npm run lint` — zero warnings
- Run `cd frontend && npm run lint` — zero warnings

### 4. Tests
- Run `cd backend && npm test` if backend tests exist
- Run `cd frontend && npm test -- --watchAll=false` if frontend tests exist

### 5. Solana Program Checks (if program/ was modified)
- Run `cd program && cargo clippy -- -D warnings`
- Verify no unchecked arithmetic (use checked_mul, checked_add, checked_div)
- Verify all accounts have proper constraint checks (#[account(has_one, constraint, seeds)])
- Verify no remaining_accounts used without validation

## Code Standards

### Backend (TypeScript/Express)
- Validate all request inputs with Zod at the route handler level
- Use parameterized queries, never string interpolation for data lookups
- Rate limiting on all public endpoints
- No `require()` — use ES module imports
- Error responses must not leak stack traces or internal paths

### Frontend (TypeScript/React)
- No direct DOM manipulation — use React refs
- Sanitize any user-generated content before rendering
- Validate wallet inputs and transaction parameters client-side before sending
- Never store private keys or seed phrases in localStorage/sessionStorage

### Solana Program (Rust/Anchor)
- All math operations must use checked arithmetic or error on overflow
- PDAs must use canonical bump seeds
- Every instruction must validate all account constraints
- No `unwrap()` — use proper error handling with custom error codes
