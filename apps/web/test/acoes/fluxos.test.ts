import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODELOS } from '@journey/fluxo';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase }) }));
const revalidar = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (c: string) => revalidar(c) }));
const { apagarFluxo, criarDeModelo, criarFluxo, mudarFluxo } = await import('@/acoes/fluxos');
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('acoes/fluxos', () => {
  beforeEach(() => {
    b.limpar();
    revalidar.mockClear();
  });

  it('fluxo em branco: nome e canal; sem nome não vai pro banco', async () => {
    expect(await criarFluxo('e1', '  ', 'whatsapp')).toEqual({ erro: 'Dá um nome pro fluxo.' });
    expect(b.feitas).toEqual([]);
    b.quando('fluxos.insert', { data: { id: 'f1' }, error: null });
    expect(await criarFluxo('e1', ' Cobrança ', '')).toEqual({ id: 'f1' });
    expect(b.feitas[0]).toMatchObject({ tabela: 'fluxos', op: 'insert', valores: { empresa_id: 'e1', nome: 'Cobrança', canal: null } });
    expect(revalidar).toHaveBeenCalledWith('/e/e1');
  });

  it('modelo: reaproveita o cadastro igual, cria os outros e salva o documento com os ids da empresa', async () => {
    const m = MODELOS.find((x) => x.chave === 'credito')!;
    b.quando('cadastros.select', { data: [{ id: 'k-bureau', tipo: 'sistema', nome: '  bureau de CRÉDITO ' }], error: null });
    b.quando('cadastros.insert', { data: { id: 'k-analistas' }, error: null });
    b.quando('canais.select', { data: { chave: 'interno' }, error: null });
    b.quando('fluxos.insert', { data: { id: 'f9' }, error: null });
    b.quando('rpc.salvar_fluxo', { data: 1, error: null });
    expect(await criarDeModelo('e1', 'credito')).toEqual({ id: 'f9' });
    const insercoes = b.feitas.filter((f) => f.tabela === 'cadastros' && f.op === 'insert');
    expect(insercoes.map((f) => (f.valores as { nome: string }).nome)).toEqual(['Analistas de crédito']);
    expect(b.feitas.find((f) => f.tabela === 'fluxos')!.valores).toEqual({ empresa_id: 'e1', nome: m.nome, descricao: m.descricao, canal: 'interno' });
    const salvo = b.feitas.find((f) => f.tabela === 'rpc:salvar_fluxo')!.valores as { p_documento: { pecas: { responsavel?: string }[] }; p_revisao: number };
    expect(salvo.p_revisao).toBe(0);
    expect(salvo.p_documento.pecas.flatMap((p) => (p.responsavel ? [p.responsavel] : []))).toEqual(['k-bureau', 'k-analistas']);
  });

  it('modelo: o Horário entra com as janelas e feriados; canal que a empresa não tem fica vazio', async () => {
    b.quando('cadastros.select', { data: [], error: null });
    for (const id of ['k1', 'k2', 'k3']) b.quando('cadastros.insert', { data: { id }, error: null });
    b.quando('canais.select', { data: null, error: null });
    b.quando('fluxos.insert', { data: { id: 'f1' }, error: null });
    b.quando('rpc.salvar_fluxo', { data: 1, error: null });
    await criarDeModelo('e1', 'whatsapp');
    const horario = b.feitas.find((f) => f.tabela === 'cadastros' && f.op === 'insert' && (f.valores as { tipo: string }).tipo === 'horario')!;
    expect((horario.valores as { campos: { janelas: unknown[]; feriados: unknown[] } }).campos.janelas).toHaveLength(2);
    expect((b.feitas.find((f) => f.tabela === 'fluxos')!.valores as { canal: unknown }).canal).toBeNull();
  });

  it('modelo: se salvar o documento falha, o fluxo criado é apagado', async () => {
    b.quando('cadastros.select', { data: [], error: null });
    for (const id of ['k1', 'k2']) b.quando('cadastros.insert', { data: { id }, error: null });
    b.quando('fluxos.insert', { data: { id: 'f1' }, error: null });
    b.quando('rpc.salvar_fluxo', { error: { code: '22023', message: 'responsável' } });
    expect((await criarDeModelo('e1', 'email')).erro).toBeTruthy();
    expect(b.feitas.at(-1)).toMatchObject({ tabela: 'fluxos', op: 'delete', filtros: [['id', 'f1']] });
    expect(await criarDeModelo('e1', 'nao-existe')).toEqual({ erro: 'Esse modelo não existe.' });
  });

  it('mudar dados do fluxo: confere nome e meta; fluxo que sumiu é erro', async () => {
    expect(await mudarFluxo('e1', 'f1', { nome: ' ' })).toEqual({ erro: 'Dá um nome pro fluxo.' });
    expect(await mudarFluxo('e1', 'f1', { meta_s: -5 })).toEqual({ erro: 'A meta é um tempo maior que zero.' });
    b.quando('fluxos.update', { data: [{ id: 'f1' }], error: null }, { data: [], error: null });
    expect(await mudarFluxo('e1', 'f1', { nome: ' Novo ', canal: '', meta_s: null })).toEqual({});
    expect(b.feitas.at(-1)!.valores).toEqual({ nome: 'Novo', canal: null, meta_s: null });
    expect(await mudarFluxo('e1', 'f1', { descricao: 'x' })).toEqual({ erro: 'Este fluxo não existe mais.' });
  });

  it('apagar fluxo', async () => {
    b.quando('fluxos.delete', { data: [{ id: 'f1' }], error: null }, { data: [], error: null });
    expect(await apagarFluxo('e1', 'f1')).toEqual({});
    expect(await apagarFluxo('e1', 'f1')).toEqual({ erro: 'Este fluxo não existe mais.' });
  });
});
