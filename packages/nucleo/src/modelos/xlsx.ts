import ExcelJS from 'exceljs';
import { ABAS, type Coluna, type TipoColuna } from '../formato/abas';
import { NOMES_ABAS } from '../formato/documento';

const TIPO_LEGIVEL: Record<TipoColuna, string> = {
  texto: 'texto',
  inteiro: 'número inteiro',
  booleano: 'sim ou nao',
  enum: 'lista',
  ref: 'referência',
  refs: 'referências',
  hora: 'hora HH:MM',
  data: 'data AAAA-MM-DD',
  dias: 'dias da semana',
  expressao: 'chave=valor',
  opcao: 'opção',
};

const REGRAS_GERAIS = [
  'Como preencher o modelo do Journey',
  'Cada aba descreve um tipo de coisa. Toda linha precisa de um id único e estável na aba: use o mesmo da central, pra os ajustes feitos no Journey sobreviverem ao próximo import.',
  'Referências apontam pra outras linhas no formato tipo:id, por exemplo fila:90011, ramal:2001, peca:menu-principal, horario:atendimento. Também existem fim:desliga, fim:atendido, fim:caixa_postal e externo:celular.',
  'Listas são separadas por espaço. Tempos em segundos. Horas em HH:MM. Datas em AAAA-MM-DD.',
  'Pode enviar só algumas abas (import parcial). As linhas se juntam pelo id.',
  'Abaixo, cada coluna de cada aba. As linhas de exemplo de todas as abas formam um fluxo pequeno e completo.',
];

function descricaoCompleta(c: Coluna): string {
  const partes = [c.descricao];
  if (c.valores) partes.push(`Valores: ${c.valores.join(', ')}.`);
  if (c.refs) partes.push(`Aceita: ${c.refs.map((r) => `${r}:…`).join(', ')}.`);
  if (c.padrao !== undefined) partes.push(`Vazio = ${c.padrao}.`);
  return partes.join(' ');
}

const obrigatoria = (c: Coluna) => c.obrigatoria === true && c.padrao === undefined;

/** Planilha modelo: aba de instruções e uma aba por tipo, com listas de valores e exemplos. */
export async function gerarModeloXlsx(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Journey';

  const instr = wb.addWorksheet('instrucoes');
  instr.columns = [
    { header: 'aba', key: 'aba', width: 12 },
    { header: 'coluna', key: 'coluna', width: 24 },
    { header: 'obrigatória', key: 'obrigatoria', width: 12 },
    { header: 'tipo', key: 'tipo', width: 18 },
    { header: 'descrição', key: 'descricao', width: 100 },
  ];
  instr.getRow(1).font = { bold: true };
  for (const regra of REGRAS_GERAIS) instr.addRow({ descricao: regra });
  for (const aba of NOMES_ABAS) {
    instr.addRow({});
    instr.addRow({ aba, descricao: ABAS[aba].descricao }).font = { bold: true };
    for (const c of ABAS[aba].colunas) {
      instr.addRow({ aba, coluna: c.nome, obrigatoria: obrigatoria(c) ? 'sim' : 'não', tipo: TIPO_LEGIVEL[c.tipo], descricao: descricaoCompleta(c) });
    }
  }

  for (const aba of NOMES_ABAS) {
    const colunas = ABAS[aba].colunas;
    const ws = wb.addWorksheet(aba, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = colunas.map((c) => ({ header: c.nome, key: c.nome, width: Math.max(14, c.nome.length + 4) }));
    const cabecalho = ws.getRow(1);
    cabecalho.font = { bold: true };
    colunas.forEach((c, i) => {
      cabecalho.getCell(i + 1).note = descricaoCompleta(c);
    });
    for (const ex of ABAS[aba].exemplos) {
      ws.addRow(Object.fromEntries(colunas.map((c) => [c.nome, c.tipo === 'inteiro' && ex[c.nome] ? Number(ex[c.nome]) : (ex[c.nome] ?? '')])));
    }
    colunas.forEach((c, i) => {
      const lista = c.tipo === 'enum' ? c.valores : c.tipo === 'booleano' ? ['sim', 'nao'] : undefined;
      if (!lista) return;
      for (let linha = 2; linha <= 500; linha++) {
        ws.getCell(linha, i + 1).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${lista.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Valor não permitido',
          error: `Use: ${lista.join(', ')}`,
        };
      }
    });
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
