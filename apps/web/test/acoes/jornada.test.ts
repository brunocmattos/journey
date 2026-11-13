import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resposta = { data?: unknown; error: { code?: string; message: string } | null };
let respostas: Record<string, Resposta> = {};
/** O que cada consulta fez: tabela, operação, valores, filtros e colunas devolvidas. */
let feitas: { tabela: string; op: string; valores?: unknown; filtros: [string, unknown][]; select?: string }[] = [];

function consulta(tabela: string) {
  const f: (typeof feitas)[number] = { tabela, op: 'select', filtros: [] };
  feitas.push(f);
  const r = () => respostas[`${tabela}.${f.op}`] ?? { data: null, error: null };
  const q: Record<string, unknown> = {
    then: (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(r()).then(ok, falha),
    single: async () => r(),
    eq: (coluna: string, valor: unknown) => {
      f.filtros.push([coluna, valor]);
      return q;
    },
    select: (colunas: string) => {
      f.select = colunas;
      return q;
    },
  };
  for (const m of ['insert', 'update', 'delete', 'upsert'])
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
const { aprovarResultado, apagarCenario, desmarcarIntencional, marcarIntencional, salvarCenario } = await import('@/acoes/jornada');

const log = vi.spyOn(console, 'error').mockImplementation(() => {});
const SESSAO = { entrada: 'entrada:e', inicio: '2026-11-24T10:00', modo: 'cenario' as const, escolhas: ['saida:m-1'] };
const FALHA = { error: { code: 'XX000', message: 'relation "cenarios" violates something' } };
const GENERICA = 'Não deu certo agora. Tenta de novo em instantes.';

describe('acoes/jornada', () => {
  beforeEach(() => {
    respostas = {};
    feitas = [];
    revalidar.mockClear();
    log.mockClear();
  });

  it('salvar: o erro do banco vira texto pra pessoa', async () => {
    respostas['cenarios.insert'] = FALHA;
    expect(await salvarCenario('e1', 'j1', { nome: 'x', ...SESSAO, esperado: [], versao: 1 })).toEqual({ erro: GENERICA });
    expect(log).toHaveBeenCalled();
  });

  it('aprovar grava o caminho da simulação junto com o esperado, só nesta jornada', async () => {
    respostas['cenarios.update'] = { data: [{ id: 'c1' }], error: null };
    expect(await aprovarResultado('e1', 'j1', 'c1', { ...SESSAO, esperado: [], versao: 3 })).toEqual({});
    const f = feitas[0]!;
    expect(f.valores).toMatchObject({ ...SESSAO, esperado: [], versao_aprovada: 3 });
    expect(f.filtros).toEqual(expect.arrayContaining([['id', 'c1'], ['jornada_id', 'j1']]));
    expect(f.select).toBe('id');
    expect(revalidar).toHaveBeenCalledWith('/e/e1/j/j1');
  });

  it('aprovar um cenário que sumiu avisa', async () => {
    respostas['cenarios.update'] = { data: [], error: null };
    expect(await aprovarResultado('e1', 'j1', 'c1', { ...SESSAO, esperado: [], versao: 3 })).toEqual({ erro: 'Este cenário não existe mais.' });
    expect(revalidar).not.toHaveBeenCalled();
  });

  it('aprovar: o erro do banco vira texto pra pessoa', async () => {
    respostas['cenarios.update'] = FALHA;
    expect(await aprovarResultado('e1', 'j1', 'c1', { ...SESSAO, esperado: [], versao: 3 })).toEqual({ erro: GENERICA });
  });

  it('apagar filtra pela jornada e avisa quando não havia o que apagar', async () => {
    respostas['cenarios.delete'] = { data: [{ id: 'c1' }], error: null };
    expect(await apagarCenario('e1', 'j1', 'c1')).toEqual({});
    expect(feitas[0]!.filtros).toEqual(expect.arrayContaining([['id', 'c1'], ['jornada_id', 'j1']]));
    respostas['cenarios.delete'] = { data: [], error: null };
    expect(await apagarCenario('e1', 'j1', 'c1')).toEqual({ erro: 'Este cenário não existe mais.' });
    respostas['cenarios.delete'] = FALHA;
    expect(await apagarCenario('e1', 'j1', 'c1')).toEqual({ erro: GENERICA });
  });

  it('marcar: o erro do banco vira texto pra pessoa', async () => {
    respostas['achados_intencionais.upsert'] = FALHA;
    expect(await marcarIntencional('e1', 'j1', 'k', 'nota')).toEqual({ erro: GENERICA });
    respostas['achados_intencionais.upsert'] = { data: null, error: null };
    expect(await marcarIntencional('e1', 'j1', 'k', ' nota ')).toEqual({});
    expect(feitas.at(-1)!.valores).toMatchObject({ jornada_id: 'j1', chave: 'k', nota: 'nota' });
  });

  it('desmarcar filtra pela jornada e avisa quando já não estava marcado', async () => {
    respostas['achados_intencionais.delete'] = { data: [{ chave: 'k' }], error: null };
    expect(await desmarcarIntencional('e1', 'j1', 'k')).toEqual({});
    expect(feitas[0]!.filtros).toEqual(expect.arrayContaining([['jornada_id', 'j1'], ['chave', 'k']]));
    respostas['achados_intencionais.delete'] = { data: [], error: null };
    expect(await desmarcarIntencional('e1', 'j1', 'k')).toEqual({ erro: 'Este achado não está mais marcado como intencional.' });
    respostas['achados_intencionais.delete'] = FALHA;
    expect(await desmarcarIntencional('e1', 'j1', 'k')).toEqual({ erro: GENERICA });
  });
});
