import type { Evento } from '@journey/nucleo/motor';

export interface Divergencia {
  /** Posição do primeiro evento diferente. */
  indice: number;
  esperado?: Evento;
  atual?: Evento;
}

/** Texto do valor com as chaves em ordem: o jsonb do Postgres devolve os objetos com as chaves reordenadas. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** O primeiro ponto em que a execução de hoje se afasta da aprovada; null quando são iguais. */
export function comparar(esperado: readonly Evento[], atual: readonly Evento[]): Divergencia | null {
  const n = Math.max(esperado.length, atual.length);
  for (let i = 0; i < n; i++) {
    if (canonico(esperado[i]) !== canonico(atual[i])) {
      const d: Divergencia = { indice: i };
      if (esperado[i]) d.esperado = esperado[i];
      if (atual[i]) d.atual = atual[i];
      return d;
    }
  }
  return null;
}
