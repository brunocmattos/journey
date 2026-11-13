import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase }) }));
// O lib/link de verdade importa server-only e lê a chave; aqui só a resposta importa.
let configurado = true;
vi.mock('@/lib/link', () => ({ linkPublicoConfigurado: () => configurado }));
const { criarLink, revogarLink } = await import('@/acoes/links');

const log = vi.spyOn(console, 'error').mockImplementation(() => {});
const OPCOES = { versao: null, esconderNomes: true, cenarioId: null, validade: 30 };
const CENARIO = { nome: 'E se?', inicio: 'i', quando: '2026-11-23T16:57', modo: 'relogio', escolhas: ['c2'] };
/** A versão 2: Início → decisão (c2 ou c3) → Fim. */
const VERSAO = {
  documento: {
    formato: 'journey/2',
    pecas: [
      { id: 'i', tipo: 'inicio', nome: 'Início', x: 0, y: 0 },
      { id: 'd', tipo: 'decisao', nome: 'Qual?', x: 0, y: 0 },
      { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
    ],
    conexoes: [
      { id: 'c1', de: 'i', para: 'd', regra: 'sempre' },
      { id: 'c2', de: 'd', para: 'f', regra: 'opcao', valor: '1' },
      { id: 'c3', de: 'd', para: 'f', regra: 'opcao', valor: '2' },
    ],
    grupos: [],
    notas: [],
  },
};
const RESUMO = { id: 'l1', token: 'abcdefghijklmnopqrstuvwx', versao: null, esconder_nomes: true, cenario_nome: null, expira_em: null, revogado_em: null, criado_em: '2026-11-13T10:00:00Z' };

describe('acoes/links', () => {
  beforeEach(() => {
    b.limpar();
    log.mockClear();
    configurado = true;
  });

  it('sem a chave secreta no servidor, nem tenta criar e avisa', async () => {
    configurado = false;
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1' })).toEqual({
      erro: 'Os links públicos ainda não estão configurados neste servidor (falta a chave secreta). Avisa quem cuida do Journey.',
    });
    expect(b.feitas).toEqual([]);
    expect(log).toHaveBeenCalled();
  });

  it('cria o link com as opções e devolve como a lista mostra; a validade vira data', async () => {
    b.quando('links.insert', { data: RESUMO, error: null });
    const antes = Date.now();
    expect(await criarLink('e1', 'f1', OPCOES)).toEqual({ link: RESUMO });
    const v = b.feitas[0]!.valores as { expira_em: string };
    expect(v).toMatchObject({ empresa_id: 'e1', fluxo_id: 'f1', versao: null, esconder_nomes: true, cenario: null });
    expect(new Date(v.expira_em).getTime() - antes).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000);
  });

  it('o cenário inicial é copiado do banco, deste fluxo e desta empresa', async () => {
    b.quando('cenarios.select', { data: CENARIO, error: null });
    b.quando('links.insert', { data: RESUMO, error: null });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', validade: null })).toEqual({ link: RESUMO });
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'k1']]);
    expect(b.feitas[1]!.valores).toMatchObject({ cenario: CENARIO, expira_em: null, versao: null });
  });

  it('com versão fixa, o cenário tem que tocar nela (com os Horários da empresa)', async () => {
    b.quando('cenarios.select', { data: CENARIO, error: null });
    b.quando('fluxo_versoes.select', { data: VERSAO, error: null });
    b.quando('cadastros.select', { data: [], error: null });
    b.quando('links.insert', { data: RESUMO, error: null });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual({ link: RESUMO });
    expect(b.feitas.map((f) => f.tabela)).toEqual(['cenarios', 'fluxo_versoes', 'cadastros', 'links']);
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['numero', 2]]);
    expect(b.feitas[2]!.filtros).toEqual([['empresa_id', 'e1'], ['tipo', 'horario']]);
    expect(b.feitas[3]!.valores).toMatchObject({ cenario: CENARIO, versao: 2 });
  });

  it('cenário que começa numa peça que a versão não tem, ou com escolha que ela não tem: recusa', async () => {
    b.quando('cenarios.select', { data: { ...CENARIO, inicio: 'outro' }, error: null }, { data: { ...CENARIO, escolhas: ['c2', 'c9'] }, error: null }, { data: { ...CENARIO, escolhas: ['c9'] }, error: null });
    b.quando('fluxo_versoes.select', { data: VERSAO, error: null }, { data: VERSAO, error: null }, { data: VERSAO, error: null });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual({
      erro: 'O cenário “E se?” começa numa peça que não existe na versão 2. Escolhe outra versão ou outro cenário.',
    });
    const naoToca = { erro: 'O cenário “E se?” não toca na versão 2: alguma escolha dele não existe nela. Escolhe outra versão ou outro cenário.' };
    // Uma escolha a mais depois do fim também não serve: o motor não a aceita.
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual(naoToca);
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual(naoToca);
    expect(b.feitas.some((f) => f.tabela === 'links')).toBe(false);
  });

  it('versão que sumiu ou que não abre: recusa antes de criar', async () => {
    b.quando('cenarios.select', { data: CENARIO, error: null }, { data: CENARIO, error: null });
    b.quando('fluxo_versoes.select', { data: null, error: null }, { data: { documento: { formato: 'journey/1' } }, error: null });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual({ erro: 'Esta versão não existe mais neste fluxo.' });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual({ erro: 'A versão 2 não abre: o documento dela não é válido.' });
  });

  it('cenário que sumiu não vira link', async () => {
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1' })).toEqual({ erro: 'Este cenário não existe mais.' });
    expect(b.feitas.map((f) => f.tabela)).toEqual(['cenarios']);
  });

  it('esconder nomes só desliga com false', async () => {
    await criarLink('e1', 'f1', { ...OPCOES, esconderNomes: 'nao' as unknown as boolean });
    expect(b.feitas[0]!.valores).toMatchObject({ esconder_nomes: true });
  });

  it('validade fora da lista, versão e cenário inválidos são recusados antes do banco', async () => {
    expect(await criarLink('e1', 'f1', { ...OPCOES, validade: 1 })).toEqual({ erro: 'Escolhe uma validade da lista.' });
    expect(await criarLink('e1', 'f1', { ...OPCOES, versao: 0 })).toEqual({ erro: 'Versão inválida.' });
    expect(await criarLink('e1', 'f1', { ...OPCOES, versao: 1.5 })).toEqual({ erro: 'Versão inválida.' });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 3 as unknown as string })).toEqual({ erro: 'Cenário inválido.' });
    expect(await criarLink('e1', 'f1', null as never)).toEqual({ erro: 'Opções inválidas.' });
    expect(await criarLink('e1', 'f1', 'x' as never)).toEqual({ erro: 'Opções inválidas.' });
    expect(b.feitas).toEqual([]);
  });

  it('versão que não existe vira texto pra pessoa; sem versão fixa, é o fluxo que sumiu', async () => {
    b.quando('links.insert', { error: { code: '23503', message: 'violates foreign key' } }, { error: { code: '23503', message: 'violates foreign key' } });
    expect(await criarLink('e1', 'f1', { ...OPCOES, versao: 9 })).toEqual({ erro: 'Esta versão não existe mais neste fluxo.' });
    expect(await criarLink('e1', 'f1', OPCOES)).toEqual({ erro: 'Este fluxo não existe mais.' });
    expect(log).toHaveBeenCalled();
  });

  it('revogar marca a data, só se ainda não foi revogado, neste fluxo e empresa; devolve a data do banco', async () => {
    b.quando('links.update', { data: [{ revogado_em: '2026-11-13T10:00:00.123Z' }], error: null });
    expect(await revogarLink('e1', 'f1', 'l1')).toEqual({ revogado_em: '2026-11-13T10:00:00.123Z' });
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'l1'], ['revogado_em', null]]);
    expect(typeof (b.feitas[0]!.valores as { revogado_em: string }).revogado_em).toBe('string');
  });

  it('revogar de novo avisa', async () => {
    b.quando('links.update', { data: [], error: null });
    expect(await revogarLink('e1', 'f1', 'l1')).toEqual({ erro: 'Este link não existe mais ou já foi revogado.' });
  });
});
