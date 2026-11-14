/**
 * Entrar com o Google pelo navegador (a /entrar e a landing). O cliente do Supabase vem por import dinâmico: a landing
 * abre sem ele, e `preCarregarGoogle` (no ponteiro ou no foco do botão) adianta o download. O código do PKCE fica num
 * cookie deste navegador, e a volta é pelo /auth/callback.
 */
const cliente = () => import('@/lib/supabase/navegador');

/** Começa a baixar o cliente do Supabase antes do clique. Falhar aqui não importa: o clique tenta de novo. */
export const preCarregarGoogle = (): void => void cliente().catch(() => {});

/**
 * Pede o login do Google. Devolve true quando o pedido saiu (o navegador já está indo pro Google) e false quando nem
 * saiu (o cliente não baixou, o provedor está desligado, sem rede): quem chama diz pra pessoa.
 */
export async function entrarComGoogle(): Promise<boolean> {
  try {
    const { supabaseNavegador } = await cliente();
    const { error } = await supabaseNavegador().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (!error) return true;
    console.error('[Google]', error.message);
  } catch (e) {
    console.error('[Google]', e);
  }
  return false;
}
