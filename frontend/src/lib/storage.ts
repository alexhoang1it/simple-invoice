const KEY = 'simpleinvoice.token';

/**
 * Where the access token lives between reloads.
 *
 * localStorage is readable by any script on the page, so a successful XSS gets
 * the token. An httpOnly cookie is stronger and is what a production deployment
 * should use — it also needs CSRF handling and a shared site between API and
 * client, which is outside what the brief asks for. Every read and write goes
 * through here, so swapping the mechanism is a one-file change.
 *
 * Both accessors are guarded: Safari private mode and hardened browser settings
 * throw rather than returning null.
 */
export const tokenStore = {
  read(): string | null {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },

  write(token: string): void {
    try {
      window.localStorage.setItem(KEY, token);
    } catch {
      // A session that lasts until reload beats a hard failure.
    }
  },

  clear(): void {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* nothing sensible to do */
    }
  },
};
