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

  describe('ajustes e documento efetivo', () => {
    const arquivos = () => [
      csv('entradas.csv', 'id;numero;destino', 'e1;5130000001;peca:menu', 'e2;5130000002;peca:nada'),
      csv('pecas.csv', 'id;tipo;espera_s;tentativas', 'menu;menu;5;2'),
      csv('saidas.csv', 'id;de;opcao;para', 's1;peca:menu;1;fila:100', 's2;peca:menu;esgotou;fim:desliga'),
      csv('filas.csv', 'id;estrategia;toque_por_membro_s', '100;rrmemory;15'),
    ];

    it('ajuste inválido vira aviso de origem ajuste, não é aplicado e não tira o ok', async () => {
      const r = await importar(arquivos(), { ajustes: [{ tipo: 'campo', aba: 'filas', id: '100', campo: 'espera_maxima_s', valor: 'abc' }] });
      expect(r.ok).toBe(true);
      expect(r.invalidos).toHaveLength(1);
      expect(r.efetivo.filas[0]!.espera_maxima_s).toBeUndefined();
      expect(r.problemas.filter((p) => p.origem === 'ajuste')).toEqual([
        expect.objectContaining({ gravidade: 'aviso', aba: 'filas', coluna: 'espera_maxima_s', mensagem: expect.stringContaining('"abc" não é um número inteiro') }),
      ]);
    });

    it('valida o efetivo e só acrescenta os problemas novos, uma vez cada', async () => {
      const r = await importar(arquivos(), { ajustes: [{ tipo: 'criar', aba: 'saidas', linha: { id: 'manual-s', de: 'peca:menu', opcao: '2', para: 'peca:sumiu' } }] });
      expect(r.ok).toBe(true);
      expect(r.problemas.filter((p) => p.mensagem.includes('peca:nada'))).toEqual([expect.objectContaining({ aba: 'entradas' })]);
      expect(r.problemas.filter((p) => p.mensagem.includes('peca:nada'))[0]!.origem).toBeUndefined();
      expect(r.problemas.filter((p) => p.mensagem.includes('peca:sumiu'))).toEqual([
        expect.objectContaining({ gravidade: 'aviso', aba: 'saidas', id: 'manual-s', coluna: 'para', origem: 'ajuste' }),
      ]);
    });

    it('erro que só existe no efetivo aparece, mas o ok continua dizendo respeito à central', async () => {
      const r = await importar(arquivos(), { ajustes: [{ tipo: 'criar', aba: 'saidas', linha: { id: 'manual-s', de: 'peca:menu', opcao: '1', para: 'fim:desliga' } }] });
      expect(r.ok).toBe(true);
      expect(r.problemas.filter((p) => p.gravidade === 'erro')).toEqual([expect.objectContaining({ aba: 'saidas', id: 'manual-s', origem: 'ajuste' })]);
    });
  });
});
