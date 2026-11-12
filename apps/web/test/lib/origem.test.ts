import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { origemDe } from '@/lib/origem';

const pedido = (url: string, headers: Record<string, string> = {}) => new NextRequest(url, { headers });

describe('origemDe', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('com APP_URL, vale ela e os cabeçalhos são ignorados', () => {
    vi.stubEnv('APP_URL', 'https://journey.exemplo.com/');
    expect(origemDe(pedido('http://localhost:3000/x', { 'x-forwarded-host': 'mal.exemplo', 'x-forwarded-proto': 'http' }))).toBe('https://journey.exemplo.com');
  });

  it('sem APP_URL, usa os cabeçalhos do proxy, só o primeiro valor de cada', () => {
    vi.stubEnv('APP_URL', '');
    expect(origemDe(pedido('http://localhost:3000/x', { 'x-forwarded-host': 'app.exemplo, mal.exemplo', 'x-forwarded-proto': 'https,http' }))).toBe(
      'https://app.exemplo',
    );
  });

  it('sem cabeçalho do proxy, usa o host do pedido', () => {
    vi.stubEnv('APP_URL', '');
    expect(origemDe(pedido('http://localhost:3000/x', { host: '127.0.0.1:3000' }))).toBe('http://127.0.0.1:3000');
  });

  it('sem nada, cai na URL do pedido', () => {
    vi.stubEnv('APP_URL', '');
    expect(origemDe(pedido('http://localhost:3000/x'))).toBe('http://localhost:3000');
  });
});
