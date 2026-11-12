import type { Canal, Motivo, Opcao, QuemDecide } from '@journey/nucleo';
import type { Passo } from './passos';

/** O que o mapa mostra depois dos primeiros k passos. */
export interface EstadoVisual {
  /** Canos com água (já percorridos). */
  molhados: Set<string>;
  /** O cano que está enchendo agora (o último passo foi correr por ele). */
  correndo: string | null;
  visitados: Set<string>;
  /** Onde a água está. */
  atual: string | null;
  /**
   * Decisão esperando resposta, quando o último passo mostrado é ela (ou uma resposta ignorada depois dela: o motor segue esperando).
   * `no: null`: a decisão é num ponto fora deste mapa (ver `fora`).
   */
  perguntando: { no: string | null; ref: string; quem: QuemDecide; opcoes: Opcao[]; sugestao?: string } | null;
  fim: { no: string | null; ref: string; motivo: Motivo; detalhe?: string } | null;
  /** Canos escolhidos em decisões, pra acender o chip. */
  escolhidos: Set<string>;
  canal: Canal;
  /** Ponto fora deste mapa onde a água está (ex.: ramal direto visto do mapa das entradas). */
  fora: string | null;
  /** Segundos de linha no último passo mostrado. */
  t: number;
}

export function estadoAte(passos: readonly Passo[], k: number): EstadoVisual {
  const e: EstadoVisual = {
    molhados: new Set(),
    correndo: null,
    visitados: new Set(),
    atual: null,
    perguntando: null,
    fim: null,
    escolhidos: new Set(),
    canal: 'telefonia',
    fora: null,
    t: 0,
  };
  const ate = Math.min(k, passos.length);
  for (let i = 0; i < ate; i++) {
    const p = passos[i]!;
    e.correndo = null;
    // Resposta ignorada não responde: a decisão continua pendente.
    if (p.tipo !== 'ignorar') e.perguntando = null;
    e.t = p.t;
    switch (p.tipo) {
      case 'chegar':
        e.atual = p.no;
        e.visitados.add(p.no);
        e.fora = null;
        break;
      case 'correr':
        e.molhados.add(p.cano);
        e.correndo = p.cano;
        e.atual = p.para;
        e.visitados.add(p.de);
        break;
      case 'saltar':
        e.atual = p.para;
        e.fora = null;
        break;
      case 'fora_do_mapa':
        e.atual = null;
        e.fora = p.ref;
        break;
      case 'decidir':
        e.perguntando = { no: p.no, ref: p.ref, quem: p.quem, opcoes: p.opcoes, ...(p.sugestao && { sugestao: p.sugestao }) };
        break;
      case 'escolher':
        if (p.cano) e.escolhidos.add(p.cano);
        break;
      case 'trocar_canal':
        e.canal = p.para;
        break;
      case 'terminar':
        e.fim = { no: p.no, ref: p.ref, motivo: p.motivo, ...(p.detalhe && { detalhe: p.detalhe }) };
        break;
      case 'ignorar':
        break;
    }
  }
  return e;
}

/** Quanto tempo (ms) a tela leva em cada passo, na velocidade 1×. */
const DURACAO: Record<Passo['tipo'], number> = {
  chegar: 350,
  correr: 750,
  saltar: 650,
  fora_do_mapa: 400,
  decidir: 0,
  escolher: 300,
  trocar_canal: 500,
  ignorar: 600,
  terminar: 0,
};

export function duracaoDoPasso(p: Passo, velocidade: number, semMovimento: boolean): number {
  return semMovimento ? 0 : DURACAO[p.tipo] / velocidade;
}
