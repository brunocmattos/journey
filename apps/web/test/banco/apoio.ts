import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Testes contra o Supabase local (npx supabase start). Pulados quando ele não está no ar.
 * Cada teste cria um usuário novo pela API de administração e entra com senha.
 */
export const URL_LOCAL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const CHAVE_SECRETA = process.env.SUPABASE_SECRET_KEY ?? '';

export async function bancoNoAr(): Promise<boolean> {
  try {
    const r = await fetch(`${URL_LOCAL}/auth/v1/health`, { headers: { apikey: CHAVE_PUBLICA } });
    return r.ok;
  } catch {
    return false;
  }
}

export async function usuarioNovo(): Promise<{ cliente: SupabaseClient; email: string; id: string }> {
  const admin = createClient(URL_LOCAL, CHAVE_SECRETA, { auth: { persistSession: false } });
  const email = `t${Date.now()}${Math.random().toString(36).slice(2, 7)}@exemplo.com`;
  const senha = 'senha-de-teste-123';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw error;
  const cliente = createClient(URL_LOCAL, CHAVE_PUBLICA, { auth: { persistSession: false } });
  const login = await cliente.auth.signInWithPassword({ email, password: senha });
  if (login.error) throw login.error;
  return { cliente, email, id: data.user.id };
}
