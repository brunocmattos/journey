import { executar, indexar, lerRef, type Canal, type Documento, type Execucao, type Indice, type Opcao } from '@journey/nucleo';

export type Modo = 'cenario' | 'livre' | 'ninguem_atende';

/**
 * Uma simulação é a entrada, a hora, o modo e as escolhas de quem simula, em ordem.
 * O motor é previsível: refazer as escolhas dá os mesmos eventos. Voltar é tirar a última e refazer.
 */
export interface Sessao {
  entrada: string;
  /** AAAA-MM-DDTHH:MM. */
  inicio: string;
  modo: Modo;
  escolhas: readonly string[];
}

export function rodar(fonte: Documento | Indice, s: Sessao): Execucao {
  const e = executar(fonte, { entrada: s.entrada, inicio: s.inicio, modo: s.modo });
  for (const c of s.escolhas) e.avancar(c);
  return e;
}

/**
 * O canal em que a jornada começa: o da entrada. O motor o assume calado ao passar pela entrada (só a troca feita
 * por uma peça vira evento), então quem desenha ou resume precisa dele (`passosDe`, `resumir`).
 * Começando por outro ponto (ramal:…, peca:…) ou por entrada que não existe, é telefonia, como no motor.
 */
export function canalInicial(fonte: Documento | Indice, entrada: string): Canal {
  const r = lerRef(entrada);
  if (r?.tipo !== 'entrada') return 'telefonia';
  const idx = 'formato' in fonte ? indexar(fonte) : fonte;
  return idx.entradas.get(r.id)?.canal ?? 'telefonia';
}

/** A resposta que repete exatamente esta opção: `saida:<id>` quando vem de uma peça. */
export const respostaDe = (o: Opcao): string => (o.saida ? `saida:${o.saida}` : o.opcao);

export const escolher = (s: Sessao, o: Opcao): Sessao => ({ ...s, escolhas: [...s.escolhas, respostaDe(o)] });

export const voltar = (s: Sessao): Sessao => ({ ...s, escolhas: s.escolhas.slice(0, -1) });

/** "2026-11-24T16:57" a partir de uma data local do navegador. */
export function inicioDe(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
