import {
  generateSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../../src/admin/admin-auth.utils';

describe('admin-auth.utils', () => {
  it('hashes and verifies passwords', () => {
    const hashed = hashPassword('Password123!');
    expect(verifyPassword('Password123!', hashed)).toBe(true);
    expect(verifyPassword('wrong-password', hashed)).toBe(false);
  });

  it('generates unique session tokens', () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    expect(first).not.toEqual(second);
    expect(first.length).toBeGreaterThan(20);
  });

  it('hashToken is deterministic', () => {
    const token = 'test-token';
    expect(hashToken(token)).toEqual(hashToken(token));
  });
});
