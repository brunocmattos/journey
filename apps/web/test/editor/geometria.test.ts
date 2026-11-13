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

  it('peças em escada ligam por cima e por baixo, não pelos lados (o cano voltaria por dentro delas)', () => {
    const a = { x: 0, y: 0, w: 210, h: 62 };
    const b = { x: 150, y: 100, w: 210, h: 62 };
    expect(lados(a, b)).toEqual(['b', 'c']);
    expect(geometriaCano(a, b, 'reta').d).toBe('M105,62 L255,93');
  });

  it('cotovelo vertical também é arredondado', () => {
    expect(caminho({ x: 0, y: 0, nx: 0, ny: 1 }, { x: 100, y: 200, nx: 0, ny: -1 }, 'cotovelo')).toBe('M0,0 L0,86 Q0,100 14,100 L86,100 Q100,100 100,114 L100,200');
  });

  it('ida e volta entre as mesmas peças: o desvio afasta os dois canos', () => {
    const B = { x: 400, y: 0, w: 100, h: 60 };
    const ida = geometriaCano(A, B, 'reta', false, -9);
    const volta = geometriaCano(B, A, 'reta', false, 9);
    expect(ida.d).toBe('M100,21 L393,21');
    expect(volta.d).toBe('M400,39 L107,39');
  });

  it('laço na própria peça: o rótulo fica em cima da curva', () => {
    const g = geometriaCano(A, A, 'suave', true);
    expect(g.d).toBe('M100,30 C170,30 90,-77 50,-7');
    expect(g.meio).toEqual({ x: 116.25, y: -14.75 }); // a curva em t = 0,5
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
