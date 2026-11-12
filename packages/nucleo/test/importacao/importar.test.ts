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
    expect(r.okEfetivo).toBe(true);
    expect(r.base.filas[0]!.espera_maxima_s).toBeUndefined();
    expect(r.efetivo.filas[0]!.espera_maxima_s).toBe(120);
    expect(r.diferencas.novos).toHaveLength(5);
  });

  it('não fica ok quando há erro', async () => {
    const r = await importar([csv('filas.csv', 'id;estrategia', '100;fila-boba')]);
    expect(r.ok).toBe(false);
    expect(r.okEfetivo).toBe(false);
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

  describe('import parcial por coluna', () => {
    const json = (obj: unknown) => ({ nome: 'dados.json', conteudo: JSON.stringify({ formato: 'journey/1', ...(obj as object) }) });
    const base = async () =>
      (await importar([csv('filas.csv', 'id;estrategia;toque_por_membro_s;membros_dinamicos', '1;ringall;10;sim', '2;ringall;20;nao')])).base;

    it('filas.csv só com id;estrategia mantém as outras colunas da fila existente', async () => {
      const r = await importar([csv('filas.csv', 'id;estrategia', '1;linear')], { anterior: await base(), parcial: true });
      expect(r.ok).toBe(true);
      expect(r.base.filas[0]).toMatchObject({ id: '1', estrategia: 'linear', toque_por_membro_s: 10 });
      expect(r.diferencas.alterados).toEqual([{ chave: 'filas/1', campos: ['estrategia'] }]);
    });

    it('sem a coluna com padrão (membros_dinamicos), mantém o valor anterior (não aplica o padrão)', async () => {
      const r = await importar([csv('filas.csv', 'id;estrategia', '1;linear')], { anterior: await base(), parcial: true });
      expect(r.base.filas[0]!.membros_dinamicos).toBe(true);
    });

    it('coluna presente com célula vazia volta ao padrão/limpa', async () => {
      const r = await importar([csv('filas.csv', 'id;estrategia;toque_por_membro_s;membros_dinamicos', '1;linear;;')], { anterior: await base(), parcial: true });
      expect(r.base.filas[0]!.toque_por_membro_s).toBeUndefined();
      expect(r.base.filas[0]!.membros_dinamicos).toBe(false);
    });

    it('sem coluna obrigatória: atualiza linha existente, mas linha nova leva erro', async () => {
      const r = await importar([csv('filas.csv', 'id;nome', '1;Vendas', '3;Nova')], { anterior: await base(), parcial: true });
      expect(r.base.filas.find((f) => f.id === '1')).toMatchObject({ nome: 'Vendas', estrategia: 'ringall', toque_por_membro_s: 10 });
      const erros = r.problemas.filter((p) => p.gravidade === 'erro' && p.aba === 'filas');
      expect(erros).toEqual([expect.objectContaining({ linha: 3, coluna: 'estrategia', mensagem: expect.stringContaining('estrategia') })]);
      expect(r.ok).toBe(false);
    });

    it('sem coluna obrigatória e só linhas existentes: ok', async () => {
      const r = await importar([csv('filas.csv', 'id;nome', '1;Vendas')], { anterior: await base(), parcial: true });
      expect(r.problemas.filter((p) => p.gravidade === 'erro')).toEqual([]);
      expect(r.ok).toBe(true);
    });

    it('import completo continua substituindo a linha inteira e acusando coluna ausente', async () => {
      const r = await importar([csv('filas.csv', 'id;estrategia', '1;linear')], { anterior: await base() });
      expect(r.base.filas).toEqual([expect.not.objectContaining({ toque_por_membro_s: expect.anything() })]);
      const c = await importar([csv('filas.csv', 'id;nome', '1;V')], { anterior: await base() });
      expect(c.problemas).toContainEqual({ gravidade: 'erro', aba: 'filas', coluna: 'estrategia', mensagem: 'falta a coluna obrigatória "estrategia"' });
    });

    it('JSON parcial: colunas presentes são a união das chaves dos itens', async () => {
      const r = await importar([json({ filas: [{ id: '1', estrategia: 'linear' }, { id: '2', estrategia: 'ringall', nome: 'Dois' }] })], { anterior: await base(), parcial: true });
      expect(r.ok).toBe(true);
      expect(r.base.filas[0]).toMatchObject({ id: '1', estrategia: 'linear', toque_por_membro_s: 10, membros_dinamicos: true });
      expect(r.base.filas[1]).toMatchObject({ id: '2', nome: 'Dois', estrategia: 'ringall', toque_por_membro_s: 20 });
    });

    it('JSON parcial: chave ausente num item mantém o valor anterior desse item', async () => {
      const r = await importar([json({ filas: [{ id: '1', estrategia: 'linear' }, { id: '2', membros: ['ramal:2001'] }] })], { anterior: await base(), parcial: true });
      expect(r.problemas.filter((p) => p.gravidade === 'erro')).toEqual([]);
      expect(r.base.filas[0]).toMatchObject({ estrategia: 'linear', toque_por_membro_s: 10, membros_dinamicos: true });
      expect(r.base.filas[1]).toMatchObject({ estrategia: 'ringall', membros: ['ramal:2001'], toque_por_membro_s: 20 });
      expect(r.diferencas.alterados).toEqual([
        { chave: 'filas/1', campos: ['estrategia'] },
        { chave: 'filas/2', campos: ['membros'] },
      ]);
    });

    it('JSON parcial: null explícito limpa; chave presente com valor vazio limpa só naquele item', async () => {
      const r = await importar([json({ filas: [{ id: '1', toque_por_membro_s: null }, { id: '2', nome: 'Dois' }] })], { anterior: await base(), parcial: true });
      expect(r.base.filas[0]!.toque_por_membro_s).toBeUndefined();
      expect(r.base.filas[1]).toMatchObject({ toque_por_membro_s: 20, nome: 'Dois' });
    });

    it('JSON parcial: item novo ainda precisa das colunas obrigatórias, mesmo que outro item as traga', async () => {
      const r = await importar([json({ filas: [{ id: '1', estrategia: 'linear' }, { id: '3', nome: 'Nova' }] })], { anterior: await base(), parcial: true });
      expect(r.ok).toBe(false);
      expect(r.problemas.filter((p) => p.gravidade === 'erro')).toEqual([expect.objectContaining({ aba: 'filas', linha: 2, coluna: 'estrategia' })]);
    });

    it('JSON completo: chave ausente continua valendo como vazio', async () => {
      const r = await importar([json({ filas: [{ id: '1', estrategia: 'linear' }] })], { anterior: await base() });
      expect(r.base.filas).toEqual([expect.not.objectContaining({ toque_por_membro_s: expect.anything() })]);
    });
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
      expect(r.okEfetivo).toBe(false);
    });

    it('okEfetivo: ajuste que apaga o horario de uma regra_horario trava o documento efetivo, não a central', async () => {
      const r = await importar(
        [
          csv('entradas.csv', 'id;numero;destino', 'e1;5130000001;peca:h'),
          csv('horarios.csv', 'id;grupo;dias;inicio;fim', 'h1;comercial;seg-sex;08:00;18:00'),
          csv('pecas.csv', 'id;tipo;horario', 'h;regra_horario;horario:comercial'),
          csv('saidas.csv', 'id;de;opcao;para', 's1;peca:h;sim;fim:atendido', 's2;peca:h;nao;fim:desliga'),
        ],
        { ajustes: [{ tipo: 'campo', aba: 'pecas', id: 'h', campo: 'horario', valor: undefined }] },
      );
      expect(r.ok).toBe(true);
      expect(r.okEfetivo).toBe(false);
      expect(r.problemas.filter((p) => p.gravidade === 'erro')).toEqual([expect.objectContaining({ aba: 'pecas', id: 'h', coluna: 'horario', origem: 'ajuste' })]);
    });

    it('renomear um item por ajuste não repete o aviso que a central já tem', async () => {
      const r = await importar(
        [
          csv('entradas.csv', 'id;numero;destino', 'e1;5130000001;peca:menu'),
          csv('pecas.csv', 'id;tipo;nome', 'menu;menu;Principal'),
          csv('saidas.csv', 'id;de;opcao;para', 's1;peca:menu;1;fim:atendido', 's2;peca:menu;esgotou;fim:desliga'),
        ],
        { ajustes: [{ tipo: 'campo', aba: 'pecas', id: 'menu', campo: 'nome', valor: 'Menu de entrada' }] },
      );
      const semTempo = r.problemas.filter((p) => p.regra === 'menu_sem_tempo');
      expect(semTempo).toEqual([expect.objectContaining({ gravidade: 'aviso', aba: 'pecas', id: 'menu' })]);
      expect(semTempo[0]!.origem).toBeUndefined();
    });

    it('referência inexistente nova numa coluna de lista aparece, mesmo com outra já avisada na mesma coluna', async () => {
      const r = await importar([csv('filas.csv', 'id;estrategia;toque_por_membro_s;membros', '100;rrmemory;15;ramal:9')], {
        ajustes: [{ tipo: 'campo', aba: 'filas', id: '100', campo: 'membros', valor: 'ramal:9 ramal:8' }],
      });
      const membros = r.problemas.filter((p) => p.coluna === 'membros');
      expect(membros.map((p) => [p.mensagem.includes('ramal:9') ? 'ramal:9' : 'ramal:8', p.origem])).toEqual([
        ['ramal:9', undefined],
        ['ramal:8', 'ajuste'],
      ]);
    });
  });
});
