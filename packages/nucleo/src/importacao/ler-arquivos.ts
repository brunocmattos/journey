import ExcelJS from 'exceljs';
import { paraCelula, semAcento } from '../formato/celulas';
import { NOMES_ABAS, type NomeAba } from '../formato/documento';
import { lerCsv } from './csv';
import type { Problema } from './problemas';

export interface ArquivoEntrada {
  nome: string;
  conteudo: Uint8Array | string;
}

export interface LinhaBruta {
  /** Número da linha no arquivo (cabeçalho = 1). No JSON, a posição do item (primeiro = 1). */
  linha: number;
  valores: Record<string, string>;
  /**
   * Só no JSON: as chaves que este item trouxe. Chave ausente = "não informado" (no import parcial, mantém o valor anterior).
   * Em .xlsx e .csv as colunas valem pra aba toda e esta lista não existe.
   */
  presentes?: ReadonlySet<string>;
}

export type Tabelas = Partial<Record<NomeAba, LinhaBruta[]>>;

const normalizar = (s: string) => semAcento(s).trim().toLowerCase();

/** Sem protótipo: um cabeçalho "__proto__" é só mais uma coluna (desconhecida), não some. */
const registroVazio = (): Record<string, string> => Object.create(null) as Record<string, string>;
const ehAba = (nome: string): nome is NomeAba => (NOMES_ABAS as readonly string[]).includes(nome);
const paraTexto = (c: Uint8Array | string) => (typeof c === 'string' ? c : new TextDecoder('utf-8').decode(c));
const paraBytes = (c: Uint8Array | string) => (typeof c === 'string' ? new TextEncoder().encode(c) : c);

/** Matriz [cabeçalho, ...linhas] → linhas brutas. Pula linhas totalmente vazias. */
export function linhasDeMatriz(matriz: string[][]): LinhaBruta[] {
  const cabecalho = (matriz[0] ?? []).map(normalizar);
  const out: LinhaBruta[] = [];
  for (let i = 1; i < matriz.length; i++) {
    const celulas = matriz[i] ?? [];
    if (celulas.every((c) => c.trim() === '')) continue;
    const valores = registroVazio();
    cabecalho.forEach((nome, j) => {
      if (nome) valores[nome] = celulas[j] ?? '';
    });
    out.push({ linha: i + 1, valores });
  }
  return out;
}

function textoDaCelula(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    const iso = valor.toISOString();
    return valor.getUTCFullYear() <= 1900 ? iso.slice(11, 16) : iso.slice(0, 10);
  }
  if (typeof valor === 'boolean') return valor ? 'sim' : 'nao';
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((p) => p.text).join('');
    if ('result' in valor) return textoDaCelula(valor.result as ExcelJS.CellValue);
    if ('text' in valor) return String(valor.text);
    return '';
  }
  return String(valor);
}

async function lerXlsx(bytes: Uint8Array): Promise<[NomeAba, LinhaBruta[]][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const out: [NomeAba, LinhaBruta[]][] = [];
  wb.eachSheet((ws) => {
    const aba = normalizar(ws.name);
    if (!ehAba(aba)) return;
    const matriz: string[][] = [];
    let largura = 0;
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const celulas: string[] = [];
      if (n === 1) largura = row.cellCount;
      for (let j = 1; j <= Math.min(row.cellCount, largura); j++) celulas.push(textoDaCelula(row.getCell(j).value));
      matriz[n - 1] = celulas;
    });
    out.push([aba, linhasDeMatriz(Array.from({ length: matriz.length }, (_, i) => matriz[i] ?? []))]);
  });
  return out;
}

function lerJson(arquivo: ArquivoEntrada, problemas: Problema[]): [NomeAba, LinhaBruta[]][] {
  let dados: unknown;
  try {
    dados = JSON.parse(paraTexto(arquivo.conteudo));
  } catch (e) {
    problemas.push({ gravidade: 'erro', mensagem: `o arquivo ${arquivo.nome} não é um JSON válido: ${(e as Error).message}` });
    return [];
  }
  const obj = dados as Record<string, unknown> | null;
  if (!obj || obj.formato !== 'journey/1') {
    problemas.push({ gravidade: 'erro', mensagem: `o arquivo ${arquivo.nome} não está no formato journey/1 (falta "formato": "journey/1")` });
    return [];
  }
  const out: [NomeAba, LinhaBruta[]][] = [];
  for (const aba of NOMES_ABAS) {
    const lista = obj[aba];
    if (lista === undefined) continue;
    if (!Array.isArray(lista)) {
      problemas.push({ gravidade: 'erro', aba, mensagem: `"${aba}" precisa ser uma lista` });
      continue;
    }
    const linhas: LinhaBruta[] = [];
    lista.forEach((item, i) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        problemas.push({ gravidade: 'erro', aba, linha: i + 1, mensagem: 'o item precisa ser um objeto (um registro com colunas)' });
        return;
      }
      const valores = registroVazio();
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) valores[normalizar(k)] = paraCelula(v);
      linhas.push({ linha: i + 1, valores, presentes: new Set(Object.keys(valores)) });
    });
    out.push([aba, linhas]);
  }
  return out;
}

/** Lê .xlsx (uma aba por planilha), .csv (um arquivo por aba) e .json (formato journey/1). */
export async function lerArquivos(arquivos: ArquivoEntrada[]): Promise<{ tabelas: Tabelas; problemas: Problema[] }> {
  const tabelas: Tabelas = {};
  const problemas: Problema[] = [];
  const guardar = (aba: NomeAba, linhas: LinhaBruta[], origem: string) => {
    if (tabelas[aba]) {
      problemas.push({ gravidade: 'erro', aba, mensagem: `a aba ${aba} veio em mais de um arquivo (de novo em ${origem})` });
      return;
    }
    tabelas[aba] = linhas;
  };
  for (const arquivo of arquivos) {
    const partes = arquivo.nome.split(/[\\/]/).pop()!.split('.');
    const ext = partes.length > 1 ? partes.pop()!.toLowerCase() : '';
    const base = normalizar(partes.join('.'));
    if (ext === 'xlsx') {
      let abas: [NomeAba, LinhaBruta[]][];
      try {
        abas = await lerXlsx(paraBytes(arquivo.conteudo));
      } catch {
        problemas.push({ gravidade: 'erro', mensagem: `"${arquivo.nome}" não é uma planilha .xlsx válida` });
        continue;
      }
      for (const [aba, linhas] of abas) guardar(aba, linhas, arquivo.nome);
    } else if (ext === 'csv') {
      if (!ehAba(base)) {
        problemas.push({ gravidade: 'erro', mensagem: `o arquivo ${arquivo.nome} não corresponde a nenhuma aba. Use um destes nomes: ${NOMES_ABAS.map((a) => `${a}.csv`).join(', ')}` });
        continue;
      }
      guardar(base, linhasDeMatriz(lerCsv(paraTexto(arquivo.conteudo))), arquivo.nome);
    } else if (ext === 'json') {
      for (const [aba, linhas] of lerJson(arquivo, problemas)) guardar(aba, linhas, arquivo.nome);
    } else {
      problemas.push({ gravidade: 'erro', mensagem: `o arquivo ${arquivo.nome} está num formato não aceito. Use .xlsx, .csv ou .json` });
    }
  }
  return { tabelas, problemas };
}
