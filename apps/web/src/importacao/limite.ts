/**
 * Teto do import, somando os arquivos. O servidor confere de novo; o formulário avisa antes de enviar.
 * 4 MB porque a Vercel corta o corpo de uma função em 4,5 MB; mais que isso pede upload direto pro Storage.
 */
export const LIMITE_BYTES = 4 * 1024 * 1024;
export const ERRO_LIMITE = 'Os arquivos passam de 4 MB juntos.';

export function passaDoLimite(tamanhos: number[]): boolean {
  return tamanhos.reduce((s, t) => s + t, 0) > LIMITE_BYTES;
}
