/**
 * Brute-force protection for password logins, kept in memory (one API instance).
 * - per account: after `maxPerAccount` failures inside the window the account is locked for the rest of the window,
 *   even for the correct password, which stops online guessing of a single account from many IPs
 * - per IP: after `maxPerIp` failures the address is blocked, which stops one source spraying many accounts
 * A successful login clears the account counter only. For several API instances, move this to Redis.
 */
export interface LoginAttemptOptions {
  maxPerAccount: number;
  maxPerIp: number;
  windowMs: number;
}

export const DEFAULT_LOGIN_ATTEMPT_OPTIONS: LoginAttemptOptions = {
  maxPerAccount: 10,
  maxPerIp: 30,
  windowMs: 15 * 60 * 1000,
};

export class LoginAttemptTracker {
  private readonly accounts = new Map<string, number[]>();
  private readonly ips = new Map<string, number[]>();

  constructor(
    private readonly opts: LoginAttemptOptions = DEFAULT_LOGIN_ATTEMPT_OPTIONS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Returns seconds until the lock expires, or 0 when the attempt may proceed. */
  retryAfterSeconds(email: string, ip?: string): number {
    const a = this.waitFor(this.accounts, this.key(email), this.opts.maxPerAccount);
    const i = ip ? this.waitFor(this.ips, ip, this.opts.maxPerIp) : 0;
    return Math.max(a, i);
  }

  recordFailure(email: string, ip?: string): void {
    this.push(this.accounts, this.key(email));
    if (ip) this.push(this.ips, ip);
  }

  recordSuccess(email: string): void {
    this.accounts.delete(this.key(email));
  }

  private key(email: string): string {
    return email.trim().toLowerCase().slice(0, 254);
  }

  private recent(map: Map<string, number[]>, key: string): number[] {
    const cutoff = this.now() - this.opts.windowMs;
    const list = (map.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) map.set(key, list);
    else map.delete(key);
    return list;
  }

  private waitFor(map: Map<string, number[]>, key: string, max: number): number {
    const list = this.recent(map, key);
    if (list.length < max) return 0;
    const unlockAt = list[0] + this.opts.windowMs; // oldest failure falls out of the window
    return Math.max(1, Math.ceil((unlockAt - this.now()) / 1000));
  }

  private push(map: Map<string, number[]>, key: string): void {
    const list = this.recent(map, key);
    list.push(this.now());
    map.set(key, list);
    // Keep memory bounded if someone sprays millions of distinct keys
    if (map.size > 50_000) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) map.delete(oldest);
    }
  }
}
