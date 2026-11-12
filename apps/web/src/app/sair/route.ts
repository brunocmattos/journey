import { NextResponse, type NextRequest } from 'next/server';
import { origemDe } from '@/lib/origem';
import { supabaseServidor } from '@/lib/supabase/servidor';

export async function POST(request: NextRequest) {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/entrar', origemDe(request)), { status: 303 });
}
