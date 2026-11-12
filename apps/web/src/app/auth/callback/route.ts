import { NextResponse, type NextRequest } from 'next/server';
import { origemDe } from '@/lib/origem';
import { supabaseServidor } from '@/lib/supabase/servidor';

export async function GET(request: NextRequest) {
  const origem = origemDe(request);
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', origem));
  }
  return NextResponse.redirect(new URL('/entrar?erro=link', origem));
}
