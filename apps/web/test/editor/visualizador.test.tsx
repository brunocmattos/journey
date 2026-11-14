import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Visualizador } from '@/componentes/editor/Visualizador';
import { EXEMPLOS } from '@/landing/exemplos';

const r = EXEMPLOS.ura;

describe('visualizador: o link público e o embutido', () => {
  it('no link: o cabeçalho (empresa, fluxo, validade), o rodapé e a gaveta fechada', () => {
    const h = renderToStaticMarkup(<Visualizador retrato={r} />);
    expect(h).toContain('<h1>URA telefônica</h1>');
    expect(h).toContain('sem prazo');
    expect(h).toContain('Feito com Journey');
    expect(h).not.toContain('aria-label="Diagnóstico"');
    expect(h).not.toContain('barra-embutida');
  });

  it('embutido: sem cabeçalho e rodapé, a gaveta do diagnóstico aberta e o "Dar play" numa barra em cima do quadro', () => {
    const h = renderToStaticMarkup(<Visualizador retrato={r} embutido />);
    expect(h).toMatch(/^<div class="editor visualizador embutido/);
    expect(h).not.toContain('<h1>');
    expect(h).not.toContain('Feito com Journey');
    expect(h).toContain('aria-label="Diagnóstico"');
    expect(h).toContain('Transferindo… não tem saída');
    expect(h).toMatch(/<div class="barra-embutida"><button[^>]*aria-expanded="true"[^>]*>.*?2 achados<\/button><button[^>]*>.*?Dar play<\/button><\/div>/);
    // O play começa parado: nada do cartão da simulação.
    expect(h).not.toContain('aria-label="Simulação"');
  });
});
