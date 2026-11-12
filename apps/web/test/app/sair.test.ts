import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const signOut = vi.fn(async (_opcoes?: unknown) => ({ error: null }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ auth: { signOut } }) }));
const { POST } = await import('@/app/sair/route');

const sair = (origin?: string) =>
  POST(new NextRequest('http://127.0.0.1:3000/sair', { method: 'POST', headers: { host: '127.0.0.1:3000', ...(origin ? { origin } : {}) } }));

describe('POST /sair', () => {
  beforeEach(() => vi.stubEnv('APP_URL', ''));
  afterEach(() => {
    vi.unstubAllEnvs();
    signOut.mockClear();
  });

  it('sai só neste aparelho e volta pro entrar', async () => {
    const r = await sair('http://127.0.0.1:3000');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://127.0.0.1:3000/entrar');
  });

  it('recusa pedido vindo de outro site', async () => {
    const r = await sair('https://mal.exemplo');
    expect(r.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('com APP_URL, a origem certa é a dele', async () => {
    vi.stubEnv('APP_URL', 'https://journey.exemplo.com');
    expect((await sair('http://127.0.0.1:3000')).status).toBe(403);
    expect((await sair('https://journey.exemplo.com')).status).toBe(303);
  });
});
