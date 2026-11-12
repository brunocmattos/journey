'use server';

import { revalidatePath } from 'next/cache';
import type { Evento } from '@journey/nucleo';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';
import type { Modo } from '@/simulacao/sessao';

/** O caminho de uma simulação: o que refaz os eventos. */
export interface CaminhoCenario {
  entrada: string;
  inicio: string;
  modo: Modo;
  escolhas: string[];
}

export interface NovoCenario extends CaminhoCenario {
  nome: string;
  esperado: Evento[];
  versao: number;
}

const caminho = (empresaId: string, jornadaId: string) => `/e/${empresaId}/j/${jornadaId}`;
const CENARIO_SUMIU = 'Este cenário não existe mais.';

export async function salvarCenario(empresaId: string, jornadaId: string, c: NovoCenario): Promise<{ id?: string; erro?: string }> {
  const { supabase } = await usuarioAtual();
  const nome = c.nome.trim();
  if (!nome) return { erro: 'Dá um nome pro cenário.' };
  const r = await supabase
    .from('cenarios')
    .insert({ empresa_id: empresaId, jornada_id: jornadaId, nome, entrada: c.entrada, inicio: c.inicio, modo: c.modo, escolhas: c.escolhas, esperado: c.esperado, versao_aprovada: c.versao })
    .select('id')
    .single();
  if (r.error) return { erro: mensagemDoErro('salvarCenario', r.error) };
  revalidatePath(caminho(empresaId, jornadaId));
  return { id: r.data.id };
}

/**
 * O resultado de hoje passa a ser o esperado. O caminho vai junto: o esperado só vale com as escolhas que o produziram
 * (a tela só oferece aprovar quando a simulação é o caminho do cenário, mas o banco não fica dependendo disso).
 */
export async function aprovarResultado(
  empresaId: string,
  jornadaId: string,
  cenarioId: string,
  c: CaminhoCenario & { esperado: Evento[]; versao: number },
): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('cenarios')
    .update({
      entrada: c.entrada,
      inicio: c.inicio,
      modo: c.modo,
      escolhas: c.escolhas,
      esperado: c.esperado,
      versao_aprovada: c.versao,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', cenarioId)
    .eq('jornada_id', jornadaId)
    .select('id');
  if (r.error) return { erro: mensagemDoErro('aprovarResultado', r.error) };
  if (!r.data?.length) return { erro: CENARIO_SUMIU };
  revalidatePath(caminho(empresaId, jornadaId));
  return {};
}

export async function apagarCenario(empresaId: string, jornadaId: string, cenarioId: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cenarios').delete().eq('id', cenarioId).eq('jornada_id', jornadaId).select('id');
  if (r.error) return { erro: mensagemDoErro('apagarCenario', r.error) };
  if (!r.data?.length) return { erro: CENARIO_SUMIU };
  revalidatePath(caminho(empresaId, jornadaId));
  return {};
}

export async function marcarIntencional(empresaId: string, jornadaId: string, chave: string, nota: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('achados_intencionais').upsert({ empresa_id: empresaId, jornada_id: jornadaId, chave, nota: nota.trim() });
  if (r.error) return { erro: mensagemDoErro('marcarIntencional', r.error) };
  revalidatePath(caminho(empresaId, jornadaId));
  return {};
}

export async function desmarcarIntencional(empresaId: string, jornadaId: string, chave: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  // A tabela não tem id: a chave primária é (jornada_id, chave).
  const r = await supabase.from('achados_intencionais').delete().eq('jornada_id', jornadaId).eq('chave', chave).select('chave');
  if (r.error) return { erro: mensagemDoErro('desmarcarIntencional', r.error) };
  if (!r.data?.length) return { erro: 'Este achado não está mais marcado como intencional.' };
  revalidatePath(caminho(empresaId, jornadaId));
  return {};
}
