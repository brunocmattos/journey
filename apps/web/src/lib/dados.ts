import 'server-only';
import { notFound, redirect } from 'next/navigation';
import type { Achado, Documento, Evento } from '@journey/nucleo';
import type { Revisao } from '@/importacao/revisao';
import type { Modo } from '@/simulacao/sessao';
import { supabaseServidor } from './supabase/servidor';

/** Leituras do banco pelo servidor, com a sessão de quem está logado: a regra de acesso (RLS) vale em todas. */

export async function usuarioAtual() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/entrar');
  return { supabase, usuario: data.user };
}

/** Lista do banco; o erro vira exceção (a tela de erro do Next mostra). */
function ok<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}

/** Uma linha ou nada. */
function talvez<T>(r: { data: T | null; error: { message: string } | null }): T | null {
  if (r.error) throw new Error(r.error.message);
  return r.data;
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
  const e = talvez(await supabase.from('empresas').select('id, nome').eq('id', id).maybeSingle());
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

export async function jornadas(empresaId: string): Promise<JornadaResumo[]> {
  const { supabase } = await usuarioAtual();
  const js = ok(await supabase.from('jornadas').select('id, nome, canal').eq('empresa_id', empresaId).order('nome'));
  const vs = ok(
    await supabase.from('jornada_versoes').select('jornada_id, numero, criada_em, diagnostico').eq('empresa_id', empresaId).order('numero', { ascending: false }),
  );
  return js.map((j) => {
    const v = vs.find((x) => x.jornada_id === j.id);
    return {
      ...j,
      versao: v?.numero ?? null,
      atualizada: v?.criada_em ?? null,
      graves: v ? (v.diagnostico as Achado[]).filter((a) => a.gravidade === 'grave').length : 0,
    };
  });
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
  const j = talvez(await supabase.from('jornadas').select('id, nome, canal').eq('empresa_id', empresaId).eq('id', jornadaId).maybeSingle());
  if (!j) notFound();
  const v = talvez<{ numero: number; criada_em: string; documento: unknown; diagnostico: unknown }>(
    await supabase.from('jornada_versoes').select('numero, criada_em, documento, diagnostico').eq('jornada_id', jornadaId).order('numero', { ascending: false }).limit(1).maybeSingle(),
  );
  if (!v) notFound();
  return { jornada: j, numero: v.numero, criada_em: v.criada_em, documento: v.documento as Documento, diagnostico: v.diagnostico as Achado[] };
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
}

export async function intencionais(jornadaId: string): Promise<Intencional[]> {
  const { supabase } = await usuarioAtual();
  return ok(await supabase.from('achados_intencionais').select('chave, nota, criado_em').eq('jornada_id', jornadaId));
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
  const i = talvez(await supabase.from('imports').select('id, status, parcial, arquivos, relatorio, criado_em').eq('empresa_id', empresaId).eq('id', id).maybeSingle());
  if (!i) notFound();
  return i as ImportRevisao;
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

export async function catalogo(empresaId: string, aba: string): Promise<ItemCatalogo[]> {
  const { supabase } = await usuarioAtual();
  return ok(await supabase.from('catalogo').select('aba, item_id, nome, dados').eq('empresa_id', empresaId).eq('aba', aba).order('item_id'));
}

export async function contagemCatalogo(empresaId: string): Promise<Record<string, number>> {
  const { supabase } = await usuarioAtual();
  const linhas = ok(await supabase.from('catalogo').select('aba').eq('empresa_id', empresaId));
  const c: Record<string, number> = {};
  for (const l of linhas) c[l.aba] = (c[l.aba] ?? 0) + 1;
  return c;
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
