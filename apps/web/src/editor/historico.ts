import type { Documento } from '@journey/fluxo';

/** O documento atual com o que dá pra desfazer e refazer. As versões são guardadas por referência. */
export interface Historico {
  atual: Documento;
  antes: readonly Documento[];
  depois: readonly Documento[];
}

/** Quantos passos dá pra desfazer. */
export const PASSOS = 120;

export const comecar = (doc: Documento): Historico => ({ atual: doc, antes: [], depois: [] });

/** Uma mudança que entra no histórico (o que estava vira um passo pra desfazer; o refazer se perde). */
export function registrar(h: Historico, doc: Documento): Historico {
  if (doc === h.atual) return h;
  return { atual: doc, antes: [...h.antes, h.atual].slice(-PASSOS), depois: [] };
}

/** Uma mudança sem passo novo: os quadros seguintes de um arrasto, depois do primeiro. */
export const substituir = (h: Historico, doc: Documento): Historico => ({ ...h, atual: doc });

export function desfazer(h: Historico): Historico {
  const anterior = h.antes[h.antes.length - 1];
  if (!anterior) return h;
  return { atual: anterior, antes: h.antes.slice(0, -1), depois: [...h.depois, h.atual] };
}

export function refazer(h: Historico): Historico {
  const proximo = h.depois[h.depois.length - 1];
  if (!proximo) return h;
  return { atual: proximo, antes: [...h.antes, h.atual], depois: h.depois.slice(0, -1) };
}
