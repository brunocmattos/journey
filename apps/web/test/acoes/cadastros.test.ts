import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase }) }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
const { apagarCadastro, criarCadastro, mudarHorario, renomearCadastro } = await import('@/acoes/cadastros');
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('acoes/cadastros', () => {
  beforeEach(() => b.limpar());

  it('cria; Horário nasce de segunda a sexta, 8h às 18h', async () => {
    b.quando('cadastros.insert', { data: { id: 'k1', tipo: 'horario', nome: 'SAC', campos: {} }, error: null });
    expect((await criarCadastro('e1', 'horario', ' SAC ')).cadastro?.id).toBe('k1');
    expect(b.feitas[0]!.valores).toMatchObject({ nome: 'SAC', campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }] } });
    expect(await criarCadastro('e1', 'fila', '')).toEqual({ erro: 'Escreve um nome.' });
  });

  it('nome que já existe no tipo: devolve o que existe', async () => {
    b.quando('cadastros.insert', { error: { code: '23505', message: 'duplicate' } }, { error: { code: '23505', message: 'duplicate' } });
    b.quando('cadastros.select', { data: [{ id: 'k7', tipo: 'fila', nome: 'Fila Cobrança', campos: {} }], error: null }, { data: [], error: null });
    expect((await criarCadastro('e1', 'fila', 'fila cobrança')).cadastro).toMatchObject({ id: 'k7', nome: 'Fila Cobrança' });
    // A busca é só dos parecidos, com % e _ do nome valendo como letra.
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['tipo', 'fila'], ['nome', '%fila cobrança%']]);
    b.limpar();
    b.quando('cadastros.insert', { error: { code: '23505', message: 'duplicate' } });
    b.quando('cadastros.select', { data: [], error: null });
    expect(await criarCadastro('e1', 'fila', '50%_off')).toEqual({ erro: 'Já existe um cadastro com esse nome nesse tipo.' });
    expect(b.feitas[1]!.filtros.at(-1)).toEqual(['nome', '%50\\%\\_off%']);
  });

  it('renomear com nome repetido e apagar em uso explicam o porquê', async () => {
    b.quando('cadastros.update', { error: { code: '23505', message: 'duplicate' } });
    expect(await renomearCadastro('e1', 'k1', 'Ana')).toEqual({ erro: 'Já existe um cadastro com esse nome nesse tipo.' });
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['id', 'k1']]);
    b.quando('cadastros.delete', { error: { code: '23503', message: 'fk' } });
    expect(await apagarCadastro('e1', 'k1')).toEqual({ erro: 'Algum fluxo usa este cadastro. Troca nas peças antes de apagar.' });
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['id', 'k1']]);
  });

  it('horário: confere janelas e feriados antes de gravar', async () => {
    expect((await mudarHorario('e1', 'k1', { janelas: [{ dias: ['seg'], inicio: '18:00', fim: '08:00' }] })).erro).toMatch(/Confere as janelas/);
    expect((await mudarHorario('e1', 'k1', { janelas: [{ dias: [], inicio: '08:00', fim: '18:00' }] })).erro).toMatch(/pelo menos um dia/);
    expect(b.feitas).toEqual([]);
    b.quando('cadastros.update', { data: [{ id: 'k1' }], error: null });
    expect(await mudarHorario('e1', 'k1', { janelas: [{ dias: ['sab'], inicio: '00:00', fim: '24:00' }], feriados: [{ data: '2026-12-25', todo_ano: true, extra: 1 }] })).toEqual({});
    expect(b.feitas[0]!.valores).toEqual({ campos: { janelas: [{ dias: ['sab'], inicio: '00:00', fim: '24:00' }], feriados: [{ data: '2026-12-25', todo_ano: true }] } });
    // Só Horário: sem o filtro de tipo, mudaria os campos de uma fila.
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['id', 'k1'], ['tipo', 'horario']]);
  });
});
