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
const chave = (s: string) => s.toLocaleLowerCase('pt-BR');

/**
 * Quem o link esconde: o nome de quem usa cada ramal (spec, 4: na primeira versão o nome da pessoa fica no ramal).
 * Ramal de setor ("Recepção") não é pessoa e fica com o nome. Devolve nome → o que aparece no lugar ("ramal 2001");
 * dois ramais com o mesmo nome ficam com o primeiro.
 */
export function nomesDePessoas(doc: Documento): Map<string, string> {
  const nomes = new Map<string, string>();
  for (const r of doc.ramais) {
    const nome = r.nome?.trim();
    if (!nome || nome.length < 2 || r.tipo === 'setor') continue;
    if (!nomes.has(chave(nome))) nomes.set(chave(nome), `ramal ${r.id}`);
  }
  return nomes;
}

/**
 * Troca cada nome, escrito inteiro e como palavra (sem pegar "Ana" dentro de "Análise"), pelo que aparece no lugar.
 * Sem diferença de caixa. Nome maior primeiro: "Ana Paula" antes de "Ana".
 */
export function trocadorDeNomes(nomes: Map<string, string>): (texto: string) => string {
  if (nomes.size === 0) return (t) => t;
  const lista = [...nomes.keys()].sort((a, b) => b.length - a.length).map(escapar);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${lista.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return (t) => t.replace(re, (achado) => nomes.get(chave(achado)) ?? achado);
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
 * O documento sem os nomes das pessoas: o ramal perde o nome; a entrada que disca direto num ramal escondido também
 * (o nome dela costuma ser o da pessoa, e o número continua no mapa); nos outros nomes, nos textos dos áudios e nos
 * rótulos das opções, o nome da pessoa vira "ramal <id>".
 */
export function esconderNomes(doc: Documento): Documento {
  const nomes = nomesDePessoas(doc);
  const trocar = trocadorDeNomes(nomes);
  const escondidos = new Set(doc.ramais.filter((r) => r.nome?.trim() && r.tipo !== 'setor').map((r) => `ramal:${r.id}`));
  const comNome = <T extends { nome?: string }>(item: T): T => (item.nome === undefined ? item : { ...item, nome: trocar(item.nome) });
  const semNome = <T extends { nome?: string }>(item: T): T => {
    if (item.nome === undefined) return item;
    const { nome: _fora, ...resto } = item;
    return resto as T;
  };
  return {
    formato: doc.formato,
    entradas: doc.entradas.map((e) => (lerRef(e.destino)?.tipo === 'ramal' && escondidos.has(e.destino) ? semNome(e) : comNome(e))),
    horarios: doc.horarios.map(comNome),
    feriados: doc.feriados.map(comNome),
    ramais: doc.ramais.map((r) => (r.tipo === 'setor' ? r : semNome(r))),
    filas: doc.filas.map(comNome),
    grupos: doc.grupos.map(comNome),
    pecas: doc.pecas.map((p) => {
      const c = comNome(p);
      return c.texto === undefined ? c : { ...c, texto: trocar(c.texto) };
    }),
    saidas: doc.saidas.map((s) => (s.rotulo === undefined ? s : { ...s, rotulo: trocar(s.rotulo) })),
  };
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
  const documento = l.esconder_nomes ? esconderNomes(limpo) : limpo;
  const trocar = l.esconder_nomes ? trocadorDeNomes(nomesDePessoas(limpo)) : (t: string) => t;
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
