import type { Canal } from '@journey/nucleo/formato';
import type { Evento, Motivo, Opcao, QuemDecide } from '@journey/nucleo/motor';
import type { CanoMapa, Mapa, NoMapa } from '@/mapa/montar';

/**
 * O que a tela anima, na ordem. Cada passo aponta pra nós e canos do mapa.
 * `no: null`: a água está num ponto que este mapa não mostra (depois de um `fora_do_mapa`); o passo existe mesmo assim,
 * pra decisão pendente nunca ficar invisível.
 */
export type Passo =
  | { tipo: 'chegar'; no: string; ref: string; t: number }
  | { tipo: 'correr'; cano: string; de: string; para: string; t: number }
  /** A água pula pra outro ponto do mapa: atalho, ou um ponto que este mapa mostra em outro lugar. */
  | { tipo: 'saltar'; de: string | null; para: string; t: number }
  /** O ponto não está neste mapa (ex.: um ramal direto visto do mapa das entradas). */
  | { tipo: 'fora_do_mapa'; ref: string; t: number }
  | { tipo: 'decidir'; no: string | null; ref: string; quem: QuemDecide; opcoes: Opcao[]; sugestao?: string; t: number }
  | { tipo: 'escolher'; no: string | null; opcao: string; cano?: string; t: number }
  | { tipo: 'trocar_canal'; no: string | null; de: Canal; para: Canal; t: number }
  | { tipo: 'ignorar'; no: string | null; resposta: string; motivo: string; t: number }
  | { tipo: 'terminar'; no: string | null; ref: string; motivo: Motivo; detalhe?: string; t: number };

/**
 * Converte os eventos do motor em passos sobre o mapa.
 * `atual` segue o nó onde a água está, pra escolher o cano certo quando a mesma referência aparece mais de uma vez.
 * `canalInicial` é o canal da entrada (ver `canalInicial` em sessao.ts): o motor o assume calado na entrada,
 * então, quando não é telefonia, a troca vira um passo logo depois da chegada na entrada.
 * Só se corre por cano simulável: o que o motor nunca usa (ex.: "nunca: sem espera máxima") não acende.
 */
export function passosDe(mapa: Mapa, eventos: readonly Evento[], canalInicial: Canal = 'telefonia'): Passo[] {
  return passosComOrigem(mapa, eventos, canalInicial).passos;
}

/**
 * Os passos e, pra cada um, a posição do evento que o gerou (`evento[j]` é o índice em `eventos` do passo j).
 * A linha do tempo usa isso pra mostrar só os eventos que a animação já mostrou.
 */
export function passosComOrigem(mapa: Mapa, eventos: readonly Evento[], canalInicial: Canal = 'telefonia'): { passos: Passo[]; evento: number[] } {
  const passos: Passo[] = [];
  const evento: number[] = [];
  const porId = new Map(mapa.nos.map((n) => [n.id, n]));
  let atual: string | null = null;
  /** Ponto fora do mapa onde a água está (pra não repetir o fora_do_mapa na chegada). */
  let fora: string | null = null;
  let canalPosto = canalInicial === 'telefonia';

  /** O nó que mostra a referência quando a água chega sem cano: o ponto em si, nunca um atalho. */
  const noDe = (ref: string): NoMapa | undefined =>
    (mapa.porRef.get(ref) ?? []).map((id) => porId.get(id)!).find((n) => n.tipo !== 'atalho');

  const posicionar = (ref: string, t: number) => {
    const n = noDe(ref);
    if (!n) {
      if (atual !== null || fora !== ref) passos.push({ tipo: 'fora_do_mapa', ref, t });
      atual = null;
      fora = ref;
      return;
    }
    if (atual !== n.id) passos.push({ tipo: 'saltar', de: atual, para: n.id, t });
    atual = n.id;
    fora = null;
  };

  const canoPor = (e: { opcao: string; saida?: string }, de: string, comDestino: boolean): CanoMapa | undefined =>
    mapa.canos.find(
      (c) => c.de === de && c.simulavel && (!comDestino || c.para !== null) && (e.saida ? c.saidas.includes(e.saida) : c.opcoes.includes(e.opcao)),
    );

  for (const [i, e] of eventos.entries()) {
    switch (e.tipo) {
      case 'chegou':
        if (atual === null || porId.get(atual)?.ref !== e.ref) posicionar(e.ref, e.t);
        if (atual !== null) passos.push({ tipo: 'chegar', no: atual, ref: e.ref, t: e.t });
        if (!canalPosto) {
          passos.push({ tipo: 'trocar_canal', no: atual, de: 'telefonia', para: canalInicial, t: e.t });
          canalPosto = true;
        }
        break;
      case 'correu': {
        const cano = atual === null ? undefined : canoPor(e, atual, true);
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
        passos.push({ tipo: 'decidir', no: atual, ref: e.ref, quem: e.quem, opcoes: e.opcoes, ...(e.sugestao && { sugestao: e.sugestao }), t: e.t });
        break;
      case 'escolheu': {
        const cano = atual === null ? undefined : canoPor(e, atual, false);
        passos.push({ tipo: 'escolher', no: atual, opcao: e.opcao, ...(cano && { cano: cano.id }), t: e.t });
        break;
      }
      case 'trocou_canal':
        passos.push({ tipo: 'trocar_canal', no: atual, de: e.de, para: e.para, t: e.t });
        break;
      case 'resposta_ignorada':
        passos.push({ tipo: 'ignorar', no: atual, resposta: e.resposta, motivo: e.motivo, t: e.t });
        break;
      case 'terminou':
        passos.push({ tipo: 'terminar', no: atual, ref: e.ref, motivo: e.motivo, ...(e.detalhe && { detalhe: e.detalhe }), t: e.t });
        break;
      case 'definiu':
        break;
    }
    while (evento.length < passos.length) evento.push(i);
  }
  return { passos, evento };
}
