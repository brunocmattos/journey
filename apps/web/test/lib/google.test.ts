import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOAuth = vi.fn();
vi.mock('@/lib/supabase/navegador', () => ({ supabaseNavegador: () => ({ auth: { signInWithOAuth } }) }));
const { entrarComGoogle } = await import('@/lib/google');

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:3000' } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  signInWithOAuth.mockReset();
});

describe('entrar com o Google', () => {
  it('pede o provedor google com a volta pelo /auth/callback desta origem', async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    expect(await entrarComGoogle()).toBe(true);
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'http://127.0.0.1:3000/auth/callback' } });
  });

  it('o Supabase recusa (provedor desligado, rede): devolve false', async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: 'Unsupported provider' } });
    expect(await entrarComGoogle()).toBe(false);
  });

  it('o pedido estoura (o cliente não baixou, exceção): devolve false, sem estourar pra quem chama', async () => {
    signInWithOAuth.mockRejectedValue(new Error('Failed to fetch dynamically imported module'));
    expect(await entrarComGoogle()).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('o cliente do Supabase nem baixa (o import dinâmico falha): devolve false', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/navegador', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const outra = await import('@/lib/google');
    expect(await outra.entrarComGoogle()).toBe(false);
    expect(signInWithOAuth).not.toHaveBeenCalled();
    vi.doUnmock('@/lib/supabase/navegador');
  });
});
