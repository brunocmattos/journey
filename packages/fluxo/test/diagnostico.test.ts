import { describe, expect, it } from 'vitest';
import { diagnosticar } from '../src/diagnostico';
import { doc, liga, peca } from './apoio';

const chaves = (...args: Parameters<typeof diagnosticar>) => diagnosticar(...args).map((a) => a.chave);
const HORARIO = { id: 'h', tipo: 'horario', nome: 'Comercial', campos: { janelas: [], feriados: [] } };

describe('diagnóstico', () => {
  it('fluxo limpo não tem achado', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('f', 'fim')], [liga('i', 'f')]))).toEqual([]);
    expect(chaves(doc([]))).toEqual([]);
  });

  it('sem Início', () => {
    expect(chaves(doc([peca('f', 'fim')]))).toEqual(['sem_inicio:fluxo']);
  });

  it('beco sem saída e Início que não termina', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('e', 'etapa')], [liga('i', 'e')]))).toEqual(['beco_sem_saida:e', 'nao_termina:i']);
  });

  it('peça que ninguém alcança', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('f', 'fim'), peca('solta', 'fim')], [liga('i', 'f')]))).toEqual(['inalcancavel:solta']);
  });

  it('ciclo sem saída, e ciclo com saída não é achado', () => {
    const preso = doc([peca('i', 'inicio'), peca('a', 'etapa'), peca('b', 'etapa'), peca('f', 'fim')], [liga('i', 'a'), liga('a', 'b'), liga('b', 'a')]);
    expect(chaves(preso)).toEqual(['ciclo_sem_saida:a+b', 'nao_termina:i', 'inalcancavel:f']);
    const comSaida = doc(preso.pecas, [liga('i', 'a'), liga('a', 'b'), liga('b', 'a', { regra: 'opcao', valor: '2' }), liga('b', 'f', { regra: 'opcao', valor: '1' })]);
    expect(chaves(comSaida).filter((k) => k.startsWith('ciclo'))).toEqual([]);
  });

  it('laço numa peça só', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('a', 'etapa')], [liga('i', 'a'), liga('a', 'a')]))).toContain('ciclo_sem_saida:a');
  });

  it('decisão com uma saída só', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('d', 'decisao'), peca('f', 'fim')], [liga('i', 'd'), liga('d', 'f')]))).toEqual(['decisao_sem_escolha:d']);
  });

  it('opções repetidas na mesma peça', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('d', 'decisao'), peca('a', 'fim'), peca('b', 'fim')],
      [liga('i', 'd'), liga('d', 'a', { regra: 'opcao', valor: '1' }), liga('d', 'b', { regra: 'opcao', valor: '1' })],
    );
    expect(diagnosticar(d)).toEqual([expect.objectContaining({ chave: 'opcoes_repetidas:d:opcao:1', refs: ['d', 'd>a', 'd>b'] })]);
  });

  it('regra pela metade', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim'), peca('b', 'fim')], [liga('i', 'a', { regra: 'condicao' }), liga('i', 'b', { regra: 'opcao', valor: '2' })]);
    expect(chaves(d)).toEqual(['regra_vazia:i>a']);
  });

  it('atendimento sem responsável e responsável que não existe', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'atendimento'), peca('b', 'atendimento', { responsavel: 'k9' }), peca('f', 'fim')], [liga('i', 'a'), liga('a', 'b'), liga('b', 'f')]);
    expect(chaves(d)).toEqual(['sem_responsavel:a']);
    expect(chaves(d, { cadastros: [] })).toEqual(['responsavel_inexistente:b', 'sem_responsavel:a']);
  });

  it('decisão de horário sem um cadastro Horário', () => {
    const pecas = [peca('i', 'inicio'), peca('h', 'decisao', { responsavel: 'k1' }), peca('a', 'fim'), peca('b', 'fim')];
    const conexoes = [liga('i', 'h'), liga('h', 'a', { regra: 'horario', horario: 'dentro' as const }), liga('h', 'b', { regra: 'horario', horario: 'fora' as const })];
    expect(chaves(doc(pecas, conexoes), { cadastros: [{ id: 'k1', tipo: 'fila', nome: 'Fila' }] })).toEqual(['horario_sem_cadastro:h']);
    const comH = doc(pecas.map((p) => (p.id === 'h' ? { ...p, responsavel: 'h' } : p)), conexoes);
    expect(chaves(comH, { cadastros: [HORARIO] })).toEqual([]);
    expect(chaves(comH, { cadastros: [{ ...HORARIO, campos: { janelas: [{ dias: ['seg'], inicio: '18:00', fim: '08:00' }] } }] })).toEqual(['horario_invalido:h']);
  });

  it('caminho mais longo acima da meta', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('a', 'atendimento', { responsavel: 'k', tempo_s: 3600 }), peca('w', 'espera'), peca('f', 'fim')],
      [liga('i', 'a'), liga('a', 'w'), liga('w', 'f', { regra: 'tempo', tempo_s: 7200 })],
    );
    expect(chaves(d, { meta_s: 4 * 3600 })).toEqual([]);
    const [a] = diagnosticar(d, { meta_s: 2 * 3600 });
    expect(a).toMatchObject({ chave: 'passou_do_prazo:fluxo', refs: ['i', 'a', 'w', 'f'] });
    expect(a!.texto).toContain('3 h');
  });

  it('ordem: grave, alerta, observação; a chave não depende do nome', () => {
    const d = doc([peca('i', 'inicio'), peca('e', 'etapa', { nome: 'X' }), peca('s', 'atendimento'), peca('f', 'fim')], [liga('i', 'e')]);
    const g = diagnosticar(d).map((a) => a.gravidade);
    expect(g).toEqual([...g].sort((a, b) => ['grave', 'alerta', 'observacao'].indexOf(a) - ['grave', 'alerta', 'observacao'].indexOf(b)));
    const renomeado = { ...d, pecas: d.pecas.map((p) => ({ ...p, nome: `${p.nome}!` })) };
    expect(chaves(renomeado)).toEqual(chaves(d));
  });

  it('caminho comprido não estoura a pilha', () => {
    const n = 20_000;
    const d = doc([peca('i', 'inicio'), ...Array.from({ length: n }, (_, k) => peca(`p${k}`, 'etapa', { tempo_s: 1 })), peca('f', 'fim')], [liga('i', 'p0'), ...Array.from({ length: n - 1 }, (_, k) => liga(`p${k}`, `p${k + 1}`)), liga(`p${n - 1}`, 'f')]);
    expect(chaves(d, { meta_s: 60 })).toEqual(['passou_do_prazo:fluxo']);
  });

  it('500 peças em menos de 100 ms', () => {
    const pecas = [peca('i', 'inicio'), ...Array.from({ length: 498 }, (_, k) => peca(`p${k}`, k % 7 === 0 ? 'decisao' : 'etapa')), peca('f', 'fim')];
    const conexoes = [liga('i', 'p0'), ...Array.from({ length: 497 }, (_, k) => liga(`p${k}`, `p${k + 1}`)), ...Array.from({ length: 70 }, (_, k) => liga(`p${k * 7}`, 'f', { regra: 'opcao', valor: '9' })), liga('p497', 'f')];
    const d = doc(pecas, conexoes);
    const t0 = performance.now();
    diagnosticar(d, { meta_s: 60 });
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
