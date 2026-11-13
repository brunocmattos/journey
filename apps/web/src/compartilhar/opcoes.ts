import { FUSO } from '@/lib/fuso';

/** As validades que a tela oferece, em dias; null é sem prazo. */
export const VALIDADES = [7, 30, 90, null] as const;
export type Validade = (typeof VALIDADES)[number];
export const VALIDADE_PADRAO: Validade = 30;

export const ehValidade = (v: unknown): v is Validade => (VALIDADES as readonly unknown[]).includes(v);

export const rotuloValidade = (v: Validade) => (v === null ? 'sem prazo' : `${v} dias`);

/** Quando vence um link criado agora, em ISO; null sem prazo. */
export function expiraEm(dias: Validade, agora: Date): string | null {
  return dias === null ? null : new Date(agora.getTime() + dias * 86_400_000).toISOString();
}

/** Um link na lista do "Compartilhar". */
export interface LinkResumo {
  id: string;
  token: string;
  versao: number | null;
  esconder_nomes: boolean;
  cenario_nome: string | null;
  expira_em: string | null;
  revogado_em: string | null;
  criado_em: string;
}

export type Situacao = 'ativo' | 'vencido' | 'revogado';

export function situacao(l: Pick<LinkResumo, 'expira_em' | 'revogado_em'>, agora: Date): Situacao {
  if (l.revogado_em) return 'revogado';
  if (l.expira_em && new Date(l.expira_em).getTime() <= agora.getTime()) return 'vencido';
  return 'ativo';
}

const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
export const dataCurta = (iso: string) => dia.format(new Date(iso));

/** "versão 3 · nomes escondidos · cenário “E se…” · vale até 12/12/2026". */
export function descreverLink(l: LinkResumo, agora: Date): string {
  const partes = [
    l.versao === null ? 'o fluxo de agora' : `versão ${l.versao}`,
    l.esconder_nomes ? 'nomes escondidos' : 'com os nomes',
    l.cenario_nome ? `cenário “${l.cenario_nome}”` : 'sem cenário',
  ];
  const s = situacao(l, agora);
  if (s === 'revogado') partes.push(`revogado em ${dataCurta(l.revogado_em!)}`);
  else if (s === 'vencido') partes.push(`venceu em ${dataCurta(l.expira_em!)}`);
  else partes.push(l.expira_em ? `vale até ${dataCurta(l.expira_em)}` : 'sem prazo');
  return partes.join(' · ');
}

/** O endereço do link a partir da origem do app. */
export const enderecoDoLink = (origem: string, token: string) => `${origem}/l/${token}`;

/** Uma linha com o que "esconder nomes" não pega (os limites estão em compartilhar/retrato.ts, seção "Nomes"). */
export const LIMITES_ESCONDER =
  'Troca o nome de cada pessoa cadastrada, inteiro ou por partes, em todo texto do fluxo; apelidos, abreviações, e-mails e telefones escritos no texto ficam.';

/** O que o formulário do "Compartilhar" manda, já no formato da ação criarLink. */
export interface EscolhasDoLink {
  versao: number | null;
  esconderNomes: boolean;
  cenarioId: string | null;
  validade: Validade;
}

/** Lê o formulário: versão e cenário vazios são "o fluxo de agora" e "nenhum"; validade "sem" é sem prazo. */
export function escolhasDoFormulario(f: { versao: string; cenario: string; esconder: boolean; validade: string }): EscolhasDoLink {
  const validade = f.validade === 'sem' ? null : Number(f.validade);
  return {
    versao: f.versao ? Number(f.versao) : null,
    esconderNomes: f.esconder,
    cenarioId: f.cenario || null,
    validade: ehValidade(validade) ? validade : VALIDADE_PADRAO,
  };
}
