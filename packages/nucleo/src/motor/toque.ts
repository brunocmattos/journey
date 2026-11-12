import type { Grupo, Ramal } from '../formato/documento';

/** Quanto um ramal ou grupo toca quando a planilha não diz. */
export const TOQUE_PADRAO_S = 20;

/**
 * Quanto o ramal toca antes de transbordar. Com o siga-me completo (só o ramal + com a lista),
 * é a soma dos dois tempos; senão, o toque_s (ou o padrão).
 */
export function toqueDoRamal(x: Ramal): number {
  if (x.siga_me_so_ramal_s !== undefined && x.siga_me_com_lista_s !== undefined) return x.siga_me_so_ramal_s + x.siga_me_com_lista_s;
  return x.toque_s ?? TOQUE_PADRAO_S;
}

/** Quanto o grupo toca antes de esgotar. */
export function toqueDoGrupo(g: Grupo): number {
  return g.toque_s ?? TOQUE_PADRAO_S;
}
