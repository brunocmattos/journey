import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { NOMES_ABAS } from '../../src/formato/documento';
import { diagnosticar } from '../../src/diagnostico/diagnosticar';
import { ABAS } from '../../src/formato/abas';
import { lerCelula } from '../../src/formato/celulas';
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

describe('modelo .json: coerência', () => {
  it('o exemplo, importado e diagnosticado, não traz nenhum achado grave nem alerta', async () => {
    const r = await importar([{ nome: 'modelo-journey.json', conteudo: JSON.stringify(gerarModeloJson()) }]);
    expect(diagnosticar(r.base).filter((a) => a.gravidade !== 'observacao').map((a) => a.chave)).toEqual([]);
  });

  it('o padrão de hora do esquema aceita e rejeita exatamente o que a leitura de célula aceita e rejeita', () => {
    const e = gerarEsquemaJson() as { properties: { horarios: { items: { properties: { inicio: { pattern: string } } } } } };
    const re = new RegExp(e.properties.horarios.items.properties.inicio.pattern);
    const col = ABAS.horarios.colunas.find((c) => c.tipo === 'hora')!;
    const valores = ['8:30', '08:30', '00:00', '23:59', '24:00', '24:01', '24:59', '25:00', '8:60', '08:5', '800', '', '1:00', '12:3', '99:99'];
    for (const v of valores) {
      const lido = lerCelula(col, v);
      // A leitura normaliza H:MM pra HH:MM; o que importa é o valor gravado passar no esquema.
      const aceitaLeitura = lido?.ok === true;
      expect(re.test(v), `esquema pra "${v}"`).toBe(aceitaLeitura && v !== '');
      if (lido?.ok) expect(re.test(String(lido.valor))).toBe(true);
    }
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
