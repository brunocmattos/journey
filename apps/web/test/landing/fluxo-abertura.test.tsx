import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FluxoAbertura } from '@/landing/FluxoAbertura';

const h = renderToStaticMarkup(<FluxoAbertura />);

describe('landing: o fluxo da abertura', () => {
  it('é uma imagem com a descrição dos quatro caminhos (nos dois desenhos, o largo e o de pé)', () => {
    const rotulos = [...h.matchAll(/<svg[^>]*role="img"[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(rotulos).toHaveLength(2);
    for (const r of rotulos) for (const t of ['Boleto', 'Resolvido', 'acima da meta', 'sem saída', 'Não entendi volta']) expect(r).toContain(t);
  });

  it('tem os selos de como cada caminho termina', () => {
    for (const t of ['chegou em 3 min', '18 min, acima da meta', 'Sem saída', 'Volta pro menu']) expect(h).toContain(t);
  });

  it('usa os tokens do tema, sem cor fixa no desenho (só o branco do play e do brilho, no CSS)', () => {
    expect(h).not.toMatch(/(fill|stroke)="#/);
    expect(h).not.toMatch(/style="/);
  });
});
