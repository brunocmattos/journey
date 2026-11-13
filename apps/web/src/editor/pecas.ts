import { NOMES_TIPOS, TIPOS_PECA, type Peca, type TipoPeca } from '@journey/fluxo';

const TAMANHOS: Record<TipoPeca, { w: number; h: number; dica: string }> = {
  inicio: { w: 190, h: 60, dica: 'Onde a jornada começa: um número, um contato, um formulário…' },
  mensagem: { w: 210, h: 62, dica: 'O que a pessoa recebe ou ouve' },
  etapa: { w: 210, h: 62, dica: 'Uma tarefa ou passo do processo' },
  decisao: { w: 140, h: 140, dica: 'Um ponto com mais de um caminho' },
  espera: { w: 200, h: 62, dica: 'Um tempo parado: SLA, fila, aguardando resposta' },
  atendimento: { w: 220, h: 62, dica: 'Uma pessoa, fila ou equipe atende' },
  sistema: { w: 210, h: 62, dica: 'Uma consulta ou integração com outro sistema' },
  fim: { w: 180, h: 56, dica: 'Onde a jornada termina' },
};

/** Tamanho, nome (o do pacote) e dica de cada tipo de peça no quadro. O documento não guarda tamanho: vem do tipo. */
export const FORMAS: Record<TipoPeca, { nome: string; w: number; h: number; dica: string }> = Object.fromEntries(
  TIPOS_PECA.map((t) => [t, { nome: NOMES_TIPOS[t], ...TAMANHOS[t] }]),
) as Record<TipoPeca, { nome: string; w: number; h: number; dica: string }>;

/** A ordem da barra de formas: a do pacote. */
export const ORDEM_FORMAS: readonly TipoPeca[] = TIPOS_PECA;

export const NOTA = { w: 190, h: 110 } as const;
export const GRUPO = { w: 400, h: 240, minW: 160, minH: 100 } as const;

/** O retângulo de uma peça no quadro. */
export interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const caixaDe = (p: Pick<Peca, 'tipo' | 'x' | 'y'>): Caixa => ({ x: p.x, y: p.y, w: FORMAS[p.tipo].w, h: FORMAS[p.tipo].h });

/** Tipos de peça que usam um responsável (um cadastro), com o rótulo do campo. */
export const ROTULO_RESPONSAVEL: Partial<Record<TipoPeca, string>> = {
  atendimento: 'Quem atende (pessoa, fila ou equipe)',
  sistema: 'Sistema',
  decisao: 'Regra usada (ex.: horário)',
  espera: 'Quem ou o que segura',
  etapa: 'Responsável',
};

/** Arredonda pra grade de 10 px do quadro (sem -0, que atrapalha comparar). */
export const naGrade = (v: number): number => Math.round(v / 10) * 10 || 0;
