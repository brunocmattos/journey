import type { NomeAba } from '../formato/documento';

export interface Problema {
  /** Erro bloqueia o import. Aviso não bloqueia. */
  gravidade: 'erro' | 'aviso';
  aba?: NomeAba;
  linha?: number;
  /** Id do item, quando o problema é de um item só. */
  id?: string;
  coluna?: string;
  mensagem: string;
  /**
   * Código da regra que gerou o problema (ex.: ref_inexistente, menu_sem_tempo), quando vem da validação do documento.
   * Não muda com nomes de exibição; serve pra comparar problemas entre a base e o efetivo.
   */
  regra?: string;
  /** 'ajuste': o problema vem dos ajustes manuais, não do arquivo da central. */
  origem?: 'ajuste';
}

/** "saidas, linha 14, coluna para: …". Sem linha (item criado à mão), mostra o id. */
export function descrever(p: Problema): string {
  const item = p.linha !== undefined ? `linha ${p.linha}` : p.id;
  const onde = [p.aba, item, p.coluna ? `coluna ${p.coluna}` : undefined].filter(Boolean).join(', ');
  return onde ? `${onde}: ${p.mensagem}` : p.mensagem;
}
