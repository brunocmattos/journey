import { describe, expect, it } from 'vitest';
import { importar } from '../../src/importacao/importar';

const csv = (nome: string, ...linhas: string[]) => ({ nome, conteudo: linhas.join('\n') });

describe('importar', () => {
  it('lê, valida, monta a base e aplica os ajustes', async () => {
    const r = await importar(
      [
        csv('entradas.csv', 'id;numero;destino', 'e1;5130000001;peca:menu'),
        csv('pecas.csv', 'id;tipo;espera_s;tentativas', 'menu;menu;5;2'),
        csv('saidas.csv', 'id;de;opcao;para', 's1;peca:menu;1;fila:100', 's2;peca:menu;esgotou;fim:desliga'),
        csv('filas.csv', 'id;estrategia;toque_por_membro_s', '100;rrmemory;15'),
      ],
      { ajustes: [{ tipo: 'campo', aba: 'filas', id: '100', campo: 'espera_maxima_s', valor: 120 }] },
    );
    expect(r.problemas).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.base.filas[0]!.espera_maxima_s).toBeUndefined();
    expect(r.efetivo.filas[0]!.espera_maxima_s).toBe(120);
    expect(r.diferencas.novos).toHaveLength(5);
  });

  it('não fica ok quando há erro', async () => {
    const r = await importar([csv('filas.csv', 'id;estrategia', '100;fila-boba')]);
    expect(r.ok).toBe(false);
  });

  it('sem nenhuma aba reconhecida é erro', async () => {
    const r = await importar([]);
    expect(r.ok).toBe(false);
    expect(r.problemas[0]?.mensagem).toContain('nenhuma aba');
  });

  it('import parcial mantém o resto da base anterior e mostra o que mudou', async () => {
    const primeiro = await importar([csv('filas.csv', 'id;estrategia;toque_por_membro_s', '1;ringall;10', '2;ringall;10')]);
    const segundo = await importar([csv('filas.csv', 'id;estrategia;toque_por_membro_s', '2;linear;12')], { anterior: primeiro.base, parcial: true });
    expect(segundo.base.filas.map((f) => [f.id, f.estrategia])).toEqual([
      ['1', 'ringall'],
      ['2', 'linear'],
    ]);
    expect(segundo.diferencas.alterados).toEqual([{ chave: 'filas/2', campos: ['estrategia', 'toque_por_membro_s'] }]);
  });
});
