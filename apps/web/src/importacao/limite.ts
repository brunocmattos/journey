/** Teto do import, somando os arquivos. O servidor confere de novo; o formulário avisa antes de enviar. */
export const LIMITE_BYTES = 20 * 1024 * 1024;
export const ERRO_LIMITE = 'Os arquivos passam de 20 MB juntos.';

export function passaDoLimite(tamanhos: number[]): boolean {
  return tamanhos.reduce((s, t) => s + t, 0) > LIMITE_BYTES;
}
