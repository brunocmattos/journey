'use server';

import { usuarioAtual, type VersaoResumo } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

/**
 * Marca uma versão com nome: a foto do documento e do estilo que estão no banco agora (o editor manda o que falta
 * salvar antes de chamar). Devolve a versão como a lista mostra. Sem revalidatePath: a lista de versões só aparece no
 * editor, que acrescenta a versão nova no lugar (refazer a página leria o documento inteiro de novo à toa).
 */
export async function marcarVersao(empresaId: string, fluxoId: string, nome: string): Promise<{ versao?: VersaoResumo; erro?: string }> {
  const n = typeof nome === 'string' ? nome.trim() : '';
  if (!n || n.length > 120) return { erro: 'O nome da versão vai de 1 a 120 letras.' };
  const { supabase, usuario } = await usuarioAtual();
  // A função confere que quem pede é membro da empresa do fluxo; a leitura de volta filtra pela empresa da página.
  const r = await supabase.rpc('marcar_versao', { p_fluxo: fluxoId, p_nome: n });
  if (r.error) return { erro: mensagemDoErro('marcarVersao', r.error, { P0002: 'Este fluxo não existe mais.', '23514': 'O nome da versão vai de 1 a 120 letras.' }) };
  const v = await supabase.from('fluxo_versoes').select('numero, nome, criada_em').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('numero', r.data as number).single();
  if (v.error) return { erro: mensagemDoErro('marcarVersao', v.error) };
  return { versao: { ...(v.data as Omit<VersaoResumo, 'autor'>), autor: usuario.email ?? null } };
}
