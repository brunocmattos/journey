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

const { cadastros, cenarios, empresa, fluxoParaEditar, intencionais, links, versoes } = await import('@/lib/dados');

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

  it('versões: da mais nova pra mais velha, com o e-mail de quem marcou (quem saiu fica null)', async () => {
    respostas.fluxo_versoes = {
      data: [
        { numero: 2, nome: 'depois', autor: 'u1', criada_em: '2026-11-13T10:00:00Z' },
        { numero: 1, nome: 'antes', autor: 'u-saiu', criada_em: '2026-11-12T10:00:00Z' },
      ],
      error: null,
    };
    respostas.membros = { data: [{ usuario_id: 'u1', email: 'ana@exemplo.com' }], error: null };
    expect(await versoes('e1', 'f1')).toEqual([
      { numero: 2, nome: 'depois', autor: 'ana@exemplo.com', criada_em: '2026-11-13T10:00:00Z' },
      { numero: 1, nome: 'antes', autor: null, criada_em: '2026-11-12T10:00:00Z' },
    ]);
    expect(filtros).toContainEqual(['order', 'numero', { ascending: false }]);
    expect(filtros).toContainEqual(['eq', 'fluxo_id', 'f1']);
  });

  it('intencionais: chave, nota, e-mail de quem marcou e data', async () => {
    respostas.achados_intencionais = {
      data: [
        { chave: 'k1', nota: 'de propósito', autor: 'u1', criado_em: '2026-11-12T10:00:00Z' },
        { chave: 'k2', nota: '', autor: null, criado_em: '2026-11-12T11:00:00Z' },
      ],
      error: null,
    };
    respostas.membros = { data: [{ usuario_id: 'u1', email: 'ana@exemplo.com' }], error: null };
    expect(await intencionais('e1', 'f1')).toEqual([
      { chave: 'k1', nota: 'de propósito', autor: 'ana@exemplo.com', criado_em: '2026-11-12T10:00:00Z' },
      { chave: 'k2', nota: '', autor: null, criado_em: '2026-11-12T11:00:00Z' },
    ]);
  });

  it('cenários e links: só os do fluxo, da empresa, em páginas', async () => {
    respostas.cenarios = { data: [], error: null };
    respostas.links = { data: [], error: null };
    await cenarios('e1', 'f1');
    await links('e1', 'f1');
    expect(filtros.filter((f) => f[0] === 'eq')).toEqual([
      ['eq', 'empresa_id', 'e1'],
      ['eq', 'fluxo_id', 'f1'],
      ['eq', 'empresa_id', 'e1'],
      ['eq', 'fluxo_id', 'f1'],
    ]);
    expect(filtros.filter((f) => f[0] === 'range')).toHaveLength(2);
    // O nome do cenário do link vem da cópia guardada nele.
    expect(filtros).toContainEqual(['select', 'id, token, versao, esconder_nomes, cenario_nome:cenario->>nome, expira_em, revogado_em, criado_em']);
  });
});
