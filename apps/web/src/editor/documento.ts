import type { Conexao, Documento, Grupo, Nota, Peca, TipoPeca } from '@journey/fluxo';
import { dentro } from './geometria';
import { FORMAS, GRUPO, NOTA, caixaDe, naGrade } from './pecas';

/**
 * As mudanças do editor no documento journey/2. Todas puras: recebem o documento e devolvem outro, sem tocar
 * no de entrada (o histórico guarda as versões anteriores por referência). Ids vêm de quem chama.
 */

/** Aplica um remendo: chave com `undefined` some do objeto (o documento não guarda campo vazio). */
function remendar<T extends object>(obj: T, patch: Partial<NoInfer<T>>): T {
  const novo = { ...obj } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === '') delete novo[k];
    else novo[k] = v;
  }
  return novo as T;
}

const trocar = <T extends { id: string }>(lista: readonly T[], id: string, f: (x: T) => T): T[] => lista.map((x) => (x.id === id ? f(x) : x));

/** Uma peça nova com o centro em (cx, cy), na grade, com o nome do tipo. */
export function criarPeca(doc: Documento, id: string, tipo: TipoPeca, cx: number, cy: number): Documento {
  const f = FORMAS[tipo];
  const p: Peca = { id, tipo, nome: f.nome, x: naGrade(cx - f.w / 2), y: naGrade(cy - f.h / 2) };
  return { ...doc, pecas: [...doc.pecas, p] };
}

export function criarNota(doc: Documento, id: string, cx: number, cy: number): Documento {
  const n: Nota = { id, texto: 'Escreva aqui', x: naGrade(cx - NOTA.w / 2), y: naGrade(cy - NOTA.h / 2), w: NOTA.w, h: NOTA.h };
  return { ...doc, notas: [...doc.notas, n] };
}

export function criarGrupo(doc: Documento, id: string, cx: number, cy: number): Documento {
  const g: Grupo = { id, nome: 'Grupo', x: naGrade(cx - GRUPO.w / 2), y: naGrade(cy - GRUPO.h / 2), w: GRUPO.w, h: GRUPO.h };
  return { ...doc, grupos: [...doc.grupos, g] };
}

export type Ligacao = { doc: Documento; conexao: Conexao } | { erro: 'mesma' | 'repetida' | 'inexistente' };

/**
 * Liga duas peças. A segunda saída de uma peça transforma as saídas "sempre" sem texto em opções numeradas
 * (1, 2…): é o que faz o play perguntar.
 */
export function ligar(doc: Documento, id: string, de: string, para: string): Ligacao {
  if (de === para) return { erro: 'mesma' };
  if (!doc.pecas.some((p) => p.id === de) || !doc.pecas.some((p) => p.id === para)) return { erro: 'inexistente' };
  if (doc.conexoes.some((c) => c.de === de && c.para === para)) return { erro: 'repetida' };
  const outras = doc.conexoes.filter((c) => c.de === de);
  let conexoes = doc.conexoes;
  let nova: Conexao = { id, de, para, regra: 'sempre' };
  if (outras.length >= 1) {
    let i = 0;
    conexoes = conexoes.map((c) => {
      if (c.de !== de) return c;
      i++;
      return c.regra === 'sempre' && !c.rotulo ? { ...c, regra: 'opcao', valor: String(i) } : c;
    });
    nova = { ...nova, regra: 'opcao', valor: String(outras.length + 1) };
  }
  return { doc: { ...doc, conexoes: [...conexoes, nova] }, conexao: nova };
}

/** Distância entre uma peça e a próxima criada pelo "+". */
const VAO = 110;

/** Cria a próxima peça já ligada à de origem: à direita, uma linha abaixo por saída que ela já tem. */
export function criarLigada(doc: Documento, idPeca: string, idConexao: string, origem: string, tipo: TipoPeca, onde?: { x: number; y: number }): Documento {
  const o = doc.pecas.find((p) => p.id === origem);
  if (!o) return doc;
  const co = caixaDe(o);
  const f = FORMAS[tipo];
  const saidas = doc.conexoes.filter((c) => c.de === origem).length;
  const p = onde ?? { x: co.x + co.w + VAO + f.w / 2, y: co.y + co.h / 2 + saidas * VAO };
  const comPeca = criarPeca(doc, idPeca, tipo, p.x, p.y);
  const r = ligar(comPeca, idConexao, origem, idPeca);
  return 'doc' in r ? r.doc : comPeca;
}

export const moverPeca = (doc: Documento, id: string, x: number, y: number): Documento => ({ ...doc, pecas: trocar(doc.pecas, id, (p) => ({ ...p, x: naGrade(x), y: naGrade(y) })) });
export const moverNota = (doc: Documento, id: string, x: number, y: number): Documento => ({ ...doc, notas: trocar(doc.notas, id, (n) => ({ ...n, x: naGrade(x), y: naGrade(y) })) });

/** O que um grupo leva junto quando se move: peças e notas com o centro dentro dele. */
export function conteudoDoGrupo(doc: Documento, id: string): { pecas: string[]; notas: string[] } {
  const g = doc.grupos.find((x) => x.id === id);
  if (!g) return { pecas: [], notas: [] };
  return { pecas: doc.pecas.filter((p) => dentro(caixaDe(p), g)).map((p) => p.id), notas: doc.notas.filter((n) => dentro(n, g)).map((n) => n.id) };
}

/**
 * Move o grupo e o que estava dentro dele no começo do arrasto. As posições de partida vêm de `inicio`
 * (o documento de quando o arrasto começou), pra o arredondamento na grade não acumular erro.
 */
export function moverGrupo(inicio: Documento, id: string, dx: number, dy: number, levar: { pecas: string[]; notas: string[] }): Documento {
  const mx = naGrade(dx);
  const my = naGrade(dy);
  const pecas = new Set(levar.pecas);
  const notas = new Set(levar.notas);
  return {
    ...inicio,
    grupos: trocar(inicio.grupos, id, (g) => ({ ...g, x: g.x + mx, y: g.y + my })),
    pecas: inicio.pecas.map((p) => (pecas.has(p.id) ? { ...p, x: p.x + mx, y: p.y + my } : p)),
    notas: inicio.notas.map((n) => (notas.has(n.id) ? { ...n, x: n.x + mx, y: n.y + my } : n)),
  };
}

export const redimensionarGrupo = (doc: Documento, id: string, w: number, h: number): Documento => ({
  ...doc,
  grupos: trocar(doc.grupos, id, (g) => ({ ...g, w: Math.max(GRUPO.minW, naGrade(w)), h: Math.max(GRUPO.minH, naGrade(h)) })),
});

/** Muda campos de uma peça. Trocar o tipo mantém o centro (as formas têm tamanhos diferentes) e as ligações. */
export function mudarPeca(doc: Documento, id: string, patch: Partial<Omit<Peca, 'id'>>): Documento {
  return {
    ...doc,
    pecas: trocar(doc.pecas, id, (p) => {
      const nova = remendar(p, patch);
      if (patch.tipo && patch.tipo !== p.tipo) {
        const a = FORMAS[p.tipo];
        const b = FORMAS[patch.tipo];
        nova.x = naGrade(p.x + a.w / 2 - b.w / 2);
        nova.y = naGrade(p.y + a.h / 2 - b.h / 2);
      }
      if (!nova.nome) nova.nome = FORMAS[nova.tipo].nome;
      return nova;
    }),
  };
}

/** Muda a regra ou os campos de uma conexão. Trocar a regra limpa os campos que não são dela. */
export function mudarConexao(doc: Documento, id: string, patch: Partial<Omit<Conexao, 'id' | 'de' | 'para'>>): Documento {
  return {
    ...doc,
    conexoes: trocar(doc.conexoes, id, (c) => {
      let base: Conexao = c;
      if (patch.regra && patch.regra !== c.regra) {
        const { valor: _v, tempo_s: _t, horario: _h, ...resto } = c;
        base = resto;
        if (patch.regra === 'horario' && !patch.horario) base = { ...base, horario: 'dentro' };
      }
      return remendar(base, patch);
    }),
  };
}

export const inverterConexao = (doc: Documento, id: string): Documento => ({ ...doc, conexoes: trocar(doc.conexoes, id, (c) => ({ ...c, de: c.para, para: c.de })) });
export const mudarGrupo = (doc: Documento, id: string, patch: Partial<Pick<Grupo, 'nome' | 'cor'>>): Documento => ({ ...doc, grupos: trocar(doc.grupos, id, (g) => remendar(g, patch)) });
export const mudarNota = (doc: Documento, id: string, patch: Partial<Pick<Nota, 'texto' | 'cor'>>): Documento => ({ ...doc, notas: trocar(doc.notas, id, (n) => remendar(n, patch)) });

export type Selecao = { tipo: 'peca' | 'conexao' | 'grupo' | 'nota'; id: string } | null;

/** Apaga o que está selecionado. Peça leva junto as ligações dela; grupo deixa as peças. */
export function apagar(doc: Documento, sel: NonNullable<Selecao>): Documento {
  if (sel.tipo === 'peca') return { ...doc, pecas: doc.pecas.filter((p) => p.id !== sel.id), conexoes: doc.conexoes.filter((c) => c.de !== sel.id && c.para !== sel.id) };
  if (sel.tipo === 'conexao') return { ...doc, conexoes: doc.conexoes.filter((c) => c.id !== sel.id) };
  if (sel.tipo === 'grupo') return { ...doc, grupos: doc.grupos.filter((g) => g.id !== sel.id) };
  return { ...doc, notas: doc.notas.filter((n) => n.id !== sel.id) };
}

/** Cópia da peça (sem as ligações), um pouco abaixo e à direita. */
export function duplicar(doc: Documento, id: string, novoId: string): Documento {
  const p = doc.pecas.find((x) => x.id === id);
  if (!p) return doc;
  return { ...doc, pecas: [...doc.pecas, { ...p, id: novoId, x: p.x + 30, y: p.y + 30 }] };
}

/** A seleção ainda existe no documento? (Desfazer pode tirar o que estava selecionado.) */
export function existe(doc: Documento, sel: Selecao): boolean {
  if (!sel) return false;
  const lista = { peca: doc.pecas, conexao: doc.conexoes, grupo: doc.grupos, nota: doc.notas }[sel.tipo] as readonly { id: string }[];
  return lista.some((x) => x.id === sel.id);
}
