import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(__dirname, '..');
const pacote = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8')) as { exports: Record<string, string> };

/** Tudo que o arquivo importa: [relativos resolvidos, pacotes externos]. Leitura por texto, sem executar nada. */
function importacoes(arquivo: string): { locais: string[]; externos: string[] } {
  const texto = readFileSync(arquivo, 'utf8');
  const alvos = [...texto.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]!);
  const locais: string[] = [];
  const externos: string[] = [];
  for (const alvo of alvos) {
    if (!alvo.startsWith('.')) {
      externos.push(alvo);
      continue;
    }
    const base = resolve(dirname(arquivo), alvo);
    const achado = [`${base}.ts`, resolve(base, 'index.ts')].find(existsSync);
    if (!achado) throw new Error(`${arquivo} importa ${alvo}, que não existe`);
    locais.push(achado);
  }
  return { locais, externos };
}

/** Todo arquivo alcançável a partir da entrada, seguindo só imports relativos. */
function alcancados(entrada: string): { arquivo: string; externos: string[] }[] {
  const vistos = new Map<string, string[]>();
  const fila = [entrada];
  while (fila.length) {
    const atual = fila.pop()!;
    if (vistos.has(atual)) continue;
    const { locais, externos } = importacoes(atual);
    vistos.set(atual, externos);
    fila.push(...locais);
  }
  return [...vistos].map(([arquivo, externos]) => ({ arquivo, externos }));
}

describe('subpacotes', () => {
  it.each(['formato', 'importacao', 'modelos', 'motor', 'diagnostico'])('"./%s" aponta pra um índice que existe', (pasta) => {
    const alvo = pacote.exports[`./${pasta}`];
    expect(alvo).toBe(`./src/${pasta}/index.ts`);
    expect(existsSync(resolve(raiz, alvo!))).toBe(true);
  });

  it('"." continua exportando tudo', () => {
    expect(pacote.exports['.']).toBe('./src/index.ts');
  });

  it.each(['formato', 'motor', 'diagnostico'])('src/%s/index.ts não alcança exceljs nem a importação', (pasta) => {
    const alcance = alcancados(resolve(raiz, 'src', pasta, 'index.ts'));
    expect(alcance.length).toBeGreaterThan(1);
    expect(alcance.filter((a) => a.externos.some((e) => e === 'exceljs' || e.startsWith('exceljs/'))).map((a) => a.arquivo)).toEqual([]);
    expect(alcance.map((a) => a.arquivo).filter((a) => a.includes('/importacao/') || a.includes('/modelos/'))).toEqual([]);
  });

  it('o índice geral alcança exceljs (a varredura enxerga o import)', () => {
    const alcance = alcancados(resolve(raiz, 'src', 'index.ts'));
    expect(alcance.some((a) => a.externos.includes('exceljs'))).toBe(true);
  });

  it('o índice geral só reexporta os índices das pastas', () => {
    const geral = readFileSync(resolve(raiz, 'src/index.ts'), 'utf8');
    const alvos = [...geral.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
    expect(alvos).toEqual(['./diagnostico', './formato', './importacao', './modelos', './motor']);
  });
});

describe('API pública', () => {
  it('o índice geral exporta tudo o que os índices das pastas exportam', async () => {
    const geral = await import('../src/index');
    for (const pasta of ['formato', 'importacao', 'modelos', 'motor', 'diagnostico']) {
      const indice = (await import(`../src/${pasta}/index.ts`)) as Record<string, unknown>;
      expect(Object.keys(indice).length).toBeGreaterThan(0);
      for (const nome of Object.keys(indice)) expect(geral).toHaveProperty(nome, indice[nome]);
    }
  });

  it('o que é de uso interno não vaza', async () => {
    const geral = (await import('../src/index')) as Record<string, unknown>;
    for (const nome of ['lerLinha', 'erroDeId', 'MSG_OBRIGATORIO_VAZIO', 'linhasDeMatriz', 'achado', 'igual', 'semAcento', 'somar', 'buracosDeHorario']) {
      expect(geral, nome).not.toHaveProperty(nome);
    }
    for (const nome of ['importar', 'analisar', 'validar', 'aplicarAjustes', 'descrever', 'lerArquivos', 'executar', 'Execucao', 'diagnosticar', 'GRAVIDADE', 'indexar', 'lerRef', 'ABAS', 'gerarModeloXlsx']) {
      expect(geral, nome).toHaveProperty(nome);
    }
  });
});
