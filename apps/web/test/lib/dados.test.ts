import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentoVazio } from '@journey/nucleo';

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

const { catalogo, contagemCatalogo, empresa, intencionais, jornadas, versaoAtual } = await import('@/lib/dados');

const JORNADA = { id: 'j1', nome: 'Telefonia', canal: 'telefonia' };
const versao = (documento: unknown): Resposta => ({ data: { numero: 1, criada_em: '2026-11-12T10:00:00Z', documento, diagnostico: [] }, error: null });
const uuidInvalido: Resposta = { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid: "x"' } };

describe('dados', () => {
  beforeEach(() => {
    respostas = {};
    filtros.length = 0;
  });

  it('id que não é uuid na URL vira "não achado", não erro', async () => {
    respostas.empresas = uuidInvalido;
    await expect(empresa('x')).rejects.toThrow('NAO_ACHADO');
    respostas.jornadas_resumo = uuidInvalido;
    await expect(jornadas('x')).rejects.toThrow('NAO_ACHADO');
  });

  it('outro erro do banco continua erro', async () => {
    respostas.empresas = { data: null, error: { code: '42501', message: 'permission denied' } };
    await expect(empresa('e1')).rejects.toThrow('permission denied');
  });

  it('a lista de jornadas vem da view do resumo (última versão e graves contados no banco)', async () => {
    respostas.jornadas_resumo = {
      data: [
        { id: 'j1', nome: 'Telefonia', canal: 'telefonia', numero: 3, criada_em: '2026-11-12T10:00:00Z', graves: 2 },
        { id: 'j2', nome: 'WhatsApp', canal: 'whatsapp', numero: null, criada_em: null, graves: 0 },
      ],
      error: null,
    };
    expect(await jornadas('e1')).toEqual([
      { id: 'j1', nome: 'Telefonia', canal: 'telefonia', versao: 3, atualizada: '2026-11-12T10:00:00Z', graves: 2 },
      { id: 'j2', nome: 'WhatsApp', canal: 'whatsapp', versao: null, atualizada: null, graves: 0 },
    ]);
    expect(filtros).toContainEqual(['eq', 'empresa_id', 'e1']);
  });

  it('intencionais trazem o e-mail de quem marcou; quem saiu (ou foi apagado) fica null', async () => {
    respostas.achados_intencionais = {
      data: [
        { chave: 'k1', nota: 'de propósito', criado_em: '2026-11-12T10:00:00Z', autor: 'u1' },
        { chave: 'k2', nota: '', criado_em: '2026-11-12T11:00:00Z', autor: 'u-saiu' },
        { chave: 'k3', nota: '', criado_em: '2026-11-12T12:00:00Z', autor: null },
      ],
      error: null,
    };
    respostas.membros = { data: [{ usuario_id: 'u1', email: 'ana@exemplo.com' }], error: null };
    expect((await intencionais('e1', 'j1')).map((i) => [i.chave, i.autor])).toEqual([
      ['k1', 'ana@exemplo.com'],
      ['k2', null],
      ['k3', null],
    ]);
    expect(filtros).toContainEqual(['in', 'usuario_id', ['u1', 'u-saiu']]);
    expect(filtros.filter((f) => f[0] === 'eq' && f[1] === 'empresa_id')).toHaveLength(2);
  });

  it('versaoAtual devolve o documento journey/1', async () => {
    respostas.jornadas = { data: JORNADA, error: null };
    respostas.jornada_versoes = versao(documentoVazio());
    const v = await versaoAtual('e1', 'j1');
    expect(v.documento).toEqual(documentoVazio());
    expect(v.numero).toBe(1);
  });

  it('versaoAtual recusa versão que não é um documento journey/1', async () => {
    respostas.jornadas = { data: JORNADA, error: null };
    for (const doc of [{ ...documentoVazio(), formato: 'journey/2' }, { ...documentoVazio(), pecas: undefined }, { ...documentoVazio(), saidas: {} }, null, 'journey/1']) {
      respostas.jornada_versoes = versao(doc);
      await expect(versaoAtual('e1', 'j1'), JSON.stringify(doc)).rejects.toThrow('a versão 1 de "Telefonia" não é um documento journey/1');
    }
  });

  it('o catálogo vem inteiro, em páginas de 1000 (o PostgREST corta em 1000 por pedido)', async () => {
    const itens = (de: number, n: number) => Array.from({ length: n }, (_, i) => ({ aba: 'ramais', item_id: String(de + i), nome: null, dados: {} }));
    respostas.catalogo = [
      { data: itens(0, 1000), error: null },
      { data: itens(1000, 1000), error: null },
      { data: itens(2000, 5), error: null },
    ];
    expect(await catalogo('e1', 'ramais')).toHaveLength(2005);
    expect(filtros.filter((f) => f[0] === 'range')).toEqual([
      ['range', 0, 999],
      ['range', 1000, 1999],
      ['range', 2000, 2999],
    ]);
  });

  it('a contagem por aba vem do banco, não das linhas devolvidas', async () => {
    respostas.catalogo = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos'].map((_, i) => ({ data: null, count: (i + 1) * 1000, error: null }) as Resposta);
    expect(await contagemCatalogo('e1')).toEqual({ entradas: 1000, horarios: 2000, feriados: 3000, ramais: 4000, filas: 5000, grupos: 6000 });
  });
});
