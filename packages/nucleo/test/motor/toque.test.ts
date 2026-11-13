import { describe, expect, it } from 'vitest';
import { executar, TOQUE_PADRAO_S, toqueDoGrupo, toqueDoRamal } from '../../src/motor';
import { doc, grupo, ramal } from '../apoio';

describe('toque', () => {
  it('ramal: siga-me completo soma os dois tempos; incompleto ou sem siga-me usa toque_s ou o padrão', () => {
    expect(toqueDoRamal(ramal('1', { toque_s: 27, siga_me_so_ramal_s: 7, siga_me_com_lista_s: 15 }))).toBe(22);
    expect(toqueDoRamal(ramal('1', { toque_s: 27, siga_me_so_ramal_s: 7 }))).toBe(27);
    expect(toqueDoRamal(ramal('1', { toque_s: 12 }))).toBe(12);
    expect(toqueDoRamal(ramal('1'))).toBe(TOQUE_PADRAO_S);
  });

  it('grupo: toque_s ou o padrão', () => {
    expect(toqueDoGrupo(grupo('1', { toque_s: 30 }))).toBe(30);
    expect(toqueDoGrupo(grupo('1', { toque_s: undefined }))).toBe(TOQUE_PADRAO_S);
  });

  it('o motor usa o mesmo tempo', () => {
    const x = ramal('1', { siga_me_so_ramal_s: 7, siga_me_com_lista_s: 15 });
    const e = executar(doc({ ramais: [x] }), { entrada: 'ramal:1', inicio: '2026-11-23T10:00', modo: 'ninguem_atende' });
    expect(JSON.stringify(e.eventos)).toContain(`em ${toqueDoRamal(x)} s`);
  });
});
