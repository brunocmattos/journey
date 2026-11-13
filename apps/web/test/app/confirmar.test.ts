import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

let erro: { status?: number; code?: string; message: string } | null = null;
const verifyOtp = vi.fn(async (_p: { type: string; token_hash: string }) => ({ error: erro }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ auth: { verifyOtp } }) }));
const { POST } = await import('@/app/auth/confirmar/route');

const APP = 'http://127.0.0.1:3000';
/** O POST do botão da página /auth/confirm, com o Origin que o navegador manda (ou outro, ou nenhum). */
function botao(campos: Record<string, string>, origin: string | null = APP) {
  const corpo = new URLSearchParams(campos);
  const headers: Record<string, string> = { host: '127.0.0.1:3000', 'content-type': 'application/x-www-form-urlencoded' };
  if (origin !== null) headers.origin = origin;
  return POST(new NextRequest(`${APP}/auth/confirmar`, { method: 'POST', headers, body: corpo }));
}

describe('POST /auth/confirmar', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    erro = null;
    verifyOtp.mockClear();
  });

  it('confirma o token no servidor (sem PKCE) e segue pro next com 303', async () => {
    const r = await botao({ token_hash: 'abc', type: 'recovery', next: '/conta/senha' });
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`${APP}/conta/senha`);
    expect((await botao({ token_hash: 'abc', type: 'email', next: '/' })).headers.get('location')).toBe(`${APP}/`);
  });

  it('de outro site, ou sem Origin: recusa sem tocar no token (login CSRF)', async () => {
    for (const origin of ['https://evil.com', 'null', null]) {
      const r = await botao({ token_hash: 'abc', type: 'email', next: '/' }, origin);
      expect(r.status, String(origin)).toBe(403);
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('next de outro site vira a raiz deste', async () => {
    for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      const r = await botao({ token_hash: 'abc', type: 'email', next });
      expect(r.headers.get('location')).toBe(`${APP}/`);
    }
  });

  it('sem token, tipo fora dos modelos ou token que não vale: volta pro entrar com o aviso', async () => {
    expect((await botao({ type: 'email' })).headers.get('location')).toBe(`${APP}/entrar?erro=link`);
    for (const type of ['signup', 'magiclink', 'invite', 'email_change', 'sms'])
      expect((await botao({ token_hash: 'abc', type })).headers.get('location'), type).toBe(`${APP}/entrar?erro=link`);
    expect(verifyOtp).not.toHaveBeenCalled();
    erro = { status: 403, code: 'otp_expired', message: 'Email link is invalid or has expired' };
    expect((await botao({ token_hash: 'velho', type: 'email' })).headers.get('location')).toBe(`${APP}/entrar?erro=link`);
  });
});
