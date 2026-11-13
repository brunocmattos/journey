/** O documento de um fluxo: o que o editor desenha e salva inteiro (formato journey/2). */
export const FORMATO = 'journey/2' as const;

/** O vocabulário comum de peças. A forma é só a aparência: nenhuma traz regra de um canal específico. */
export const TIPOS_PECA = ['inicio', 'mensagem', 'etapa', 'decisao', 'espera', 'atendimento', 'sistema', 'fim'] as const;
export type TipoPeca = (typeof TIPOS_PECA)[number];

export const NOMES_TIPOS: Record<TipoPeca, string> = {
  inicio: 'Início',
  mensagem: 'Mensagem',
  etapa: 'Etapa',
  decisao: 'Decisão',
  espera: 'Espera',
  atendimento: 'Atendimento',
  sistema: 'Sistema',
  fim: 'Fim',
};

/**
 * Quando a água passa por uma conexão:
 * - sempre: sem condição (a única saída, ou um caminho padrão com texto);
 * - opcao: uma escolha com código (tecla 1, S, N…) e nome;
 * - condicao: um texto livre ("cliente respondeu");
 * - tempo: depois de um tempo (soma no relógio do cliente);
 * - horario: dentro ou fora do horário de um cadastro Horário (o relógio decide);
 * - senao: o que sobra.
 */
export const REGRAS = ['sempre', 'opcao', 'condicao', 'tempo', 'horario', 'senao'] as const;
export type Regra = (typeof REGRAS)[number];

export interface Peca {
  id: string;
  tipo: TipoPeca;
  nome: string;
  x: number;
  y: number;
  /** Chave de um canal da empresa. Sem canal: segue o canal de antes. */
  canal?: string;
  /** Id de um cadastro da empresa (pessoa, fila, equipe, sistema, horário…). */
  responsavel?: string;
  /** Quanto tempo o cliente passa aqui, em segundos (pra simulação). */
  tempo_s?: number;
  descricao?: string;
  cor?: string;
}

export interface Conexao {
  id: string;
  de: string;
  para: string;
  regra: Regra;
  /** opcao: o código (1, S…); condicao: o texto da condição. */
  valor?: string;
  /** Nome da opção, ou texto no cano. */
  rotulo?: string;
  /** regra tempo: depois de quantos segundos. */
  tempo_s?: number;
  /** regra horario: qual lado do horário esta saída é. */
  horario?: 'dentro' | 'fora';
}

export interface Grupo {
  id: string;
  nome: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cor?: string;
}

export interface Nota {
  id: string;
  texto: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cor?: string;
}

export interface Documento {
  formato: typeof FORMATO;
  pecas: Peca[];
  conexoes: Conexao[];
  grupos: Grupo[];
  notas: Nota[];
}

export const documentoVazio = (): Documento => ({ formato: FORMATO, pecas: [], conexoes: [], grupos: [], notas: [] });
