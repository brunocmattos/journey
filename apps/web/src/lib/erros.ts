/** Erro do banco (PostgREST/Storage): o código do Postgres, quando há, e o texto cru. */
export interface ErroBanco {
  code?: string;
  message: string;
}

const GERAIS: Record<string, string> = {
  '42501': 'Sem acesso a esta empresa.',
};

/**
 * O texto pra pessoa ver. O erro cru vai só pro log do servidor: ele cita tabela, regra e coluna,
 * o que não ajuda quem está na tela e conta demais sobre o banco.
 */
export function mensagemDoErro(onde: string, erro: ErroBanco, porCodigo: Record<string, string> = {}): string {
  console.error(`[${onde}]`, erro.code, erro.message);
  return porCodigo[erro.code ?? ''] ?? GERAIS[erro.code ?? ''] ?? 'Não deu certo agora. Tenta de novo em instantes.';
}
