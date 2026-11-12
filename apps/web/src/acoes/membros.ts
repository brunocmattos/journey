'use server';

import { revalidatePath } from 'next/cache';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

export async function convidar(empresaId: string, _antes: { erro?: string; ok?: string } | null, form: FormData) {
  const { supabase } = await usuarioAtual();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return { erro: 'E-mail inválido.' };
  const r = await supabase.from('convites').insert({ empresa_id: empresaId, email });
  if (r.error) return { erro: mensagemDoErro('convidar', r.error, { '23505': 'Essa pessoa já foi convidada.', '23514': 'E-mail inválido.' }) };
  revalidatePath(`/e/${empresaId}/membros`);
  return { ok: `Convite pra ${email} criado. Ela entra pelo link mágico com esse e-mail.` };
}

export async function desfazerConvite(empresaId: string, email: string) {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('convites').delete().eq('empresa_id', empresaId).eq('email', email);
  if (r.error) console.error('[desfazerConvite]', r.error.code, r.error.message);
  revalidatePath(`/e/${empresaId}/membros`);
}
