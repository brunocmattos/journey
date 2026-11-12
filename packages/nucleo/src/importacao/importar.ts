import type { Documento } from '../formato/documento';
import { indexar } from '../formato/indice';
import { aplicarAjustes, type Ajuste, type Conflito } from './ajustes';
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
  /** Sem nenhum erro: pode confirmar. */
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
}

export async function importar(arquivos: ArquivoEntrada[], opcoes: OpcoesImport = {}): Promise<ResultadoImport> {
  const lidos = await lerArquivos(arquivos);
  const analise = analisar(lidos.tabelas);
  const base = juntar(opcoes.anterior, analise.documento, { presentes: analise.presentes, parcial: opcoes.parcial ?? false });
  const problemas: Problema[] = [...lidos.problemas, ...analise.problemas, ...validar(indexar(base), analise.linhas)];
  if (analise.presentes.length === 0 && !problemas.some((p) => p.gravidade === 'erro')) {
    problemas.push({ gravidade: 'erro', mensagem: 'nenhuma aba reconhecida nos arquivos enviados' });
  }
  const ajustados = aplicarAjustes(base, opcoes.ajustes ?? []);
  return {
    ok: !problemas.some((p) => p.gravidade === 'erro'),
    problemas,
    base,
    efetivo: ajustados.efetivo,
    diferencas: diferencas(opcoes.anterior, base),
    conflitos: ajustados.conflitos,
    orfaos: ajustados.orfaos,
    redundantes: ajustados.redundantes,
  };
}
