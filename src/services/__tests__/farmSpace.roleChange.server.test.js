// Server‑side role‑change authorization test
import { expect, test, describe, beforeAll, vi } from 'vitest';

vi.mock('../../../api/_lib/db.js', async () => {
  const { dbRef } = await import('../../../api/_lib/__tests__/e2e/harness.js');
  return { getSql: () => dbRef.sql };
});
vi.mock('../../../api/_middleware/verifyAuth.js', async () => {
  const { testVerifyToken } = await import('../../../api/_lib/__tests__/e2e/harness.js');
  return { verifyToken: testVerifyToken };
});
vi.mock('../../../api/_lib/blobStore.js', () => ({ deleteAttachment: vi.fn(async () => {}) }));

import { freshDb, call, createFarm, userIdOf, dbRef, U } from '../../../api/_lib/__tests__/e2e/harness.js';

/**
 * Verify that a user with an initially sufficient role can perform a protected action,
 * that after the role is downgraded server‑side the same action is rejected with 403.
 */
describe('farmSpace role‑change server‑side auth', () => {
  beforeAll(async () => {
    await freshDb();
  }, 120000);

  test('owner can update space, worker cannot after role downgrade', async () => {
    const ownerUid = U(1);
    const space = await createFarm(ownerUid, 'Test Farm');

    // Owner initially has the permission to update space settings.
    const first = await call(ownerUid, 'spaces.update', {
      spaceId: space.id,
      payload: { name: 'Renamed' },
    });
    expect(first.status).toBe(200);

    // Downgrade the role server‑side to "worker".
    const uid = await userIdOf(ownerUid);
    await dbRef.sql`
      update farm_space_memberships
      set role = 'worker'
      where space_id = ${space.id} and user_id = ${uid}`;

    // Same request should now be rejected with 403.
    const second = await call(ownerUid, 'spaces.update', {
      spaceId: space.id,
      payload: { name: 'Again' },
    });
    expect(second.status).toBe(403);
  }, 30000);
});
