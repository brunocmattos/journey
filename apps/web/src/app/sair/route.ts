import { NextResponse, type NextRequest } from 'next/server';
import { origemDe } from '@/lib/origem';
import { supabaseServidor } from '@/lib/supabase/servidor';

export async function POST(request: NextRequest) {
  const origem = origemDe(request);
  // Formulário de outro site não desloga ninguém. Sem Origin (navegador antigo), deixa passar.
  const de = request.headers.get('origin');
  if (de !== null && de !== origem) return new NextResponse('Origem não confere.', { status: 403 });
  const supabase = await supabaseServidor();
  // Só neste aparelho: as outras sessões da pessoa continuam.
  await supabase.auth.signOut({ scope: 'local' });
  return NextResponse.redirect(new URL('/entrar', origem), { status: 303 });
}
