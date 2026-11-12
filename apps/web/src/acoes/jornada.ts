'use server';

import { revalidatePath } from 'next/cache';
import type { Evento } from '@journey/nucleo';
import { usuarioAtual } from '@/lib/dados';
import type { Modo } from '@/simulacao/sessao';

export interface NovoCenario {
  nome: string;
  entrada: string;
  inicio: string;
  modo: Modo;
  escolhas: string[];
  esperado: Evento[];
  versao: number;
}

const caminho = (empresaId: string, jornadaId: string) => `/e/${empresaId}/j/${jornadaId}`;

export async function salvarCenario(empresaId: string, jornadaId: string, c: NovoCenario): Promise<{ id?: string; erro?: string }> {
  const { supabase } = await usuarioAtual();
  const nome = c.nome.trim();
  if (!nome) return { erro: 'Dá um nome pro cenário.' };
  const r = await supabase
    .from('cenarios')
    .insert({ empresa_id: empresaId, jornada_id: jornadaId, nome, entrada: c.entrada, inicio: c.inicio, modo: c.modo, escolhas: c.escolhas, esperado: c.esperado, versao_aprovada: c.versao })
    .select('id')
    .single();
  if (r.error) return { erro: r.error.message };
  revalidatePath(caminho(empresaId, jornadaId));
  return { id: r.data.id };
}

/** O resultado de hoje passa a ser o esperado. */
export async function aprovarResultado(empresaId: string, jornadaId: string, cenarioId: string, esperado: Evento[], versao: number): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cenarios').update({ esperado, versao_aprovada: versao, atualizado_em: new Date().toISOString() }).eq('id', cenarioId);
  if (r.error) return { erro: r.error.message };
  revalidatePath(caminho(empresaId, jornadaId));
  return {};
}

export async function apagarCenario(empresaId: string, jornadaId: string, cenarioId: string): Promise<void> {
  const { supabase } = await usuarioAtual();
  await supabase.from('cenarios').delete().eq('id', cenarioId);
  revalidatePath(caminho(empresaId, jornadaId));
}

export async function marcarIntencional(empresaId: string, jornadaId: string, chave: string, nota: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('achados_intencionais').upsert({ empresa_id: empresaId, jornada_id: jornadaId, chave, nota: nota.trim() });
  if (r.error) return { erro: r.error.message };
  revalidatePath(caminho(empresaId, jornadaId));
  return {};
}

export async function desmarcarIntencional(empresaId: string, jornadaId: string, chave: string): Promise<void> {
  const { supabase } = await usuarioAtual();
  await supabase.from('achados_intencionais').delete().eq('jornada_id', jornadaId).eq('chave', chave);
  revalidatePath(caminho(empresaId, jornadaId));
}
