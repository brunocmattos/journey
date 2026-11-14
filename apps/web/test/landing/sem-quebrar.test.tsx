import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SemQuebrar } from '@/landing/SemQuebrar';

describe('landing: o visualizador que falha não derruba a página', () => {
  it('sem erro, mostra o que tem dentro', () => {
    expect(renderToStaticMarkup(<SemQuebrar>{<p>exemplo</p>}</SemQuebrar>)).toBe('<p>exemplo</p>');
  });

  it('com erro, vira nada (e a miniatura de baixo fica) e registra no console', () => {
    expect(SemQuebrar.getDerivedStateFromError()).toEqual({ erro: true });
    const b = new SemQuebrar({ children: <p>exemplo</p> });
    b.state = SemQuebrar.getDerivedStateFromError();
    expect(b.render()).toBeNull();
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => {});
    b.componentDidCatch(new Error('o pedaço não baixou'));
    expect(console_).toHaveBeenCalledWith('[landing: exemplo]', expect.any(Error));
    console_.mockRestore();
  });
});
