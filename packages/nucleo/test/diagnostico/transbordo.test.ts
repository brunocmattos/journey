import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { ciclosDeTransbordo, destinosInexistentes, esperaSemLimite, gruposQueDesligam, planoBQueNaoDispara, voltaPropriaFila } from '../../src/diagnostico/transbordo';
import { doc, fila, grupo, ramal } from '../apoio';

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
      ['destino_inexistente:ramal:4>ramal:98', ['siga_me_lista']],
    ]);
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

  it('espera sem limite e plano B que não dispara', () => {
    expect(esperaSemLimite(idx).map((a) => a.chave)).toEqual(['espera_sem_limite:fila:10']);
    expect(planoBQueNaoDispara(idx).map((a) => a.chave)).toEqual(['plano_b_nao_dispara:fila:10']);
  });
});
