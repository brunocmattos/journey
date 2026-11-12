'use server';

import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

export async function criarEmpresa(_antes: { erro: string } | null, form: FormData) {
  const { supabase } = await usuarioAtual();
  const nome = String(form.get('nome') ?? '').trim();
  if (!nome) return { erro: 'Dá um nome pra empresa.' };
  const r = await supabase.rpc('criar_empresa', { p_nome: nome });
  if (r.error) return { erro: mensagemDoErro('criarEmpresa', r.error, { '23514': 'O nome vai de 1 a 120 letras.' }) };
  redirect(`/e/${r.data as string}`);
}
