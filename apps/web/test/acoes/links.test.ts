import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resposta = { data?: unknown; error: { code?: string; message: string } | null };
let respostas: Record<string, Resposta> = {};
/** O que cada consulta fez: tabela, operação, valores e filtros. */
let feitas: { tabela: string; op: string; valores?: unknown; filtros: [string, unknown][] }[] = [];

function consulta(tabela: string) {
  const f: (typeof feitas)[number] = { tabela, op: 'select', filtros: [] };
  feitas.push(f);
  const r = () => respostas[`${tabela}.${f.op}`] ?? { data: null, error: null };
  const q: Record<string, unknown> = {
    then: (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(r()).then(ok, falha),
    single: async () => r(),
    maybeSingle: async () => r(),
    select: () => q,
  };
  for (const m of ['eq', 'is'])
    q[m] = (coluna: string, valor: unknown) => {
      f.filtros.push([coluna, valor]);
      return q;
    };
  for (const m of ['insert', 'update'])
    q[m] = (valores?: unknown) => {
      f.op = m;
      f.valores = valores;
      return q;
    };
  return q;
}

vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: { from: consulta } }) }));
const revalidar = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (c: string) => revalidar(c) }));
const { criarLink, revogarLink } = await import('@/acoes/links');

const log = vi.spyOn(console, 'error').mockImplementation(() => {});
const OPCOES = { versao: null, esconderNomes: true, cenarioId: null, validade: 30 };
const CENARIO = { nome: 'E se?', entrada: 'entrada:e', inicio: '2026-11-23T16:57', modo: 'cenario', escolhas: ['saida:m-1'] };

describe('acoes/links', () => {
  beforeEach(() => {
    respostas = {};
    feitas = [];
    revalidar.mockClear();
    log.mockClear();
  });

  it('cria o link com as opções e devolve o token; a validade vira data', async () => {
    respostas['links.insert'] = { data: { token: 'abcdefghijklmnopqrstuvwx' }, error: null };
    const antes = Date.now();
    expect(await criarLink('e1', 'j1', OPCOES)).toEqual({ token: 'abcdefghijklmnopqrstuvwx' });
    const v = feitas[0]!.valores as { expira_em: string };
    expect(v).toMatchObject({ empresa_id: 'e1', jornada_id: 'j1', versao: null, esconder_nomes: true, cenario: null });
    expect(new Date(v.expira_em).getTime() - antes).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000);
    expect(revalidar).toHaveBeenCalledWith('/e/e1/j/j1');
  });

  it('o cenário inicial é copiado do banco, desta jornada', async () => {
    respostas['cenarios.select'] = { data: CENARIO, error: null };
    respostas['links.insert'] = { data: { token: 't' }, error: null };
    await criarLink('e1', 'j1', { ...OPCOES, cenarioId: 'c1', validade: null, versao: 2 });
    expect(feitas[0]!.filtros).toEqual([
      ['id', 'c1'],
      ['jornada_id', 'j1'],
    ]);
    expect(feitas[1]!.valores).toMatchObject({ cenario: CENARIO, expira_em: null, versao: 2 });
  });

  it('cenário que sumiu não vira link', async () => {
    respostas['cenarios.select'] = { data: null, error: null };
    expect(await criarLink('e1', 'j1', { ...OPCOES, cenarioId: 'c1' })).toEqual({ erro: 'Este cenário não existe mais.' });
    expect(feitas.map((f) => f.tabela)).toEqual(['cenarios']);
  });

  it('esconder nomes só desliga com false', async () => {
    respostas['links.insert'] = { data: { token: 't' }, error: null };
    await criarLink('e1', 'j1', { ...OPCOES, esconderNomes: 'nao' as unknown as boolean });
    expect(feitas[0]!.valores).toMatchObject({ esconder_nomes: true });
  });

  it('validade fora da lista e versão inválida são recusadas antes do banco', async () => {
    expect(await criarLink('e1', 'j1', { ...OPCOES, validade: 1 })).toEqual({ erro: 'Escolhe uma validade da lista.' });
    expect(await criarLink('e1', 'j1', { ...OPCOES, versao: 0 })).toEqual({ erro: 'Versão inválida.' });
    expect(feitas).toEqual([]);
  });

  it('versão que não existe vira texto pra pessoa', async () => {
    respostas['links.insert'] = { error: { code: '23503', message: 'insert or update on table "links" violates foreign key' } };
    expect(await criarLink('e1', 'j1', { ...OPCOES, versao: 9 })).toEqual({ erro: 'Esta versão não existe mais nesta jornada.' });
    expect(log).toHaveBeenCalled();
  });

  it('revogar marca a data, só se ainda não foi revogado, nesta jornada', async () => {
    respostas['links.update'] = { data: [{ id: 'l1' }], error: null };
    expect(await revogarLink('e1', 'j1', 'l1')).toEqual({});
    expect(feitas[0]!.filtros).toEqual([
      ['id', 'l1'],
      ['jornada_id', 'j1'],
      ['revogado_em', null],
    ]);
    expect(typeof (feitas[0]!.valores as { revogado_em: string }).revogado_em).toBe('string');
    expect(revalidar).toHaveBeenCalledWith('/e/e1/j/j1');
  });

  it('revogar de novo avisa', async () => {
    respostas['links.update'] = { data: [], error: null };
    expect(await revogarLink('e1', 'j1', 'l1')).toEqual({ erro: 'Este link já estava revogado.' });
    expect(revalidar).not.toHaveBeenCalled();
  });
});
