import type { Canal, Evento, Motivo, Opcao, QuemDecide } from '@journey/nucleo';
import type { CanoMapa, Mapa, NoMapa } from '@/mapa/montar';

/** O que a tela anima, na ordem. Cada passo aponta pra nós e canos do mapa. */
export type Passo =
  | { tipo: 'chegar'; no: string; ref: string; t: number }
  | { tipo: 'correr'; cano: string; de: string; para: string; t: number }
  /** A água pula pra outro ponto do mapa: atalho, ou um ponto que este mapa mostra em outro lugar. */
  | { tipo: 'saltar'; de: string | null; para: string; t: number }
  /** O ponto não está neste mapa (ex.: um ramal direto visto do mapa das entradas). */
  | { tipo: 'fora_do_mapa'; ref: string; t: number }
  | { tipo: 'decidir'; no: string; ref: string; quem: QuemDecide; opcoes: Opcao[]; sugestao?: string; t: number }
  | { tipo: 'escolher'; no: string; opcao: string; cano?: string; t: number }
  | { tipo: 'trocar_canal'; no: string; de: Canal; para: Canal; t: number }
  | { tipo: 'ignorar'; no: string; resposta: string; motivo: string; t: number }
  | { tipo: 'terminar'; no: string | null; ref: string; motivo: Motivo; detalhe?: string; t: number };

/** O nó que mostra a referência quando a água chega sem cano: o ponto em si, nunca um atalho. */
function noDe(mapa: Mapa, ref: string): NoMapa | undefined {
  const ids = mapa.porRef.get(ref) ?? [];
  const nos = ids.map((id) => mapa.nos.find((n) => n.id === id)!);
  return nos.find((n) => n.tipo !== 'atalho');
}

/**
 * Converte os eventos do motor em passos sobre o mapa.
 * `atual` segue o nó onde a água está, pra escolher o cano certo quando a mesma referência aparece mais de uma vez.
 */
export function passosDe(mapa: Mapa, eventos: readonly Evento[]): Passo[] {
  const passos: Passo[] = [];
  const porId = new Map(mapa.nos.map((n) => [n.id, n]));
  let atual: string | null = null;

  const posicionar = (ref: string, t: number) => {
    const n = noDe(mapa, ref);
    if (!n) {
      passos.push({ tipo: 'fora_do_mapa', ref, t });
      atual = null;
      return;
    }
    if (atual !== n.id) passos.push({ tipo: 'saltar', de: atual, para: n.id, t });
    atual = n.id;
  };

  for (const e of eventos) {
    switch (e.tipo) {
      case 'chegou':
        if (atual === null || porId.get(atual)?.ref !== e.ref) posicionar(e.ref, e.t);
        if (atual !== null) passos.push({ tipo: 'chegar', no: atual, ref: e.ref, t: e.t });
        break;
      case 'correu': {
        const cano: CanoMapa | undefined =
          atual === null
            ? undefined
            : mapa.canos.find((c) => c.de === atual && (e.saida ? c.saidas.includes(e.saida) : c.opcoes.includes(e.opcao)) && c.para !== null);
        if (!cano) {
          posicionar(e.para, e.t);
          break;
        }
        passos.push({ tipo: 'correr', cano: cano.id, de: cano.de, para: cano.para!, t: e.t });
        const alvo: NoMapa = porId.get(cano.para!)!;
        atual = alvo.id;
        if (alvo.atalho) {
          passos.push({ tipo: 'saltar', de: alvo.id, para: alvo.atalho.alvo, t: e.t });
          atual = alvo.atalho.alvo;
        }
        break;
      }
      case 'decisao':
        if (atual !== null) passos.push({ tipo: 'decidir', no: atual, ref: e.ref, quem: e.quem, opcoes: e.opcoes, ...(e.sugestao && { sugestao: e.sugestao }), t: e.t });
        break;
      case 'escolheu': {
        if (atual === null) break;
        const de = atual;
        const cano: CanoMapa | undefined = mapa.canos.find((c) => c.de === de && (e.saida ? c.saidas.includes(e.saida) : c.opcoes.includes(e.opcao)));
        passos.push({ tipo: 'escolher', no: de, opcao: e.opcao, ...(cano && { cano: cano.id }), t: e.t });
        break;
      }
      case 'trocou_canal':
        if (atual !== null) passos.push({ tipo: 'trocar_canal', no: atual, de: e.de, para: e.para, t: e.t });
        break;
      case 'resposta_ignorada':
        if (atual !== null) passos.push({ tipo: 'ignorar', no: atual, resposta: e.resposta, motivo: e.motivo, t: e.t });
        break;
      case 'terminou':
        passos.push({ tipo: 'terminar', no: atual, ref: e.ref, motivo: e.motivo, ...(e.detalhe && { detalhe: e.detalhe }), t: e.t });
        break;
      case 'definiu':
        break;
    }
  }
  return passos;
}
