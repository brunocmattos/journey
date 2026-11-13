import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormularioEntrar } from '@/app/entrar/formulario';

const html = (props: { google: boolean; email: boolean }) => renderToStaticMarkup(<FormularioEntrar {...props} aviso={null} />);

describe('entrar: os jeitos que aparecem', () => {
  it('só o Google: o botão do Google e nada de e-mail, senha ou link', () => {
    const h = html({ google: true, email: false });
    expect(h).toContain('Continuar com o Google');
    expect(h).not.toContain('type="email"');
    expect(h).not.toContain('type="password"');
    expect(h).not.toContain('Receber um link');
    expect(h).not.toContain('class="ou"');
  });

  it('o botão do Google segue o padrão: o "G" colorido, decorativo, e o texto como nome do botão', () => {
    const h = html({ google: true, email: false });
    expect(h).toMatch(/<button[^>]*class="botao-google"/);
    expect(h).toMatch(/<svg[^>]*aria-hidden="true"/);
    for (const cor of ['#EA4335', '#4285F4', '#FBBC05', '#34A853']) expect(h).toContain(cor);
  });

  it('com os dois: o formulário do e-mail, o "ou" e o botão do Google', () => {
    const h = html({ google: true, email: true });
    expect(h).toContain('type="email"');
    expect(h).toContain('class="ou"');
    expect(h).toContain('Continuar com o Google');
  });

  it('sem o Google: só o e-mail', () => {
    const h = html({ google: false, email: true });
    expect(h).toContain('type="email"');
    expect(h).not.toContain('Google');
  });
});
