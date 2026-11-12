import { describe, expect, it } from 'vitest';
import { doc, entrada, fila, peca, ramal, saida } from '@journey/nucleo/teste';
import { montarMapa } from '@/mapa/montar';
import { passosDe } from '@/simulacao/passos';
import { escolher, rodar, type Sessao } from '@/simulacao/sessao';

const d = doc({
  entradas: [entrada('e', 'peca:m'), entrada('d', 'ramal:r')],
  pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 2 })],
  saidas: [saida('m', '1', 'fila:f'), saida('m', '2', 'fila:f'), saida('m', 'esgotou', 'fim:desliga')],
  filas: [fila('f', { espera_maxima_s: 30, ao_esgotar: 'peca:m' })],
  ramais: [ramal('r')],
});
const mapa = montarMapa(d);
const s0: Sessao = { entrada: 'entrada:e', inicio: '2026-11-24T10:00', modo: 'cenario', escolhas: [] };

describe('passosDe', () => {
  it('começa no nó da entrada, corre pelo cano e para na decisão', () => {
    const p = passosDe(mapa, rodar(d, s0).eventos);
    expect(p.map((x) => x.tipo)).toEqual(['saltar', 'chegar', 'correr', 'chegar', 'decidir']);
    expect(p[2]).toMatchObject({ tipo: 'correr', de: 'entrada:e', para: 'peca:m' });
  });

  it('a tecla escolhe o cano que junta as opções', () => {
    const s1 = escolher(s0, rodar(d, s0).pendente!.opcoes[1]!);
    const p = passosDe(mapa, rodar(d, s1).eventos);
    expect(p.find((x) => x.tipo === 'escolher')).toMatchObject({ opcao: '2', cano: 'peca:m>m-1' });
    expect(p.filter((x) => x.tipo === 'correr').at(-1)).toMatchObject({ para: 'fila:f' });
  });

  it('pelo atalho, a água salta pro ponto original', () => {
    const s1 = escolher(s0, rodar(d, s0).pendente!.opcoes[0]!);
    const naoAtende = rodar(d, s1).pendente!.opcoes.find((o) => o.opcao === 'nao_atende')!;
    const p = passosDe(mapa, rodar(d, escolher(s1, naoAtende)).eventos);
    const i = p.findIndex((x) => x.tipo === 'saltar' && x.para === 'peca:m' && x.de !== null);
    expect(i).toBeGreaterThan(0);
    expect(p[i - 1]).toMatchObject({ tipo: 'correr', de: 'fila:f' });
    expect(p.at(-1)).toMatchObject({ tipo: 'decidir', no: 'peca:m' });
  });

  it('ponto que o mapa não mostra vira fora_do_mapa', () => {
    const p = passosDe(mapa, rodar(d, { ...s0, entrada: 'entrada:d' }).eventos);
    expect(p.some((x) => x.tipo === 'fora_do_mapa' && x.ref === 'ramal:r')).toBe(true);
  });

  it('no mapa do ramal, ninguém atende segue até desligar', () => {
    const m = montarMapa(d, { raizes: ['ramal:r'] });
    const p = passosDe(m, rodar(d, { ...s0, entrada: 'ramal:r', modo: 'ninguem_atende' }).eventos);
    expect(p.at(-1)).toMatchObject({ tipo: 'terminar', motivo: 'fim', no: 'fim:desliga' });
  });
});
