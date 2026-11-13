import { describe, expect, it } from 'vitest';
import { caminho, dentro, envolvente, geometriaCano, lados } from '@/editor/geometria';

const A = { x: 0, y: 0, w: 100, h: 60 };

describe('editor/geometria', () => {
  it('sai pelo lado mais direto (prefere os lados)', () => {
    expect(lados(A, { x: 300, y: 50, w: 100, h: 60 })).toEqual(['d', 'e']);
    expect(lados(A, { x: -300, y: 0, w: 100, h: 60 })).toEqual(['e', 'd']);
    expect(lados(A, { x: 0, y: 300, w: 100, h: 60 })).toEqual(['b', 'c']);
    expect(lados(A, { x: 0, y: -300, w: 100, h: 60 })).toEqual(['c', 'b']);
  });

  it('cano: sai da borda, chega recuado 7 px pra seta encostar, rótulo no meio', () => {
    const g = geometriaCano(A, { x: 300, y: 0, w: 100, h: 60 }, 'reta');
    expect(g.d).toBe('M100,30 L293,30');
    expect(g.meio).toEqual({ x: 196.5, y: 30 });
    expect(geometriaCano(A, { x: 300, y: 0, w: 100, h: 60 }, 'suave').d).toMatch(/^M100,30 C/);
  });

  it('cotovelo arredondado; sem altura pra curva, vira reta', () => {
    const p1 = { x: 0, y: 0, nx: 1, ny: 0 };
    expect(caminho(p1, { x: 200, y: 100, nx: -1, ny: 0 }, 'cotovelo')).toBe('M0,0 L86,0 Q100,0 100,14 L100,86 Q100,100 114,100 L200,100');
    expect(caminho(p1, { x: 200, y: 0, nx: -1, ny: 0 }, 'cotovelo')).toBe('M0,0 L200,0');
  });

  it('dentro pelo centro, e a caixa que cobre tudo', () => {
    expect(dentro({ x: 10, y: 10, w: 20, h: 20 }, A)).toBe(true);
    expect(dentro({ x: 90, y: 10, w: 40, h: 20 }, A)).toBe(false);
    expect(envolvente([A, { x: 200, y: -50, w: 10, h: 10 }])).toEqual({ x: 0, y: -50, w: 210, h: 110 });
    expect(envolvente([])).toBeNull();
  });
});
