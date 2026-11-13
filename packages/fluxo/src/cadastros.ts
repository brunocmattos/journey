/** Cadastros e canais: são da empresa toda, não de um fluxo. As peças apontam pra eles pelo id. */

export interface Cadastro {
  id: string;
  /** Chave do tipo: pessoa, fila, equipe, sistema, horario, ou um tipo que a empresa criou. */
  tipo: string;
  nome: string;
  campos?: Record<string, unknown>;
}

export interface Canal {
  chave: string;
  nome: string;
  cor: string;
}

export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
export type Dia = (typeof DIAS)[number];

export interface JanelaHorario {
  dias: Dia[];
  /** HH:MM */
  inicio: string;
  /** HH:MM, não incluída. */
  fim: string;
}

export interface Feriado {
  /** AAAA-MM-DD */
  data: string;
  /** Repete todo ano no mesmo dia e mês. */
  todo_ano?: boolean;
  nome?: string;
}

/** Os campos de um cadastro do tipo Horário: as janelas da semana e os feriados (em que fica fechado). */
export interface CamposHorario {
  janelas: JanelaHorario[];
  feriados: Feriado[];
}

/** Os canais que toda empresa nova recebe. Ela pode mudar nome e cor, criar outros e arquivar. */
export const CANAIS_PADRAO: readonly Canal[] = [
  { chave: 'telefonia', nome: 'Telefonia', cor: '#1e8bdc' },
  { chave: 'whatsapp', nome: 'WhatsApp', cor: '#159e5a' },
  { chave: 'email', nome: 'E-mail', cor: '#c98410' },
  { chave: 'chat', nome: 'Chat', cor: '#7650d6' },
  { chave: 'interno', nome: 'Interno', cor: '#3a6a88' },
];

/** Os tipos de cadastro que toda empresa nova recebe. */
export const TIPOS_CADASTRO_PADRAO = [
  { chave: 'pessoa', nome: 'Pessoa' },
  { chave: 'fila', nome: 'Fila' },
  { chave: 'equipe', nome: 'Equipe' },
  { chave: 'sistema', nome: 'Sistema' },
  { chave: 'horario', nome: 'Horário' },
] as const;

const INICIO = /^([01]\d|2[0-3]):[0-5]\d$/;
/** O fim da janela pode ser 24:00 (até a meia-noite). */
const FIM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
/** AAAA-MM-DD que existe no calendário (2026-02-30 não). */
const ehData = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00Z`).toISOString().slice(0, 10) === v;

/**
 * Os campos de um cadastro Horário, se o cadastro é um horário com campos válidos; senão null.
 * Uma janela vai de início a fim no mesmo dia (fim depois do início; 24:00 vale como fim). Pra passar da
 * meia-noite, use duas janelas (22:00–24:00 num dia, 00:00–06:00 no outro).
 */
export function camposHorario(c: Cadastro | undefined): CamposHorario | null {
  if (!c || c.tipo !== 'horario' || !c.campos) return null;
  const { janelas, feriados } = c.campos as { janelas?: unknown; feriados?: unknown };
  if (!Array.isArray(janelas) || (feriados !== undefined && !Array.isArray(feriados))) return null;
  const js: JanelaHorario[] = [];
  for (const j of janelas) {
    const { dias, inicio, fim } = (j ?? {}) as Record<string, unknown>;
    if (!Array.isArray(dias) || !dias.every((d) => (DIAS as readonly unknown[]).includes(d))) return null;
    if (typeof inicio !== 'string' || typeof fim !== 'string' || !INICIO.test(inicio) || !FIM.test(fim) || fim <= inicio) return null;
    js.push({ dias: [...dias] as Dia[], inicio, fim });
  }
  const fs: Feriado[] = [];
  for (const f of (feriados ?? []) as unknown[]) {
    const { data, todo_ano, nome } = (f ?? {}) as Record<string, unknown>;
    if (!ehData(data)) return null;
    fs.push({ data, ...(todo_ano === true && { todo_ano: true }), ...(typeof nome === 'string' && { nome }) });
  }
  return { janelas: js, feriados: fs };
}
