import { describe, expect, it } from 'vitest';
import { documentoVazio } from '@journey/fluxo';
import { PASSOS, comecar, desfazer, refazer, registrar, substituir } from '@/editor/historico';

const d = (n: string) => ({ ...documentoVazio(), notas: [{ id: n, texto: n, x: 0, y: 0, w: 1, h: 1 }] });

describe('editor/historico', () => {
  it('desfaz e refaz; mudança nova perde o refazer', () => {
    const [a, b, c] = [d('a'), d('b'), d('c')];
    let h = registrar(registrar(comecar(a), b), c);
    h = desfazer(h);
    expect(h.atual).toBe(b);
    h = refazer(h);
    expect(h.atual).toBe(c);
    h = registrar(desfazer(h), d('x'));
    expect(h.depois).toEqual([]);
    expect(refazer(h)).toBe(h);
    expect(desfazer(desfazer(desfazer(h)))).toMatchObject({ atual: a });
  });

  it('arrasto: o primeiro quadro registra, os outros substituem', () => {
    const [a, b, c] = [d('a'), d('b'), d('c')];
    const h = substituir(registrar(comecar(a), b), c);
    expect(desfazer(h).atual).toBe(a);
  });

  it(`guarda no máximo ${PASSOS} passos e ignora a mesma versão`, () => {
    let h = comecar(d('0'));
    for (let i = 1; i <= PASSOS + 10; i++) h = registrar(h, d(String(i)));
    expect(h.antes).toHaveLength(PASSOS);
    expect(registrar(h, h.atual)).toBe(h);
  });
});
