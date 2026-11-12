import { lerRef, type Indice } from '@journey/nucleo/formato';

const REGRAS = new Set(['regra_horario', 'regra_feriado']);

/**
 * As regras de horário (ou feriado) que as entradas encontram primeiro: cada uma ganha uma agenda.
 * Segue a ligação por peças de saída única que não decidem nada (um áudio de boas-vindas, por exemplo)
 * até a primeira regra; menu, peça com várias saídas ou destino que não é peça param a busca.
 */
export function pontosComAgenda(idx: Indice): string[] {
  const vistos = new Set<string>();
  for (const e of idx.doc.entradas) {
    let atual = e.destino;
    for (let i = 0; i < 30; i++) {
      const r = lerRef(atual);
      const p = r?.tipo === 'peca' ? idx.pecas.get(r.id) : undefined;
      if (!p) break;
      if (REGRAS.has(p.tipo)) {
        vistos.add(atual);
        break;
      }
      const saidas = idx.saidasDe.get(p.id) ?? [];
      if (p.tipo === 'menu' || saidas.length !== 1) break;
      atual = saidas[0]!.para;
    }
  }
  return [...vistos];
}
