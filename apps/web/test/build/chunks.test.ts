import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * O primeiro carregamento da landing (`/`) não traz o editor, o quadro, o @journey/fluxo nem o cliente do Supabase: eles
 * vêm depois (o visualizador, quando a seção dos exemplos chega perto da tela; o Supabase, quando o ponteiro chega no
 * botão do Google). Lê o build: o manifesto dos componentes de cliente da página (os arquivos de entrada e os de cada
 * componente) e os arquivos de todas as páginas.
 *
 * Só roda com `npm run test:build`, que faz o build antes (CONFERIR_BUILD=1): fora dele, um build velho daria verde
 * falso. Com CONFERIR_BUILD e sem build, falha.
 */
const NEXT = join(import.meta.dirname, '..', '..', '.next');
const MANIFESTO = join(NEXT, 'server', 'app', 'page_client-reference-manifest.js');

/** Um texto de cada coisa que não pode vir: o diagnóstico do pacote, o quadro, o visualizador e o Supabase. */
const MARCAS = { '@journey/fluxo': 'beco_sem_saida', Quadro: 'Quadro do fluxo', Visualizador: 'Feito com Journey', Supabase: 'GoTrueClient' };

interface Manifesto {
  clientModules: Record<string, { chunks: string[] }>;
  entryJSFiles?: Record<string, string[]>;
}

function primeiroCarregamento() {
  const ctx: { globalThis: { __RSC_MANIFEST?: Record<string, Manifesto> } } = { globalThis: {} };
  runInNewContext(readFileSync(MANIFESTO, 'utf8'), ctx);
  const pagina = ctx.globalThis.__RSC_MANIFEST!['/page']!;
  const build = JSON.parse(readFileSync(join(NEXT, 'build-manifest.json'), 'utf8')) as { rootMainFiles: string[] };
  const arquivo = (c: string) => join(NEXT, c.replace(/^\/_next\//, ''));
  const arquivos = new Set(build.rootMainFiles.map(arquivo));
  // Os de entrada (o layout, a página) e os de todo componente de cliente que a página usa, sem filtro nenhum.
  for (const lista of Object.values(pagina.entryJSFiles ?? {})) for (const c of lista) arquivos.add(arquivo(c));
  for (const m of Object.values(pagina.clientModules)) for (const c of m.chunks) arquivos.add(arquivo(c));
  return { modulos: Object.keys(pagina.clientModules), arquivos: [...arquivos] };
}

describe.runIf(process.env.CONFERIR_BUILD)('build: o primeiro carregamento da landing', () => {
  it('o build existe (npm run test:build faz ele antes)', () => {
    expect(existsSync(MANIFESTO), MANIFESTO).toBe(true);
  });

  it('os componentes de cliente da página são só os da landing (nada do editor)', () => {
    const daApp = primeiroCarregamento().modulos.filter((m) => m.includes('/apps/web/') || m.includes('/packages/'));
    expect(daApp.sort()).toEqual(['[project]/apps/web/src/landing/BotaoDeEntrar.tsx', '[project]/apps/web/src/landing/Exemplos.tsx']);
  });

  it.each(Object.entries(MARCAS))('não traz %s', (_, marca) => {
    const { arquivos } = primeiroCarregamento();
    expect(arquivos.length).toBeGreaterThan(0);
    for (const f of arquivos) expect(readFileSync(f, 'utf8').includes(marca), f).toBe(false);
  });

  it.each(Object.entries(MARCAS))('%s existe no build, num pedaço que vem depois (senão a conferência acima não valeria)', (_, marca) => {
    const pasta = join(NEXT, 'static', 'chunks');
    const { arquivos } = primeiroCarregamento();
    const depois = readdirSync(pasta)
      .filter((f) => f.endsWith('.js'))
      .map((f) => join(pasta, f))
      .filter((f) => !arquivos.includes(f));
    expect(depois.some((f) => readFileSync(f, 'utf8').includes(marca))).toBe(true);
  });
});
