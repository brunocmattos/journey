import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// A sessão expirou: ao tentar renovar, o cliente do Supabase apaga os cookies e não acha ninguém.
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _chave: string, { cookies }: { cookies: { setAll: (l: unknown[]) => void } }) => ({
    auth: {
      getClaims: async () => {
        cookies.setAll([{ name: 'sb-token', value: '', options: { maxAge: 0, path: '/' } }]);
        return { data: null };
      },
    },
  }),
}));
const { proxy } = await import('@/proxy');

describe('proxy', () => {
  it('manda pro entrar levando os cookies que o Supabase mexeu', async () => {
    const r = await proxy(new NextRequest('http://127.0.0.1:3000/e/x', { headers: { host: '127.0.0.1:3000' } }));
    expect(r.headers.get('location')).toBe('http://127.0.0.1:3000/entrar');
    expect(r.cookies.get('sb-token')).toMatchObject({ value: '', maxAge: 0 });
  });
});

describe('proxy no link público', () => {
  it('deixa abrir sem sessão', async () => {
    const r = await proxy(new NextRequest('http://127.0.0.1:3000/l/abcdefghijklmnopqrstuvwx', { headers: { host: '127.0.0.1:3000' } }));
    expect(r.headers.get('location')).toBeNull();
  });
});
