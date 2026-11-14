import { redirect } from 'next/navigation';
import { empresasDoUsuario, sessaoAtual } from '@/lib/dados';
import { Landing } from '@/landing/Landing';

/**
 * Sem sessão, a landing. Com sessão, o de sempre: quem entra cai na primeira empresa; quem foi convidado entra nela
 * antes; quem não tem nenhuma cria.
 */
export default async function Inicio() {
  // A mesma ida ao Auth que o empresasDoUsuario usa (sessaoAtual, com o cache do React).
  const { supabase, usuario } = await sessaoAtual();
  if (!usuario) return <Landing />;
  await supabase.rpc('aceitar_convites');
  const empresas = await empresasDoUsuario();
  redirect(empresas[0] ? `/e/${empresas[0].id}` : '/empresa/nova');
}
