export const TIPOS_REF = ['entrada', 'horario', 'ramal', 'fila', 'grupo', 'peca', 'saida', 'fim', 'externo'] as const;
export type TipoRef = (typeof TIPOS_REF)[number];

/** Referências que existem sem precisar de linha em nenhuma aba. */
export const REFS_EMBUTIDAS = ['fim:desliga', 'fim:atendido', 'fim:caixa_postal', 'externo:celular'] as const;

/** Formato de um id: começa com letra ou número; depois letras, números, ponto, hífen ou sublinhado. */
export const PADRAO_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface RefLida {
  tipo: TipoRef;
  id: string;
}

export function lerRef(texto: string): RefLida | null {
  const m = /^([a-z]+):(.+)$/.exec(texto.trim());
  if (!m) return null;
  const tipo = m[1] as TipoRef;
  const id = m[2] as string;
  if (!(TIPOS_REF as readonly string[]).includes(tipo) || !PADRAO_ID.test(id)) return null;
  return { tipo, id };
}

export function montarRef(tipo: TipoRef, id: string): string {
  return `${tipo}:${id}`;
}

export function ehEmbutida(ref: string): boolean {
  return (REFS_EMBUTIDAS as readonly string[]).includes(ref);
}
