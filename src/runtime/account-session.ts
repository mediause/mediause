import type { AccountIdentity, AccountRecord } from "../types.js";

export class AccountSessionStore {
  private readonly sessions = new Map<string, AccountRecord>();

  private key(identity: AccountIdentity): string {
    return `${identity.platform}:${identity.accountId}`;
  }

  set(record: AccountRecord): void {
    this.sessions.set(this.key(record), record);
  }

  get(identity: AccountIdentity): AccountRecord | undefined {
    return this.sessions.get(this.key(identity));
  }

  delete(identity: AccountIdentity): boolean {
    return this.sessions.delete(this.key(identity));
  }

  list(platform?: string): AccountRecord[] {
    const values = Array.from(this.sessions.values());
    if (!platform) {
      return values;
    }

    return values.filter((record) => record.platform === platform);
  }
}
