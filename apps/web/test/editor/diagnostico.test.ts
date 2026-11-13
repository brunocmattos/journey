import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODELOS, type Achado, type Documento } from '@journey/fluxo';
import { alcancaveis, antigos, caminhoAte, contar, focoDoAchado, gavetaAberta, lembrarGaveta, pecaDoAchado, rotuloAchados, separar, simulaveis } from '@/editor/diagnostico';
import { rodar, type Contexto } from '@/editor/play';

const achado = (chave: string): Achado => ({ tipo: chave.split(':')[0]!, gravidade: 'alerta', chave, titulo: chave, texto: '', refs: [] });

/** Toca o caminho em modo livre e diz se a água chega na peça. */
const QUANDO = '2026-11-23T10:00';

function chega(doc: Documento, ctx: Contexto, alvo: string) {
  const c = caminhoAte(doc, ctx, alvo, QUANDO);
  if (!c) return false;
  const x = rodar(doc, ctx, c);
  return x.escolhas.length === c.escolhas.length && x.eventos.some((e) => e.tipo === 'chegou' && e.peca === alvo);
}

describe('editor/diagnostico', () => {
  it('separa os achados abertos dos marcados como intencionais', () => {
    const achados = [achado('beco_sem_saida:a'), achado('inalcancavel:b'), achado('regra_vazia:c')];
    const marcados = [{ chave: 'inalcancavel:b', nota: '', autor: null, criado_em: '' }, { chave: 'de-outro-documento', nota: '', autor: null, criado_em: '' }];
    expect(separar(achados, marcados)).toEqual({ abertos: [achados[0], achados[2]], intencionais: [achados[1]] });
    // O marcado que não é achado deste documento não conta.
    expect(contar(achados, marcados)).toEqual({ abertos: 2, intencionais: 1 });
  });

  it('caminho até uma peça atrás de duas decisões (e do horário, que no modo livre pergunta)', () => {
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    const ctx = { cadastros: m.cadastros, canal: m.canal };
    const play = (escolhas: string[]) => ({ inicio: 'inicio', quando: QUANDO, modo: 'livre', escolhas });
    expect(caminhoAte(m.documento, ctx, 'protocolo', QUANDO)).toEqual(play(['c3', 'c6', 'c10']));
    expect(caminhoAte(m.documento, ctx, 'fechado', QUANDO)).toEqual(play(['c4']));
    expect(caminhoAte(m.documento, ctx, 'inicio', QUANDO)).toEqual(play([]));
    expect(chega(m.documento, ctx, 'protocolo')).toBe(true);
  });

  it.each(MODELOS.map((m) => [m.nome, m] as const))('em "%s", toda peça chega pelo caminho achado', (_nome, m) => {
    const ctx = { cadastros: m.cadastros, canal: m.canal };
    for (const p of m.documento.pecas) expect(chega(m.documento, ctx, p.id), p.id).toBe(true);
  });

  it('ninguém chega: sem caminho', () => {
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    const ctx = { cadastros: m.cadastros, canal: m.canal };
    const solta: Documento = {
      ...m.documento,
      pecas: [...m.documento.pecas, { id: 'solta', tipo: 'etapa', nome: 'Solta', x: 0, y: 600 }, { id: 'depois', tipo: 'etapa', nome: 'Depois do fim', x: 0, y: 700 }],
      // Saída de um Fim não leva a lugar nenhum: a água para no Fim.
      conexoes: [...m.documento.conexoes, { id: 'cf', de: 'resolvido', para: 'depois', regra: 'sempre' }],
    };
    expect(caminhoAte(solta, ctx, 'solta', QUANDO)).toBeNull();
    expect(caminhoAte(solta, ctx, 'depois', QUANDO)).toBeNull();
    expect(caminhoAte(solta, ctx, 'nao-existe', QUANDO)).toBeNull();
  });

  it('com dois Inícios, vai pelo mais perto', () => {
    const doc: Documento = {
      formato: 'journey/2',
      pecas: [
        { id: 'i1', tipo: 'inicio', nome: 'Telefone', x: 0, y: 0 },
        { id: 'i2', tipo: 'inicio', nome: 'Site', x: 0, y: 100 },
        { id: 'd', tipo: 'decisao', nome: 'Qual?', x: 100, y: 0 },
        { id: 'a', tipo: 'etapa', nome: 'A', x: 200, y: 0 },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 300, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i1', para: 'd', regra: 'sempre' },
        { id: 'c2', de: 'd', para: 'a', regra: 'opcao', valor: '1' },
        { id: 'c3', de: 'd', para: 'f', regra: 'opcao', valor: '2' },
        { id: 'c4', de: 'i2', para: 'a', regra: 'sempre' },
        { id: 'c5', de: 'a', para: 'f', regra: 'sempre' },
      ],
      grupos: [],
      notas: [],
    };
    expect(caminhoAte(doc, { cadastros: [], canal: null }, 'a', QUANDO)).toEqual({ inicio: 'i2', quando: QUANDO, modo: 'livre', escolhas: [] });
  });

  it('atrás de um "senão" do horário: o play volta em modo livre, porque no relógio as escolhas não valem', () => {
    const H = 'h0000000-0000-0000-0000-000000000001';
    const ctx = { cadastros: [{ id: H, tipo: 'horario', nome: 'Comercial', campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }], feriados: [] } }], canal: null };
    const doc: Documento = {
      formato: 'journey/2',
      pecas: [
        { id: 'i', tipo: 'inicio', nome: 'I', x: 0, y: 0 },
        { id: 'h', tipo: 'decisao', nome: 'Horário', x: 0, y: 0, responsavel: H },
        { id: 'fechado', tipo: 'etapa', nome: 'Fechado', x: 0, y: 0 },
        { id: 'alvo', tipo: 'etapa', nome: 'Alvo', x: 0, y: 0 },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i', para: 'h', regra: 'sempre' },
        { id: 'c2', de: 'h', para: 'f', regra: 'horario', horario: 'dentro' },
        { id: 'c3', de: 'h', para: 'fechado', regra: 'senao' },
        { id: 'c4', de: 'fechado', para: 'alvo', regra: 'sempre' },
        { id: 'c5', de: 'alvo', para: 'f', regra: 'sempre' },
      ],
      grupos: [],
      notas: [],
    };
    // Segunda às 10h o relógio diria "dentro": só no modo livre a escolha do "senão" vale.
    const p = caminhoAte(doc, ctx, 'alvo', QUANDO)!;
    expect(p).toEqual({ inicio: 'i', quando: QUANDO, modo: 'livre', escolhas: ['c3'] });
    expect(rodar(doc, ctx, p).eventos.some((e) => e.tipo === 'chegou' && e.peca === 'alvo')).toBe(true);
    expect(rodar(doc, ctx, { ...p, modo: 'relogio' }).eventos.some((e) => e.tipo === 'chegou' && e.peca === 'alvo')).toBe(false);
  });

  it('marcações de achados que o documento não tem mais são "antigas"', () => {
    const achados = [achado('beco_sem_saida:a')];
    const marcados = [{ chave: 'beco_sem_saida:a', nota: '' }, { chave: 'inalcancavel:sumiu', nota: 'x' }];
    expect(antigos(achados, marcados)).toEqual([{ chave: 'inalcancavel:sumiu', nota: 'x' }]);
  });

  it('o rótulo do botão', () => {
    expect([0, 1, 3].map(rotuloAchados)).toEqual(['sem achados', '1 achado', '3 achados']);
  });

  it('a peça de um achado: a primeira peça das referências, ou a origem da conexão', () => {
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    expect(pecaDoAchado(m.documento, { refs: ['c5', 'assunto'] })).toBe('assunto');
    expect(pecaDoAchado(m.documento, { refs: ['c5'] })).toBe('assunto');
    expect(pecaDoAchado(m.documento, { refs: [] })).toBeNull();
  });

  describe('a gaveta lembrada por fluxo', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('guarda e lê do navegador', () => {
      const guardado = new Map<string, string>();
      vi.stubGlobal('localStorage', { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v), removeItem: (k: string) => guardado.delete(k) });
      expect(gavetaAberta('f1')).toBe(false);
      lembrarGaveta('f1', true);
      expect(gavetaAberta('f1')).toBe(true);
      expect(gavetaAberta('f2')).toBe(false);
      lembrarGaveta('f1', false);
      expect(gavetaAberta('f1')).toBe(false);
    });

    it('sem armazenamento (ou bloqueado), fechada e sem erro', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('bloqueado');
        },
        setItem: () => {
          throw new Error('bloqueado');
        },
      });
      expect(gavetaAberta('f1')).toBe(false);
      expect(() => lembrarGaveta('f1', true)).not.toThrow();
    });
  });

  it('ver no quadro: seleciona a primeira referência, holofote em todas, enquadra as peças (as da conexão também)', () => {
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    expect(focoDoAchado(m.documento, { refs: ['c5', 'assunto'] })).toEqual({ sel: { tipo: 'conexao', id: 'c5' }, destaque: new Set(['c5', 'assunto']), enquadrar: ['assunto', 'financeiro'] });
    expect(focoDoAchado(m.documento, { refs: ['sumiu', 'horario'] })!.sel).toEqual({ tipo: 'peca', id: 'horario' });
    expect(focoDoAchado(m.documento, { refs: [] })).toBeNull();
  });

  it('as peças que algum Início alcança: uma busca só, sem passar de um Fim; bate com o caminho de cada peça', () => {
    for (const m of MODELOS) {
      const ctx = { cadastros: m.cadastros, canal: m.canal };
      const a = alcancaveis(m.documento);
      for (const p of m.documento.pecas) expect(a.has(p.id), `${m.chave}:${p.id}`).toBe(caminhoAte(m.documento, ctx, p.id, QUANDO) !== null);
    }
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    const doc: Documento = {
      ...m.documento,
      pecas: [...m.documento.pecas, { id: 'solta', tipo: 'etapa', nome: 'Solta', x: 0, y: 0 }, { id: 'depois', tipo: 'etapa', nome: 'Depois', x: 0, y: 0 }],
      conexoes: [...m.documento.conexoes, { id: 'cf', de: 'resolvido', para: 'depois', regra: 'sempre' }],
    };
    const a = alcancaveis(doc);
    expect([a.has('solta'), a.has('depois'), a.has('protocolo')]).toEqual([false, false, true]);
    expect(alcancaveis({ ...doc, pecas: doc.pecas.filter((p) => p.tipo !== 'inicio') }).size).toBe(0);
    // Os achados com "simular até aqui": os de peça alcançável (o "inalcancavel:solta" não).
    const achados = [achado('beco_sem_saida:depois'), achado('inalcancavel:solta'), achado('regra_vazia:c5'), achado('sem_inicio:fluxo')];
    achados[0]!.refs = ['depois'];
    achados[1]!.refs = ['solta'];
    achados[2]!.refs = ['assunto', 'c5'];
    expect([...simulaveis(doc, achados)]).toEqual(['regra_vazia:c5']);
  });
});
