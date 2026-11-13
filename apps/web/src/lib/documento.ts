import type { Documento } from '@journey/nucleo/formato';

const LISTAS_DO_DOCUMENTO = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos', 'pecas', 'saidas'] as const;

/** A forma de um documento journey/1 (o banco já recusa outra; aqui é a segunda trava, antes da tela). */
export function ehDocumento(v: unknown): v is Documento {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return d.formato === 'journey/1' && LISTAS_DO_DOCUMENTO.every((k) => Array.isArray(d[k]));
}
