import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BotaoDeEntrar } from '@/landing/BotaoDeEntrar';

describe('landing: os botões de entrar', () => {
  it('pra uma página, é um link', () => {
    const h = renderToStaticMarkup(<BotaoDeEntrar destino={{ tipo: 'pagina', href: '/entrar?modo=criar' }} rotulo="Criar conta" jeito="pilula" />);
    expect(h).toBe('<a class="l-pilula" href="/entrar?modo=criar">Criar conta</a>');
  });

  it('pro Google, a chamada é o botão do Google com o rótulo do lugar', () => {
    const h = renderToStaticMarkup(<BotaoDeEntrar destino={{ tipo: 'google' }} rotulo="Continuar com o Google" jeito="google" />);
    expect(h).toMatch(/<button[^>]*class="botao-google"/);
    expect(h).toContain('<span>Continuar com o Google</span>');
    for (const cor of ['#EA4335', '#4285F4', '#FBBC05', '#34A853']) expect(h).toContain(cor);
  });

  it('pro Google, o "Entrar" da barra é um botão (não um link) e só liga depois da hidratação', () => {
    const h = renderToStaticMarkup(<BotaoDeEntrar destino={{ tipo: 'google' }} rotulo="Entrar" jeito="texto" />);
    expect(h).toBe('<button class="l-texto" type="button" disabled="">Entrar</button>');
  });
});
