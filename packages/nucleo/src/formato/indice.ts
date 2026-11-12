import type { Documento, Entrada, Feriado, Fila, Grupo, Horario, Peca, Ramal, Saida } from './documento';
import { ehEmbutida, lerRef } from './refs';

export interface Indice {
  doc: Documento;
  entradas: Map<string, Entrada>;
  /** Janelas de horário por grupo. */
  janelas: Map<string, Horario[]>;
  /** Feriados por calendário. */
  feriados: Map<string, Feriado[]>;
  ramais: Map<string, Ramal>;
  filas: Map<string, Fila>;
  grupos: Map<string, Grupo>;
  pecas: Map<string, Peca>;
  saidas: Map<string, Saida>;
  /** Saídas por id da peça de origem, na ordem do arquivo. */
  saidasDe: Map<string, Saida[]>;
}

function agrupar<T>(itens: T[], chave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const lista = m.get(k);
    if (lista) lista.push(item);
    else m.set(k, [item]);
  }
  return m;
}

const porId = <T extends { id: string }>(itens: T[]) => new Map(itens.map((i) => [i.id, i] as const));

export function indexar(doc: Documento): Indice {
  const saidasDe = new Map<string, Saida[]>();
  for (const s of doc.saidas) {
    const r = lerRef(s.de);
    if (!r) continue;
    const lista = saidasDe.get(r.id);
    if (lista) lista.push(s);
    else saidasDe.set(r.id, [s]);
  }
  return {
    doc,
    entradas: porId(doc.entradas),
    janelas: agrupar(doc.horarios, (h) => h.grupo),
    feriados: agrupar(doc.feriados, (f) => f.calendario),
    ramais: porId(doc.ramais),
    filas: porId(doc.filas),
    grupos: porId(doc.grupos),
    pecas: porId(doc.pecas),
    saidas: porId(doc.saidas),
    saidasDe,
  };
}

export function existe(idx: Indice, ref: string): boolean {
  if (ehEmbutida(ref)) return true;
  const r = lerRef(ref);
  if (!r) return false;
  switch (r.tipo) {
    case 'entrada':
      return idx.entradas.has(r.id);
    case 'horario':
      return idx.janelas.has(r.id);
    case 'ramal':
      return idx.ramais.has(r.id);
    case 'fila':
      return idx.filas.has(r.id);
    case 'grupo':
      return idx.grupos.has(r.id);
    case 'peca':
      return idx.pecas.has(r.id);
    case 'saida':
      return idx.saidas.has(r.id);
    default:
      return false;
  }
}

const NOMES_EMBUTIDOS: Record<string, string> = {
  'fim:desliga': 'desligar',
  'fim:atendido': 'atendido',
  'fim:caixa_postal': 'caixa postal',
  'externo:celular': 'celular externo',
};

/** Nome legível de uma referência, pra mensagens. */
export function nomeDe(idx: Indice, ref: string): string {
  const embutido = NOMES_EMBUTIDOS[ref];
  if (embutido) return embutido;
  const r = lerRef(ref);
  if (!r) return ref;
  const comNome = (rotulo: string, nome?: string) => (nome ? `${rotulo} (${nome})` : rotulo);
  switch (r.tipo) {
    case 'peca':
      return idx.pecas.get(r.id)?.nome ?? ref;
    case 'fila':
      return comNome(`fila ${r.id}`, idx.filas.get(r.id)?.nome);
    case 'grupo':
      return comNome(`grupo ${r.id}`, idx.grupos.get(r.id)?.nome);
    case 'ramal':
      return comNome(`ramal ${r.id}`, idx.ramais.get(r.id)?.nome);
    case 'entrada': {
      const e = idx.entradas.get(r.id);
      return e?.nome ?? e?.numero ?? ref;
    }
    default:
      return ref;
  }
}
