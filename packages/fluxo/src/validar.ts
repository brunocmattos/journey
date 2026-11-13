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
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';
const opcional = (v: unknown): string | undefined => (ehTexto(v) && v.trim() !== '' ? v.trim() : undefined);

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
  for (const lista of LISTAS) if (!Array.isArray(bruto[lista])) erro('forma', `Falta a lista "${lista}".`);
  if (problemas.length) return { documento: null, problemas };

  const ids = (lista: (typeof LISTAS)[number]) => {
    const vistos = new Set<string>();
    for (const item of bruto[lista] as unknown[]) {
      const id = (item as Record<string, unknown> | null)?.id;
      if (!ehTexto(id) || id.trim() === '') { erro('id', `Item sem id em "${lista}".`); continue; }
      if (vistos.has(id)) erro('id_repetido', `O id "${id}" aparece duas vezes em "${lista}".`, id);
      vistos.add(id);
    }
    return vistos;
  };
  const idsPecas = ids('pecas');
  ids('conexoes');
  ids('grupos');
  ids('notas');

  const canais = conhecidos.canais && new Set(conhecidos.canais);
  const cadastros = conhecidos.cadastros && new Set(conhecidos.cadastros);

  const pecas: Peca[] = [];
  for (const item of bruto.pecas as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    const id = item.id;
    if (!(TIPOS_PECA as readonly unknown[]).includes(item.tipo)) { erro('tipo', `A peça "${id}" tem um tipo que não existe.`, id); continue; }
    if (!ehNumero(item.x) || !ehNumero(item.y)) erro('posicao', `A peça "${id}" não tem posição.`, id);
    const p: Peca = { id, tipo: item.tipo as TipoPeca, nome: ehTexto(item.nome) && item.nome.trim() ? item.nome.trim() : '', x: ehNumero(item.x) ? item.x : 0, y: ehNumero(item.y) ? item.y : 0 };
    if (!p.nome) erro('nome', `A peça "${id}" não tem nome.`, id);
    const canal = opcional(item.canal);
    if (canal) { p.canal = canal; if (canais && !canais.has(canal)) aviso('canal', `A peça "${p.nome}" usa o canal "${canal}", que a empresa não tem.`, id); }
    const resp = opcional(item.responsavel);
    if (resp) { p.responsavel = resp; if (cadastros && !cadastros.has(resp)) aviso('responsavel', `A peça "${p.nome}" aponta pra um cadastro que não existe.`, id); }
    if (item.tempo_s !== undefined && item.tempo_s !== null) {
      if (!ehNumero(item.tempo_s) || item.tempo_s < 0) erro('tempo', `O tempo da peça "${p.nome}" tem que ser um número de segundos, zero ou mais.`, id);
      else if (item.tempo_s > 0) p.tempo_s = Math.round(item.tempo_s);
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
    const c: Conexao = { id, de: item.de, para: item.para, regra: regra as Regra };
    const valor = opcional(item.valor);
    if (valor) c.valor = valor;
    const rotulo = opcional(item.rotulo);
    if (rotulo) c.rotulo = rotulo;
    if (c.regra === 'tempo') {
      if (!ehNumero(item.tempo_s) || item.tempo_s < 0) erro('tempo', `A conexão "${id}" é "depois de um tempo" e não diz quanto.`, id);
      else c.tempo_s = Math.round(item.tempo_s);
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
    const g: Grupo = { id: item.id, nome: ehTexto(item.nome) ? item.nome.trim() : '', ...caixa(item, 'O grupo') };
    const cor = opcional(item.cor);
    if (cor) g.cor = cor;
    grupos.push(g);
  }
  const notas: Nota[] = [];
  for (const item of bruto.notas as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    const n: Nota = { id: item.id, texto: ehTexto(item.texto) ? item.texto : '', ...caixa(item, 'A nota') };
    const cor = opcional(item.cor);
    if (cor) n.cor = cor;
    notas.push(n);
  }

  const temErro = problemas.some((p) => p.gravidade === 'erro');
  return { documento: temErro ? null : { formato: FORMATO, pecas, conexoes, grupos, notas }, problemas };
}
