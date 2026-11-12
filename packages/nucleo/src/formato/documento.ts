export const NOMES_ABAS = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos', 'pecas', 'saidas'] as const;
export type NomeAba = (typeof NOMES_ABAS)[number];

export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
export type Dia = (typeof DIAS)[number];

export const CANAIS = ['telefonia', 'whatsapp', 'email', 'ocorrencia'] as const;
export type Canal = (typeof CANAIS)[number];

export const TIPOS_PECA = ['audio', 'menu', 'regra_horario', 'regra_feriado', 'consulta', 'transferencia', 'atalho', 'pesquisa', 'fim'] as const;
export type TipoPeca = (typeof TIPOS_PECA)[number];

export const TIPOS_RAMAL = ['pessoa', 'webphone', 'setor'] as const;
export const ESTRATEGIAS_FILA = ['ringall', 'rrmemory', 'linear', 'leastrecent', 'fewestcalls', 'random', 'wrandom'] as const;
export const ESTRATEGIAS_GRUPO = ['ringall', 'hunt', 'memoryhunt', 'firstavailable', 'random'] as const;

export interface Expressao {
  chave: string;
  valor: string;
}

export interface Entrada {
  id: string;
  numero: string;
  nome?: string;
  canal: Canal;
  destino: string;
  ativo: boolean;
  observacao?: string;
}

export interface Horario {
  id: string;
  grupo: string;
  nome?: string;
  dias: Dia[];
  inicio: string;
  fim: string;
  observacao?: string;
}

export interface Feriado {
  id: string;
  calendario: string;
  data: string;
  nome?: string;
  todo_ano: boolean;
  observacao?: string;
}

export interface Ramal {
  id: string;
  nome?: string;
  tipo?: (typeof TIPOS_RAMAL)[number];
  toque_s?: number;
  siga_me_so_ramal_s?: number;
  siga_me_com_lista_s?: number;
  siga_me_lista?: string[];
  ao_nao_atender?: string;
  ao_ocupado?: string;
  ao_indisponivel?: string;
  transbordo_anti_loop: boolean;
  observacao?: string;
}

export interface Fila {
  id: string;
  nome?: string;
  estrategia: string;
  toque_por_membro_s?: number;
  espera_maxima_s?: number;
  ao_esgotar?: string;
  membros?: string[];
  membros_dinamicos: boolean;
  pesquisa_ao_desligar?: string;
  observacao?: string;
}

export interface Grupo {
  id: string;
  nome?: string;
  estrategia: string;
  toque_s?: number;
  ao_esgotar?: string;
  membros?: string[];
  observacao?: string;
}

export interface Peca {
  id: string;
  tipo: TipoPeca;
  nome?: string;
  horario?: string;
  calendario?: string;
  espera_s?: number;
  tentativas?: number;
  texto?: string;
  duracao_s?: number;
  guarda_variavel?: string;
  canal?: Canal;
  id_central?: string;
  ativo: boolean;
  observacao?: string;
}

export interface Saida {
  id: string;
  de: string;
  opcao: string;
  rotulo?: string;
  quando?: Expressao;
  define?: Expressao;
  para: string;
  ativo: boolean;
  observacao?: string;
}

export interface Documento {
  formato: 'journey/1';
  entradas: Entrada[];
  horarios: Horario[];
  feriados: Feriado[];
  ramais: Ramal[];
  filas: Fila[];
  grupos: Grupo[];
  pecas: Peca[];
  saidas: Saida[];
}

export function documentoVazio(): Documento {
  return { formato: 'journey/1', entradas: [], horarios: [], feriados: [], ramais: [], filas: [], grupos: [], pecas: [], saidas: [] };
}

/** Acesso genérico às abas, para código que trata todas do mesmo jeito. */
export type LinhaGenerica = { id: string } & Record<string, unknown>;
export function tabelasDe(doc: Documento): Record<NomeAba, LinhaGenerica[]> {
  return doc as unknown as Record<NomeAba, LinhaGenerica[]>;
}
