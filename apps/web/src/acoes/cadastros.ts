'use server';

import { revalidatePath } from 'next/cache';
import { camposHorario, type Cadastro } from '@journey/fluxo';
import { HORARIO_PADRAO, nomeNormalizado } from '@/editor/cadastros';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

const MENSAGENS = {
  '23505': 'Já existe um cadastro com esse nome nesse tipo.',
  '23514': 'O nome vai de 1 a 200 letras.',
  '23503': 'A empresa não tem esse tipo de cadastro.',
};

const caminho = (empresaId: string) => `/e/${empresaId}/cadastros`;

/**
 * Cria um cadastro (é assim que ele nasce do desenho). Se já existe um com o mesmo nome no mesmo tipo,
 * devolve o que existe: escrever "fila cobrança" numa peça usa a Fila Cobrança que já está lá.
 * Horário nasce de segunda a sexta, das 8h às 18h.
 */
export async function criarCadastro(empresaId: string, tipo: string, nome: string): Promise<{ cadastro?: Cadastro; erro?: string }> {
  const n = nome.trim();
  if (!n) return { erro: 'Escreve um nome.' };
  const { supabase } = await usuarioAtual();
  const campos = tipo === 'horario' ? HORARIO_PADRAO : {};
  const r = await supabase.from('cadastros').insert({ empresa_id: empresaId, tipo, nome: n, campos }).select('id, tipo, nome, campos').single();
  if (r.error?.code === '23505') {
    const mesmos = await supabase.from('cadastros').select('id, tipo, nome, campos').eq('empresa_id', empresaId).eq('tipo', tipo);
    const igual = mesmos.data?.find((k) => nomeNormalizado(k.nome as string) === nomeNormalizado(n));
    if (igual) return { cadastro: igual as Cadastro };
  }
  if (r.error) return { erro: mensagemDoErro('criarCadastro', r.error, MENSAGENS) };
  revalidatePath(caminho(empresaId));
  return { cadastro: r.data as Cadastro };
}

/** Renomear muda o nome em todos os fluxos: as peças guardam o id, não o nome. */
export async function renomearCadastro(empresaId: string, id: string, nome: string): Promise<{ erro?: string }> {
  const n = nome.trim();
  if (!n) return { erro: 'Escreve um nome.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cadastros').update({ nome: n }).eq('empresa_id', empresaId).eq('id', id).select('id');
  if (r.error) return { erro: mensagemDoErro('renomearCadastro', r.error, MENSAGENS) };
  if (!r.data?.length) return { erro: 'Este cadastro não existe mais.' };
  revalidatePath(caminho(empresaId));
  return {};
}

/** Só apaga cadastro sem uso: o banco recusa (23503) se algum fluxo usa. */
export async function apagarCadastro(empresaId: string, id: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cadastros').delete().eq('empresa_id', empresaId).eq('id', id).select('id');
  if (r.error) return { erro: mensagemDoErro('apagarCadastro', r.error, { '23503': 'Algum fluxo usa este cadastro. Troca nas peças antes de apagar.' }) };
  if (!r.data?.length) return { erro: 'Este cadastro não existe mais.' };
  revalidatePath(caminho(empresaId));
  return {};
}

/** Janelas e feriados de um Horário, conferidos como o relógio confere. */
export async function mudarHorario(empresaId: string, id: string, campos: unknown): Promise<{ erro?: string }> {
  const lidos = camposHorario({ id, tipo: 'horario', nome: 'h', campos: campos as Record<string, unknown> });
  if (!lidos) return { erro: 'Confere as janelas (o fim depois do início, até 24:00) e as datas dos feriados.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cadastros').update({ campos: lidos }).eq('empresa_id', empresaId).eq('id', id).eq('tipo', 'horario').select('id');
  if (r.error) return { erro: mensagemDoErro('mudarHorario', r.error) };
  if (!r.data?.length) return { erro: 'Este horário não existe mais.' };
  revalidatePath(caminho(empresaId));
  return {};
}
