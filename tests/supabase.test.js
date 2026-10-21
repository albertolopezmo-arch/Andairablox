import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseClient } from '../web/supabase.js';

function storageMock(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, value: () => value };
}

test('crea y conserva una sesión anónima para el mismo usuario', async () => {
  const original = globalThis.fetch;const storage = storageMock();let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200, json: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'anonymous-user' } }) };
  };
  try {
    const client = new SupabaseClient({ url: 'https://example.supabase.co', publicKey: 'publishable' }, storage);
    const session = await client.initializeSession();
    assert.equal(new URL(call.url).pathname, '/auth/v1/signup');
    assert.deepEqual(JSON.parse(call.options.body), { data: {} });
    assert.equal(session.user.id, 'anonymous-user');
    assert.equal(JSON.parse(storage.value()).refresh_token, 'refresh');
    assert.equal((await client.initializeSession()).user.id, 'anonymous-user');
  } finally { globalThis.fetch = original; }
});
