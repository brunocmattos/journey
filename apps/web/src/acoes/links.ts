'use server';

import { revalidatePath } from 'next/cache';
import { ehValidade, expiraEm } from '@/compartilhar/opcoes';
import type { CenarioDoLink } from '@/compartilhar/retrato';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

/** O que a pessoa escolhe no "Compartilhar". */
export interface OpcoesLink {
  /** null: sempre a versão mais recente. */
  versao: number | null;
  esconderNomes: boolean;
  cenarioId: string | null;
  /** Dias, ou null sem prazo (só os de VALIDADES). */
  validade: number | null;
}

const caminho = (empresaId: string, jornadaId: string) => `/e/${empresaId}/j/${jornadaId}`;

/**
 * Cria o link e devolve o token. O cenário inicial é copiado do banco (não do navegador) pra dentro do link.
 * O token, o autor e as datas são do banco; o membro só manda as opções.
 */
export async function criarLink(empresaId: string, jornadaId: string, o: OpcoesLink): Promise<{ token?: string; erro?: string }> {
  if (!ehValidade(o.validade)) return { erro: 'Escolhe uma validade da lista.' };
  if (o.versao !== null && !(Number.isInteger(o.versao) && o.versao > 0)) return { erro: 'Versão inválida.' };
  const { supabase } = await usuarioAtual();
  let cenario: CenarioDoLink | null = null;
  if (o.cenarioId) {
    const c = await supabase.from('cenarios').select('nome, entrada, inicio, modo, escolhas').eq('id', o.cenarioId).eq('jornada_id', jornadaId).maybeSingle();
    if (c.error) return { erro: mensagemDoErro('criarLink', c.error) };
    if (!c.data) return { erro: 'Este cenário não existe mais.' };
    cenario = c.data as CenarioDoLink;
  }
  const r = await supabase
    .from('links')
    .insert({
      empresa_id: empresaId,
      jornada_id: jornadaId,
      versao: o.versao,
      esconder_nomes: o.esconderNomes !== false,
      cenario,
      expira_em: expiraEm(o.validade, new Date()),
    })
    .select('token')
    .single();
  // 23503 é a FK: com versão fixa, é a versão; sem ela, só pode ser a jornada.
  if (r.error) return { erro: mensagemDoErro('criarLink', r.error, { '23503': o.versao !== null ? 'Esta versão não existe mais nesta jornada.' : 'Esta jornada não existe mais.' }) };
  revalidatePath(caminho(empresaId, jornadaId));
  return { token: r.data.token as string };
}

/** Revoga pra sempre: quem abrir depois vê a página de link revogado. */
export async function revogarLink(empresaId: string, jornadaId: string, linkId: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('links')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', linkId)
    .eq('jornada_id', jornadaId)
    .is('revogado_em', null)
    .select('id');
  if (r.error) return { erro: mensagemDoErro('revogarLink', r.error) };
  if (!r.data?.length) return { erro: 'Este link não existe mais ou já foi revogado.' };
  revalidatePath(caminho(empresaId, jornadaId));
  return {};
}
