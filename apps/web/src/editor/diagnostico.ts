import { executar, indexar, type Achado, type Documento, type Evento, type Indice } from '@journey/fluxo';
import type { Contexto, Play } from './play';

/** Um achado marcado como intencional: a chave do achado, a nota e quem marcou (e-mail; null se saiu da empresa). */
export interface Intencional {
  chave: string;
  nota: string;
  autor: string | null;
  criado_em: string;
}

/** Os achados abertos e os marcados como intencionais. Marcação de achado que este documento não tem não conta. */
export function separar(achados: readonly Achado[], intencionais: readonly Pick<Intencional, 'chave'>[]): { abertos: Achado[]; intencionais: Achado[] } {
  const marcadas = new Set(intencionais.map((i) => i.chave));
  return { abertos: achados.filter((a) => !marcadas.has(a.chave)), intencionais: achados.filter((a) => marcadas.has(a.chave)) };
}

/** Quantos abertos e quantos intencionais (o botão do topo mostra os abertos). */
export function contar(achados: readonly Achado[], intencionais: readonly Pick<Intencional, 'chave'>[]): { abertos: number; intencionais: number } {
  const s = separar(achados, intencionais);
  return { abertos: s.abertos.length, intencionais: s.intencionais.length };
}

/**
 * As peças que a água alcança a partir de algum Início (sem seguir saída de Fim, onde ela para). Uma busca só pro
 * documento inteiro: o "simular até aqui" de cada achado só fica disponível pra peça daqui, e o caminho em si
 * (`caminhoAte`, que roda o motor) só é feito no clique.
 */
export function alcancaveis(doc: Documento): Set<string> {
  const idx = indexar(doc);
  const vistos = new Set(doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id));
  const fila = [...vistos];
  for (let i = 0; i < fila.length; i++) {
    const id = fila[i]!;
    if (idx.pecas.get(id)!.tipo === 'fim') continue;
    for (const c of idx.saidas.get(id)!) {
      if (vistos.has(c.para)) continue;
      vistos.add(c.para);
      fila.push(c.para);
    }
  }
  return vistos;
}

/** As chaves dos achados que têm "simular até aqui": a peça deles é alcançável. O documento é lido uma vez só. */
export function simulaveis(doc: Documento, achados: readonly Achado[]): Set<string> {
  const idx = indexar(doc);
  const a = alcancaveis(doc);
  return new Set(achados.flatMap((x) => (a.has(pecaNoIndice(idx, x) ?? '') ? [x.chave] : [])));
}

/**
 * O play que leva a água de um Início até a peça `alvo` ("simular até aqui"). O caminho mais curto, numa busca em
 * largura a partir de todos os Inícios (a água para num Fim, então não se segue saída de Fim). Depois o motor anda
 * por ele em modo livre (o relógio não decide: o horário também pergunta) e, a cada pergunta, escolhe a saída do
 * caminho. Devolve o play inteiro, já em modo livre: no modo relógio as mesmas escolhas não valem (o relógio decide
 * o horário sozinho e a escolha guardada pra ele sobra). null quando nenhum Início chega lá.
 */
export function caminhoAte(doc: Documento, ctx: Contexto, alvo: string, quando: string): Play | null {
  const idx = indexar(doc);
  if (!idx.pecas.has(alvo)) return null;
  const inicios = doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id);
  // Por qual conexão cada peça foi alcançada primeiro (os Inícios não têm).
  const veioPor = new Map<string, string | null>(inicios.map((id) => [id, null]));
  const fila = [...inicios];
  for (let i = 0; i < fila.length && !veioPor.has(alvo); i++) {
    const id = fila[i]!;
    if (idx.pecas.get(id)!.tipo === 'fim') continue;
    for (const c of idx.saidas.get(id)!) {
      if (veioPor.has(c.para)) continue;
      veioPor.set(c.para, c.id);
      fila.push(c.para);
    }
  }
  if (!veioPor.has(alvo)) return null;
  const conexoes = new Map(doc.conexoes.map((c) => [c.id, c]));
  const doCaminho = new Set<string>();
  let inicio = alvo;
  for (let c = veioPor.get(alvo); c; c = veioPor.get(inicio)) {
    doCaminho.add(c);
    inicio = conexoes.get(c)!.de;
  }
  const x = executar(doc, { cadastros: ctx.cadastros, ...(ctx.canal && { canal: ctx.canal }) }, { inicio, modo: 'livre' });
  const chegou = (eventos: readonly Evento[]) => eventos.some((e) => e.tipo === 'chegou' && e.peca === alvo);
  let chegouNoAlvo = chegou(x.eventos);
  while (!chegouNoAlvo && x.pendente) {
    const opcao = x.pendente.opcoes.find((o) => doCaminho.has(o.conexao));
    if (!opcao) break;
    chegouNoAlvo = chegou(x.avancar(opcao.conexao));
  }
  // Não acontece num caminho sem peça repetida; se acontecer, melhor nenhum caminho que um errado.
  return chegouNoAlvo ? { inicio, quando, modo: 'livre', escolhas: [...x.escolhas] } : null;
}

/** Marcações de achados que este documento não tem mais (a peça mudou ou sumiu): não contam, mas dá pra desmarcar. */
export function antigos<T extends Pick<Intencional, 'chave'>>(achados: readonly Achado[], intencionais: readonly T[]): T[] {
  const chaves = new Set(achados.map((a) => a.chave));
  return intencionais.filter((i) => !chaves.has(i.chave));
}

/** O texto do botão do diagnóstico: "sem achados", "1 achado", "3 achados". */
export const rotuloAchados = (n: number): string => (n === 0 ? 'sem achados' : n === 1 ? '1 achado' : `${n} achados`);

/** Gravidade com nome e ícone: a cor não é a única pista. */
export const GRAVIDADES: Record<Achado['gravidade'], { nome: string; icone: string }> = {
  grave: { nome: 'Grave', icone: 'alerta' },
  alerta: { nome: 'Alerta', icone: 'alerta' },
  observacao: { nome: 'Observação', icone: 'legenda' },
};

/** A peça onde "simular até aqui" chega: a primeira peça entre as referências do achado (uma conexão leva à origem dela). */
export function pecaDoAchado(doc: Documento, a: Pick<Achado, 'refs'>): string | null {
  return pecaNoIndice(indexar(doc), a);
}

function pecaNoIndice(idx: Indice, a: Pick<Achado, 'refs'>): string | null {
  for (const r of a.refs) {
    if (idx.pecas.has(r)) return r;
    const c = idx.doc.conexoes.find((x) => x.id === r);
    if (c && idx.pecas.has(c.de)) return c.de;
  }
  return null;
}

const chaveGaveta = (fluxoId: string) => `journey:diagnostico:${fluxoId}`;

/** Se a gaveta do diagnóstico estava aberta neste fluxo (lembrado no navegador; sem armazenamento, fechada). */
export function gavetaAberta(fluxoId: string): boolean {
  try {
    return globalThis.localStorage?.getItem(chaveGaveta(fluxoId)) === '1';
  } catch {
    return false;
  }
}

export function lembrarGaveta(fluxoId: string, aberta: boolean): void {
  try {
    if (aberta) globalThis.localStorage?.setItem(chaveGaveta(fluxoId), '1');
    else globalThis.localStorage?.removeItem(chaveGaveta(fluxoId));
  } catch {
    // Sem armazenamento no navegador (janela anônima, bloqueado): só não lembra.
  }
}

/**
 * "Ver no quadro": o que selecionar (a primeira referência que existe: peça ou conexão), o que fica no holofote (todas
 * as referências) e as peças a enquadrar (as da conexão, quando a referência é uma). null: nada do achado está no
 * documento (o "sem Início", por exemplo).
 */
export function focoDoAchado(doc: Documento, a: Pick<Achado, 'refs'>): { sel: { tipo: 'peca' | 'conexao'; id: string }; destaque: Set<string>; enquadrar: string[] } | null {
  const pecas = new Set(doc.pecas.map((p) => p.id));
  const conexoes = new Map(doc.conexoes.map((c) => [c.id, c]));
  const primeiro = a.refs.find((r) => pecas.has(r) || conexoes.has(r));
  if (!primeiro) return null;
  return {
    sel: { tipo: pecas.has(primeiro) ? 'peca' : 'conexao', id: primeiro },
    destaque: new Set(a.refs),
    enquadrar: [...new Set(a.refs.flatMap((r) => (pecas.has(r) ? [r] : conexoes.has(r) ? [conexoes.get(r)!.de, conexoes.get(r)!.para] : [])))],
  };
}
