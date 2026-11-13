import { diagnosticar, lerDocumento, type Cadastro, type Documento, type Modo } from '@journey/fluxo';
import { lerEstilo, type CanalEditor, type Estilo } from '@/editor/estilo';

/** O cenário inicial guardado no link: a cópia do cenário salvo, sem o resultado esperado. */
export interface CenarioDoLink {
  nome: string;
  inicio: string;
  quando: string;
  modo: Modo;
  escolhas: string[];
}

/** O que `abrir_link` devolve quando o link vale (migração 20261115000000). O documento e o estilo vêm sem conferir. */
export interface LinkDoBanco {
  estado: 'ok';
  empresa: { nome: string };
  fluxo: { nome: string; canal: string | null; descricao: string; meta_s: number | null };
  documento: unknown;
  estilo: unknown;
  /** A versão fixa do link; null quando o link mostra o fluxo de agora. */
  versao: { numero: number; nome: string; criada_em: string } | null;
  /** O fluxo de agora (link sem versão fixa); null com versão fixa. */
  atual: { revisao: number; editado_em: string } | null;
  /** Só os cadastros que o documento usa. */
  cadastros: Cadastro[];
  canais: (CanalEditor & { arquivado: boolean })[];
  intencionais: { chave: string; nota: string }[];
  esconder_nomes: boolean;
  cenario: CenarioDoLink | null;
  expira_em: string | null;
  /**
   * Com "esconder nomes", o nome de toda Pessoa da empresa (vazio com os nomes à mostra): pra sair também do texto
   * livre que cita quem não é responsável de nenhuma peça. Só o servidor usa; não vai pro retrato.
   */
  pessoas: string[];
}

/** O retrato só de leitura que a página do link mostra. É tudo o que vai pro navegador de quem abre. */
export interface Retrato {
  empresa: { nome: string };
  fluxo: { nome: string; canal: string | null; descricao: string; meta_s: number | null };
  /** A versão fixa (número e nome) ou null: o fluxo de agora. */
  versao: { numero: number; nome: string } | null;
  /** De quando é o que o link mostra: a data da versão, ou a da última edição do fluxo. */
  de: string;
  esconderNomes: boolean;
  expiraEm: string | null;
  documento: Documento;
  estilo: Estilo;
  cadastros: Cadastro[];
  canais: CanalEditor[];
  /** Só os dos achados deste documento. */
  intencionais: { chave: string; nota: string }[];
  cenario: CenarioDoLink | null;
}

/** "versão 3 · antes do horário novo", ou "o fluxo de agora". */
export const rotuloDaVersao = (v: Retrato['versao']): string => (v ? `versão ${v.numero} · ${v.nome}` : 'o fluxo de agora');

// Nomes ----------------------------------------------------------------------------------------------------------

/*
 * Esconder nomes troca, em todo texto livre, o nome de cada Pessoa da empresa: o nome inteiro e cada palavra dele
 * com 3 letras ou mais (menos da, de, do, das, dos, e), sem diferença de caixa, sem o acento que o nome tem
 * ("Joao" acha "João"), e com espaço, hífen, sublinhado ou espaço de largura zero entre as palavras. Trocar a mais é o
 * lado seguro: o sobrenome "Rosa" também troca a cor rosa.
 *
 * O que fica de fora (limites conhecidos):
 * - apelido, diminutivo, abreviação ou erro de digitação ("Aninha", "A. Souza", "Ana Sousa");
 * - nome grudado em outra coisa ("AnaSouza", "@ana.souza", "ana.souza@empresa.com") e telefones ou e-mails no texto;
 * - palavra do nome com menos de 3 letras sozinha ("Li" de "Li Wang"; o nome "Li" inteiro troca);
 * - acento que o texto tem e o nome não ("Anã" não é "Ana");
 * - quem não é cadastro do tipo Pessoa (gente cadastrada como equipe, sistema ou num tipo próprio da empresa);
 * - o nome da empresa, cores, ids e o que não é texto.
 */

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Entre as palavras de um nome: espaço (NBSP e tab também), hífen, sublinhado ou espaço de largura zero. */
const SEPARADOR = '[\\s\\u200B-\\u200D\\u2060\\u2010-\\u2015_-]+';
const ehSeparador = (c: string) => new RegExp(`^${SEPARADOR}$`, 'u').test(c);

/** Letra, número ou acento combinante: o que não pode vir colado num nome pra ele contar como palavra inteira. */
const LETRA = '[\\p{L}\\p{N}\\p{M}]';

/** As partículas não trocam sozinhas: "da" e "de" estão em todo texto. */
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * O padrão de um nome, pra casar no texto em NFD (letra e acento separados). Letra com acento no nome aceita qualquer
 * acento ou nenhum ("João" acha "Joao"); letra sem acento só casa sem ("Ana" não acha "Anã"). Separadores viram
 * SEPARADOR, e um apóstrofo casa com o outro.
 */
function padrao(nome: string): string {
  const cs = [...nome.normalize('NFD').trim()];
  let out = '';
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    if (/\p{M}/u.test(c)) continue;
    if (ehSeparador(c)) {
      if (!out.endsWith(SEPARADOR)) out += SEPARADOR;
    } else if (c === "'" || c === '’') out += "['’]";
    else out += escapar(c) + (/\p{M}/u.test(cs[i + 1] ?? '') ? '\\p{M}*' : '');
  }
  return out;
}

const letras = (s: string) => [...s.normalize('NFD').replace(/\p{M}/gu, '')].filter((c) => /\p{L}/u.test(c)).length;

/** As palavras de um nome que trocam sozinhas: 3 letras ou mais, menos as partículas. */
const palavras = (nome: string) =>
  nome
    .split(new RegExp(SEPARADOR, 'u'))
    .filter((p) => letras(p) >= 3 && !PARTICULAS.has(p.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()));

/** No lugar de quem não é responsável de nenhuma peça: sem número, pra não contar quantas pessoas a empresa tem. */
export const PESSOA = 'Pessoa';

/**
 * Quem o link esconde: os cadastros do tipo Pessoa que as peças usam viram "Pessoa 1", "Pessoa 2"… na ordem em que
 * aparecem nas peças (a ordem do documento não muda entre aberturas e não conta nada do nome, como contaria a ordem
 * alfabética). Pessoa que nenhuma peça usa vira só "Pessoa". Devolve id → o nome que aparece no lugar.
 */
export function pessoasEscondidas(cadastros: readonly Cadastro[], doc: Documento): Map<string, string> {
  const pessoas = new Set(cadastros.filter((k) => k.tipo === 'pessoa').map((k) => k.id));
  const ordem: string[] = [];
  for (const p of doc.pecas) if (p.responsavel && pessoas.has(p.responsavel) && !ordem.includes(p.responsavel)) ordem.push(p.responsavel);
  const nomes = new Map(ordem.map((id, i) => [id, `Pessoa ${i + 1}`]));
  for (const id of pessoas) if (!nomes.has(id)) nomes.set(id, PESSOA);
  return nomes;
}

/**
 * Troca cada nome (inteiro, e cada palavra dele: ver os limites acima) pelo que aparece no lugar. O texto sai em NFC.
 * Os nomes inteiros vêm antes das palavras, e o maior antes do menor: "Ana Paula" antes de "Ana". Quando dois casam
 * igual, fica a primeira troca (a ordem do mapa: os responsáveis das peças primeiro). Cada padrão é um grupo da
 * regex, e o grupo que casou diz qual troca usar. Nome de uma letra só não troca nada (trocaria toda letra solta).
 */
export function trocadorDeNomes(nomes: ReadonlyMap<string, string>): (texto: string) => string {
  const vistos = new Set<string>();
  const lista: { padrao: string; tamanho: number; troca: string }[] = [];
  const pôr = (nome: string, troca: string) => {
    const p = padrao(nome);
    const k = p.toLowerCase();
    if (!p || vistos.has(k)) return;
    vistos.add(k);
    lista.push({ padrao: p, tamanho: [...nome.normalize('NFD').replace(/\p{M}/gu, '')].length, troca });
  };
  const validos = [...nomes].filter(([nome]) => letras(nome) >= 2);
  for (const [nome, troca] of validos) pôr(nome, troca);
  for (const [nome, troca] of validos) for (const p of palavras(nome)) pôr(p, troca);
  // sort é estável: no empate de tamanho, fica a ordem de cima.
  lista.sort((a, b) => b.tamanho - a.tamanho);
  if (lista.length === 0) return (t) => t.normalize('NFC');
  const re = new RegExp(`(?<!${LETRA})(?:${lista.map((n) => `(${n.padrao})`).join('|')})(?!${LETRA})`, 'giu');
  return (t) =>
    t
      .normalize('NFD')
      .replace(re, (achado, ...resto: unknown[]) => {
        const i = resto.findIndex((g, j) => j < lista.length && g !== undefined);
        return i < 0 ? achado : lista[i]!.troca;
      })
      .normalize('NFC');
}

/** Cada texto dentro de um valor (objeto, lista) passa pela troca: os campos de um cadastro são livres. */
function trocarEmTudo(v: unknown, trocar: (t: string) => string): unknown {
  if (typeof v === 'string') return trocar(v);
  if (Array.isArray(v)) return v.map((x) => trocarEmTudo(x, trocar));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trocarEmTudo(x, trocar)]));
  return v;
}

/**
 * O documento sem os nomes: em todo texto livre (nome e descrição da peça, texto no cano, valor da regra, nome do
 * grupo, nota), o nome de cada Pessoa vira o que aparece no lugar.
 */
function semNomes(doc: Documento, trocar: (t: string) => string, cadastros: ReadonlySet<string>): Documento {
  const t = (s: string | undefined) => (s === undefined ? s : trocar(s));
  const sem = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return {
    formato: doc.formato,
    // Responsável que não é um dos cadastros que vieram (texto solto, apagado, de outra empresa) pode ser um nome: sai.
    pecas: doc.pecas.map((p) => sem({ ...p, nome: trocar(p.nome), descricao: t(p.descricao), responsavel: p.responsavel && cadastros.has(p.responsavel) ? p.responsavel : undefined })),
    // O valor de toda regra: o código de uma opção também é texto que a pessoa escreveu.
    conexoes: doc.conexoes.map((c) => sem({ ...c, rotulo: t(c.rotulo), valor: t(c.valor) })),
    grupos: doc.grupos.map((g) => ({ ...g, nome: trocar(g.nome) })),
    notas: doc.notas.map((n) => ({ ...n, texto: trocar(n.texto) })),
  };
}

/**
 * O retrato do link, montado no servidor (null: o documento não é um journey/2 válido, e o link não abre).
 * Com "esconder nomes", cada cadastro do tipo Pessoa vira "Pessoa N" (sem os campos) e o nome de toda Pessoa da
 * empresa (`pessoas`; quem não está no documento vira só "Pessoa") sai de todo texto livre: do documento, dos outros
 * cadastros, dos nomes dos canais, do nome e da descrição do fluxo, do nome da versão e do cenário e das notas dos
 * intencionais. Nada de quem foi escondido vai pro navegador, nem a lista das pessoas (os limites estão em "Nomes").
 */
export function montarRetrato(l: LinkDoBanco): Retrato | null {
  const lido = lerDocumento(l.documento);
  if (!lido.documento) return null;
  let documento = lido.documento;
  let cadastros = l.cadastros.map((k) => ({ id: k.id, tipo: k.tipo, nome: k.nome, campos: k.campos ?? {} }));
  let trocar = (t: string) => t;
  if (l.esconder_nomes) {
    const escondidas = pessoasEscondidas(cadastros, documento);
    // Os do documento primeiro: o mesmo nome em `pessoas` fica com o número (o trocador guarda a primeira troca).
    const nomes = new Map(cadastros.flatMap((k) => (escondidas.has(k.id) ? [[k.nome, escondidas.get(k.id)!] as const] : [])));
    for (const nome of l.pessoas ?? []) if (typeof nome === 'string' && !nomes.has(nome)) nomes.set(nome, PESSOA);
    trocar = trocadorDeNomes(nomes);
    documento = semNomes(documento, trocar, new Set(cadastros.map((k) => k.id)));
    cadastros = cadastros.map((k) =>
      escondidas.has(k.id) ? { id: k.id, tipo: k.tipo, nome: escondidas.get(k.id)!, campos: {} } : { ...k, nome: trocar(k.nome), campos: trocarEmTudo(k.campos, trocar) as Record<string, unknown> },
    );
  }
  // As chaves dos achados não dependem de nome; o que não é achado deste documento (uma versão fixa antiga) não vai.
  const chaves = new Set(diagnosticar(documento, { cadastros, ...(l.fluxo.meta_s && { meta_s: l.fluxo.meta_s }) }).map((a) => a.chave));
  return {
    empresa: { nome: l.empresa.nome },
    fluxo: { nome: trocar(l.fluxo.nome), canal: l.fluxo.canal, descricao: trocar(l.fluxo.descricao), meta_s: l.fluxo.meta_s },
    versao: l.versao && { numero: l.versao.numero, nome: trocar(l.versao.nome) },
    de: l.versao?.criada_em ?? l.atual?.editado_em ?? '',
    esconderNomes: l.esconder_nomes,
    expiraEm: l.expira_em,
    documento,
    estilo: lerEstilo(l.estilo),
    cadastros,
    canais: l.canais.map(({ chave, nome, cor }) => ({ chave, nome: trocar(nome), cor })),
    intencionais: l.intencionais.filter((i) => chaves.has(i.chave)).map((i) => ({ chave: i.chave, nota: trocar(i.nota) })),
    // Campo a campo: o que mais a cópia guardada tiver não vai.
    cenario: l.cenario && { nome: trocar(l.cenario.nome), inicio: l.cenario.inicio, quando: l.cenario.quando, modo: l.cenario.modo, escolhas: l.cenario.escolhas },
  };
}
