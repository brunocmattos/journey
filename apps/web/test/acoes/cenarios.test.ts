import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CenarioNovo } from '@/editor/cenarios';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase }) }));
const { apagarCenario, aprovarCenario, renomearCenario, salvarCenario } = await import('@/acoes/cenarios');
vi.spyOn(console, 'error').mockImplementation(() => {});

const ESPERADO = { caminho: ['i', 'a', 'f'], fim: { motivo: 'fim' as const, peca: 'f' }, tempo_s: 60 };
const NOVO: CenarioNovo = { inicio: 'i', quando: '2026-11-23T10:00', modo: 'relogio', escolhas: ['c2'], esperado: ESPERADO };

describe('acoes/cenarios', () => {
  beforeEach(() => b.limpar());

  it('salva com o nome, o caminho e a revisão; devolve o cenário', async () => {
    const linha = { id: 'k1', nome: 'Paga na hora', ...NOVO, revisao_aprovada: 4, atualizado_em: '2026-11-13T10:00:00Z' };
    b.quando('cenarios.insert', { data: linha, error: null });
    expect(await salvarCenario('e1', 'f1', ' Paga na hora ', NOVO, 4)).toEqual({ cenario: linha });
    expect(b.feitas[0]!.valores).toEqual({ empresa_id: 'e1', fluxo_id: 'f1', nome: 'Paga na hora', ...NOVO, revisao_aprovada: 4 });
  });

  it('o que o banco recusaria é recusado antes, com o motivo', async () => {
    const casos: [string, CenarioNovo, number, string][] = [
      ['  ', NOVO, 4, 'O nome do cenário vai de 1 a 200 letras.'],
      ['x'.repeat(201), NOVO, 4, 'O nome do cenário vai de 1 a 200 letras.'],
      ['ok', { ...NOVO, inicio: '' }, 4, 'O cenário precisa de um Início.'],
      ['ok', { ...NOVO, quando: '23/11/2026 10:00' }, 4, 'A data e hora do cenário não estão no formato certo.'],
      ['ok', { ...NOVO, modo: 'cenario' as never }, 4, 'O modo do cenário é "relógio" ou "livre".'],
      ['ok', { ...NOVO, escolhas: [1] as never }, 4, 'As escolhas do cenário não estão no formato certo.'],
      ['ok', { ...NOVO, esperado: { ...ESPERADO, fim: null } as never }, 4, 'O resultado do cenário não está no formato certo: dá play até o fim e salva de novo.'],
      ['ok', NOVO, -1, 'Revisão inválida.'],
      ['ok', null as never, 4, 'O cenário não está no formato certo.'],
    ];
    for (const [nome, c, rev, erro] of casos) expect(await salvarCenario('e1', 'f1', nome, c, rev), erro).toEqual({ erro });
    expect(b.feitas).toEqual([]);
  });

  it('fluxo que sumiu', async () => {
    b.quando('cenarios.insert', { error: { code: '23503', message: 'fk' } });
    expect(await salvarCenario('e1', 'f1', 'x', NOVO, 0)).toEqual({ erro: 'Este fluxo não existe mais.' });
  });

  it('aprovar o resultado novo: as escolhas aceitas, o esperado e a revisão, só neste fluxo e empresa', async () => {
    const novo = { escolhas: ['c3'], esperado: ESPERADO };
    b.quando('cenarios.update', { data: [{ id: 'k1' }], error: null }, { data: [], error: null });
    expect(await aprovarCenario('e1', 'f1', 'k1', novo, 5)).toEqual({});
    expect(b.feitas[0]).toMatchObject({ valores: { escolhas: ['c3'], esperado: ESPERADO, revisao_aprovada: 5 }, filtros: [['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'k1']] });
    expect(await aprovarCenario('e1', 'f1', 'k1', novo, 5)).toEqual({ erro: 'Este cenário não existe mais.' });
    expect(await aprovarCenario('e1', 'f1', 'k1', { ...novo, esperado: { ...ESPERADO, tempo_s: -1 } }, 5)).toEqual({ erro: 'O resultado não está no formato certo: dá play até o fim e aprova de novo.' });
    expect(await aprovarCenario('e1', 'f1', 'k1', { ...novo, escolhas: [['c3']] as never }, 5)).toEqual({ erro: 'As escolhas do cenário não estão no formato certo.' });
    expect(await aprovarCenario('e1', 'f1', 'k1', null as never, 5)).toEqual({ erro: 'As escolhas do cenário não estão no formato certo.' });
    expect(b.feitas).toHaveLength(2);
  });

  it('renomear e apagar', async () => {
    expect(await renomearCenario('e1', 'f1', 'k1', '')).toEqual({ erro: 'O nome do cenário vai de 1 a 200 letras.' });
    b.quando('cenarios.update', { data: [{ id: 'k1' }], error: null });
    expect(await renomearCenario('e1', 'f1', 'k1', ' Novo ')).toEqual({});
    expect(b.feitas[0]).toMatchObject({ valores: { nome: 'Novo' }, filtros: [['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'k1']] });
    b.quando('cenarios.delete', { data: [{ id: 'k1' }], error: null }, { data: [], error: null });
    expect(await apagarCenario('e1', 'f1', 'k1')).toEqual({});
    expect(b.feitas[1]).toMatchObject({ op: 'delete', filtros: [['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'k1']] });
    expect(await apagarCenario('e1', 'f1', 'k1')).toEqual({ erro: 'Este cenário não existe mais.' });
  });
});
