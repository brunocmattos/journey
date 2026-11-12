import 'server-only';
import { importar, type Documento } from '@journey/nucleo';
import { jornadasDoImport } from './jornadas';
import { revisar, type Revisao } from './revisao';

export interface Analise {
  revisao: Revisao;
  base: Documento;
  efetivo: Documento;
}

/**
 * Lê os arquivos e monta a revisão. `anterior` é a base do último import confirmado (o parcial precisa dela).
 * Na etapa 2 não há ajustes manuais: o efetivo é a base.
 */
export async function analisarArquivos(arquivos: { nome: string; conteudo: Uint8Array }[], anterior: Documento | null, parcial: boolean): Promise<Analise> {
  const r = await importar(arquivos, { anterior, parcial, ajustes: [] });
  // Com erro, o documento pode ter referência que nem se lê: o diagnóstico não roda e a revisão só lista os erros.
  const jornadas = r.ok && r.okEfetivo ? jornadasDoImport(r.efetivo) : [];
  return { revisao: revisar(r, jornadas, parcial), base: r.base, efetivo: r.efetivo };
}
