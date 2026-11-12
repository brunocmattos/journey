import type { NomeAba } from '../formato/documento';

export interface Problema {
  /** Erro bloqueia o import. Aviso não bloqueia. */
  gravidade: 'erro' | 'aviso';
  aba?: NomeAba;
  linha?: number;
  coluna?: string;
  mensagem: string;
}

/** "saidas, linha 14, coluna para: …" */
export function descrever(p: Problema): string {
  const onde = [p.aba, p.linha !== undefined ? `linha ${p.linha}` : undefined, p.coluna ? `coluna ${p.coluna}` : undefined].filter(Boolean).join(', ');
  return onde ? `${onde}: ${p.mensagem}` : p.mensagem;
}
