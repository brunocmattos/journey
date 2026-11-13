import { redirect } from 'next/navigation';
import { empresasDoUsuario, usuarioAtual } from '@/lib/dados';

/** Quem entra cai na primeira empresa; quem foi convidado entra nela antes; quem não tem nenhuma cria. */
export default async function Inicio() {
  const { supabase } = await usuarioAtual();
  await supabase.rpc('aceitar_convites');
  const empresas = await empresasDoUsuario();
  redirect(empresas[0] ? `/e/${empresas[0].id}` : '/empresa/nova');
}
