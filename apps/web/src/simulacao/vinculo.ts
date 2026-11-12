import type { Sessao } from './sessao';

/**
 * Se a simulação na tela ainda é o caminho de um cenário salvo.
 * - `completo`: mesma entrada, hora e modo, e as mesmas escolhas: dá pra comparar com o esperado e aprovar.
 * - `parcial`: as escolhas são o começo das do cenário (voltou uma decisão); ainda é ele, sem comparação.
 * - `null`: outra escolha, uma a mais, ou outra entrada, hora ou modo. Aprovar aqui gravaria um esperado
 *   que as escolhas do cenário não reproduzem, então a tela solta o cenário.
 */
export function vinculo(cenario: Sessao, sessao: Sessao): 'completo' | 'parcial' | null {
  if (cenario.entrada !== sessao.entrada || cenario.inicio !== sessao.inicio || cenario.modo !== sessao.modo) return null;
  if (sessao.escolhas.length > cenario.escolhas.length) return null;
  if (sessao.escolhas.some((e, i) => e !== cenario.escolhas[i])) return null;
  return sessao.escolhas.length === cenario.escolhas.length ? 'completo' : 'parcial';
}
