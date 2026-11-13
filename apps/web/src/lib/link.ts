import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { montarRetrato, type LinkDoBanco, type Retrato } from '@/compartilhar/retrato';

export type LinkAberto =
  | { estado: 'ok'; retrato: Retrato }
  | { estado: 'revogado' | 'vencido'; quando: string }
  | { estado: 'inexistente' };

/** O banco gera 24 caracteres de base64 de URL; qualquer outra coisa nem vai pro banco. */
const TOKEN = /^[A-Za-z0-9_-]{24}$/;

/** Se o servidor tem a chave secreta: sem ela, o link público não abre, e criar link é recusado. */
export function linkPublicoConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

/**
 * O link público, pelo token, já como o retrato que a página mostra.
 * É o único lugar do app que usa a chave secreta (SUPABASE_SECRET_KEY): quem abre o link não tem sessão, e a função
 * abrir_link só aceita a service_role. Aqui ela só chama abrir_link; os nomes saem em `montarRetrato`, antes de
 * qualquer coisa ir pro navegador. Um pedido, uma ida ao banco (a página e o título chamam; o cache do React junta).
 */
export const abrirLink = cache(async (token: string): Promise<LinkAberto> => {
  // Cada pedido lê o banco: um link revogado deixa de abrir na hora.
  await connection();
  if (!TOKEN.test(token)) return { estado: 'inexistente' };
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error('SUPABASE_SECRET_KEY não está configurada: o link público precisa dela no servidor');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc('abrir_link', { p_token: token });
  if (error) throw new Error(error.message);
  const r = data as LinkDoBanco | { estado: 'revogado' | 'vencido'; quando: string } | { estado: 'inexistente' };
  if (r.estado !== 'ok') return r;
  const retrato = montarRetrato(r);
  // O banco só confere a forma do documento: um que o lerDocumento recusa não vira página (o erro do link aparece).
  if (!retrato) throw new Error('este link não abre: o documento do fluxo não é um journey/2 válido');
  return { estado: 'ok', retrato };
});
