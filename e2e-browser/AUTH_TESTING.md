# Firebase Auth E2E Testing Architecture

This repository uses a FRONTEND-ONLY Firebase Auth Emulator testing strategy. 

## Why Frontend-Only?
The Firebase Auth Emulator issues mock identity tokens (`{"alg": "none"}`). 
Cryptographically verifying these unsigned tokens on a real deployed backend requires either an explicit authentication bypass or configuring a dangerous parser like `decodeJwt()` to trust unverified payloads.

To ensure strict zero-trust security and prevent any accidental exposure in Vercel Production/Preview, **we do not route emulator tokens to the deployed backend**.

## Test Scope
- **COVERED**:
  - The React frontend's ability to trigger the Firebase JS SDK authentication flow.
  - Integration with mocked OTP delivery (`otpApi.js`).
  - Handling of `signInWithCustomToken` via the local Firebase Auth Emulator.
  - UI state management (logged in vs. logged out).

- **NOT COVERED** (and explicitly out of scope for emulator testing):
  - Production SMS/WhatsApp OTP delivery.
  - Deployed backend cryptographic verification of tokens (`api/_middleware/verifyAuth.js`).
  - Production Authorization/RLS policies via live Firebase users.
  
## How to Run
```bash
npm run build:e2e:auth
npm run test:e2e:auth
```

## Security Posture
The production backend remains **100% untouched** by this testing configuration. It will always rigorously enforce Google's official JWKS signatures and reject emulator tokens outright.
