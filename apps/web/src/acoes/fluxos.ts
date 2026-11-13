'use server';

import { revalidatePath } from 'next/cache';
import { LIMITES, MODELOS, camposHorario, instanciarModelo } from '@journey/fluxo';
import { acharOuCriarCadastro } from '@/lib/cadastro-unico';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

const MENSAGENS = { '23514': 'O nome vai de 1 a 120 letras.', '23503': 'Esse canal não existe nesta empresa.' };

/** Fluxo em branco: só nome e canal. O documento vazio vem do banco. */
export async function criarFluxo(empresaId: string, nome: string, canal: string | null): Promise<{ id?: string; erro?: string }> {
  const n = typeof nome === 'string' ? nome.trim() : '';
  if (!n) return { erro: 'Dá um nome pro fluxo.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('fluxos').insert({ empresa_id: empresaId, nome: n, canal: canal || null }).select('id').single();
  if (r.error) return { erro: mensagemDoErro('criarFluxo', r.error, MENSAGENS) };
  revalidatePath(`/e/${empresaId}`);
  return { id: r.data.id as string };
}

/**
 * Fluxo a partir de um modelo. Cada cadastro do modelo vira o cadastro da empresa com o mesmo tipo e nome
 * (o que já existe é reaproveitado), e o documento é salvo com os ids dela. Se algo falha no meio, o que esta
 * chamada criou é apagado (o fluxo e os cadastros novos): não sobra fluxo vazio nem cadastro solto.
 */
export async function criarDeModelo(empresaId: string, chave: string): Promise<{ id?: string; erro?: string }> {
  const modelo = MODELOS.find((m) => m.chave === chave);
  if (!modelo) return { erro: 'Esse modelo não existe.' };
  const { supabase } = await usuarioAtual();

  const ids: Record<string, string> = {};
  const criados: string[] = [];
  const falhou = async (erro: { code?: string; message: string }, mensagens?: Record<string, string>) => {
    if (criados.length) {
      const d = await supabase.from('cadastros').delete().eq('empresa_id', empresaId).in('id', criados);
      if (d.error) mensagemDoErro('criarDeModelo: desfazer cadastros', d.error);
    }
    return { erro: mensagemDoErro('criarDeModelo', erro, mensagens) };
  };
  for (const k of modelo.cadastros) {
    const campos = k.tipo === 'horario' ? (camposHorario(k) ?? {}) : (k.campos ?? {});
    const a = await acharOuCriarCadastro(supabase, empresaId, k.tipo, k.nome, campos);
    if ('erro' in a) return falhou(a.erro, { '23503': `A empresa não tem o tipo de cadastro "${k.tipo}".` });
    ids[k.id] = a.cadastro.id;
    if (a.novo) criados.push(a.cadastro.id);
  }
  const documento = instanciarModelo(modelo, ids);

  // Canal arquivado ou que a empresa não tem: o fluxo nasce sem canal (dá pra escolher no painel).
  const canal = await supabase.from('canais').select('chave').eq('empresa_id', empresaId).eq('chave', modelo.canal).eq('arquivado', false).maybeSingle();
  if (canal.error) return falhou(canal.error);
  const f = await supabase
    .from('fluxos')
    .insert({ empresa_id: empresaId, nome: modelo.nome, descricao: modelo.descricao, canal: canal.data ? modelo.canal : null })
    .select('id')
    .single();
  if (f.error) return falhou(f.error, MENSAGENS);
  const id = f.data.id as string;
  const s = await supabase.rpc('salvar_fluxo', { p_fluxo: id, p_revisao: 0, p_documento: documento });
  if (s.error) {
    const d = await supabase.from('fluxos').delete().eq('empresa_id', empresaId).eq('id', id);
    if (d.error) mensagemDoErro('criarDeModelo: desfazer fluxo', d.error);
    return falhou(s.error);
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
    if (typeof d.nome !== 'string' || !d.nome.trim()) return { erro: 'Dá um nome pro fluxo.' };
    valores.nome = d.nome.trim();
  }
  if (d.descricao !== undefined) {
    if (typeof d.descricao !== 'string' || d.descricao.length > LIMITES.texto) return { erro: `A descrição vai até ${LIMITES.texto} letras.` };
    valores.descricao = d.descricao.trim();
  }
  if (d.canal !== undefined) valores.canal = d.canal || null;
  if (d.meta_s !== undefined) {
    if (d.meta_s !== null && !(Number.isInteger(d.meta_s) && d.meta_s > 0 && d.meta_s <= LIMITES.tempo_s)) return { erro: 'A meta é um tempo maior que zero, de até um ano.' };
    valores.meta_s = d.meta_s;
  }
  if (!Object.keys(valores).length) return {};
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
