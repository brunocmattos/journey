'use server';

import { lerDocumento, type Cadastro } from '@journey/fluxo';
import { ehValidade, expiraEm, type LinkResumo } from '@/compartilhar/opcoes';
import type { CenarioDoLink } from '@/compartilhar/retrato';
import { playDoCenario } from '@/editor/cenarios';
import { rodar } from '@/editor/play';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';
import { linkPublicoConfigurado } from '@/lib/link';

/*
 * Os links só aparecem no "Compartilhar" do editor, que muda a lista no lugar com o que estas ações devolvem:
 * sem revalidatePath.
 */

/** O que a pessoa escolhe no "Compartilhar". */
export interface OpcoesLink {
  /** null: o fluxo de agora. Número: uma versão marcada. */
  versao: number | null;
  esconderNomes: boolean;
  /** O cenário salvo que toca quando o link abre (copiado pro link agora). */
  cenarioId: string | null;
  /** Dias, ou null sem prazo (só os de VALIDADES). */
  validade: number | null;
}

const RESUMO = 'id, token, versao, esconder_nomes, cenario_nome:cenario->>nome, expira_em, revogado_em, criado_em';

type Supabase = Awaited<ReturnType<typeof usuarioAtual>>['supabase'];

/**
 * Com versão fixa, o cenário tem que tocar nela: o Início dele existe na versão e cada escolha guardada serve (o motor
 * aceita todas). Senão quem abre o link veria o play parar no começo ou numa pergunta que o cenário não responde.
 * Os Horários da empresa entram porque, no modo relógio, é o horário que decide algumas saídas.
 * Devolve o motivo da recusa, ou null. (Sem versão fixa, o link mostra o fluxo de agora, que ainda vai mudar.)
 */
async function cenarioNaVersao(supabase: Supabase, empresaId: string, fluxoId: string, versao: number, cenario: CenarioDoLink): Promise<string | null> {
  const v = await supabase.from('fluxo_versoes').select('documento').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('numero', versao).maybeSingle();
  if (v.error) return mensagemDoErro('criarLink', v.error);
  if (!v.data) return 'Esta versão não existe mais neste fluxo.';
  const doc = lerDocumento((v.data as { documento: unknown }).documento).documento;
  if (!doc) return `A versão ${versao} não abre: o documento dela não é válido.`;
  if (!doc.pecas.some((p) => p.id === cenario.inicio)) return `O cenário “${cenario.nome}” começa numa peça que não existe na versão ${versao}. Escolhe outra versão ou outro cenário.`;
  const h = await supabase.from('cadastros').select('id, tipo, nome, campos').eq('empresa_id', empresaId).eq('tipo', 'horario');
  if (h.error) return mensagemDoErro('criarLink', h.error);
  const x = rodar(doc, { cadastros: (h.data ?? []) as Cadastro[], canal: null }, playDoCenario(cenario));
  if (x.escolhas.length !== cenario.escolhas.length) return `O cenário “${cenario.nome}” não toca na versão ${versao}: alguma escolha dele não existe nela. Escolhe outra versão ou outro cenário.`;
  return null;
}

/**
 * Cria o link e devolve como a lista mostra (com o token). O cenário inicial é copiado do banco (não do navegador)
 * pra dentro do link. O token, o autor e as datas são do banco; o membro só manda as opções.
 * Sem a chave secreta no servidor o link não abriria pra ninguém: nem cria.
 */
export async function criarLink(empresaId: string, fluxoId: string, o: OpcoesLink): Promise<{ link?: LinkResumo; erro?: string }> {
  if (!linkPublicoConfigurado()) {
    console.error('[criarLink] a chave secreta do Supabase não está configurada neste servidor: o link público não abriria');
    return { erro: 'Os links públicos ainda não estão configurados neste servidor (falta a chave secreta). Avisa quem cuida do Journey.' };
  }
  if (!o || typeof o !== 'object') return { erro: 'Opções inválidas.' };
  if (!ehValidade(o.validade)) return { erro: 'Escolhe uma validade da lista.' };
  if (o.versao !== null && !(Number.isInteger(o.versao) && o.versao > 0)) return { erro: 'Versão inválida.' };
  if (o.cenarioId !== null && typeof o.cenarioId !== 'string') return { erro: 'Cenário inválido.' };
  const { supabase } = await usuarioAtual();
  let cenario: CenarioDoLink | null = null;
  if (o.cenarioId) {
    const c = await supabase.from('cenarios').select('nome, inicio, quando, modo, escolhas').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('id', o.cenarioId).maybeSingle();
    if (c.error) return { erro: mensagemDoErro('criarLink', c.error) };
    if (!c.data) return { erro: 'Este cenário não existe mais.' };
    cenario = c.data as CenarioDoLink;
    if (o.versao !== null) {
      const problema = await cenarioNaVersao(supabase, empresaId, fluxoId, o.versao, cenario);
      if (problema) return { erro: problema };
    }
  }
  const r = await supabase
    .from('links')
    .insert({ empresa_id: empresaId, fluxo_id: fluxoId, versao: o.versao, esconder_nomes: o.esconderNomes !== false, cenario, expira_em: expiraEm(o.validade, new Date()) })
    .select(RESUMO)
    .single();
  // 23503 é a FK: com versão fixa, é a versão; sem ela, só pode ser o fluxo.
  if (r.error) return { erro: mensagemDoErro('criarLink', r.error, { '23503': o.versao !== null ? 'Esta versão não existe mais neste fluxo.' : 'Este fluxo não existe mais.' }) };
  return { link: r.data as LinkResumo };
}

/** Revoga pra sempre: quem abrir depois vê a página de link revogado. Devolve a data, que é a do banco. */
export async function revogarLink(empresaId: string, fluxoId: string, linkId: string): Promise<{ revogado_em?: string; erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('links')
    .update({ revogado_em: new Date().toISOString() })
    .eq('empresa_id', empresaId)
    .eq('fluxo_id', fluxoId)
    .eq('id', linkId)
    .is('revogado_em', null)
    .select('revogado_em');
  if (r.error) return { erro: mensagemDoErro('revogarLink', r.error) };
  const linha = (r.data as { revogado_em: string }[] | null)?.[0];
  if (!linha) return { erro: 'Este link não existe mais ou já foi revogado.' };
  return { revogado_em: linha.revogado_em };
}
