import { simular, type Cadastro, type Documento, type Evento, type Execucao, type Modo, type MotivoFim, type Opcao } from '@journey/fluxo';
import { FUSO } from '@/lib/fuso';

/**
 * O play do editor em cima do motor: a simulação é refeita das escolhas (o motor é previsível) e a tela mostra os
 * eventos um a um, com a água correndo. `mostrados` diz quantos eventos já apareceram.
 */
export interface Play {
  inicio: string;
  /** AAAA-MM-DDTHH:MM, hora de parede de quem simula. */
  quando: string;
  modo: Modo;
  escolhas: readonly string[];
}

export interface Contexto {
  cadastros: readonly Cadastro[];
  canal: string | null;
}

export function rodar(doc: Documento, ctx: Contexto, p: Play): Execucao {
  return simular(doc, { cadastros: ctx.cadastros, ...(ctx.canal && { canal: ctx.canal }) }, { inicio: p.inicio, quando: p.quando, modo: p.modo, escolhas: p.escolhas });
}

/** A hora de agora em São Paulo, no formato do motor. */
export function agora(d = new Date()): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

/** O que a tela desenha depois de mostrar os `n` primeiros eventos. */
export interface Visual {
  /** Peças por onde a água passou, com o canal em que chegou (a cor). */
  molhadas: Map<string, string | null>;
  /** Conexões já cheias, com o canal da água que passou. */
  cheias: Map<string, string | null>;
  /** A conexão onde a água está correndo agora (o último evento mostrado é `correu`). */
  correndo: { conexao: string; canal: string | null } | null;
  atual: string | null;
  pergunta: { peca: string; opcoes: Opcao[] } | null;
  fim: { motivo: MotivoFim; peca: string | null } | null;
  relogio_s: number;
  canal: string | null;
  /** Cada chegada, com o tempo do cliente naquele momento. */
  linha: { peca: string; relogio_s: number }[];
}

export function visual(eventos: readonly Evento[], n: number): Visual {
  const v: Visual = { molhadas: new Map(), cheias: new Map(), correndo: null, atual: null, pergunta: null, fim: null, relogio_s: 0, canal: null, linha: [] };
  for (const e of eventos.slice(0, n)) {
    if (v.correndo) {
      v.cheias.set(v.correndo.conexao, v.correndo.canal);
      v.correndo = null;
    }
    v.pergunta = null;
    if (e.tipo === 'chegou') {
      v.canal = e.canal;
      v.atual = e.peca;
      v.relogio_s = e.relogio_s;
      v.molhadas.set(e.peca, e.canal);
      v.linha.push({ peca: e.peca, relogio_s: e.relogio_s });
    } else if (e.tipo === 'correu') {
      v.correndo = { conexao: e.conexao, canal: v.canal };
      v.relogio_s = e.relogio_s;
    } else if (e.tipo === 'pede_escolha') {
      v.pergunta = { peca: e.peca, opcoes: e.opcoes };
    } else if (e.tipo === 'terminou') {
      v.fim = { motivo: e.motivo, peca: e.peca };
      v.relogio_s = e.relogio_s;
    }
  }
  return v;
}

/**
 * Quanto a tela espera depois de mostrar um evento, antes do próximo (em ms, na velocidade 1). `correu` espera a
 * água chegar ao fim do cano. Quando não há próximo (pergunta ou fim), a tela simplesmente para.
 */
export function espera(e: Evento): number | 'cano' {
  if (e.tipo === 'chegou') return 520;
  if (e.tipo === 'correu') return 'cano';
  return 0;
}

/** Duração da água num cano de comprimento `L` (px), na velocidade dada. */
export const duracaoCano = (L: number, velocidade: number): number => Math.max(380, L * 2.4) / velocidade;

/** Voltar uma decisão: tira a última escolha. Sem escolha, recomeça. */
export const voltar = (p: Play): Play => ({ ...p, escolhas: p.escolhas.slice(0, -1) });

/** A opção que uma tecla escolhe: o número da posição (1 a 9) ou o código de uma letra/dígito da opção. */
export function opcaoDaTecla(opcoes: readonly Opcao[], tecla: string, valores: ReadonlyMap<string, string | undefined>): Opcao | null {
  const k = tecla.toLowerCase();
  const porValor = opcoes.find((o) => {
    const v = valores.get(o.conexao);
    return v !== undefined && v.length === 1 && v.toLowerCase() === k;
  });
  if (porValor) return porValor;
  if (/^[1-9]$/.test(tecla)) return opcoes[Number(tecla) - 1] ?? null;
  return null;
}

const NOMES_FIM: Record<MotivoFim, string> = {
  fim: 'Chegou em',
  beco: 'Parou em (sem saída)',
  ciclo: 'Ficou rodando em',
  limite: 'Andou demais sozinho até',
  inexistente: 'Não achou o começo',
};
export const tituloDoFim = (m: MotivoFim): string => NOMES_FIM[m];
