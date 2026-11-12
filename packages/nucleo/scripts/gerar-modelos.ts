/**
 * Gera os modelos pra baixar: planilha .xlsx, exemplo .json e o esquema JSON.
 * Uso: npm run modelos [-- <pasta>]   (padrão: saida/modelos)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gerarEsquemaJson, gerarModeloJson } from '../src/modelos/json';
import { gerarModeloXlsx } from '../src/modelos/xlsx';

const pasta = process.argv[2] ?? 'saida/modelos';
await mkdir(pasta, { recursive: true });
await writeFile(join(pasta, 'modelo-journey.xlsx'), await gerarModeloXlsx());
await writeFile(join(pasta, 'modelo-journey.json'), JSON.stringify(gerarModeloJson(), null, 2) + '\n');
await writeFile(join(pasta, 'esquema-journey.json'), JSON.stringify(gerarEsquemaJson(), null, 2) + '\n');
console.log(`modelos gerados em ${pasta}`);
