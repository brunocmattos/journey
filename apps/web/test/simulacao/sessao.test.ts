import { describe, expect, it } from 'vitest';
import { doc, entrada, fila, peca, ramal, saida } from '@journey/nucleo/teste';
import { escolher, inicioDe, rodar, voltar, type Sessao } from '@/simulacao/sessao';

const d = doc({
  entradas: [entrada('e', 'peca:m')],
  pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 2 })],
  saidas: [saida('m', '1', 'fila:f'), saida('m', '2', 'ramal:r')],
  filas: [fila('f', { espera_maxima_s: 30, ao_esgotar: 'ramal:r' })],
  ramais: [ramal('r')],
});
const s0: Sessao = { entrada: 'entrada:e', inicio: '2026-11-24T10:00', modo: 'cenario', escolhas: [] };

describe('sessão', () => {
  it('para na primeira decisão sem resposta', () => {
    const e = rodar(d, s0);
    expect(e.pendente?.ref).toBe('peca:m');
  });

  it('escolher grava a saída e refazer dá os mesmos eventos', () => {
    const s1 = escolher(s0, rodar(d, s0).pendente!.opcoes[0]!);
    expect(s1.escolhas).toEqual(['saida:m-1']);
    expect(rodar(d, s1).eventos).toEqual(rodar(d, s1).eventos);
    expect(rodar(d, s1).pendente?.ref).toBe('fila:f');
  });

  it('opção sem saída (fila, ramal) é gravada pela opção', () => {
    const s1 = escolher(s0, rodar(d, s0).pendente!.opcoes[0]!);
    const naoAtende = rodar(d, s1).pendente!.opcoes.find((o) => o.opcao === 'nao_atende')!;
    expect(escolher(s1, naoAtende).escolhas).toEqual(['saida:m-1', 'nao_atende']);
  });

  it('voltar tira a última escolha e a execução volta pra aquela decisão', () => {
    const s1 = escolher(s0, rodar(d, s0).pendente!.opcoes[0]!);
    expect(rodar(d, voltar(s1)).eventos).toEqual(rodar(d, s0).eventos);
  });

  it('inicioDe usa a hora local', () => {
    expect(inicioDe(new Date(2026, 10, 24, 16, 57))).toBe('2026-11-24T16:57');
  });
});
