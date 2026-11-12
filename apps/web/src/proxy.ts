import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { origemDe } from '@/lib/origem';

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const publico = ['/entrar', '/auth'].some((p) => request.nextUrl.pathname.startsWith(p));
  if (!data?.claims && !publico) {
    const paraEntrar = NextResponse.redirect(new URL('/entrar', origemDe(request)));
    // Leva os cookies que o Supabase acabou de mexer (sessão vencida apagada), senão o navegador fica com os velhos.
    for (const c of resposta.cookies.getAll()) paraEntrar.cookies.set(c);
    return paraEntrar;
  }
  return resposta;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|modelos/).*)'] };
