'use server';

import { ehEsperado, type Cenario, type CenarioNovo } from '@/editor/cenarios';
import { quandoValido } from '@/editor/play';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

/*
 * Os cenários só aparecem no editor, que guarda a lista e muda no lugar com o que estas ações devolvem: sem
 * revalidatePath (refazer a página leria o documento inteiro de novo à toa).
 */

const COLUNAS = 'id, nome, inicio, quando, modo, escolhas, esperado, revisao_aprovada, atualizado_em';
const SUMIU = 'Este cenário não existe mais.';

const nomeValido = (nome: unknown): string | null => {
  const n = typeof nome === 'string' ? nome.trim() : '';
  return n && n.length <= 200 ? n : null;
};
const revisaoValida = (r: unknown): r is number => Number.isInteger(r) && (r as number) >= 0;

/** O que o banco confere (cenarios_*), conferido antes: o erro vira um texto que diz o que está errado. */
function conferir(c: CenarioNovo): string | null {
  if (typeof c.inicio !== 'string' || !c.inicio) return 'O cenário precisa de um Início.';
  if (typeof c.quando !== 'string' || !quandoValido(c.quando)) return 'A data e hora do cenário não estão no formato certo.';
  if (c.modo !== 'relogio' && c.modo !== 'livre') return 'O modo do cenário é "relógio" ou "livre".';
  if (!Array.isArray(c.escolhas) || !c.escolhas.every((e) => typeof e === 'string')) return 'As escolhas do cenário não estão no formato certo.';
  if (!ehEsperado(c.esperado)) return 'O resultado do cenário não está no formato certo: dá play até o fim e salva de novo.';
  return null;
}

/** Salva o caminho do play como cenário, com o resultado aprovado na revisão do fluxo de agora. */
export async function salvarCenario(empresaId: string, fluxoId: string, nome: string, c: CenarioNovo, revisao: number): Promise<{ cenario?: Cenario; erro?: string }> {
  const n = nomeValido(nome);
  if (!n) return { erro: 'O nome do cenário vai de 1 a 200 letras.' };
  const problema = c && typeof c === 'object' ? conferir(c) : 'O cenário não está no formato certo.';
  if (problema) return { erro: problema };
  if (!revisaoValida(revisao)) return { erro: 'Revisão inválida.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('cenarios')
    .insert({ empresa_id: empresaId, fluxo_id: fluxoId, nome: n, inicio: c.inicio, quando: c.quando, modo: c.modo, escolhas: c.escolhas, esperado: c.esperado, revisao_aprovada: revisao })
    .select(COLUNAS)
    .single();
  if (r.error) return { erro: mensagemDoErro('salvarCenario', r.error, { '23503': 'Este fluxo não existe mais.', '23514': 'O cenário não está no formato certo.' }) };
  return { cenario: r.data as Cenario };
}

/**
 * O fluxo mudou e o resultado novo é o certo: ele passa a ser o esperado, aprovado nesta revisão, com as escolhas que
 * o motor aceitou (`paraAprovar`). Só o resultado deixaria uma escolha que não serve mais, e o cenário seguiria "mudou".
 */
export async function aprovarCenario(empresaId: string, fluxoId: string, id: string, novo: Pick<Cenario, 'escolhas' | 'esperado'>, revisao: number): Promise<{ erro?: string }> {
  if (!novo || typeof novo !== 'object' || !Array.isArray(novo.escolhas) || !novo.escolhas.every((e) => typeof e === 'string'))
    return { erro: 'As escolhas do cenário não estão no formato certo.' };
  if (!ehEsperado(novo.esperado)) return { erro: 'O resultado não está no formato certo: dá play até o fim e aprova de novo.' };
  if (!revisaoValida(revisao)) return { erro: 'Revisão inválida.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('cenarios')
    .update({ escolhas: novo.escolhas, esperado: novo.esperado, revisao_aprovada: revisao })
    .eq('empresa_id', empresaId)
    .eq('fluxo_id', fluxoId)
    .eq('id', id)
    .select('id');
  if (r.error) return { erro: mensagemDoErro('aprovarCenario', r.error, { '23514': 'O cenário não está no formato certo.' }) };
  if (!r.data?.length) return { erro: SUMIU };
  return {};
}

export async function renomearCenario(empresaId: string, fluxoId: string, id: string, nome: string): Promise<{ erro?: string }> {
  const n = nomeValido(nome);
  if (!n) return { erro: 'O nome do cenário vai de 1 a 200 letras.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cenarios').update({ nome: n }).eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('id', id).select('id');
  if (r.error) return { erro: mensagemDoErro('renomearCenario', r.error) };
  if (!r.data?.length) return { erro: SUMIU };
  return {};
}

export async function apagarCenario(empresaId: string, fluxoId: string, id: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cenarios').delete().eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('id', id).select('id');
  if (r.error) return { erro: mensagemDoErro('apagarCenario', r.error) };
  if (!r.data?.length) return { erro: SUMIU };
  return {};
}
