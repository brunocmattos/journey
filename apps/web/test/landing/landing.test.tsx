import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Landing } from '@/landing/Landing';

const html = (google: string, email: string) => {
  vi.stubEnv('NEXT_PUBLIC_LOGIN_GOOGLE', google);
  vi.stubEnv('NEXT_PUBLIC_LOGIN_EMAIL', email);
  return renderToStaticMarkup(<Landing />);
};
afterEach(() => vi.unstubAllEnvs());

describe('landing: as seções', () => {
  it('tem os títulos da spec, na ordem', () => {
    const h = html('sim', 'nao');
    const titulos = [...h.matchAll(/<h[12][^>]*>([^<]*)<\/h[12]>/g)].map((m) => m[1]);
    expect(titulos).toEqual([
      'Desenha o fluxo e dá play.',
      'Um fluxo pra cada operação',
      'O que o play mostra e o fluxograma esconde',
      'Como funciona',
      'Pra quem cuida de fluxo',
      'Play your journey.',
    ]);
  });

  it('os atalhos da barra levam às âncoras da página', () => {
    const h = html('sim', 'nao');
    for (const [rotulo, id] of [
      ['Exemplos', 'exemplos'],
      ['Como funciona', 'como-funciona'],
      ['Pra quem', 'pra-quem'],
    ]) {
      expect(h).toContain(`<a href="#${id}">${rotulo}</a>`);
      expect(h).toContain(`id="${id}"`);
    }
    expect(h).toContain('<a class="l-sublinhado" href="#exemplos">Ver exemplos</a>');
  });

  it('os passos de "Como funciona" são uma lista numerada', () => {
    expect(html('sim', 'nao')).toMatch(/<ol class="l-passos">(.*?<h3>(Desenha\.|Dá play\.|Compartilha\.)<\/h3>){3}/);
  });
});

describe('landing: entrar e criar conta', () => {
  it('só o Google: a chamada é o botão do Google (duas vezes) e a barra também vai pro Google', () => {
    const h = html('sim', 'nao');
    expect(h.match(/<span>Continuar com o Google<\/span>/g)).toHaveLength(2);
    expect(h).not.toContain('href="/entrar');
  });

  it('com o e-mail (o modo dos testes locais): Entrar e Criar conta são links, e a chamada sem o Google leva pra aba de criar', () => {
    const h = html('nao', '');
    expect(h).toContain('<a class="l-texto" href="/entrar">Entrar</a>');
    expect(h).toContain('<a class="l-pilula" href="/entrar?modo=criar">Criar conta</a>');
    expect(h.match(/<a class="l-pilula grande" href="\/entrar\?modo=criar">Criar conta<\/a>/g)).toHaveLength(2);
    expect(h).not.toContain('Google</span>');
  });
});

describe('landing: as abas dos exemplos', () => {
  it('são uma lista de abas de verdade: a primeira escolhida, só ela no Tab, cada uma ligada ao painel', () => {
    const h = html('sim', 'nao');
    const abas = [...h.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
    expect(abas).toHaveLength(4);
    expect(abas[0]).toContain('id="aba-ura"');
    expect(abas[0]).toContain('aria-selected="true"');
    expect(abas[0]).toContain('tabindex="0"');
    for (const a of abas.slice(1)) expect(a).toMatch(/aria-selected="false".*tabindex="-1"|tabindex="-1".*aria-selected="false"/);
    for (const a of abas) expect(a).toContain('aria-controls="exemplo-painel"');
    expect(h).toMatch(/<div[^>]*id="exemplo-painel"[^>]*role="tabpanel"[^>]*aria-labelledby="aba-ura-nome"/);
  });

  it('o nome da aba é o nome do exemplo; a dor é a descrição', () => {
    const h = html('sim', 'nao');
    expect(h).toMatch(/<button[^>]*id="aba-ura"[^>]*aria-labelledby="aba-ura-nome"[^>]*aria-describedby="aba-ura-dor"/);
    expect(h).toContain('<span class="l-aba-nome" id="aba-ura-nome">URA telefônica</span>');
    expect(h).toContain('<span class="l-aba-dor" id="aba-ura-dor">O cliente que aperta 9 e não chega em lugar nenhum.</span>');
  });

  it('antes de chegar perto, o painel só tem a miniatura (o visualizador não vem no HTML) e recebe o foco ele mesmo', () => {
    const h = html('sim', 'nao');
    expect(h).toMatch(/<div[^>]*role="tabpanel"[^>]*tabindex="0"/);
    expect(h).toContain('class="l-exemplo-espera"');
    expect(h).not.toContain('data-testid="quadro"');
  });
});

describe('landing: o texto do fechamento', () => {
  it('com o Google, fala dele; sem o Google, não', () => {
    expect(html('sim', 'nao')).toContain('Entra com o Google e desenha o primeiro fluxo em minutos, do zero ou a partir de um modelo pronto.');
    const semGoogle = html('nao', '');
    expect(semGoogle).toContain('Desenha o primeiro fluxo em minutos, do zero ou a partir de um modelo pronto.');
    expect(semGoogle).not.toContain('Google');
  });
});
