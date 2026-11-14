import { describe, expect, it } from 'vitest';
import { ABAS, abaDaTecla, abaDoHash, hashDaAba, idDaAba } from '@/landing/abas';
import { CHAVES_EXEMPLO, EXEMPLOS } from '@/landing/exemplos';

describe('landing: as abas dos exemplos', () => {
  it('são os mesmos quatro dos retratos, na mesma ordem', () => {
    expect(ABAS.map((a) => a.chave)).toEqual([...CHAVES_EXEMPLO]);
  });

  it('a cor de cada aba (a da miniatura) é a do canal do exemplo', () => {
    for (const a of ABAS) {
      const r = EXEMPLOS[a.chave];
      expect(a.cor, a.chave).toBe(r.canais.find((c) => c.chave === r.fluxo.canal)!.cor);
    }
  });

  it('o hash leva à aba e volta', () => {
    for (const a of ABAS) expect(abaDoHash(hashDaAba(a.chave))).toBe(a.chave);
    expect(hashDaAba('credito')).toBe('#exemplo-credito');
  });

  it('o id do botão da aba não é o do hash (senão o navegador rolaria até a aba, e não até a seção)', () => {
    for (const a of ABAS) expect(`#${idDaAba(a.chave)}`).not.toBe(hashDaAba(a.chave));
    expect(idDaAba('ura')).toBe('aba-ura');
  });

  it.each(['', '#exemplos', '#exemplo-', '#exemplo-fax', '#exemplo-ura-x', '#EXEMPLO-URA', 'exemplo-ura'])('"%s" não é aba nenhuma', (h) => {
    expect(abaDoHash(h)).toBeNull();
  });

  it('as setas andam e dão a volta; Home e End vão pras pontas; outras teclas, nada', () => {
    expect(abaDaTecla('ura', 'ArrowRight')).toBe('whatsapp');
    expect(abaDaTecla('credito', 'ArrowRight')).toBe('ura');
    expect(abaDaTecla('ura', 'ArrowLeft')).toBe('credito');
    expect(abaDaTecla('email', 'Home')).toBe('ura');
    expect(abaDaTecla('whatsapp', 'End')).toBe('credito');
    expect(abaDaTecla('ura', 'Enter')).toBeNull();
    expect(abaDaTecla('ura', 'ArrowDown')).toBeNull();
  });
});
