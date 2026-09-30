// Test OTP API failure path handling
import { expect, test, vi, afterEach } from 'vitest';
import { otpApi, OTP_ERROR } from '../auth/otpApi.js';

// Helper to mock fetch response
function mockFetch(status, body) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

// Restore original fetch after each test
afterEach(() => {
  vi.unstubAllGlobals();
});

test('otpApi maps HTTP status codes to OTP_ERROR enums', async () => {
  const statusMap = {
    503: OTP_ERROR.UNCONFIGURED,
    502: OTP_ERROR.PROVIDER,
    429: OTP_ERROR.RATE_LIMITED,
    401: OTP_ERROR.INVALID,
    400: OTP_ERROR.BAD_INPUT,
    418: OTP_ERROR.FAILED, // any other status
  };

  for (const [status, expectedError] of Object.entries(statusMap)) {
    mockFetch(Number(status), { error: { message: 'error' } });
    try {
      await otpApi.request('12345', 'whatsapp');
      // Should throw
      expect.unreachable('Expected otpApi.request to throw');
    } catch (e) {
      expect(e.reason).toBe(expectedError);
    }
  }
});

test('otpApi throws offline error when fetch throws', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
  try {
    await otpApi.request('12345', 'whatsapp');
    expect.unreachable('Expected offline error');
  } catch (e) {
    expect(e.reason).toBe(OTP_ERROR.OFFLINE);
  }
});
