import { describe, expect, it } from 'vitest';
import { NOMES_TIPOS, TIPOS_PECA } from '@journey/fluxo';
import { FORMAS, ORDEM_FORMAS, caixaDe, naGrade } from '@/editor/pecas';

describe('editor/pecas', () => {
  it('grade de 10 px, sem -0', () => {
    expect([naGrade(14), naGrade(15), naGrade(-0.1), naGrade(-16)]).toEqual([10, 20, 0, -20]);
    expect(Object.is(naGrade(-0.1), -0)).toBe(false);
  });

  it('a caixa vem do tipo; nomes e ordem são os do pacote', () => {
    expect(caixaDe({ tipo: 'decisao', x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: 140, h: 140 });
    expect(ORDEM_FORMAS).toEqual(TIPOS_PECA);
    for (const t of TIPOS_PECA) expect(FORMAS[t].nome).toBe(NOMES_TIPOS[t]);
  });
});
