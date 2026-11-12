import { diagnosticar, type Achado } from '@journey/nucleo/diagnostico';
import { lerRef, type Documento } from '@journey/nucleo/formato';
import type { Cenario } from '@/lib/dados';
import type { Modo } from '@/simulacao/sessao';

/** O cenário inicial guardado no link: a cópia do cenário salvo, sem o resultado esperado. */
export interface CenarioDoLink {
  nome: string;
  entrada: string;
  inicio: string;
  modo: Modo;
  escolhas: string[];
}

/** O que `abrir_link` devolve quando o link vale. */
export interface LinkDoBanco {
  estado: 'ok';
  jornada: { nome: string; canal: string };
  versao: { numero: number; criada_em: string; documento: Documento; diagnostico: Achado[] };
  mais_recente: boolean;
  esconder_nomes: boolean;
  cenario: CenarioDoLink | null;
  expira_em: string | null;
  intencionais: { chave: string; nota: string }[];
}

/** O retrato só de leitura que a página do link mostra. É tudo o que vai pro navegador de quem abre. */
export interface Retrato {
  jornada: { nome: string; canal: string };
  versao: number;
  maisRecente: boolean;
  esconderNomes: boolean;
  expiraEm: string | null;
  documento: Documento;
  diagnostico: Achado[];
  intencionais: { chave: string; nota: string }[];
  /** Com id fixo "link": é o único cenário que a página conhece. */
  cenario: Cenario | null;
}

/** Id do cenário inicial na página do link. */
export const CENARIO_DO_LINK = 'link';

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A forma de comparar nomes: NFC, espaços repetidos (NBSP incluído) viram um, ’ vira ' e cada letra vai pra minúscula
 * só quando a minúscula é uma letra só, que é o que a regex sem caixa também faz ("İ" fica "İ", e não "i" + ponto).
 */
const chave = (s: string) =>
  [...s.normalize('NFC').trim().replace(/\s+/g, ' ').replace(/’/g, "'")]
    .map((c) => {
      const m = c.toLowerCase();
      return [...m].length === 1 ? m : c;
    })
    .join('');

/** O nome como padrão da regex: espaço casa com qualquer sequência de espaços, e um apóstrofo com o outro. */
const padrao = (nome: string) =>
  [...nome].map((c) => (c === ' ' ? '\\s+' : c === "'" ? "['’]" : escapar(c))).join('');

/** Letra, número ou acento combinante: o que não pode vir colado num nome pra ele contar como palavra inteira. */
const LETRA = '[\\p{L}\\p{N}\\p{M}]';

/*
 * O limite do esconder nomes: só troca o nome inteiro de quem usa um ramal. Ids, opções (Saida.opcao), variáveis
 * (quando/define, guarda_variavel), id_central e o primeiro nome sozinho ("Ana" de "Ana Paula") não são trocados.
 * Ramal de setor sem tipo "setor" é tratado como pessoa e perde o nome: o erro vai pro lado seguro.
 */

/**
 * Quem o link esconde: o nome de quem usa cada ramal (spec, 4: na primeira versão o nome da pessoa fica no ramal).
 * Ramal de setor ("Recepção") não é pessoa e fica com o nome. Devolve nome (na forma de comparar) → o que aparece no
 * lugar ("ramal 2001"); dois ramais com o mesmo nome ficam com o primeiro.
 */
export function nomesDePessoas(doc: Documento): Map<string, string> {
  const nomes = new Map<string, string>();
  for (const r of doc.ramais) {
    if (!r.nome || r.tipo === 'setor') continue;
    const nome = chave(r.nome);
    if ([...nome].length < 2) continue;
    if (!nomes.has(nome)) nomes.set(nome, `ramal ${r.id}`);
  }
  return nomes;
}

/**
 * Troca cada nome, escrito inteiro e como palavra (sem pegar "Ana" dentro de "Análise"), pelo que aparece no lugar.
 * Sem diferença de caixa; o texto sai em NFC. Nome maior primeiro: "Ana Paula" antes de "Ana". Cada nome é um grupo
 * da regex, e o grupo que casou diz qual troca usar (sem depender de minúscula de idioma pra achar de volta).
 */
export function trocadorDeNomes(nomes: Map<string, string>): (texto: string) => string {
  if (nomes.size === 0) return (t) => t.normalize('NFC');
  const lista = [...nomes].map(([nome, troca]) => ({ nome: chave(nome), troca })).sort((a, b) => b.nome.length - a.nome.length);
  const grupos = lista.map((n) => `(${padrao(n.nome)})`).join('|');
  const re = new RegExp(`(?<!${LETRA})(?:${grupos})(?!${LETRA})`, 'giu');
  return (t) =>
    t.normalize('NFC').replace(re, (achado, ...resto: unknown[]) => {
      const i = resto.findIndex((g, j) => j < lista.length && g !== undefined);
      return i < 0 ? achado : lista[i]!.troca;
    });
}

/** Tira a coluna "observacao" de todos os itens: é nota interna, e a tela não mostra. */
export function semObservacoes(doc: Documento): Documento {
  const tirar = <T extends { observacao?: string }>(lista: T[]): T[] =>
    lista.map((item) => {
      if (item.observacao === undefined) return item;
      const { observacao: _fora, ...resto } = item;
      return resto as T;
    });
  return {
    formato: doc.formato,
    entradas: tirar(doc.entradas),
    horarios: tirar(doc.horarios),
    feriados: tirar(doc.feriados),
    ramais: tirar(doc.ramais),
    filas: tirar(doc.filas),
    grupos: tirar(doc.grupos),
    pecas: tirar(doc.pecas),
    saidas: tirar(doc.saidas),
  };
}

/**
 * O documento sem os nomes das pessoas, e o trocador que o fez (o retrato usa o mesmo no nome do cenário).
 * O ramal perde o nome; a entrada que disca direto num ramal também (o nome dela costuma ser o da pessoa, e o número
 * continua no mapa), a não ser que ele seja um setor conhecido: o export não traz todos os ramais, e o que falta ou
 * não tem nome não tem o que trocar. Pelo mesmo motivo, a saída pra um ramal assim perde o rótulo. Nos outros nomes,
 * nos textos dos áudios e nos rótulos das opções, o nome da pessoa vira "ramal <id>".
 */
function esconder(doc: Documento): { documento: Documento; trocar: (texto: string) => string } {
  const trocar = trocadorDeNomes(nomesDePessoas(doc));
  const setores = new Set(doc.ramais.filter((r) => r.tipo === 'setor').map((r) => r.id));
  const comNomeDePessoa = new Set(doc.ramais.filter((r) => r.nome?.trim() && r.tipo !== 'setor').map((r) => r.id));
  const ramalDe = (ref: string) => {
    const r = lerRef(ref);
    return r?.tipo === 'ramal' ? r.id : null;
  };
  const comNome = <T extends { nome?: string }>(item: T): T => (item.nome === undefined ? item : { ...item, nome: trocar(item.nome) });
  const semNome = <T extends { nome?: string }>(item: T): T => {
    if (item.nome === undefined) return item;
    const { nome: _fora, ...resto } = item;
    return resto as T;
  };
  const documento: Documento = {
    formato: doc.formato,
    entradas: doc.entradas.map((e) => {
      const id = ramalDe(e.destino);
      return id !== null && !setores.has(id) ? semNome(e) : comNome(e);
    }),
    horarios: doc.horarios.map(comNome),
    feriados: doc.feriados.map(comNome),
    ramais: doc.ramais.map((r) => (r.tipo === 'setor' ? r : semNome(r))),
    filas: doc.filas.map(comNome),
    grupos: doc.grupos.map(comNome),
    pecas: doc.pecas.map((p) => {
      const c = comNome(p);
      return c.texto === undefined ? c : { ...c, texto: trocar(c.texto) };
    }),
    saidas: doc.saidas.map((s) => {
      if (s.rotulo === undefined) return s;
      const id = ramalDe(s.para);
      if (id !== null && !setores.has(id) && !comNomeDePessoa.has(id)) {
        const { rotulo: _fora, ...resto } = s;
        return resto;
      }
      return { ...s, rotulo: trocar(s.rotulo) };
    }),
  };
  return { documento, trocar };
}

/** O documento sem os nomes das pessoas (ver `esconder`). */
export function esconderNomes(doc: Documento): Documento {
  return esconder(doc).documento;
}

/**
 * O retrato do link, montado no servidor. Sempre sem observações; com "esconder nomes", sem os nomes das pessoas,
 * sem as notas dos intencionais (texto livre) e com o nome do cenário trocado.
 * O diagnóstico é refeito sobre o documento que vai pra tela (os textos dos achados citam nomes), mas só com os
 * achados que a versão guardou: as chaves não dependem de nome, e a jornada de um canal não ganha de volta o
 * "não recebe ligação" do que só o outro canal alcança.
 */
export function montarRetrato(l: LinkDoBanco): Retrato {
  const limpo = semObservacoes(l.versao.documento);
  const { documento, trocar } = l.esconder_nomes ? esconder(limpo) : { documento: limpo, trocar: (t: string) => t };
  const guardadas = new Set(l.versao.diagnostico.map((a) => a.chave));
  const diagnostico = diagnosticar(documento).filter((a) => guardadas.has(a.chave));
  const cenario: Cenario | null = l.cenario && {
    id: CENARIO_DO_LINK,
    nome: trocar(l.cenario.nome),
    entrada: l.cenario.entrada,
    inicio: l.cenario.inicio,
    modo: l.cenario.modo,
    escolhas: l.cenario.escolhas,
    esperado: [],
    versao_aprovada: l.versao.numero,
  };
  return {
    jornada: l.jornada,
    versao: l.versao.numero,
    maisRecente: l.mais_recente,
    esconderNomes: l.esconder_nomes,
    expiraEm: l.expira_em,
    documento,
    diagnostico,
    intencionais: l.intencionais.map((i) => ({ chave: i.chave, nota: l.esconder_nomes ? '' : i.nota })),
    cenario,
  };
}
