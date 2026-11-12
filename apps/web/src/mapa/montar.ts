import { indexar, lerRef, nomeDe, existe, type Canal, type Documento, type Indice, type TipoPeca } from '@journey/nucleo';

/**
 * O mapa de uma jornada: o grafo do documento desenhado como árvore, da esquerda pra direita.
 * Cada ponto aparece uma vez; quando um caminho chega de novo num ponto já desenhado, entra um atalho
 * ("segue em" ou, se o ponto está no próprio caminho, "volta pra").
 * Não conhece React: devolve posições (centro de cada nó) e canos.
 */

export type TipoNo = 'entrada' | 'ramais_diretos' | 'peca' | 'fila' | 'grupo' | 'ramal' | 'fim' | 'externo' | 'inexistente' | 'atalho';

export interface NoMapa {
  /**
   * Único no mapa e estável: pontos usam a própria referência; atalhos e cópias de pontas, o id do cano que chega neles
   * (`atalho:<cano>`, `<ref>@<cano>`); entradas agrupadas, o destino (`entradas>…`, `entradas-inativas>…`).
   */
  id: string;
  tipo: TipoNo;
  /** A referência que o nó representa. Atalho: a do destino. Entradas agrupadas: a primeira entrada. */
  ref: string;
  titulo: string;
  subtitulo?: string;
  /** Selo acima do nó: o id na central. */
  selo?: string;
  tipoPeca?: TipoPeca;
  /** Válvula: o nó tem mais de um cano saindo. */
  decisao: boolean;
  inativo: boolean;
  canal?: Canal;
  /** Centro do nó e tamanho. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Atalho: o nó de destino e se é volta (o destino está no caminho até aqui). */
  atalho?: { alvo: string; volta: boolean };
  /** Entradas que o nó junta (entrada e ramais diretos). */
  entradas?: string[];
}

export type TipoCano = 'normal' | 'retorno' | 'inativo' | 'sem_saida';

export interface CanoMapa {
  id: string;
  de: string;
  /** Nó de destino. null: a peça não tem saída (cano quebrado). */
  para: string | null;
  /** Texto do chip no cano. */
  rotulo: string;
  /** As opções que passam por este cano ('1', 'esgotou', 'nao_atende'…). */
  opcoes: string[];
  /** Ids das saídas (aba saidas) que passam por este cano. Vazio quando o cano não vem de uma peça. */
  saidas: string[];
  tipo: TipoCano;
  /** O motor anda por este cano (algum ramo dele é simulável). Falso: só aparece no mapa (ex.: "nunca: sem espera máxima"). */
  simulavel: boolean;
}

export interface FaixaMapa {
  titulo: string;
  subtitulo?: string;
  /** Quantas faixas há em volta desta (0: nenhuma). A de fora sempre envolve a de dentro com folga. */
  nivel: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Mapa {
  nos: NoMapa[];
  canos: CanoMapa[];
  faixas: FaixaMapa[];
  /** Pra cada referência, os nós que a mostram: o ponto e os atalhos pra ele. */
  porRef: Map<string, string[]>;
  /** Canos por id da saída. */
  porSaida: Map<string, string>;
  limites: { x1: number; y1: number; x2: number; y2: number };
}

export interface OpcoesMapa {
  /** Por onde começar. Padrão: as entradas, juntando as que vão pro mesmo destino; as que vão direto pra um ramal viram um nó "ramais diretos". */
  raizes?: string[];
}

export const COLUNA = 300;
export const VAO = 26;
export const FOLGA_FAIXA = 90;
export const VAO_RAIZ = 60;
/** Folga entre a borda de uma faixa e a de outra faixa dentro dela. */
export const FOLGA_ANINHADA = 16;

export const TAMANHOS: Record<TipoNo, { w: number; h: number }> = {
  entrada: { w: 68, h: 68 },
  ramais_diretos: { w: 68, h: 68 },
  atalho: { w: 44, h: 44 },
  fim: { w: 204, h: 54 },
  fila: { w: 204, h: 70 },
  ramal: { w: 204, h: 60 },
  grupo: { w: 204, h: 62 },
  peca: { w: 204, h: 62 },
  externo: { w: 204, h: 54 },
  inexistente: { w: 204, h: 62 },
};

/** Saída de um ponto, antes de agrupar por destino. */
export interface Ramo {
  para: string;
  opcao: string;
  rotulo: string;
  saida?: string;
  inativo: boolean;
  /** O motor anda por este ramo (pesquisa, ocupado e indisponível só aparecem no mapa). */
  simulavel: boolean;
}

const ROTULOS_OPCAO: Record<string, string> = { esgotou: 'nada', sim: 'sim', nao: 'não', sempre: '' };

/**
 * Pra onde cada ponto leva, na ordem do arquivo, com o rótulo do chip.
 * Segue o motor: fila com espera máxima, grupo e ramal sem transbordo desligam quando ninguém atende.
 */
export function ramos(idx: Indice, ref: string): Ramo[] {
  const r = lerRef(ref);
  if (!r) return [];
  const ramo = (para: string, opcao: string, rotulo: string, simulavel = true): Ramo => ({ para, opcao, rotulo, inativo: false, simulavel });
  const semTransbordo = (destino: string | undefined, rotulo: string) =>
    destino === undefined ? ramo('fim:desliga', 'nao_atende', `${rotulo} (sem transbordo)`) : ramo(destino, 'nao_atende', rotulo);
  switch (r.tipo) {
    case 'entrada': {
      const e = idx.entradas.get(r.id);
      return e ? [{ ...ramo(e.destino, 'sempre', ''), inativo: !e.ativo }] : [];
    }
    case 'peca':
      return (idx.saidasDe.get(r.id) ?? []).map((s) => ({
        para: s.para,
        opcao: s.opcao,
        rotulo: ROTULOS_OPCAO[s.opcao] ?? s.rotulo ?? s.opcao,
        saida: s.id,
        inativo: !s.ativo,
        simulavel: true,
      }));
    case 'fila': {
      const f = idx.filas.get(r.id);
      if (!f) return [];
      const lista: Ramo[] = [];
      if (f.espera_maxima_s !== undefined) lista.push(semTransbordo(f.ao_esgotar, 'ninguém atende'));
      else if (f.ao_esgotar) lista.push(ramo(f.ao_esgotar, 'nao_atende', 'nunca: sem espera máxima', false));
      if (f.pesquisa_ao_desligar) lista.push(ramo(f.pesquisa_ao_desligar, 'pesquisa', 'ao desligar', false));
      return lista;
    }
    case 'grupo': {
      const g = idx.grupos.get(r.id);
      return g ? [semTransbordo(g.ao_esgotar, 'ninguém atende')] : [];
    }
    case 'ramal': {
      const x = idx.ramais.get(r.id);
      if (!x) return [];
      return [
        semTransbordo(x.ao_nao_atender, 'não atende'),
        ...(x.ao_ocupado ? [ramo(x.ao_ocupado, 'ocupado', 'ocupado', false)] : []),
        ...(x.ao_indisponivel ? [ramo(x.ao_indisponivel, 'indisponivel', 'indisponível', false)] : []),
      ];
    }
    default:
      return [];
  }
}

/** Pontas (fim, externo, inexistente) se repetem em cada lugar onde aparecem, em vez de virar atalho. */
const ehPonta = (t: TipoNo) => t === 'fim' || t === 'externo' || t === 'inexistente';

function tipoDoNo(idx: Indice, ref: string): TipoNo {
  if (ref.startsWith('fim:')) return 'fim';
  if (ref.startsWith('externo:')) return 'externo';
  if (!existe(idx, ref)) return 'inexistente';
  const t = lerRef(ref)!.tipo;
  if (t === 'peca' || t === 'fila' || t === 'grupo' || t === 'ramal' || t === 'entrada') return t;
  return 'inexistente';
}

function segundos(s: number | undefined): string | undefined {
  return s === undefined ? undefined : `${s} s`;
}

function descreverNo(idx: Indice, ref: string, tipo: TipoNo): Pick<NoMapa, 'titulo' | 'subtitulo' | 'selo' | 'tipoPeca' | 'inativo' | 'canal'> {
  const r = lerRef(ref);
  const id = r?.id ?? ref;
  switch (tipo) {
    case 'peca': {
      const p = idx.pecas.get(id)!;
      return { titulo: p.nome ?? p.id, subtitulo: rotuloTipoPeca(p.tipo), selo: p.id_central ?? p.id, tipoPeca: p.tipo, inativo: !p.ativo, ...(p.canal && { canal: p.canal }) };
    }
    case 'fila': {
      const f = idx.filas.get(id)!;
      const espera = f.espera_maxima_s === undefined ? 'sem limite de espera' : `espera até ${f.espera_maxima_s} s`;
      return { titulo: f.nome ?? `Fila ${id}`, subtitulo: espera, selo: `fila ${id}`, inativo: false };
    }
    case 'grupo': {
      const g = idx.grupos.get(id)!;
      return { titulo: g.nome ?? `Grupo ${id}`, subtitulo: [segundos(g.toque_s), g.estrategia].filter(Boolean).join(' · '), selo: `grupo ${id}`, inativo: false };
    }
    case 'ramal': {
      const x = idx.ramais.get(id)!;
      return { titulo: x.nome ?? `Ramal ${id}`, subtitulo: [`ramal ${id}`, segundos(x.toque_s)].filter(Boolean).join(' · '), selo: `ramal ${id}`, inativo: false };
    }
    case 'fim':
    case 'externo':
      return { titulo: primeiraMaiuscula(nomeDe(idx, ref)), inativo: false };
    case 'inexistente':
      return { titulo: ref, subtitulo: 'não existe no catálogo', selo: id, inativo: false };
    case 'entrada':
      return { titulo: nomeDe(idx, ref), inativo: idx.entradas.get(id)?.ativo === false };
    default:
      return { titulo: nomeDe(idx, ref), inativo: false };
  }
}

const primeiraMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function rotuloTipoPeca(t: TipoPeca): string {
  const rotulos: Record<TipoPeca, string> = {
    audio: 'áudio',
    menu: 'menu',
    regra_horario: 'regra de horário',
    regra_feriado: 'regra de feriado',
    consulta: 'consulta ao sistema',
    transferencia: 'transferência',
    atalho: 'atalho',
    pesquisa: 'pesquisa',
    fim: 'fim',
  };
  return rotulos[t];
}

/** "8 números" ou o nome da entrada; o subtítulo lista os primeiros números. */
function descreverEntradas(idx: Indice, refs: string[]): { titulo: string; subtitulo: string } {
  const es = refs.map((r) => idx.entradas.get(lerRef(r)!.id)!);
  const nomes = new Set(es.map((e) => e.nome ?? e.numero));
  const titulo = es.length === 1 ? (es[0]!.nome ?? es[0]!.numero) : nomes.size === 1 ? `${[...nomes][0]} (${es.length})` : `${es.length} números`;
  const numeros = es.slice(0, 3).map((e) => e.numero);
  return { titulo, subtitulo: numeros.join(', ') + (es.length > 3 ? ` e mais ${es.length - 3}` : '') };
}

interface RaizPadrao {
  id: string;
  tipo: 'entrada' | 'ramais_diretos';
  entradas: string[];
  destino?: string;
  inativo: boolean;
}

/**
 * Raízes padrão: entradas juntas por destino e por ativo, na ordem do arquivo (a inativa não se esconde no meio das ativas);
 * as que vão direto pra ramal num nó só.
 */
function raizesPadrao(idx: Indice): RaizPadrao[] {
  const grupos = new Map<string, { destino: string; ativo: boolean; entradas: string[] }>();
  const diretos: string[] = [];
  let diretosAtivos = false;
  for (const e of idx.doc.entradas) {
    const ref = `entrada:${e.id}`;
    if (lerRef(e.destino)?.tipo === 'ramal') {
      diretos.push(ref);
      diretosAtivos ||= e.ativo;
      continue;
    }
    const chave = `${e.ativo ? '+' : '-'}${e.destino}`;
    const g = grupos.get(chave) ?? { destino: e.destino, ativo: e.ativo, entradas: [] };
    g.entradas.push(ref);
    grupos.set(chave, g);
  }
  const raizes: RaizPadrao[] = [...grupos.values()].map(({ destino, ativo, entradas }) => ({
    id: entradas.length === 1 ? entradas[0]! : `${ativo ? 'entradas' : 'entradas-inativas'}>${destino}`,
    tipo: 'entrada',
    entradas,
    destino,
    inativo: !ativo,
  }));
  if (diretos.length > 0) raizes.push({ id: 'ramais-diretos', tipo: 'ramais_diretos', entradas: diretos, inativo: !diretosAtivos });
  return raizes;
}

interface Rascunho extends NoMapa {
  filhos: string[];
  /** Faixa que começa neste nó (filho de uma regra de horário ou feriado). */
  faixa?: { titulo: string; subtitulo?: string };
  maxX: number;
}

export function montarMapa(doc: Documento, opcoes: OpcoesMapa = {}): Mapa {
  const idx = indexar(doc);
  const nos = new Map<string, Rascunho>();
  const canos: CanoMapa[] = [];
  const porRef = new Map<string, string[]>();

  const registrar = (n: Rascunho) => {
    // Os ids são a chave das posições salvas: colisão é defeito, nunca sobrescrever calado.
    if (nos.has(n.id)) throw new Error(`id de nó repetido no mapa: ${n.id}`);
    nos.set(n.id, n);
    porRef.set(n.ref, [...(porRef.get(n.ref) ?? []), n.id]);
  };

  const novoNo = (id: string, ref: string, tipo: TipoNo, extra: Partial<Rascunho> = {}): Rascunho => ({
    id,
    ref,
    tipo,
    ...descreverNo(idx, ref, tipo),
    decisao: false,
    x: 0,
    y: 0,
    ...TAMANHOS[tipo],
    filhos: [],
    maxX: 0,
    ...extra,
  });

  // Árvore: cada ponto entra uma vez; a segunda chegada vira atalho.
  const caminho: string[] = [];

  /**
   * O nó onde o cano `canoId` chega. Ponto novo usa a referência; se já está no mapa, ponta vira cópia e o resto vira atalho.
   * O id da cópia e do atalho vem do cano (único, um destino só): não muda quando outro ramo entra antes.
   */
  const alvoDe = (para: string, canoId: string): { alvo: Rascunho; volta: boolean } => {
    const tipo = tipoDoNo(idx, para);
    const original = nos.get(para);
    let alvo: Rascunho;
    let volta = false;
    if (original && ehPonta(tipo)) alvo = novoNo(`${para}@${canoId}`, para, tipo);
    else if (original) {
      volta = caminho.includes(para);
      alvo = novoNo(`atalho:${canoId}`, para, 'atalho', { titulo: original.titulo, atalho: { alvo: original.id, volta } });
    } else alvo = novoNo(para, para, tipo);
    registrar(alvo);
    return { alvo, volta };
  };
  const visitar = (no: Rascunho) => {
    caminho.push(no.ref);
    const grupos = new Map<string, Ramo[]>();
    for (const r of ramos(idx, no.ref)) grupos.set(r.para, [...(grupos.get(r.para) ?? []), r]);
    const ehPeca = no.tipo === 'peca';
    if (ehPeca && grupos.size === 0 && no.tipoPeca !== 'fim') {
      canos.push({ id: `${no.id}>sem-saida`, de: no.id, para: null, rotulo: '', opcoes: [], saidas: [], tipo: 'sem_saida', simulavel: false });
    }
    no.decisao = grupos.size > 1;
    for (const [para, rs] of grupos) {
      const canoId = `${no.id}>${rs[0]!.saida ?? rs[0]!.opcao}`;
      const { alvo, volta } = alvoDe(para, canoId);
      no.filhos.push(alvo.id);
      const faixa = faixaDoRamo(idx, no, rs, tipoDoNo(idx, para));
      if (faixa) alvo.faixa = faixa;
      const inativo = rs.some((r) => r.inativo) || (alvo.tipo !== 'atalho' && alvo.inativo);
      canos.push({
        id: canoId,
        de: no.id,
        para: alvo.id,
        rotulo: rotuloDoCano(no, rs),
        opcoes: rs.map((r) => r.opcao),
        saidas: rs.flatMap((r) => (r.saida ? [r.saida] : [])),
        tipo: volta ? 'retorno' : inativo ? 'inativo' : 'normal',
        simulavel: rs.some((r) => r.simulavel),
      });
      if (alvo.tipo !== 'atalho') visitar(alvo);
    }
    caminho.pop();
  };

  const raizes: Rascunho[] = [];
  if (opcoes.raizes) {
    for (const ref of opcoes.raizes) {
      if (nos.has(ref)) continue;
      const n = novoNo(ref, ref, tipoDoNo(idx, ref));
      registrar(n);
      raizes.push(n);
    }
  } else {
    for (const r of raizesPadrao(idx)) {
      const d = descreverEntradas(idx, r.entradas);
      const n = novoNo(r.id, r.entradas[0]!, r.tipo, { ...d, entradas: r.entradas, inativo: r.inativo });
      if (r.tipo === 'ramais_diretos') Object.assign(n, { titulo: 'Ramais diretos', subtitulo: `${r.entradas.length} números` });
      registrar(n);
      for (const e of r.entradas.slice(1)) porRef.set(e, [...(porRef.get(e) ?? []), n.id]);
      raizes.push(n);
    }
  }
  for (const n of raizes) {
    if (n.tipo === 'ramais_diretos') continue;
    if (n.tipo === 'entrada' && n.entradas) {
      // Entradas juntas: o cano sai do nó agrupado pro destino comum.
      const destino = idx.entradas.get(lerRef(n.entradas[0]!)!.id)!.destino;
      const canoId = `${n.id}>sempre`;
      caminho.push(n.ref);
      const { alvo, volta } = alvoDe(destino, canoId);
      n.filhos.push(alvo.id);
      const inativo = n.inativo || (alvo.tipo !== 'atalho' && alvo.inativo);
      canos.push({ id: canoId, de: n.id, para: alvo.id, rotulo: '', opcoes: ['sempre'], saidas: [], tipo: volta ? 'retorno' : inativo ? 'inativo' : 'normal', simulavel: true });
      if (alvo.tipo !== 'atalho') visitar(alvo);
      caminho.pop();
    } else visitar(n);
  }

  const faixas = posicionar(nos, raizes);
  const lista = [...nos.values()].map(({ filhos: _f, faixa: _fx, maxX: _m, ...no }) => no);
  const porSaida = new Map<string, string>();
  for (const c of canos) for (const s of c.saidas) porSaida.set(s, c.id);
  return { nos: lista, canos, faixas, porRef, porSaida, limites: limitesDe(lista, faixas) };
}

function rotuloDoCano(no: NoMapa, rs: Ramo[]): string {
  if (no.tipoPeca === 'menu') return rs.map((r) => (/^[0-9*#]+$/.test(r.opcao) ? r.opcao : ROTULOS_OPCAO[r.opcao] ?? r.rotulo)).join('·');
  return rs.map((r) => r.rotulo).filter(Boolean).join(' / ');
}

/**
 * Filho de uma regra de horário ou feriado que não é outra regra: começa uma faixa (o regime daquele ramo).
 * Se o sim e o não chegam no mesmo ponto, ele vale pros dois regimes: sem faixa.
 */
function faixaDoRamo(idx: Indice, no: NoMapa, rs: Ramo[], tipoAlvo: TipoNo): { titulo: string; subtitulo?: string } | undefined {
  if (no.tipoPeca !== 'regra_horario' && no.tipoPeca !== 'regra_feriado') return undefined;
  if (new Set(rs.map((x) => x.opcao)).size > 1) return undefined;
  const r = rs[0]!;
  const alvo = lerRef(r.para);
  const alvoEhRegra = tipoAlvo === 'peca' && alvo && ['regra_horario', 'regra_feriado'].includes(idx.pecas.get(alvo.id)?.tipo ?? '');
  if (alvoEhRegra) return undefined;
  const p = idx.pecas.get(lerRef(no.ref)!.id)!;
  if (p.tipo === 'regra_feriado') return { titulo: r.opcao === 'sim' ? 'Feriado' : 'Fora de feriado' };
  if (r.opcao !== 'sim') return { titulo: 'Fora do horário' };
  const grupo = p.horario ? lerRef(p.horario)?.id : undefined;
  const janelas = idx.janelas.get(grupo ?? '') ?? [];
  const nome = janelas.find((j) => j.nome)?.nome ?? grupo ?? 'Dentro do horário';
  return { titulo: nome, subtitulo: janelas.map((j) => `${j.dias.join(' ')} ${j.inicio}–${j.fim}`).join(' · ') };
}

/** Árvore da esquerda pra direita: folhas empilhadas, cada pai no meio dos filhos (o algoritmo do protótipo). */
function posicionar(nos: Map<string, Rascunho>, raizes: Rascunho[]): FaixaMapa[] {
  const faixas: FaixaMapa[] = [];
  let cursor = 0;
  let nivel = 0;
  const colocar = (id: string, coluna: number): number => {
    const n = nos.get(id)!;
    n.x = coluna * COLUNA;
    if (n.faixa) cursor += FOLGA_FAIXA;
    const topo = cursor;
    // As faixas saem depois das de dentro (pós-ordem): as que entrarem a partir daqui estão dentro desta.
    const primeiraDentro = faixas.length;
    if (n.faixa) nivel++;
    if (n.filhos.length === 0) {
      n.y = cursor + n.h / 2;
      cursor += n.h + VAO;
      n.maxX = n.x + n.w / 2;
    } else {
      for (const f of n.filhos) colocar(f, coluna + 1);
      const ys = n.filhos.map((f) => nos.get(f)!.y);
      n.y = (ys[0]! + ys[ys.length - 1]!) / 2;
      if (n.y - n.h / 2 < topo) n.y = topo + n.h / 2;
      if (n.y + n.h / 2 + VAO > cursor) cursor = n.y + n.h / 2 + VAO;
      n.maxX = Math.max(n.x + n.w / 2, ...n.filhos.map((f) => nos.get(f)!.maxX));
    }
    if (n.faixa) {
      nivel--;
      const f: FaixaMapa = { ...n.faixa, nivel, x1: n.x - n.w / 2 - 70, x2: n.maxX + 80, y1: topo - FOLGA_FAIXA + 24, y2: cursor - VAO + 26 };
      // A de dentro começa numa coluna e numa linha depois desta; à direita e embaixo pode coincidir: a de fora cresce.
      for (const d of faixas.slice(primeiraDentro)) {
        f.x2 = Math.max(f.x2, d.x2 + FOLGA_ANINHADA);
        f.y2 = Math.max(f.y2, d.y2 + FOLGA_ANINHADA);
      }
      // O que vem depois começa abaixo da faixa, como se ela tivesse acabado no lugar de sempre.
      cursor = Math.max(cursor, f.y2 - 26 + VAO);
      faixas.push(f);
    }
    return n.maxX;
  };
  for (const r of raizes) {
    colocar(r.id, 0);
    cursor += VAO_RAIZ;
  }
  return faixas;
}

function limitesDe(nos: NoMapa[], faixas: FaixaMapa[]): Mapa['limites'] {
  if (nos.length === 0) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const n of nos) {
    x1 = Math.min(x1, n.x - n.w / 2);
    x2 = Math.max(x2, n.x + n.w / 2);
    y1 = Math.min(y1, n.y - n.h / 2);
    y2 = Math.max(y2, n.y + n.h / 2);
  }
  for (const f of faixas) {
    x1 = Math.min(x1, f.x1);
    x2 = Math.max(x2, f.x2);
    y1 = Math.min(y1, f.y1);
    y2 = Math.max(y2, f.y2);
  }
  return { x1, y1, x2, y2 };
}
