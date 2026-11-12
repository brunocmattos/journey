import { describe, expect, it } from 'vitest';
import { ehEmbutida, lerRef, montarRef } from '../../src/formato/refs';

describe('refs', () => {
  it('lê tipo e id', () => {
    expect(lerRef('fila:90011')).toEqual({ tipo: 'fila', id: '90011' });
  });
  it('aceita ponto, hífen e sublinhado no id', () => {
    expect(lerRef('peca:fase-16_a.b')?.id).toBe('fase-16_a.b');
  });
  it('recusa tipo desconhecido, falta de dois-pontos e id com espaço', () => {
    expect(lerRef('telefone:123')).toBeNull();
    expect(lerRef('90011')).toBeNull();
    expect(lerRef('fila:900 11')).toBeNull();
  });
  it('monta a referência', () => {
    expect(montarRef('ramal', '9019')).toBe('ramal:9019');
  });
  it('conhece as referências embutidas', () => {
    expect(ehEmbutida('fim:desliga')).toBe(true);
    expect(ehEmbutida('externo:celular')).toBe(true);
    expect(ehEmbutida('fim:outro')).toBe(false);
  });
});
