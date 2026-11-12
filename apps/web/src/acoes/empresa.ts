'use server';

import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/dados';

export async function criarEmpresa(_antes: { erro: string } | null, form: FormData) {
  const { supabase } = await usuarioAtual();
  const nome = String(form.get('nome') ?? '').trim();
  if (!nome) return { erro: 'Dá um nome pra empresa.' };
  const r = await supabase.rpc('criar_empresa', { p_nome: nome });
  if (r.error) return { erro: r.error.message };
  redirect(`/e/${r.data as string}`);
}
