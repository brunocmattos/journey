import { describe, expect, it } from 'vitest';
import { escreverCsv, lerCsv } from '../../src/importacao/csv';

describe('csv', () => {
  it('usa ponto e vírgula quando o cabeçalho tem', () => {
    expect(lerCsv('a;b\n1;2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('usa vírgula quando o cabeçalho não tem ponto e vírgula', () => {
    expect(lerCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('respeita aspas, aspas duplas e quebra de linha dentro do campo', () => {
    expect(lerCsv('a;b\n"x;y";"diz ""oi""\nok"\n')).toEqual([
      ['a', 'b'],
      ['x;y', 'diz "oi"\nok'],
    ]);
  });
  it('tira a marca BOM', () => {
    expect(lerCsv('﻿id;nome\n1;A')[0]).toEqual(['id', 'nome']);
  });
  it('escreve e lê de volta', () => {
    const m = [
      ['id', 'texto'],
      ['1', 'a;b "c"'],
    ];
    expect(lerCsv(escreverCsv(m))).toEqual(m);
  });
});
