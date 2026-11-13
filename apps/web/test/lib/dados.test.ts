import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// notFound do Next lança; aqui lança um erro reconhecível.
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NAO_ACHADO');
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

type Resposta = { data: unknown; error: { code?: string; message: string } | null };
let respostas: Record<string, Resposta | Resposta[]> = {};
const filtros: unknown[][] = [];

/** Cliente falso: qualquer encadeamento de filtros termina na resposta da tabela. */
function consulta(tabela: string) {
  // Uma lista de respostas é servida em ordem, uma por pedido (as páginas).
  const r = () => {
    const x = respostas[tabela];
    return (Array.isArray(x) ? x.shift() : x) ?? { data: null, error: null };
  };
  const q: Record<string, unknown> = {
    then: (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(r()).then(ok, falha),
    maybeSingle: async () => r(),
    single: async () => r(),
  };
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'range'])
    q[m] = (...args: unknown[]) => {
      filtros.push([m, ...args]);
      return q;
    };
  return q;
}
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: consulta }),
}));

const { cadastros, empresa, fluxoParaEditar } = await import('@/lib/dados');

const uuidInvalido: Resposta = { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid: "x"' } };

describe('dados', () => {
  beforeEach(() => {
    respostas = {};
    filtros.length = 0;
  });

  it('id que não é uuid na URL vira "não achado", não erro', async () => {
    respostas.empresas = uuidInvalido;
    await expect(empresa('x')).rejects.toThrow('NAO_ACHADO');
    respostas.fluxos = uuidInvalido;
    await expect(fluxoParaEditar('e1', 'x')).rejects.toThrow('NAO_ACHADO');
  });

  it('outro erro do banco continua erro', async () => {
    respostas.empresas = { data: null, error: { code: '42501', message: 'permission denied' } };
    await expect(empresa('e1')).rejects.toThrow('permission denied');
  });

  it('os cadastros vêm inteiros, em páginas de 1000 (o PostgREST corta em 1000 por pedido)', async () => {
    const itens = (de: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: String(de + i), tipo: 'pessoa', nome: `P${de + i}`, campos: {} }));
    respostas.cadastros = [
      { data: itens(0, 1000), error: null },
      { data: itens(1000, 1000), error: null },
      { data: itens(2000, 5), error: null },
    ];
    expect(await cadastros('e1')).toHaveLength(2005);
    expect(filtros.filter((f) => f[0] === 'range')).toEqual([
      ['range', 0, 999],
      ['range', 1000, 1999],
      ['range', 2000, 2999],
    ]);
  });
});
