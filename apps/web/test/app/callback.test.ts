import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

let erro: { message: string } | null = null;
const exchangeCodeForSession = vi.fn(async (_code: string) => ({ error: erro }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ auth: { exchangeCodeForSession } }) }));
const { GET } = await import('@/app/auth/callback/route');

const volta = (consulta: string) => GET(new NextRequest(`http://127.0.0.1:3000/auth/callback${consulta}`, { headers: { host: '127.0.0.1:3000' } }));

describe('GET /auth/callback', () => {
  beforeEach(() => vi.stubEnv('APP_URL', ''));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    erro = null;
    exchangeCodeForSession.mockClear();
  });

  it('troca o código pela sessão e segue pro next', async () => {
    const r = await volta('?code=abc&next=%2Fconta%2Fsenha');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(r.headers.get('location')).toBe('http://127.0.0.1:3000/conta/senha');
  });

  it('next de outro site vira a raiz deste', async () => {
    for (const next of ['%2F%2Fevil.com', 'https%3A%2F%2Fevil.com', '%2F%5Cevil.com']) {
      const r = await volta(`?code=abc&next=${next}`);
      expect(r.headers.get('location')).toBe('http://127.0.0.1:3000/');
    }
  });

  it('o Google cancelado (ou recusado) volta com error e sem código: o aviso é o do Google', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await volta('?error=access_denied&error_code=access_denied&error_description=The+user+denied');
    expect(r.headers.get('location')).toBe('http://127.0.0.1:3000/entrar?erro=google');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('sem código, ou código que não vale: volta pro entrar com o aviso', async () => {
    expect((await volta('?next=%2F%2Fevil.com')).headers.get('location')).toBe('http://127.0.0.1:3000/entrar?erro=link');
    erro = { message: 'invalid flow state' };
    expect((await volta('?code=velho')).headers.get('location')).toBe('http://127.0.0.1:3000/entrar?erro=link');
  });
});
