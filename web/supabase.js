const SESSION_KEY = 'quiz-lqsa-session-v1';

export class SupabaseClient {
  constructor(config = {}, storage = globalThis.localStorage) {
    this.config = config;
    this.storage = storage;
  }

  get ready() { return Boolean(this.config.url && this.config.publicKey); }

  readSession() {
    try { return JSON.parse(this.storage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  saveSession(session) {
    const value = { ...session, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600) };
    this.storage.setItem(SESSION_KEY, JSON.stringify(value));
    return value;
  }

  async request(path, { method = 'GET', body, token, signal } = {}) {
    if (!this.ready) throw new Error('Supabase no está configurado.');
    const response = await fetch(new URL(path, this.config.url), {
      method,
      headers: {
        apikey: this.config.publicKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal || AbortSignal.timeout(12000)
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Error de Supabase (${response.status}).`);
    return data;
  }

  async initializeSession() {
    if (!this.ready) return null;
    const current = this.readSession();
    if (current?.access_token && current?.user?.id && current.expires_at > Math.floor(Date.now() / 1000) + 60) return current;
    if (current?.refresh_token) {
      try {
        const renewed = await this.request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: current.refresh_token } });
        return this.saveSession(renewed);
      } catch {
        // Try restoring anonymous access if the saved refresh token was revoked.
      }
    }
    const session = await this.request('/auth/v1/signup', { method: 'POST', body: { data: {} } });
    if (!session?.access_token || !session?.user?.id) throw new Error('Supabase no devolvió una sesión anónima. Comprueba que están habilitados los inicios anónimos.');
    return this.saveSession(session);
  }

  async rpc(name, args = {}, session = null) {
    return this.request(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: 'POST', body: args, token: session?.access_token || null
    });
  }
}
