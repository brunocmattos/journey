import type { Documento, Execucao, Modo, MotivoFim } from '@journey/fluxo';
import { rodar, type Contexto, type Play } from './play';

/**
 * Cenário: um caminho salvo do play (de onde começa, a hora, o modo e as escolhas) com o resultado aprovado.
 * Abrir o cenário refaz o caminho com o documento de agora; se o resultado mudou, a tela avisa e oferece aprovar o novo.
 */

/** O resultado de um play: as peças por onde a água passou (em ordem, com repetição), como terminou e o tempo do cliente. */
export interface Resultado {
  caminho: string[];
  /** null: o play ainda pergunta (a escolha guardada não serve mais). */
  fim: { motivo: MotivoFim; peca: string | null } | null;
  tempo_s: number;
}

/** O resultado aprovado, como fica no banco: sempre com fim (o cenário é salvo no fim do play). */
export interface Esperado extends Resultado {
  fim: { motivo: MotivoFim; peca: string | null };
}

export interface Cenario {
  id: string;
  nome: string;
  inicio: string;
  quando: string;
  modo: Modo;
  escolhas: string[];
  esperado: Esperado;
  /** A revisão do fluxo em que o resultado foi aprovado. */
  revisao_aprovada: number;
  atualizado_em: string;
}

/** O que se guarda de um cenário novo (o nome vem da pessoa). */
export type CenarioNovo = Pick<Cenario, 'inicio' | 'quando' | 'modo' | 'escolhas' | 'esperado'>;

export function resultado(x: Execucao): Resultado {
  // Quando termina, "terminou" é o último evento: depois dele o motor não anda mais.
  const fim = x.eventos.at(-1);
  return {
    caminho: x.eventos.flatMap((e) => (e.tipo === 'chegou' ? [e.peca] : [])),
    fim: fim?.tipo === 'terminou' ? { motivo: fim.motivo, peca: fim.peca } : null,
    tempo_s: x.relogio_s,
  };
}

/** O play que toca o cenário. */
export const playDoCenario = (c: Pick<Cenario, 'inicio' | 'quando' | 'modo' | 'escolhas'>): Play => ({ inicio: c.inicio, quando: c.quando, modo: c.modo, escolhas: c.escolhas });

/**
 * O cenário a salvar no fim de um play. As escolhas são as que o motor aceitou (`x.escolhas`), não as que o play
 * guardava: uma escolha que não serve mais não pode ir pro cenário. Sem fim, não há o que salvar (null).
 */
export function cenarioDoPlay(p: Play, x: Execucao): CenarioNovo | null {
  const r = resultado(x);
  if (!r.fim) return null;
  return { inicio: p.inicio, quando: p.quando, modo: p.modo, escolhas: [...x.escolhas], esperado: { ...r, fim: r.fim } };
}

const mesmo = (a: Resultado, b: Resultado) =>
  a.tempo_s === b.tempo_s &&
  a.fim?.motivo === b.fim?.motivo &&
  a.fim?.peca === b.fim?.peca &&
  a.caminho.length === b.caminho.length &&
  a.caminho.every((p, i) => p === b.caminho[i]);

/** O cenário refeito com o documento de agora. */
export interface Situacao {
  situacao: 'igual' | 'mudou';
  resultado: Resultado;
  /** As escolhas que o motor aceitou agora: aprovar grava estas, não as guardadas. */
  escolhas: string[];
}

/**
 * Refaz o cenário com o documento de agora. "mudou" quando uma escolha guardada não serve mais (o caminho não é o
 * mesmo, mesmo que acabe igual) ou o resultado é outro; com ele vão o resultado e as escolhas novos, pra aprovar.
 */
export function situacao(c: Pick<Cenario, 'inicio' | 'quando' | 'modo' | 'escolhas' | 'esperado'>, doc: Documento, ctx: Contexto): Situacao {
  const x = rodar(doc, ctx, playDoCenario(c));
  const r = resultado(x);
  const igual = x.escolhas.length === c.escolhas.length && mesmo(r, c.esperado);
  return { situacao: igual ? 'igual' : 'mudou', resultado: r, escolhas: [...x.escolhas] };
}

/**
 * O que aprovar grava: as escolhas que o motor aceitou e o resultado novo. Gravar só o resultado deixaria uma
 * escolha que o fluxo não usa mais, e o cenário continuaria "mudou". Sem fim (o play ainda pergunta), ou com o
 * Início que sumiu, não há o que aprovar: null, e a tela não oferece o botão.
 */
export function paraAprovar(s: Situacao): Pick<Cenario, 'escolhas' | 'esperado'> | null {
  // "inexistente": o Início do cenário não existe mais; aprovar guardaria um cenário que não toca nada.
  return s.resultado.fim && s.resultado.fim.motivo !== 'inexistente' ? { escolhas: s.escolhas, esperado: { ...s.resultado, fim: s.resultado.fim } } : null;
}

const MOTIVOS: readonly MotivoFim[] = ['fim', 'beco', 'ciclo', 'limite', 'inexistente'];

/** O resultado esperado na forma que o banco aceita (cenarios_esperado). */
export function ehEsperado(v: unknown): v is Esperado {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const e = v as Record<string, unknown>;
  const fim = e.fim as Record<string, unknown> | null | undefined;
  return (
    Array.isArray(e.caminho) &&
    e.caminho.every((p) => typeof p === 'string') &&
    !!fim &&
    typeof fim === 'object' &&
    MOTIVOS.includes(fim.motivo as MotivoFim) &&
    (fim.peca === null || typeof fim.peca === 'string') &&
    typeof e.tempo_s === 'number' &&
    Number.isFinite(e.tempo_s) &&
    e.tempo_s >= 0
  );
}
