import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { importar, type Documento } from '@journey/nucleo';

/** A fixture do núcleo (a central de 11/11/2026, sem nomes) como documento efetivo. Só pra testes de aceitação. */
export const PASTA_CENTRAL = join(import.meta.dirname, '..', '..', '..', 'packages', 'nucleo', 'test', 'fixtures', 'central');

export async function arquivosDaCentral() {
  const nomes = (await readdir(PASTA_CENTRAL)).filter((n) => n.endsWith('.csv')).sort();
  return Promise.all(nomes.map(async (nome) => ({ nome, conteudo: await readFile(join(PASTA_CENTRAL, nome), 'utf-8') })));
}

export async function central(): Promise<Documento> {
  const r = await importar(await arquivosDaCentral());
  if (!r.ok) throw new Error('a fixture da central não importou');
  return r.efetivo;
}
