import type { AccountIdentity, AccountRecord } from "../types.js";
import { now } from "../utils.js";

export class AccountManager {
  private readonly accounts = new Map<string, AccountRecord>();

  private key(identity: AccountIdentity): string {
    return `${identity.platform}:${identity.accountId}`;
  }

  upsert(record: Omit<AccountRecord, "updatedAt"> & { updatedAt?: number }): AccountRecord {
    const normalized: AccountRecord = {
      ...record,
      updatedAt: record.updatedAt ?? now(),
      health: record.health ?? "healthy",
    };

    this.accounts.set(this.key(normalized), normalized);
    return normalized;
  }

  get(identity: AccountIdentity): AccountRecord | undefined {
    return this.accounts.get(this.key(identity));
  }

  list(platform?: string): AccountRecord[] {
    const values = Array.from(this.accounts.values());
    if (!platform) {
      return values;
    }
    return values.filter((account) => account.platform === platform);
  }

  remove(identity: AccountIdentity): boolean {
    return this.accounts.delete(this.key(identity));
  }

  health(alias?: string): AccountRecord[] {
    const values = Array.from(this.accounts.values());
    if (!alias) {
      return values;
    }

    return values.filter((record) => record.alias === alias);
  }
}
