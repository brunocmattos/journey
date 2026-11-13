import type { Cadastro } from '@journey/fluxo';
import { nomeNormalizado } from '@/editor/cadastros';
import type { supabaseServidor } from './supabase/servidor';

type Cliente = Awaited<ReturnType<typeof supabaseServidor>>;
type Erro = { code?: string; message: string };

/** Escapa `%`, `_` e `\` pra que o texto valha literalmente num `ilike`. */
const literal = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Cria o cadastro, ou acha o que já existe com o mesmo nome no mesmo tipo (sem caixa nem espaços, como o índice
 * único do banco). Tenta criar primeiro: duas pessoas (ou dois cliques) ao mesmo tempo dão no mesmo cadastro, e
 * não precisa ler a lista inteira (que passa das 1000 linhas que o PostgREST devolve por vez).
 */
export async function acharOuCriarCadastro(
  supabase: Cliente,
  empresaId: string,
  tipo: string,
  nome: string,
  campos: object,
): Promise<{ cadastro: Cadastro; novo: boolean } | { erro: Erro }> {
  const r = await supabase.from('cadastros').insert({ empresa_id: empresaId, tipo, nome, campos }).select('id, tipo, nome, campos').single();
  if (!r.error) return { cadastro: r.data as Cadastro, novo: true };
  if (r.error.code === '23505') {
    const parecidos = await supabase.from('cadastros').select('id, tipo, nome, campos').eq('empresa_id', empresaId).eq('tipo', tipo).ilike('nome', `%${literal(nome.trim())}%`);
    const igual = (parecidos.data as Cadastro[] | null)?.find((k) => nomeNormalizado(k.nome) === nomeNormalizado(nome));
    if (igual) return { cadastro: igual, novo: false };
  }
  return { erro: r.error };
}
