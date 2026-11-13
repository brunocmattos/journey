import type { Conexao, Documento, Grupo, Nota, Peca, TipoPeca } from '@journey/fluxo';
import { dentro } from './geometria';
import { FORMAS, GRUPO, NOTA, ROTULO_RESPONSAVEL, caixaDe, naGrade } from './pecas';

/**
 * As mudanças do editor no documento journey/2. Todas puras: recebem o documento e devolvem outro, sem tocar
 * no de entrada (o histórico guarda as versões anteriores por referência). Ids vêm de quem chama.
 * Quando nada muda, devolvem o mesmo documento (o histórico não ganha passo vazio). O que sai daqui passa no
 * `lerDocumento`: um documento que ele recusa seria salvo e depois não abriria mais.
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

/** Troca um item da lista; se nada mudou (id que não existe, ou o mesmo item), devolve a mesma lista. */
function trocar<T extends { id: string }>(lista: T[], id: string, f: (x: T) => T): T[] {
  let mudou = false;
  const nova = lista.map((x) => {
    if (x.id !== id) return x;
    const y = f(x);
    if (y !== x) mudou = true;
    return y;
  });
  return mudou ? nova : lista;
}

/** O documento com uma lista trocada, ou o mesmo documento se a lista é a mesma. */
const com = <K extends 'pecas' | 'conexoes' | 'grupos' | 'notas'>(doc: Documento, chave: K, lista: Documento[K]): Documento => (lista === doc[chave] ? doc : { ...doc, [chave]: lista });

/** Os números de opção que as saídas de uma peça já usam. O próximo é o menor que falta. */
function proximaOpcao(usados: Set<string>): string {
  let n = 1;
  while (usados.has(String(n))) n++;
  usados.add(String(n));
  return String(n);
}

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
    // Números que já são opção não se repetem: depois de apagar a opção 2 de 1, 2, 3, a próxima é 2.
    const usados = new Set(outras.filter((c) => c.regra === 'opcao' && c.valor).map((c) => c.valor!));
    conexoes = conexoes.map((c) => (c.de === de && c.regra === 'sempre' && !c.rotulo ? { ...c, regra: 'opcao', valor: proximaOpcao(usados) } : c));
    nova = { ...nova, regra: 'opcao', valor: proximaOpcao(usados) };
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

/** Põe x e y na grade; se o lugar não muda, o item é o mesmo. */
const noLugar = <T extends { x: number; y: number }>(item: T, x: number, y: number): T => {
  const [gx, gy] = [naGrade(x), naGrade(y)];
  return gx === item.x && gy === item.y ? item : { ...item, x: gx, y: gy };
};
export const moverPeca = (doc: Documento, id: string, x: number, y: number): Documento => com(doc, 'pecas', trocar(doc.pecas, id, (p) => noLugar(p, x, y)));
export const moverNota = (doc: Documento, id: string, x: number, y: number): Documento => com(doc, 'notas', trocar(doc.notas, id, (n) => noLugar(n, x, y)));

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
  return moverGrupoEm(inicio, inicio, id, dx, dy, levar);
}

/**
 * O mesmo, aplicado em cima de `doc` (o documento de agora): só as posições do grupo e do que ele leva mudam, e
 * vêm de `inicio` mais o deslocamento. O que mudou no meio do arrasto (um responsável que chegou do servidor, um
 * nome) fica. Sem mudança, devolve o próprio `doc`.
 */
export function moverGrupoEm(doc: Documento, inicio: Documento, id: string, dx: number, dy: number, levar: { pecas: string[]; notas: string[] }): Documento {
  const mx = naGrade(dx);
  const my = naGrade(dy);
  const partida = new Map<string, { x: number; y: number }>();
  const g0 = inicio.grupos.find((g) => g.id === id);
  if (g0) partida.set(`g:${id}`, g0);
  for (const p of inicio.pecas) if (levar.pecas.includes(p.id)) partida.set(`p:${p.id}`, p);
  for (const n of inicio.notas) if (levar.notas.includes(n.id)) partida.set(`n:${n.id}`, n);
  const levar1 = <T extends { id: string; x: number; y: number }>(lista: T[], pre: string): T[] => {
    let mudou = false;
    const nova = lista.map((x) => {
      const o = partida.get(`${pre}:${x.id}`);
      if (!o || (x.x === o.x + mx && x.y === o.y + my)) return x;
      mudou = true;
      return { ...x, x: o.x + mx, y: o.y + my };
    });
    return mudou ? nova : lista;
  };
  return com(com(com(doc, 'grupos', levar1(doc.grupos, 'g')), 'pecas', levar1(doc.pecas, 'p')), 'notas', levar1(doc.notas, 'n'));
}

export function redimensionarGrupo(doc: Documento, id: string, w: number, h: number): Documento {
  const [gw, gh] = [Math.max(GRUPO.minW, naGrade(w)), Math.max(GRUPO.minH, naGrade(h))];
  return com(doc, 'grupos', trocar(doc.grupos, id, (g) => (g.w === gw && g.h === gh ? g : { ...g, w: gw, h: gh })));
}

/** O remendo mudou alguma coisa? (Pra não criar passo no histórico à toa.) */
const igual = <T extends object>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Muda campos de uma peça. Trocar o tipo mantém o centro (as formas têm tamanhos diferentes) e as ligações, e tira
 * o que o novo tipo não mostra no painel: o tempo no Início e no Fim, o responsável onde não há responsável.
 * Nome vazio (ou só espaços) volta pro nome do tipo; tipo e posição nunca somem.
 */
export function mudarPeca(doc: Documento, id: string, patch: Partial<Omit<Peca, 'id'>>): Documento {
  return com(
    doc,
    'pecas',
    trocar(doc.pecas, id, (p) => {
      const nova = remendar(p, patch);
      nova.tipo ??= p.tipo;
      nova.x ??= p.x;
      nova.y ??= p.y;
      if (nova.tipo !== p.tipo) {
        const a = FORMAS[p.tipo];
        const b = FORMAS[nova.tipo];
        nova.x = naGrade(p.x + a.w / 2 - b.w / 2);
        nova.y = naGrade(p.y + a.h / 2 - b.h / 2);
        if (nova.tipo === 'inicio' || nova.tipo === 'fim') delete nova.tempo_s;
        if (!ROTULO_RESPONSAVEL[nova.tipo]) delete nova.responsavel;
      }
      nova.nome = nova.nome?.trim() || FORMAS[nova.tipo].nome;
      return igual(nova, p) ? p : nova;
    }),
  );
}

/**
 * Muda a regra ou os campos de uma conexão. Trocar a regra limpa os campos que não são dela. "Depois de um tempo"
 * sempre tem um tempo (zero, até a pessoa preencher) e "horário" sempre tem um lado: sem eles o documento não abre.
 */
export function mudarConexao(doc: Documento, id: string, patch: Partial<Omit<Conexao, 'id' | 'de' | 'para'>>): Documento {
  return com(
    doc,
    'conexoes',
    trocar(doc.conexoes, id, (c) => {
      let base: Conexao = c;
      if (patch.regra && patch.regra !== c.regra) {
        const { valor: _v, tempo_s: _t, horario: _h, ...resto } = c;
        base = resto;
      }
      const nova = remendar(base, patch);
      nova.regra ??= c.regra;
      if (nova.regra === 'tempo' && nova.tempo_s === undefined) nova.tempo_s = 0;
      if (nova.regra === 'horario' && !nova.horario) nova.horario = 'dentro';
      return igual(nova, c) ? c : nova;
    }),
  );
}

/** Inverte a direção. Se a de volta já existe, não faz nada: seriam duas ligações iguais (o que `ligar` recusa). */
export function inverterConexao(doc: Documento, id: string): Documento {
  const c = doc.conexoes.find((x) => x.id === id);
  if (!c || c.de === c.para || doc.conexoes.some((x) => x.de === c.para && x.para === c.de)) return doc;
  return com(doc, 'conexoes', trocar(doc.conexoes, id, () => ({ ...c, de: c.para, para: c.de })));
}

export const mudarGrupo = (doc: Documento, id: string, patch: Partial<Pick<Grupo, 'nome' | 'cor'>>): Documento =>
  com(doc, 'grupos', trocar(doc.grupos, id, (g) => {
    const novo = remendar(g, patch);
    novo.nome = novo.nome?.trim() || 'Grupo';
    return igual(novo, g) ? g : novo;
  }));

/** O texto da nota pode ficar vazio, mas não some do documento. */
export const mudarNota = (doc: Documento, id: string, patch: Partial<Pick<Nota, 'texto' | 'cor'>>): Documento =>
  com(doc, 'notas', trocar(doc.notas, id, (n) => {
    const nova = remendar(n, patch);
    nova.texto ??= '';
    return igual(nova, n) ? n : nova;
  }));

export type Selecao = { tipo: 'peca' | 'conexao' | 'grupo' | 'nota'; id: string } | null;

/** Apaga o que está selecionado. Peça leva junto as ligações dela; grupo deixa as peças. */
export function apagar(doc: Documento, sel: NonNullable<Selecao>): Documento {
  if (!existe(doc, sel)) return doc;
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

/**
 * Tira das peças o responsável que não é mais cadastro da empresa (apagado depois): uma cópia guardada no navegador
 * ou uma versão marcada antiga voltando pro editor seria recusada pelo banco no salvamento seguinte. Devolve o
 * documento e quantas peças perderam o responsável (o aviso conta).
 */
export function semResponsaveisQueSumiram(doc: Documento, existem: ReadonlySet<string>): { documento: Documento; orfas: number } {
  const orfas = doc.pecas.filter((p) => p.responsavel && !existem.has(p.responsavel));
  let documento = doc;
  for (const p of orfas) documento = mudarPeca(documento, p.id, { responsavel: undefined });
  return { documento, orfas: orfas.length };
}
