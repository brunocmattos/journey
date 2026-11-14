import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { lerDocumento, type Cadastro, type Documento } from '@journey/fluxo';
import type { LinkResumo } from '@/compartilhar/opcoes';
import type { TipoCadastro } from '@/editor/cadastros';
import type { Cenario } from '@/editor/cenarios';
import type { Intencional } from '@/editor/diagnostico';
import type { CanalEditor } from '@/editor/estilo';
import { supabaseServidor } from './supabase/servidor';

/** Leituras do banco pelo servidor, com a sessão de quem está logado: a regra de acesso (RLS) vale em todas. */

/**
 * Uma ida ao Auth por pedido: o layout, a página e a raiz (que mostra a landing sem sessão) chamam, e o cache do React
 * junta todas. Sem sessão, `usuario` é null.
 */
export const sessaoAtual = cache(async () => {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  return { supabase, usuario: data.user };
});

/** A sessão de quem está logado; sem ela, pro entrar. */
export const usuarioAtual = cache(async () => {
  const { supabase, usuario } = await sessaoAtual();
  if (!usuario) redirect('/entrar');
  return { supabase, usuario };
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

/**
 * Lista que pode passar de 1000 linhas: o PostgREST devolve no máximo `max_rows` (1000, aqui e no Supabase) por
 * pedido, calado. Lê de 1000 em 1000, numa ordem fixa, até vir uma página incompleta.
 */
async function todas<T>(pedir: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroBanco }>): Promise<T[]> {
  const POR_VEZ = 1000;
  const linhas: T[] = [];
  for (let de = 0; ; de += POR_VEZ) {
    const pagina = ok(await pedir(de, de + POR_VEZ - 1));
    linhas.push(...pagina);
    if (pagina.length < POR_VEZ) return linhas;
  }
}

/** Uma linha ou nada. */
function talvez<T>(r: { data: T | null; error: ErroBanco }): T | null {
  falhou(r.error);
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
  const e = talvez<EmpresaResumo>(await supabase.from('empresas').select('id, nome').eq('id', id).maybeSingle());
  if (!e) notFound();
  return e;
}

export async function membros(empresaId: string) {
  const { supabase } = await usuarioAtual();
  const m = ok(await supabase.from('membros').select('usuario_id, email, entrou_em').eq('empresa_id', empresaId).order('entrou_em'));
  const c = ok(await supabase.from('convites').select('email, criado_em').eq('empresa_id', empresaId).order('criado_em'));
  return { membros: m, convites: c };
}

export interface FluxoResumo {
  id: string;
  nome: string;
  descricao: string;
  canal: string | null;
  pecas: number;
  editado_em: string;
  /** E-mail de quem mexeu por último (null se não é mais membro). */
  editado_por: string | null;
  /** E-mail de quem está editando agora (trava valendo), ou null. */
  editando: string | null;
}

/** E-mails dos membros da empresa, por id de usuário. */
async function emailsDosMembros(empresaId: string): Promise<Map<string, string>> {
  const { supabase } = await usuarioAtual();
  const ms = ok<{ usuario_id: string; email: string }>(await supabase.from('membros').select('usuario_id, email').eq('empresa_id', empresaId));
  return new Map(ms.map((m) => [m.usuario_id, m.email]));
}

/** A grade de fluxos (da view fluxos_resumo: sem os documentos), do mais mexido pro menos. */
export async function fluxos(empresaId: string): Promise<FluxoResumo[]> {
  const { supabase } = await usuarioAtual();
  const [linhas, emails] = await Promise.all([
    supabase.from('fluxos_resumo').select('id, nome, descricao, canal, pecas, editado_em, editado_por, editando_por').eq('empresa_id', empresaId).order('editado_em', { ascending: false }),
    emailsDosMembros(empresaId),
  ]);
  return ok<{ id: string; nome: string; descricao: string; canal: string | null; pecas: number; editado_em: string; editado_por: string | null; editando_por: string | null }>(linhas).map(
    (l) => ({
      id: l.id,
      nome: l.nome,
      descricao: l.descricao,
      canal: l.canal,
      pecas: l.pecas,
      editado_em: l.editado_em,
      editado_por: (l.editado_por && emails.get(l.editado_por)) ?? null,
      editando: (l.editando_por && emails.get(l.editando_por)) ?? null,
    }),
  );
}

export interface FluxoParaEditar {
  id: string;
  nome: string;
  descricao: string;
  canal: string | null;
  meta_s: number | null;
  revisao: number;
  documento: Documento;
  estilo: unknown;
}

/** Um fluxo inteiro, pro editor. O documento passa pela validação do pacote: o que vem do banco também é de fora. */
export async function fluxoParaEditar(empresaId: string, fluxoId: string): Promise<FluxoParaEditar> {
  const { supabase } = await usuarioAtual();
  const f = talvez<Omit<FluxoParaEditar, 'documento'> & { documento: unknown }>(
    await supabase.from('fluxos').select('id, nome, descricao, canal, meta_s, revisao, documento, estilo').eq('empresa_id', empresaId).eq('id', fluxoId).maybeSingle(),
  );
  if (!f) notFound();
  const lido = lerDocumento(f.documento);
  if (!lido.documento) throw new Error(`o documento do fluxo "${f.nome}" não é um journey/2 válido: ${lido.problemas.map((p) => p.codigo).join(', ')}`);
  return { ...f, documento: lido.documento };
}

export async function canais(empresaId: string): Promise<(CanalEditor & { arquivado: boolean })[]> {
  const { supabase } = await usuarioAtual();
  return ok(await supabase.from('canais').select('chave, nome, cor, arquivado').eq('empresa_id', empresaId).order('ordem').order('nome'));
}

export async function cadastros(empresaId: string): Promise<Cadastro[]> {
  const { supabase } = await usuarioAtual();
  const linhas = await todas<{ id: string; tipo: string; nome: string; campos: Record<string, unknown> }>((de, ate) =>
    supabase.from('cadastros').select('id, tipo, nome, campos').eq('empresa_id', empresaId).order('nome').order('id').range(de, ate),
  );
  return linhas.map((l) => ({ id: l.id, tipo: l.tipo, nome: l.nome, campos: l.campos }));
}

export async function tiposCadastro(empresaId: string): Promise<TipoCadastro[]> {
  const { supabase } = await usuarioAtual();
  // Os padrão primeiro, na ordem de sempre; os da empresa depois, por nome.
  const ordem = ['pessoa', 'fila', 'equipe', 'sistema', 'horario'];
  const linhas = ok<TipoCadastro & { padrao: boolean }>(await supabase.from('tipos_cadastro').select('chave, nome, padrao').eq('empresa_id', empresaId).order('nome'));
  const pos = (t: { chave: string; padrao: boolean }) => (t.padrao ? ordem.indexOf(t.chave) : ordem.length);
  return linhas.sort((a, b) => pos(a) - pos(b)).map(({ chave, nome }) => ({ chave, nome }));
}

/** "Onde é usado": os fluxos de cada cadastro. */
export async function usosDosCadastros(empresaId: string): Promise<Map<string, { id: string; nome: string }[]>> {
  const { supabase } = await usuarioAtual();
  const [usos, fs] = await Promise.all([
    todas<{ cadastro_id: string; fluxo_id: string }>((de, ate) =>
      supabase.from('fluxo_cadastros').select('cadastro_id, fluxo_id').eq('empresa_id', empresaId).order('cadastro_id').order('fluxo_id').range(de, ate),
    ),
    todas<{ id: string; nome: string }>((de, ate) => supabase.from('fluxos_resumo').select('id, nome').eq('empresa_id', empresaId).order('id').range(de, ate)),
  ]);
  const nomes = new Map(fs.map((f) => [f.id, f.nome]));
  const m = new Map<string, { id: string; nome: string }[]>();
  for (const u of usos) {
    m.set(u.cadastro_id, [...(m.get(u.cadastro_id) ?? []), { id: u.fluxo_id, nome: nomes.get(u.fluxo_id) ?? 'fluxo' }]);
  }
  return m;
}

// Versões, cenários, intencionais e links de um fluxo (etapa C) ----------------------------------------------------

export interface VersaoResumo {
  numero: number;
  nome: string;
  /** E-mail de quem marcou (null se não é mais membro, ou foi apagado). */
  autor: string | null;
  criada_em: string;
}

/** As versões marcadas do fluxo, da mais nova pra mais velha (sem os documentos). */
export async function versoes(empresaId: string, fluxoId: string): Promise<VersaoResumo[]> {
  const { supabase } = await usuarioAtual();
  const [linhas, emails] = await Promise.all([
    todas<{ numero: number; nome: string; autor: string | null; criada_em: string }>((de, ate) =>
      supabase.from('fluxo_versoes').select('numero, nome, autor, criada_em').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).order('numero', { ascending: false }).range(de, ate),
    ),
    emailsDosMembros(empresaId),
  ]);
  return linhas.map((l) => ({ ...l, autor: (l.autor && emails.get(l.autor)) ?? null }));
}

/** Os cenários do fluxo, por nome. A forma do resultado esperado o banco já conferiu (cenarios_esperado). */
export async function cenarios(empresaId: string, fluxoId: string): Promise<Cenario[]> {
  const { supabase } = await usuarioAtual();
  return todas<Cenario>((de, ate) =>
    supabase
      .from('cenarios')
      .select('id, nome, inicio, quando, modo, escolhas, esperado, revisao_aprovada, atualizado_em')
      .eq('empresa_id', empresaId)
      .eq('fluxo_id', fluxoId)
      .order('nome')
      .order('id')
      .range(de, ate),
  );
}

/** Os achados marcados como intencionais no fluxo, com o e-mail de quem marcou. */
export async function intencionais(empresaId: string, fluxoId: string): Promise<Intencional[]> {
  const { supabase } = await usuarioAtual();
  const [linhas, emails] = await Promise.all([
    todas<{ chave: string; nota: string; autor: string | null; criado_em: string }>((de, ate) =>
      supabase.from('achados_intencionais').select('chave, nota, autor, criado_em').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).order('chave').range(de, ate),
    ),
    emailsDosMembros(empresaId),
  ]);
  return linhas.map((l) => ({ ...l, autor: (l.autor && emails.get(l.autor)) ?? null }));
}

/**
 * Os links do fluxo, do mais novo pro mais velho (vencidos e revogados também: a lista conta o que já foi mandado).
 * O nome do cenário vem da cópia guardada no link, não do cenário (que pode ter mudado ou sumido).
 */
export async function links(empresaId: string, fluxoId: string): Promise<LinkResumo[]> {
  const { supabase } = await usuarioAtual();
  return todas<LinkResumo>((de, ate) =>
    supabase
      .from('links')
      .select('id, token, versao, esconder_nomes, cenario_nome:cenario->>nome, expira_em, revogado_em, criado_em')
      .eq('empresa_id', empresaId)
      .eq('fluxo_id', fluxoId)
      .order('criado_em', { ascending: false })
      .order('id')
      .range(de, ate),
  );
}
