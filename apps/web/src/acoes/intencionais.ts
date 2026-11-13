'use server';

import { LIMITES } from '@journey/fluxo';
import type { Intencional } from '@/editor/diagnostico';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

/*
 * Os intencionais só aparecem no editor (e, só com chave e nota, no link), que muda a lista no lugar com o que estas
 * ações devolvem: sem revalidatePath.
 */

/** O limite da coluna (achados_intencionais.chave): o diagnóstico resume a chave comprida bem antes disso. */
const CHAVE_MAXIMA = 2000;

/**
 * Marca o achado como intencional, com a nota; marcar de novo troca a nota (quem marcou e quando ficam os da
 * primeira vez). Devolve o intencional como a lista mostra.
 */
export async function marcarIntencional(empresaId: string, fluxoId: string, chave: string, nota: string): Promise<{ intencional?: Intencional; erro?: string }> {
  if (typeof chave !== 'string' || !chave || chave.length > CHAVE_MAXIMA) return { erro: 'Achado inválido.' };
  if (typeof nota !== 'string' || nota.length > LIMITES.texto) return { erro: `A nota vai até ${LIMITES.texto} letras.` };
  const { supabase, usuario } = await usuarioAtual();
  // As quatro colunas: o upsert do PostgREST põe todas as enviadas no "do update set" (a migração dá o grant das quatro).
  const r = await supabase
    .from('achados_intencionais')
    .upsert({ empresa_id: empresaId, fluxo_id: fluxoId, chave, nota: nota.trim() }, { onConflict: 'fluxo_id,chave' })
    .select('chave, nota, autor, criado_em')
    .single();
  if (r.error) return { erro: mensagemDoErro('marcarIntencional', r.error, { '23503': 'Este fluxo não existe mais.' }) };
  const linha = r.data as { chave: string; nota: string; autor: string | null; criado_em: string };
  let autor: string | null = null;
  if (linha.autor === usuario.id) autor = usuario.email ?? null;
  else if (linha.autor) {
    // Quem marcou primeiro foi outra pessoa: o e-mail dela, se ainda é membro.
    const m = await supabase.from('membros').select('email').eq('empresa_id', empresaId).eq('usuario_id', linha.autor).maybeSingle();
    if (m.error) mensagemDoErro('marcarIntencional: autor', m.error);
    autor = (m.data as { email: string } | null)?.email ?? null;
  }
  return { intencional: { ...linha, autor } };
}

/** Desmarca. Já desmarcado (por outra pessoa, noutra aba) também é sucesso: o achado volta a ficar aberto. */
export async function desmarcarIntencional(empresaId: string, fluxoId: string, chave: string): Promise<{ erro?: string }> {
  if (typeof chave !== 'string' || !chave) return { erro: 'Achado inválido.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('achados_intencionais').delete().eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('chave', chave);
  if (r.error) return { erro: mensagemDoErro('desmarcarIntencional', r.error) };
  return {};
}
