import { FORMATO, REGRAS, TIPOS_PECA, type Conexao, type Documento, type Grupo, type Nota, type Peca, type Regra, type TipoPeca } from './documento';

export interface Problema {
  gravidade: 'erro' | 'aviso';
  codigo: string;
  mensagem: string;
  /** Id da peça, conexão, grupo ou nota. */
  ref?: string;
}

export interface Leitura {
  /** O documento só com os campos conhecidos; null quando há erro. */
  documento: Documento | null;
  problemas: Problema[];
}

/** O que a validação confere contra a empresa, quando quem chama sabe: canais e cadastros que existem. */
export interface Conhecidos {
  canais?: readonly string[];
  cadastros?: readonly string[];
}

const LISTAS = ['pecas', 'conexoes', 'grupos', 'notas'] as const;
/**
 * Limites do documento. O spec mira 500 peças; os limites deixam folga e protegem o motor e o diagnóstico
 * (e o banco) de um documento que só serve pra travar.
 */
export const LIMITES = { pecas: 2000, conexoes: 6000, grupos: 500, notas: 500, texto: 5000, tempo_s: 365 * 86400, bytes: 6_000_000 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';
/** Texto opcional: aparado, e número vira texto (um importador pode escrever a opção 1 como número). */
const opcional = (v: unknown): string | undefined => {
  const t = ehNumero(v) ? String(v) : ehTexto(v) ? v.trim() : '';
  return t === '' ? undefined : t;
};

/**
 * Lê um documento journey/2 vindo de fora (editor, banco, arquivo) sem confiar nele: confere a forma, os ids,
 * as referências e as regras, e devolve uma cópia só com os campos conhecidos.
 * Erro impede o uso; aviso (canal ou cadastro que a empresa não tem) não.
 */
export function lerDocumento(entrada: unknown, conhecidos: Conhecidos = {}): Leitura {
  const problemas: Problema[] = [];
  const erro = (codigo: string, mensagem: string, ref?: string) => problemas.push({ gravidade: 'erro', codigo, mensagem, ...(ref && { ref }) });
  const aviso = (codigo: string, mensagem: string, ref?: string) => problemas.push({ gravidade: 'aviso', codigo, mensagem, ...(ref && { ref }) });

  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    erro('forma', 'O documento não é um objeto.');
    return { documento: null, problemas };
  }
  const bruto = entrada as Record<string, unknown>;
  if (bruto.formato !== FORMATO) erro('formato', `O formato tem que ser "${FORMATO}".`);
  for (const lista of LISTAS) {
    const v = bruto[lista];
    if (!Array.isArray(v)) erro('forma', `Falta a lista "${lista}".`);
    else if (v.length > LIMITES[lista]) erro('tamanho', `"${lista}" passa do limite de ${LIMITES[lista]}.`);
  }
  if (!problemas.length && new TextEncoder().encode(JSON.stringify(entrada)).length > LIMITES.bytes) {
    erro('tamanho', `O documento passa de ${LIMITES.bytes / 1_000_000} MB.`);
  }
  if (problemas.length) return { documento: null, problemas };

  // Um id só aparece uma vez no documento inteiro: o editor aponta pra peça, conexão, grupo ou nota pelo id.
  const todos = new Set<string>();
  const ids = (lista: (typeof LISTAS)[number]) => {
    const daLista = new Set<string>();
    (bruto[lista] as unknown[]).forEach((item, i) => {
      const id = (item as Record<string, unknown> | null)?.id;
      if (!ehTexto(id) || id.trim() === '') { erro('id', `O item ${i + 1} de "${lista}" não tem id.`); return; }
      if (todos.has(id)) erro('id_repetido', `O id "${id}" aparece duas vezes no documento.`, id);
      todos.add(id);
      daLista.add(id);
    });
    return daLista;
  };
  const idsPecas = ids('pecas');
  ids('conexoes');
  ids('grupos');
  ids('notas');
  const longo = (v: unknown, ref: string) => {
    if (ehTexto(v) && v.length > LIMITES.texto) { erro('tamanho', `Um texto de "${ref}" passa de ${LIMITES.texto} caracteres.`, ref); return true; }
    return false;
  };
  const tempo = (v: unknown) => ehNumero(v) && v >= 0 && v <= LIMITES.tempo_s;

  const canais = conhecidos.canais && new Set(conhecidos.canais);
  const cadastros = conhecidos.cadastros && new Set(conhecidos.cadastros);

  const pecas: Peca[] = [];
  for (const item of bruto.pecas as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    const id = item.id;
    if (!(TIPOS_PECA as readonly unknown[]).includes(item.tipo)) { erro('tipo', `A peça "${id}" tem um tipo que não existe.`, id); continue; }
    if (!ehNumero(item.x) || !ehNumero(item.y)) erro('posicao', `A peça "${id}" não tem posição.`, id);
    for (const v of [item.nome, item.descricao, item.canal, item.responsavel, item.cor]) if (longo(v, id)) break;
    const p: Peca = { id, tipo: item.tipo as TipoPeca, nome: ehTexto(item.nome) && item.nome.trim() ? item.nome.trim() : '', x: ehNumero(item.x) ? item.x : 0, y: ehNumero(item.y) ? item.y : 0 };
    if (!p.nome) erro('nome', `A peça "${id}" não tem nome.`, id);
    const nome = p.nome || id;
    const canal = opcional(item.canal);
    if (canal) { p.canal = canal; if (canais && !canais.has(canal)) aviso('canal', `A peça "${nome}" usa o canal "${canal}", que a empresa não tem.`, id); }
    // Id de cadastro do banco é uuid em minúsculas: o mesmo id em maiúsculas é o mesmo cadastro.
    const resp = opcional(item.responsavel)?.replace(UUID, (u) => u.toLowerCase());
    if (resp) { p.responsavel = resp; if (cadastros && !cadastros.has(resp)) aviso('responsavel', `A peça "${nome}" aponta pra um cadastro que não existe.`, id); }
    if (item.tempo_s !== undefined && item.tempo_s !== null) {
      if (!tempo(item.tempo_s)) erro('tempo', `O tempo da peça "${nome}" tem que ser um número de segundos, de zero a um ano.`, id);
      else if (Math.round(item.tempo_s as number) > 0) p.tempo_s = Math.round(item.tempo_s as number);
    }
    const descricao = opcional(item.descricao);
    if (descricao) p.descricao = descricao;
    const cor = opcional(item.cor);
    if (cor) p.cor = cor;
    pecas.push(p);
  }

  const conexoes: Conexao[] = [];
  for (const item of bruto.conexoes as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    const id = item.id;
    if (!ehTexto(item.de) || !idsPecas.has(item.de)) { erro('de', `A conexão "${id}" sai de uma peça que não existe.`, id); continue; }
    if (!ehTexto(item.para) || !idsPecas.has(item.para)) { erro('para', `A conexão "${id}" chega numa peça que não existe.`, id); continue; }
    const regra = item.regra === undefined ? 'sempre' : item.regra;
    if (!(REGRAS as readonly unknown[]).includes(regra)) { erro('regra', `A conexão "${id}" tem uma regra que não existe.`, id); continue; }
    for (const v of [item.valor, item.rotulo]) if (longo(v, id)) break;
    const c: Conexao = { id, de: item.de, para: item.para, regra: regra as Regra };
    const valor = opcional(item.valor);
    if (valor) c.valor = valor;
    const rotulo = opcional(item.rotulo);
    if (rotulo) c.rotulo = rotulo;
    if (c.regra === 'tempo') {
      if (!tempo(item.tempo_s)) erro('tempo', `A conexão "${id}" é "depois de um tempo" e não diz quanto (de zero a um ano).`, id);
      else c.tempo_s = Math.round(item.tempo_s as number);
    }
    if (c.regra === 'horario') {
      if (item.horario !== 'dentro' && item.horario !== 'fora') erro('horario', `A conexão "${id}" é de horário e não diz se é dentro ou fora.`, id);
      else c.horario = item.horario;
    }
    conexoes.push(c);
  }

  const caixa = (item: Record<string, unknown>, tipo: string) => {
    const ok = ehNumero(item.x) && ehNumero(item.y) && ehNumero(item.w) && ehNumero(item.h) && item.w > 0 && item.h > 0;
    if (!ok) erro('posicao', `${tipo} "${String(item.id)}" não tem posição e tamanho.`, String(item.id));
    return ok ? { x: item.x as number, y: item.y as number, w: item.w as number, h: item.h as number } : { x: 0, y: 0, w: 1, h: 1 };
  };
  const grupos: Grupo[] = [];
  for (const item of bruto.grupos as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    longo(item.nome, item.id);
    const g: Grupo = { id: item.id, nome: ehTexto(item.nome) ? item.nome.trim() : '', ...caixa(item, 'O grupo') };
    const cor = opcional(item.cor);
    if (cor) g.cor = cor;
    grupos.push(g);
  }
  const notas: Nota[] = [];
  for (const item of bruto.notas as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    longo(item.texto, item.id);
    const n: Nota = { id: item.id, texto: ehTexto(item.texto) ? item.texto : '', ...caixa(item, 'A nota') };
    const cor = opcional(item.cor);
    if (cor) n.cor = cor;
    notas.push(n);
  }

  const temErro = problemas.some((p) => p.gravidade === 'erro');
  return { documento: temErro ? null : { formato: FORMATO, pecas, conexoes, grupos, notas }, problemas };
}
