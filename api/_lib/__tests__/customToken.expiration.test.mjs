import { test, expect } from 'vitest';
import { signInWithToken } from '../../../src/services/firebase/auth.js';
import { generateKeyPair, SignJWT } from 'jose';

/**
 * Test that Firebase rejects an expired custom token.
 */
test('signInWithToken rejects expired custom token', async () => {
  // Generate a temporary RSA key pair for signing.
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });

  const now = Math.floor(Date.now() / 1000);
  const expiredJwt = await new SignJWT({ uid: 'test-uid' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now - 20)
    .setExpirationTime(now - 10) // already expired
    .sign(privateKey);

  await expect(signInWithToken(expiredJwt)).rejects.toThrow();
});
