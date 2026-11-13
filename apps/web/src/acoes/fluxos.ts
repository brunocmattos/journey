'use server';

import { revalidatePath } from 'next/cache';
import { MODELOS, camposHorario, instanciarModelo } from '@journey/fluxo';
import { nomeNormalizado } from '@/editor/cadastros';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

const MENSAGENS = { '23514': 'O nome vai de 1 a 120 letras.', '23503': 'Esse canal não existe nesta empresa.' };

/** Fluxo em branco: só nome e canal. O documento vazio vem do banco. */
export async function criarFluxo(empresaId: string, nome: string, canal: string | null): Promise<{ id?: string; erro?: string }> {
  const n = nome.trim();
  if (!n) return { erro: 'Dá um nome pro fluxo.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('fluxos').insert({ empresa_id: empresaId, nome: n, canal: canal || null }).select('id').single();
  if (r.error) return { erro: mensagemDoErro('criarFluxo', r.error, MENSAGENS) };
  revalidatePath(`/e/${empresaId}`);
  return { id: r.data.id as string };
}

/**
 * Fluxo a partir de um modelo. Cada cadastro do modelo vira o cadastro da empresa com o mesmo tipo e nome
 * (o que já existe é reaproveitado), e o documento é salvo com os ids dela. Se algo falha no meio,
 * o fluxo criado é apagado: não sobra fluxo vazio.
 */
export async function criarDeModelo(empresaId: string, chave: string): Promise<{ id?: string; erro?: string }> {
  const modelo = MODELOS.find((m) => m.chave === chave);
  if (!modelo) return { erro: 'Esse modelo não existe.' };
  const { supabase } = await usuarioAtual();

  const existentes = await supabase.from('cadastros').select('id, tipo, nome').eq('empresa_id', empresaId);
  if (existentes.error) return { erro: mensagemDoErro('criarDeModelo', existentes.error) };
  const ids: Record<string, string> = {};
  for (const k of modelo.cadastros) {
    const igual = existentes.data.find((e) => e.tipo === k.tipo && nomeNormalizado(e.nome) === nomeNormalizado(k.nome));
    if (igual) {
      ids[k.id] = igual.id;
      continue;
    }
    const campos = k.tipo === 'horario' ? (camposHorario(k) ?? {}) : (k.campos ?? {});
    const novo = await supabase.from('cadastros').insert({ empresa_id: empresaId, tipo: k.tipo, nome: k.nome, campos }).select('id').single();
    if (novo.error) return { erro: mensagemDoErro('criarDeModelo', novo.error, { '23503': `A empresa não tem o tipo de cadastro "${k.tipo}".` }) };
    ids[k.id] = novo.data.id as string;
  }

  const canal = await supabase.from('canais').select('chave').eq('empresa_id', empresaId).eq('chave', modelo.canal).maybeSingle();
  const f = await supabase
    .from('fluxos')
    .insert({ empresa_id: empresaId, nome: modelo.nome, descricao: modelo.descricao, canal: canal.data ? modelo.canal : null })
    .select('id')
    .single();
  if (f.error) return { erro: mensagemDoErro('criarDeModelo', f.error, MENSAGENS) };
  const id = f.data.id as string;
  const s = await supabase.rpc('salvar_fluxo', { p_fluxo: id, p_revisao: 0, p_documento: instanciarModelo(modelo, ids) });
  if (s.error) {
    await supabase.from('fluxos').delete().eq('id', id);
    return { erro: mensagemDoErro('criarDeModelo', s.error) };
  }
  revalidatePath(`/e/${empresaId}`);
  return { id };
}

export interface DadosDoFluxo {
  nome?: string;
  descricao?: string;
  canal?: string | null;
  meta_s?: number | null;
}

/** Nome, descrição, canal principal e meta: colunas que a tela grava direto (o documento vai pelo salvar_fluxo). */
export async function mudarFluxo(empresaId: string, fluxoId: string, d: DadosDoFluxo): Promise<{ erro?: string }> {
  const valores: Record<string, unknown> = {};
  if (d.nome !== undefined) {
    if (!d.nome.trim()) return { erro: 'Dá um nome pro fluxo.' };
    valores.nome = d.nome.trim();
  }
  if (d.descricao !== undefined) valores.descricao = d.descricao.trim();
  if (d.canal !== undefined) valores.canal = d.canal || null;
  if (d.meta_s !== undefined) {
    if (d.meta_s !== null && !(Number.isInteger(d.meta_s) && d.meta_s > 0)) return { erro: 'A meta é um tempo maior que zero.' };
    valores.meta_s = d.meta_s;
  }
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('fluxos').update(valores).eq('empresa_id', empresaId).eq('id', fluxoId).select('id');
  if (r.error) return { erro: mensagemDoErro('mudarFluxo', r.error, MENSAGENS) };
  if (!r.data?.length) return { erro: 'Este fluxo não existe mais.' };
  revalidatePath(`/e/${empresaId}`);
  return {};
}

export async function apagarFluxo(empresaId: string, fluxoId: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('fluxos').delete().eq('empresa_id', empresaId).eq('id', fluxoId).select('id');
  if (r.error) return { erro: mensagemDoErro('apagarFluxo', r.error) };
  if (!r.data?.length) return { erro: 'Este fluxo não existe mais.' };
  revalidatePath(`/e/${empresaId}`);
  return {};
}
