import { NextResponse, type NextRequest } from 'next/server';
import { caminhoInterno, tipoDoEmail } from '@/lib/acesso';
import { origemDe } from '@/lib/origem';
import { supabaseServidor } from '@/lib/supabase/servidor';

/**
 * O botão da página /auth/confirm: confirma o token do e-mail com o Supabase no servidor (`verifyOtp`, sem o PKCE, então
 * vale em qualquer navegador), grava a sessão no cookie e segue pro `next` (só caminho deste app), ou pra raiz.
 * Só aceita pedido desta origem: um formulário de outro site não põe o visitante na conta de outra pessoa (login CSRF).
 * Diferente do Sair, sem Origin também recusa: todo navegador de hoje manda Origin num POST.
 */
export async function POST(request: NextRequest) {
  const origem = origemDe(request);
  if (request.headers.get('origin') !== origem) return new NextResponse('Origem não confere.', { status: 403 });
  const dados = await request.formData().catch(() => null);
  const token_hash = dados?.get('token_hash');
  const type = tipoDoEmail(typeof dados?.get('type') === 'string' ? (dados!.get('type') as string) : null);
  if (typeof token_hash === 'string' && token_hash && type) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    const next = dados!.get('next');
    if (!error) return NextResponse.redirect(new URL(caminhoInterno(typeof next === 'string' ? next : null), origem), { status: 303 });
    console.error('[auth/confirmar]', error.status, error.code, error.message);
  }
  return NextResponse.redirect(new URL('/entrar?erro=link', origem), { status: 303 });
}
