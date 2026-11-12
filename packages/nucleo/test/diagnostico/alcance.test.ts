import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { alcancaveis, destinoFinal, vizinhos } from '../../src/diagnostico/alcance';
import { doc, entrada, fila, grupo, peca, ramal, saida } from '../apoio';

describe('alcance', () => {
  const idx = indexar(
    doc({
      entradas: [entrada('e', 'peca:a')],
      pecas: [peca('a', 'audio'), peca('m', 'menu'), peca('solta', 'audio')],
      saidas: [saida('a', 'sempre', 'peca:m'), saida('m', '1', 'ramal:1'), saida('m', '2', 'fila:9')],
      ramais: [ramal('1', { ao_nao_atender: 'grupo:5', ao_ocupado: 'fim:desliga' })],
      filas: [fila('9', { ao_esgotar: 'fila:10', pesquisa_ao_desligar: 'peca:nps' })],
      grupos: [grupo('5', { ao_esgotar: 'fim:caixa_postal' })],
    }),
  );

  it('vizinhos de cada tipo', () => {
    expect(vizinhos(idx, 'entrada:e')).toEqual(['peca:a']);
    expect(vizinhos(idx, 'peca:m')).toEqual(['ramal:1', 'fila:9']);
    expect(vizinhos(idx, 'ramal:1')).toEqual(['grupo:5', 'fim:desliga']);
    expect(vizinhos(idx, 'fila:9')).toEqual(['fila:10', 'peca:nps']);
    expect(vizinhos(idx, 'grupo:5')).toEqual(['fim:caixa_postal']);
  });

  it('alcançáveis a partir das entradas', () => {
    const alc = alcancaveis(idx);
    expect(alc.has('grupo:5')).toBe(true);
    expect(alc.has('peca:solta')).toBe(false);
  });

  it('destino final atravessa peças de saída única e para no menu', () => {
    expect(destinoFinal(idx, 'peca:a')).toBe('peca:m');
    expect(destinoFinal(idx, 'fila:9')).toBe('fila:9');
  });
});
