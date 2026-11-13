import type { Caixa } from './pecas';

export type Curva = 'suave' | 'cotovelo' | 'reta';
type Lado = 'd' | 'e' | 'b' | 'c';

/** Um ponto na borda de uma peça, com a direção em que o cano sai ou entra. */
export interface Ancora {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

export const centro = (c: Caixa) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });

/**
 * De que lado sai e por qual entra: pelo vão maior entre as bordas (no empate, pelos lados). Olhar só os centros
 * faria peças em escada (uma abaixo e um pouco à direita) ligarem pelos lados, com o cano voltando por dentro delas.
 */
export function lados(a: Caixa, b: Caixa): [Lado, Lado] {
  const dx = centro(b).x - centro(a).x;
  const dy = centro(b).y - centro(a).y;
  const vaoX = dx >= 0 ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
  const vaoY = dy >= 0 ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
  if (vaoX >= vaoY) return dx >= 0 ? ['d', 'e'] : ['e', 'd'];
  return dy >= 0 ? ['b', 'c'] : ['c', 'b'];
}

export function ancora(c: Caixa, l: Lado): Ancora {
  if (l === 'd') return { x: c.x + c.w, y: c.y + c.h / 2, nx: 1, ny: 0 };
  if (l === 'e') return { x: c.x, y: c.y + c.h / 2, nx: -1, ny: 0 };
  if (l === 'b') return { x: c.x + c.w / 2, y: c.y + c.h, nx: 0, ny: 1 };
  return { x: c.x + c.w / 2, y: c.y, nx: 0, ny: -1 };
}

/** O desenho do cano entre duas âncoras: curva suave, cotovelo (com cantos arredondados) ou reta. */
export function caminho(p1: Ancora, p2: Ancora, curva: Curva): string {
  if (curva === 'reta') return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
  if (curva === 'cotovelo') {
    const r = 14;
    if (p1.nx !== 0) {
      const mx = (p1.x + p2.x) / 2;
      const s = Math.sign(p2.y - p1.y) || 1;
      const sx1 = Math.sign(mx - p1.x) || 1;
      const sx2 = Math.sign(p2.x - mx) || 1;
      const rr = Math.min(r, Math.abs(p2.y - p1.y) / 2, Math.abs(mx - p1.x), Math.abs(p2.x - mx));
      if (rr < 1) return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
      return `M${p1.x},${p1.y} L${mx - sx1 * rr},${p1.y} Q${mx},${p1.y} ${mx},${p1.y + s * rr} L${mx},${p2.y - s * rr} Q${mx},${p2.y} ${mx + sx2 * rr},${p2.y} L${p2.x},${p2.y}`;
    }
    const my = (p1.y + p2.y) / 2;
    const s = Math.sign(p2.x - p1.x) || 1;
    const sy1 = Math.sign(my - p1.y) || 1;
    const sy2 = Math.sign(p2.y - my) || 1;
    const rr = Math.min(r, Math.abs(p2.x - p1.x) / 2, Math.abs(my - p1.y), Math.abs(p2.y - my));
    if (rr < 1) return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
    return `M${p1.x},${p1.y} L${p1.x},${my - sy1 * rr} Q${p1.x},${my} ${p1.x + s * rr},${my} L${p2.x - s * rr},${my} Q${p2.x},${my} ${p2.x},${my + sy2 * rr} L${p2.x},${p2.y}`;
  }
  const d = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2.2);
  return `M${p1.x},${p1.y} C${p1.x + p1.nx * d},${p1.y + p1.ny * d} ${p2.x + p2.nx * d},${p2.y + p2.ny * d} ${p2.x},${p2.y}`;
}

/** A seta encosta na peça: o fim do cano recua um pouco pra fora da borda. */
const RECUO = 7;

/** Ponto da curva suave em t = 0,5 (a de Bézier que `caminho` desenha). */
function meioSuave(p1: Ancora, p2: Ancora): { x: number; y: number } {
  const d = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2.2);
  const c1 = { x: p1.x + p1.nx * d, y: p1.y + p1.ny * d };
  const c2 = { x: p2.x + p2.nx * d, y: p2.y + p2.ny * d };
  return { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
}

export interface GeometriaCano {
  d: string;
  p1: Ancora;
  p2: Ancora;
  /** Onde fica o rótulo da regra: o meio do desenho. */
  meio: { x: number; y: number };
}

/** Afasta uma âncora pro lado (perpendicular à saída): é o que separa um cano do de volta. */
const desviar = (p: Ancora, d: number): Ancora => (p.nx !== 0 ? { ...p, y: p.y + d } : { ...p, x: p.x + d });

/**
 * O cano entre duas peças. Laço na própria peça sai pela direita e volta por cima. `desvio` afasta as duas pontas
 * pro lado (em px): quem desenha usa quando há o cano de volta (a→b e b→a), pra os dois não ficarem um em cima do outro.
 */
export function geometriaCano(a: Caixa, b: Caixa, curva: Curva, mesmaPeca = false, desvio = 0): GeometriaCano {
  if (mesmaPeca) {
    const p1 = ancora(a, 'd');
    const p2 = { ...ancora(a, 'c'), y: a.y - RECUO };
    const c1 = { x: p1.x + 70, y: p1.y };
    const c2 = { x: p2.x + 40, y: p2.y - 70 };
    const meio = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
    return { d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`, p1, p2, meio };
  }
  const [la, lb] = lados(a, b);
  const p1 = desviar(ancora(a, la), desvio);
  const p2 = desviar(ancora(b, lb), desvio);
  const p2r = { ...p2, x: p2.x + p2.nx * RECUO, y: p2.y + p2.ny * RECUO };
  const meio = curva === 'suave' ? meioSuave(p1, p2r) : { x: (p1.x + p2r.x) / 2, y: (p1.y + p2r.y) / 2 };
  return { d: caminho(p1, p2r, curva), p1, p2: p2r, meio };
}

/** Uma caixa está dentro da outra pelo centro (é o que decide o que um grupo leva junto). */
export function dentro(c: Caixa, g: Caixa): boolean {
  const m = centro(c);
  return m.x > g.x && m.x < g.x + g.w && m.y > g.y && m.y < g.y + g.h;
}

/** A caixa que cobre todas: pra "ver tudo". Null quando não há nada. */
export function envolvente(caixas: readonly Caixa[]): Caixa | null {
  if (!caixas.length) return null;
  const x1 = Math.min(...caixas.map((c) => c.x));
  const y1 = Math.min(...caixas.map((c) => c.y));
  const x2 = Math.max(...caixas.map((c) => c.x + c.w));
  const y2 = Math.max(...caixas.map((c) => c.y + c.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
