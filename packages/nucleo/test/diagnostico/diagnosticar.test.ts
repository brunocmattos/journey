import { describe, expect, it } from 'vitest';
import { diagnosticar } from '../../src/diagnostico/diagnosticar';
import { doc, entrada, fila, grupo, peca, ramal, saida } from '../apoio';

describe('diagnosticar', () => {
  it('junta todas as regras, do mais grave pro mais leve', () => {
    const achados = diagnosticar(
      doc({
        entradas: [entrada('e', 'peca:menu')],
        pecas: [peca('menu', 'menu', { espera_s: 5, tentativas: 2 })],
        saidas: [saida('menu', '1', 'fila:1'), saida('menu', '2', 'fila:1'), saida('menu', 'esgotou', 'peca:apagada')],
        filas: [fila('1')],
        ramais: [ramal('7', { ao_nao_atender: 'ramal:8' }), ramal('8', { ao_nao_atender: 'ramal:7' })],
      }),
    );
    expect(achados.map((a) => a.tipo)).toEqual(['beco_sem_saida', 'ciclo_transbordo', 'redundancia', 'espera_sem_limite']);
    expect(achados.map((a) => a.gravidade)).toEqual(['grave', 'grave', 'alerta', 'observacao']);
  });

  it('avisa quando ninguém atende e não há transbordo', () => {
    const achados = diagnosticar(doc({ entradas: [entrada('e', 'grupo:1')], grupos: [grupo('1')] }));
    expect(achados.map((a) => a.chave)).toEqual(['sem_transbordo:grupo:1']);
  });
});
