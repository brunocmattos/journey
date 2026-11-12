import { NOMES_ABAS, documentoVazio, tabelasDe, type Documento, type NomeAba } from '../formato/documento';
import { indexar } from '../formato/indice';
import { aplicarAjustes, type Ajuste, type AjusteInvalido, type Conflito } from './ajustes';
import { analisar } from './analisar';
import { diferencas, juntar, type Diferencas } from './juntar';
import { lerArquivos, type ArquivoEntrada } from './ler-arquivos';
import type { Problema } from './problemas';
import { validar } from './validar';

export interface OpcoesImport {
  /** Base do import anterior. */
  anterior?: Documento | null;
  ajustes?: readonly Ajuste[];
  parcial?: boolean;
}

export interface ResultadoImport {
  /** O arquivo da central entrou sem nenhum erro: pode confirmar. Problemas de origem 'ajuste' não contam. */
  ok: boolean;
  problemas: Problema[];
  /** Nova base: o que a central diz. */
  base: Documento;
  /** Base mais os ajustes manuais. */
  efetivo: Documento;
  /** Base anterior → nova base. */
  diferencas: Diferencas;
  conflitos: Conflito[];
  orfaos: Ajuste[];
  redundantes: Ajuste[];
  /** Ajustes que não batem com as colunas da aba. Não foram aplicados; também aparecem em problemas, como aviso. */
  invalidos: AjusteInvalido[];
}

export async function importar(arquivos: ArquivoEntrada[], opcoes: OpcoesImport = {}): Promise<ResultadoImport> {
  const lidos = await lerArquivos(arquivos);
  const parcial = opcoes.parcial ?? false;
  const analise = analisar(lidos.tabelas, parcial ? { existentes: idsExistentes(opcoes.anterior) } : {});
  const base = juntar(opcoes.anterior, analise.documento, { presentes: analise.presentes, parcial, colunas: analise.colunas, colunasPorItem: analise.colunasPorItem });
  const daBase = validar(indexar(base), analise.linhas);
  const problemas: Problema[] = [...lidos.problemas, ...analise.problemas, ...daBase];
  if (analise.presentes.length === 0 && !problemas.some((p) => p.gravidade === 'erro')) {
    problemas.push({ gravidade: 'erro', mensagem: 'nenhuma aba reconhecida nos arquivos enviados' });
  }
  const ok = !problemas.some((p) => p.gravidade === 'erro');
  const ajustados = aplicarAjustes(base, opcoes.ajustes ?? []);
  problemas.push(...ajustados.invalidos.map(problemaDoInvalido));
  problemas.push(...problemasNovos(validar(indexar(ajustados.efetivo), analise.linhas), daBase));
  return {
    ok,
    problemas,
    base,
    efetivo: ajustados.efetivo,
    diferencas: diferencas(opcoes.anterior, base),
    conflitos: ajustados.conflitos,
    orfaos: ajustados.orfaos,
    redundantes: ajustados.redundantes,
    invalidos: ajustados.invalidos,
  };
}

/** Ids da base anterior, por aba. */
function idsExistentes(anterior: Documento | null | undefined): Partial<Record<NomeAba, ReadonlySet<string>>> {
  const t = tabelasDe(anterior ?? documentoVazio());
  return Object.fromEntries(NOMES_ABAS.map((aba) => [aba, new Set(t[aba].map((l) => l.id))]));
}

/** O ajuste não foi aplicado, mas o import da central segue: é aviso. */
function problemaDoInvalido({ ajuste, coluna, mensagem }: AjusteInvalido): Problema {
  const idDoAjuste = ajuste.tipo === 'campo' ? ajuste.id : ajuste.linha?.id;
  const alvo = idDoAjuste === undefined || idDoAjuste === null ? undefined : String(idDoAjuste);
  const aba = (NOMES_ABAS as readonly string[]).includes(ajuste.aba) ? ajuste.aba : undefined;
  return {
    gravidade: 'aviso',
    ...(aba && { aba }),
    ...(typeof alvo === 'string' && { id: alvo }),
    ...(coluna !== undefined && { coluna }),
    mensagem: `o ajuste manual${typeof alvo === 'string' ? ` em ${alvo}` : ''} não foi aplicado: ${mensagem}`,
    origem: 'ajuste',
  };
}

/** Problemas do efetivo que a base não tem: vieram dos ajustes. */
function problemasNovos(doEfetivo: Problema[], daBase: Problema[]): Problema[] {
  const chave = (p: Problema) => JSON.stringify([p.gravidade, p.aba, p.id, p.coluna, p.mensagem]);
  const vistos = new Set(daBase.map(chave));
  const out: Problema[] = [];
  for (const p of doEfetivo) {
    const k = chave(p);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ ...p, origem: 'ajuste' });
  }
  return out;
}
