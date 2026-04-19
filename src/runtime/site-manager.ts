import type { SitePlugin } from "./site-runtime.js";
import { RuntimeManager } from "./runtime-manager.js";

export class SiteManager {
  constructor(private readonly runtime: RuntimeManager) {}

  register(plugin: SitePlugin): void {
    this.runtime.register(plugin);
  }

  unregister(platform: string): void {
    this.runtime.unregister(platform);
  }

  list(): string[] {
    return this.runtime.listSites();
  }
}
