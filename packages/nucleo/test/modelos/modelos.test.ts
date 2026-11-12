import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { NOMES_ABAS } from '../../src/formato/documento';
import { importar } from '../../src/importacao/importar';
import { gerarEsquemaJson, gerarModeloJson } from '../../src/modelos/json';
import { gerarModeloXlsx } from '../../src/modelos/xlsx';

describe('modelo .json', () => {
  it('passa no import sem nenhum problema', async () => {
    const r = await importar([{ nome: 'modelo-journey.json', conteudo: JSON.stringify(gerarModeloJson()) }]);
    expect(r.problemas).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('o esquema descreve todas as abas e os obrigatórios', () => {
    const e = gerarEsquemaJson() as { properties: Record<string, { items: { required: string[]; properties: Record<string, unknown> } }> };
    expect(Object.keys(e.properties)).toEqual(['formato', ...NOMES_ABAS]);
    expect(e.properties.saidas!.items.required).toEqual(['id', 'de', 'opcao', 'para']);
    expect(e.properties.filas!.items.properties.membros).toMatchObject({ type: 'array' });
  });
});

describe('modelo .xlsx', () => {
  it('passa no import sem nenhum problema', async () => {
    const r = await importar([{ nome: 'modelo-journey.xlsx', conteudo: await gerarModeloXlsx() }]);
    expect(r.problemas).toEqual([]);
    expect(r.base.saidas).toHaveLength(8);
  });

  it('tem instruções, uma aba por tipo, nota no cabeçalho e lista de valores', async () => {
    const bytes = await gerarModeloXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['instrucoes', ...NOMES_ABAS]);
    const pecas = wb.getWorksheet('pecas')!;
    expect(pecas.getCell('B1').value).toBe('tipo');
    expect(JSON.stringify(pecas.getCell('B1').note)).toContain('Tipo da peça');
    expect(pecas.getCell('B2').dataValidation?.formulae?.[0]).toContain('menu');
  });
});
