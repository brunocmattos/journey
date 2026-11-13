import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { Achado, Documento, Evento } from '@journey/nucleo';
import type { Revisao } from '@/importacao/revisao';
import type { Modo } from '@/simulacao/sessao';
import { supabaseServidor } from './supabase/servidor';

/** Leituras do banco pelo servidor, com a sessão de quem está logado: a regra de acesso (RLS) vale em todas. */

/** Uma ida ao Auth por pedido: o layout e a página chamam, o cache do React junta as duas. */
export const usuarioAtual = cache(async () => {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/entrar');
  return { supabase, usuario: data.user };
});

type ErroBanco = { code?: string; message: string } | null;

/** O erro vira exceção (a tela de erro do Next mostra). Id da URL que não é uuid (22P02) é página que não existe. */
function falhou(erro: ErroBanco): void {
  if (!erro) return;
  if (erro.code === '22P02') notFound();
  throw new Error(erro.message);
}

/** Lista do banco. */
function ok<T>(r: { data: T[] | null; error: ErroBanco }): T[] {
  falhou(r.error);
  return r.data ?? [];
}

/** Uma linha ou nada. */
function talvez<T>(r: { data: T | null; error: ErroBanco }): T | null {
  falhou(r.error);
  return r.data;
}

const LISTAS_DO_DOCUMENTO = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos', 'pecas', 'saidas'] as const;

/** A forma de um documento journey/1 (o banco já recusa outra; aqui é a segunda trava, antes da tela). */
function ehDocumento(v: unknown): v is Documento {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return d.formato === 'journey/1' && LISTAS_DO_DOCUMENTO.every((k) => Array.isArray(d[k]));
}

export interface EmpresaResumo {
  id: string;
  nome: string;
}

export async function empresasDoUsuario(): Promise<EmpresaResumo[]> {
  const { supabase } = await usuarioAtual();
  return ok(await supabase.from('empresas').select('id, nome').order('criada_em'));
}

export async function empresa(id: string): Promise<EmpresaResumo> {
  const { supabase } = await usuarioAtual();
  const e = talvez<EmpresaResumo>(await supabase.from('empresas').select('id, nome').eq('id', id).maybeSingle());
  if (!e) notFound();
  return e;
}

export interface JornadaResumo {
  id: string;
  nome: string;
  canal: string;
  versao: number | null;
  atualizada: string | null;
  graves: number;
}

/** Da view jornadas_resumo: só a última versão de cada jornada, com os graves contados no banco. */
export async function jornadas(empresaId: string): Promise<JornadaResumo[]> {
  const { supabase } = await usuarioAtual();
  const linhas = ok<{ id: string; nome: string; canal: string; numero: number | null; criada_em: string | null; graves: number }>(
    await supabase.from('jornadas_resumo').select('id, nome, canal, numero, criada_em, graves').eq('empresa_id', empresaId).order('nome'),
  );
  return linhas.map((l) => ({ id: l.id, nome: l.nome, canal: l.canal, versao: l.numero, atualizada: l.criada_em, graves: l.graves }));
}

export interface VersaoJornada {
  jornada: { id: string; nome: string; canal: string };
  numero: number;
  criada_em: string;
  documento: Documento;
  diagnostico: Achado[];
}

export async function versaoAtual(empresaId: string, jornadaId: string): Promise<VersaoJornada> {
  const { supabase } = await usuarioAtual();
  const j = talvez<VersaoJornada['jornada']>(await supabase.from('jornadas').select('id, nome, canal').eq('empresa_id', empresaId).eq('id', jornadaId).maybeSingle());
  if (!j) notFound();
  const v = talvez<{ numero: number; criada_em: string; documento: unknown; diagnostico: unknown }>(
    await supabase.from('jornada_versoes').select('numero, criada_em, documento, diagnostico').eq('jornada_id', jornadaId).order('numero', { ascending: false }).limit(1).maybeSingle(),
  );
  if (!v) notFound();
  if (!ehDocumento(v.documento)) throw new Error(`a versão ${v.numero} de "${j.nome}" não é um documento journey/1`);
  return { jornada: j, numero: v.numero, criada_em: v.criada_em, documento: v.documento, diagnostico: v.diagnostico as Achado[] };
}

export interface Cenario {
  id: string;
  nome: string;
  entrada: string;
  inicio: string;
  modo: Modo;
  escolhas: string[];
  esperado: Evento[];
  versao_aprovada: number;
}

export async function cenarios(jornadaId: string): Promise<Cenario[]> {
  const { supabase } = await usuarioAtual();
  return ok<Cenario>(await supabase.from('cenarios').select('id, nome, entrada, inicio, modo, escolhas, esperado, versao_aprovada').eq('jornada_id', jornadaId).order('nome'));
}

export interface Intencional {
  chave: string;
  nota: string;
  criado_em: string;
  /** E-mail de quem marcou; null se a pessoa não é mais membro da empresa (ou foi apagada). */
  autor: string | null;
}

/** As marcações da jornada, com o e-mail de quem marcou (pelos membros da mesma empresa). */
export async function intencionais(empresaId: string, jornadaId: string): Promise<Intencional[]> {
  const { supabase } = await usuarioAtual();
  const linhas = ok<{ chave: string; nota: string; criado_em: string; autor: string | null }>(
    await supabase.from('achados_intencionais').select('chave, nota, criado_em, autor').eq('empresa_id', empresaId).eq('jornada_id', jornadaId),
  );
  const ids = [...new Set(linhas.flatMap((l) => (l.autor ? [l.autor] : [])))];
  const emails = new Map<string, string>();
  if (ids.length > 0) {
    const ms = ok<{ usuario_id: string; email: string }>(await supabase.from('membros').select('usuario_id, email').eq('empresa_id', empresaId).in('usuario_id', ids));
    for (const m of ms) emails.set(m.usuario_id, m.email);
  }
  return linhas.map((l) => ({ chave: l.chave, nota: l.nota, criado_em: l.criado_em, autor: (l.autor && emails.get(l.autor)) ?? null }));
}

export interface ImportRevisao {
  id: string;
  status: 'revisao' | 'confirmado' | 'descartado';
  parcial: boolean;
  arquivos: { nome: string; tamanho: number }[];
  relatorio: Revisao;
  criado_em: string;
}

export async function importDaEmpresa(empresaId: string, id: string): Promise<ImportRevisao> {
  const { supabase } = await usuarioAtual();
  const i = talvez<ImportRevisao>(await supabase.from('imports').select('id, status, parcial, arquivos, relatorio, criado_em').eq('empresa_id', empresaId).eq('id', id).maybeSingle());
  if (!i) notFound();
  return i;
}

export async function importsRecentes(empresaId: string) {
  const { supabase } = await usuarioAtual();
  return ok(await supabase.from('imports').select('id, status, parcial, arquivos, criado_em').eq('empresa_id', empresaId).order('criado_em', { ascending: false }).limit(10)) as Omit<
    ImportRevisao,
    'relatorio'
  >[];
}

export interface ItemCatalogo {
  aba: string;
  item_id: string;
  nome: string | null;
  dados: Record<string, unknown>;
}

/** O PostgREST devolve no máximo 1000 linhas por pedido (max_rows): o que pode passar disso vem em páginas. */
const PAGINA = 1000;

/** A aba inteira, em páginas (a busca da tela filtra sobre tudo). */
export async function catalogo(empresaId: string, aba: string): Promise<ItemCatalogo[]> {
  const { supabase } = await usuarioAtual();
  const todos: ItemCatalogo[] = [];
  for (let de = 0; ; de += PAGINA) {
    const pagina = ok<ItemCatalogo>(
      await supabase.from('catalogo').select('aba, item_id, nome, dados').eq('empresa_id', empresaId).eq('aba', aba).order('item_id').range(de, de + PAGINA - 1),
    );
    todos.push(...pagina);
    if (pagina.length < PAGINA) return todos;
  }
}

const ABAS_DO_CATALOGO = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos'] as const;

/** Quantos itens por aba, contados no banco (contar as linhas devolvidas pararia em 1000). */
export async function contagemCatalogo(empresaId: string): Promise<Record<string, number>> {
  const { supabase } = await usuarioAtual();
  const pares = await Promise.all(
    ABAS_DO_CATALOGO.map(async (aba) => {
      const r = await supabase.from('catalogo').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('aba', aba);
      falhou(r.error);
      return [aba, r.count ?? 0] as const;
    }),
  );
  return Object.fromEntries(pares);
}

export interface Uso {
  tipo: 'catalogo' | 'jornada';
  aba: string | null;
  item_id: string;
  nome: string | null;
  campos: string[] | null;
}

export async function ondeUsado(empresaId: string, ref: string): Promise<Uso[]> {
  const { supabase } = await usuarioAtual();
  return ok<Uso>(await supabase.rpc('onde_usado', { p_empresa: empresaId, p_ref: ref }));
}

export async function membros(empresaId: string) {
  const { supabase } = await usuarioAtual();
  const m = ok(await supabase.from('membros').select('usuario_id, email, entrou_em').eq('empresa_id', empresaId).order('entrou_em'));
  const c = ok(await supabase.from('convites').select('email, criado_em').eq('empresa_id', empresaId).order('criado_em'));
  return { membros: m, convites: c };
}
