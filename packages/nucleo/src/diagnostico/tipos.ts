export type Gravidade = 'grave' | 'alerta' | 'observacao';

export type TipoAchado =
  | 'beco_sem_saida'
  | 'destino_inexistente'
  | 'ciclo_transbordo'
  | 'volta_sem_limite'
  | 'redundancia'
  | 'sem_entrada'
  | 'no_inativo'
  | 'volta_propria_fila'
  | 'grupo_desliga'
  | 'buraco_horario'
  | 'espera_sem_limite'
  | 'plano_b_nao_dispara'
  | 'dado_incompleto';

export const GRAVIDADE: Record<TipoAchado, Gravidade> = {
  beco_sem_saida: 'grave',
  destino_inexistente: 'grave',
  ciclo_transbordo: 'grave',
  volta_sem_limite: 'alerta',
  redundancia: 'alerta',
  sem_entrada: 'alerta',
  no_inativo: 'alerta',
  volta_propria_fila: 'alerta',
  grupo_desliga: 'alerta',
  buraco_horario: 'observacao',
  espera_sem_limite: 'observacao',
  plano_b_nao_dispara: 'observacao',
  dado_incompleto: 'observacao',
};

export interface Achado {
  tipo: TipoAchado;
  gravidade: Gravidade;
  /** Estável entre imports: tipo + referências. Usada pra marcar como intencional. */
  chave: string;
  titulo: string;
  texto: string;
  /** Referências envolvidas, a principal primeiro. */
  refs: string[];
  /** Campos de origem, quando o achado vem de colunas específicas (ex.: ao_nao_atender). */
  campos?: string[];
}

export function achado(tipo: TipoAchado, chave: string, titulo: string, texto: string, refs: string[], campos?: string[]): Achado {
  const a: Achado = { tipo, gravidade: GRAVIDADE[tipo], chave: `${tipo}:${chave}`, titulo, texto, refs };
  if (campos) a.campos = campos;
  return a;
}
