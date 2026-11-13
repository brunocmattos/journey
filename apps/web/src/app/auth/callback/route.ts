import { NextResponse, type NextRequest } from 'next/server';
import { caminhoInterno } from '@/lib/acesso';
import { origemDe } from '@/lib/origem';
import { supabaseServidor } from '@/lib/supabase/servidor';

/**
 * A volta do Google (OAuth com PKCE): troca o código pela sessão e segue pro `next` (só caminho deste app), ou pra raiz.
 * Os e-mails do login voltam pelo /auth/confirm (e o botão dele, /auth/confirmar). Quem cancela (ou recusa) no Google volta com `error` e sem código.
 */
export async function GET(request: NextRequest) {
  const origem = origemDe(request);
  const p = request.nextUrl.searchParams;
  if (p.get('error')) {
    console.error('[auth/callback]', p.get('error'), p.get('error_code'), p.get('error_description'));
    return NextResponse.redirect(new URL('/entrar?erro=google', origem));
  }
  const code = p.get('code');
  if (code) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(caminhoInterno(p.get('next')), origem));
  }
  return NextResponse.redirect(new URL('/entrar?erro=link', origem));
}
