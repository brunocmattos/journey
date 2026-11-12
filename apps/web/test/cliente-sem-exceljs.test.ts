import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// O que a tela usa importa o núcleo pelos subcaminhos sem exceljs (formato, motor, diagnostico).
// A raiz '@journey/nucleo' reexporta importacao e modelos, e o exceljs (~1 MB) iria pro navegador.
const SRC = fileURLToPath(new URL('../src', import.meta.url));
const PASTAS = ['componentes', 'mapa', 'simulacao', 'diagnostico'];
const PROIBIDO = /['"]@journey\/nucleo(\/importacao|\/modelos)?['"]/;

function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(e.name) ? [caminho] : [];
  });
}

describe('código da tela', () => {
  const todos = PASTAS.flatMap((p) => arquivos(join(SRC, p)));

  it('acha os arquivos', () => {
    expect(todos.length).toBeGreaterThan(10);
  });

  it.each(todos.map((f) => [f.slice(SRC.length + 1), f]))('%s não importa a raiz do núcleo nem importacao/modelos', (_nome, f) => {
    const linhas = readFileSync(f, 'utf8')
      .split('\n')
      .filter((l) => PROIBIDO.test(l));
    expect(linhas).toEqual([]);
  });
});
