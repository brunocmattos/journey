import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { lerArquivos } from '../../src/importacao/ler-arquivos';

describe('lerArquivos', () => {
  it('lê csv pelo nome do arquivo e pula linhas vazias', async () => {
    const r = await lerArquivos([{ nome: 'filas.csv', conteudo: 'id;estrategia\n100;rrmemory\n\n;\n' }]);
    expect(r.problemas).toEqual([]);
    expect(r.tabelas.filas).toEqual([{ linha: 2, valores: { id: '100', estrategia: 'rrmemory' } }]);
  });

  it('recusa csv cujo nome não é uma aba', async () => {
    const r = await lerArquivos([{ nome: 'clientes.csv', conteudo: 'id\n1' }]);
    expect(r.problemas).toEqual([expect.objectContaining({ gravidade: 'erro', mensagem: expect.stringContaining('filas.csv') })]);
  });

  it('recusa extensão desconhecida', async () => {
    const r = await lerArquivos([{ nome: 'fluxo.pdf', conteudo: '' }]);
    expect(r.problemas[0]?.mensagem).toContain('.xlsx, .csv ou .json');
  });

  it('lê json do formato journey/1 convertendo os valores pra texto', async () => {
    const json = JSON.stringify({ formato: 'journey/1', ramais: [{ id: '2001', toque_s: 20, siga_me_lista: ['ramal:1', 'ramal:2'], transbordo_anti_loop: false }] });
    const r = await lerArquivos([{ nome: 'dados.json', conteudo: json }]);
    expect(r.problemas).toEqual([]);
    expect(r.tabelas.ramais).toEqual([{ linha: 1, presentes: new Set(['id', 'toque_s', 'siga_me_lista', 'transbordo_anti_loop']), valores: { id: '2001', toque_s: '20', siga_me_lista: 'ramal:1 ramal:2', transbordo_anti_loop: 'nao' } }]);
  });

  it('recusa json sem "formato": "journey/1" e json quebrado', async () => {
    const r = await lerArquivos([
      { nome: 'a.json', conteudo: '{"filas":[]}' },
      { nome: 'b.json', conteudo: '{' },
    ]);
    expect(r.problemas.map((p) => p.mensagem)).toEqual([expect.stringContaining('journey/1'), expect.stringContaining('não é um JSON válido')]);
  });

  it('lê xlsx com uma planilha por aba e ignora as outras', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('leia-me').addRow(['qualquer coisa']);
    const ws = wb.addWorksheet('Horarios');
    ws.addRow(['id', 'grupo', 'dias', 'inicio', 'fim']);
    ws.addRow(['h1', 'atendimento', 'seg-sex', '08:30', '18:00']);
    ws.getCell('A4').value = 'h2';
    ws.getCell('B4').value = 'atendimento';
    ws.getCell('C4').value = 'sab';
    ws.getCell('D4').value = new Date(Date.UTC(1899, 11, 30, 9, 0));
    ws.getCell('E4').value = '12:00';
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());

    const r = await lerArquivos([{ nome: 'modelo.xlsx', conteudo: bytes }]);
    expect(r.problemas).toEqual([]);
    expect(Object.keys(r.tabelas)).toEqual(['horarios']);
    expect(r.tabelas.horarios).toEqual([
      { linha: 2, valores: { id: 'h1', grupo: 'atendimento', dias: 'seg-sex', inicio: '08:30', fim: '18:00' } },
      { linha: 4, valores: { id: 'h2', grupo: 'atendimento', dias: 'sab', inicio: '09:00', fim: '12:00' } },
    ]);
  });

  it('acusa a mesma aba em dois arquivos', async () => {
    const r = await lerArquivos([
      { nome: 'filas.csv', conteudo: 'id\n1' },
      { nome: 'FILAS.csv', conteudo: 'id\n2' },
    ]);
    expect(r.problemas[0]?.mensagem).toContain('mais de um arquivo');
  });

  it('aceita nomes de aba com acento (xlsx) e csv em NFC ou NFD', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet(' Horários ').addRow(['id']);
    wb.getWorksheet(' Horários ')!.addRow(['h1']);
    wb.addWorksheet('Peças').addRow(['id']);
    wb.addWorksheet('SAÍDAS').addRow(['id']);
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    const r = await lerArquivos([
      { nome: 'modelo.xlsx', conteudo: bytes },
      { nome: 'Saídas.csv'.normalize('NFC'), conteudo: 'id\n1' },
      { nome: 'Saídas.csv'.normalize('NFD'), conteudo: 'id\n2' },
    ]);
    expect(Object.keys(r.tabelas).sort()).toEqual(['horarios', 'pecas', 'saidas']);
    expect(r.tabelas.horarios).toEqual([{ linha: 2, valores: { id: 'h1' } }]);
    expect(r.problemas).toEqual([expect.objectContaining({ aba: 'saidas', mensagem: expect.stringContaining('mais de um arquivo') }), expect.objectContaining({ aba: 'saidas' })]);
  });

  it('csv com nome acentuado vira a aba sem acento', async () => {
    const r = await lerArquivos([{ nome: 'Horários.csv'.normalize('NFD'), conteudo: 'id\nh1' }]);
    expect(r.problemas).toEqual([]);
    expect(r.tabelas.horarios).toEqual([{ linha: 2, valores: { id: 'h1' } }]);
  });

  it('xlsx corrompido vira problema em vez de rejeitar', async () => {
    const r = await lerArquivos([{ nome: 'quebrado.xlsx', conteudo: new Uint8Array([1, 2, 3]) }, { nome: 'filas.csv', conteudo: 'id\n1' }]);
    expect(r.problemas).toEqual([{ gravidade: 'erro', mensagem: '"quebrado.xlsx" não é uma planilha .xlsx válida' }]);
    expect(r.tabelas.filas).toHaveLength(1);
  });

  it('xlsx lê só até a largura do cabeçalho, ignorando célula perdida à direita', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('filas');
    ws.addRow(['id', 'estrategia']);
    ws.addRow(['100', 'rrmemory']);
    ws.getCell('XFD2').value = 'perdido';
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    const r = await lerArquivos([{ nome: 'm.xlsx', conteudo: bytes }]);
    expect(r.tabelas.filas).toEqual([{ linha: 2, valores: { id: '100', estrategia: 'rrmemory' } }]);
  });

  it('json: item que não é objeto vira erro com aba e linha', async () => {
    const json = JSON.stringify({ formato: 'journey/1', filas: [{ id: '1' }, 'x', 3, null, [1], { id: '2' }] });
    const r = await lerArquivos([{ nome: 'd.json', conteudo: json }]);
    expect(r.problemas.map((p) => [p.gravidade, p.aba, p.linha])).toEqual([
      ['erro', 'filas', 2],
      ['erro', 'filas', 3],
      ['erro', 'filas', 4],
      ['erro', 'filas', 5],
    ]);
    expect(r.tabelas.filas).toEqual([
      { linha: 1, valores: { id: '1' }, presentes: new Set(['id']) },
      { linha: 6, valores: { id: '2' }, presentes: new Set(['id']) },
    ]);
  });

  describe('cabeçalhos sem acento nem caixa', () => {
    it('csv: "Observação" e " HORÁRIO " viram observacao e horario', async () => {
      const r = await lerArquivos([{ nome: 'filas.csv', conteudo: 'ID;Observação; HORÁRIO \n1;nota;08:00' }]);
      expect(r.tabelas.filas).toEqual([{ linha: 2, valores: { id: '1', observacao: 'nota', horario: '08:00' } }]);
    });

    it('xlsx: cabeçalho com acento e maiúscula', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Filas');
      ws.addRow(['Id', 'Observação']);
      ws.addRow(['1', 'nota']);
      const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
      const r = await lerArquivos([{ nome: 'x.xlsx', conteudo: bytes }]);
      expect(r.tabelas.filas).toEqual([{ linha: 2, valores: { id: '1', observacao: 'nota' } }]);
    });

    it('json: chaves do item também', async () => {
      const json = JSON.stringify({ formato: 'journey/1', filas: [{ Id: '1', Observação: 'nota' }] });
      const r = await lerArquivos([{ nome: 'd.json', conteudo: json }]);
      expect(r.tabelas.filas![0]!.valores).toEqual({ id: '1', observacao: 'nota' });
    });

    it('cabeçalho "__proto__" não some: fica como coluna desconhecida', async () => {
      const r = await lerArquivos([{ nome: 'filas.csv', conteudo: 'id;__proto__\n1;x' }]);
      expect(Object.keys(r.tabelas.filas![0]!.valores)).toEqual(['id', '__proto__']);
      const j = await lerArquivos([{ nome: 'd.json', conteudo: '{"formato":"journey/1","filas":[{"id":"1","__proto__":"x"}]}' }]);
      expect(Object.keys(j.tabelas.filas![0]!.valores)).toEqual(['id', '__proto__']);
    });

    it('csv e xlsx com cabeçalho acentuado entram no import (a coluna não é perdida)', async () => {
      const { importar } = await import('../../src/importacao/importar');
      const r = await importar([{ nome: 'filas.csv', conteudo: 'id;Estratégia;Toque_por_membro_s;Observação\n1;linear;10;nota' }]);
      expect(r.problemas).toEqual([]);
      expect(r.base.filas[0]).toMatchObject({ estrategia: 'linear', observacao: 'nota' });
    });
  });

  it('json: guarda quais chaves cada item trouxe', async () => {
    const json = JSON.stringify({ formato: 'journey/1', filas: [{ id: '1', estrategia: 'linear' }, { id: '2' }] });
    const r = await lerArquivos([{ nome: 'd.json', conteudo: json }]);
    expect([...r.tabelas.filas![0]!.presentes!]).toEqual(['id', 'estrategia']);
    expect([...r.tabelas.filas![1]!.presentes!]).toEqual(['id']);
  });
});
