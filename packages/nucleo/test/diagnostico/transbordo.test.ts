import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { alcancaveis } from '../../src/diagnostico/alcance';
import { ciclosDeTransbordo, destinosInexistentes, esperaSemLimite, gruposQueDesligam, planoBQueNaoDispara, semTransbordo, voltaPropriaFila } from '../../src/diagnostico/transbordo';
import { GRAVIDADE } from '../../src/diagnostico/tipos';
import { doc, entrada, fila, grupo, peca, ramal, saida } from '../apoio';

describe('diagnóstico de transbordo', () => {
  const idx = indexar(
    doc({
      ramais: [
        ramal('1', { ao_nao_atender: 'ramal:2' }),
        ramal('2', { ao_nao_atender: 'ramal:3' }),
        ramal('3', { ao_nao_atender: 'ramal:2' }),
        ramal('4', { ao_nao_atender: 'ramal:99', siga_me_lista: ['ramal:98'] }),
        ramal('5', { ao_nao_atender: 'fila:10' }),
        ramal('6', { ao_nao_atender: 'fila:10', transbordo_anti_loop: true }),
      ],
      filas: [fila('10', { membros: ['ramal:5', 'ramal:6'], ao_esgotar: 'fila:11' }), fila('11', { espera_maxima_s: 60, ao_esgotar: 'fim:desliga' })],
      grupos: [grupo('20', { ao_esgotar: 'fim:desliga' }), grupo('21', { ao_esgotar: 'fim:caixa_postal' })],
    }),
  );

  it('destino inexistente, agrupado por alvo, com os campos de origem', () => {
    expect(destinosInexistentes(idx).map((a) => [a.chave, a.campos])).toEqual([
      ['destino_inexistente:ramal:4>ramal:99', ['ao_nao_atender']],
      ['membro_inexistente:ramal:4>ramal:98', ['siga_me_lista']],
    ]);
  });

  it('membro inexistente só deixa de tocar: texto próprio e gravidade alerta', () => {
    const a = destinosInexistentes(idx);
    const grave = a.find((x) => x.chave === 'destino_inexistente:ramal:4>ramal:99')!;
    const membro = a.find((x) => x.chave === 'membro_inexistente:ramal:4>ramal:98')!;
    expect(grave.gravidade).toBe('grave');
    expect(grave.texto).toContain('não tem pra onde ir');
    expect(membro.gravidade).toBe('alerta');
    expect(membro.texto).toContain('lista como membro ramal:98, que não está no catálogo (pode ter sido apagado); ele não vai tocar');
    expect(membro.texto).not.toContain('pra onde ir');
  });

  it('fila e grupo com membro inexistente; o mesmo alvo em membros e em transbordo gera dois achados distintos', () => {
    const i = indexar(doc({ filas: [fila('1', { membros: ['ramal:9', 'ramal:8'], ao_esgotar: 'ramal:9' })], grupos: [grupo('2', { membros: ['ramal:7'] })] }));
    const a = destinosInexistentes(i);
    expect(a.map((x) => [x.chave, x.gravidade, x.campos])).toEqual([
      ['destino_inexistente:fila:1>ramal:9', 'grave', ['ao_esgotar']],
      ['membro_inexistente:fila:1>ramal:9', 'alerta', ['membros']],
      ['membro_inexistente:fila:1>ramal:8', 'alerta', ['membros']],
      ['membro_inexistente:grupo:2>ramal:7', 'alerta', ['membros']],
    ]);
    expect(new Set(a.map((x) => x.chave)).size).toBe(4);
  });

  it('ciclo com quem cai nele', () => {
    const c = ciclosDeTransbordo(idx);
    expect(c).toHaveLength(1);
    expect(c[0]!.titulo).toBe('Ciclo entre 2 ↔ 3');
    expect(c[0]!.refs).toEqual(['ramal:2', 'ramal:3', 'ramal:1']);
    expect(c[0]!.texto).toContain('3 ramais caem nesse ciclo');
  });

  it('volta pra própria fila, menos com anti-loop', () => {
    expect(voltaPropriaFila(idx).map((a) => a.chave)).toEqual(['volta_propria_fila:ramal:5>fila:10']);
  });

  it('grupo que desliga', () => {
    expect(gruposQueDesligam(idx).map((a) => a.chave)).toEqual(['grupo_desliga:grupo:20']);
  });

  it('grupo sem ao_esgotar desliga do mesmo jeito: grupo_desliga, alerta', () => {
    const i = indexar(doc({ grupos: [grupo('1', { ao_esgotar: 'fim:desliga' }), grupo('2'), grupo('3', { ao_esgotar: 'fim:caixa_postal' })] }));
    const a = gruposQueDesligam(i);
    expect(a.map((x) => [x.chave, x.gravidade])).toEqual([
      ['grupo_desliga:grupo:1', 'alerta'],
      ['grupo_desliga:grupo:2', 'alerta'],
    ]);
    expect(a[1]!.texto).toContain('não há destino em ao_esgotar');
    expect(a[1]!.campos).toEqual(['ao_esgotar']);
  });

  it('espera sem limite e plano B que não dispara', () => {
    expect(esperaSemLimite(idx).map((a) => a.chave)).toEqual(['espera_sem_limite:fila:10']);
    expect(planoBQueNaoDispara(idx).map((a) => a.chave)).toEqual(['plano_b_nao_dispara:fila:10']);
  });

  it('sem transbordo: cada fila alcançável, e os ramais alcançáveis num achado só; grupo fica com grupo_desliga', () => {
    const d = indexar(
      doc({
        entradas: [entrada('e', 'peca:m')],
        pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 })],
        saidas: [
          saida('m', '1', 'fila:1'),
          saida('m', '2', 'fila:2'),
          saida('m', '3', 'fila:3'),
          saida('m', '4', 'grupo:1'),
          saida('m', '5', 'grupo:2'),
          saida('m', '6', 'ramal:1'),
          saida('m', '7', 'ramal:2'),
          saida('m', '8', 'ramal:10'),
          saida('m', 'esgotou', 'ramal:3'),
        ],
        filas: [
          fila('1', { espera_maxima_s: 60 }),
          // Sem tempo máximo a espera nunca acaba: quem avisa é espera_sem_limite.
          fila('2'),
          fila('3', { espera_maxima_s: 60, ao_esgotar: 'fim:caixa_postal' }),
          fila('9', { espera_maxima_s: 60 }),
        ],
        grupos: [grupo('1'), grupo('2', { ao_esgotar: 'fim:desliga' }), grupo('9')],
        ramais: [ramal('3'), ramal('1'), ramal('2', { ao_nao_atender: 'fim:caixa_postal' }), ramal('10'), ramal('9')],
      }),
    );
    const achados = semTransbordo(d, alcancaveis(d));
    expect(achados.map((a) => a.chave)).toEqual(['sem_transbordo:ramais', 'sem_transbordo:fila:1']);
    expect(achados.map((a) => a.campos)).toEqual([['ao_nao_atender'], ['ao_esgotar']]);
    expect(achados[0]!.refs).toEqual(['ramal:1', 'ramal:10', 'ramal:3']);
    expect(achados[0]!.titulo).toBe('3 ramais desligam se ninguém atende');
    expect(achados[1]!.texto).toContain('60 s');
    expect(achados.every((a) => a.gravidade === 'observacao')).toBe(true);
    expect(GRAVIDADE.sem_transbordo).toBe('observacao');
  });

  it('sem transbordo com um ramal só: o mesmo achado, com o nome do ramal', () => {
    const d = indexar(doc({ entradas: [entrada('e', 'ramal:1')], ramais: [ramal('1', { nome: 'Recepção' })] }));
    const a = semTransbordo(d, alcancaveis(d));
    expect(a.map((x) => [x.chave, x.refs, x.titulo])).toEqual([['sem_transbordo:ramais', ['ramal:1'], 'ramal 1 (Recepção) desliga se ninguém atende']]);
  });
});
