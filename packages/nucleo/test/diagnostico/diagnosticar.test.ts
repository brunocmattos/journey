import { describe, expect, it } from 'vitest';
import { diagnosticar } from '../../src/diagnostico/diagnosticar';
import { indexar } from '../../src/formato/indice';
import { validar } from '../../src/importacao/validar';
import type { Documento } from '../../src/formato/documento';
import { doc, entrada, fila, grupo, janela, peca, ramal, saida } from '../apoio';

describe('diagnosticar', () => {
  it('junta todas as regras, do mais grave pro mais leve', () => {
    const achados = diagnosticar(
      doc({
        entradas: [entrada('e', 'peca:menu')],
        pecas: [peca('menu', 'menu', { espera_s: 5, tentativas: 2 })],
        saidas: [saida('menu', '1', 'fila:1'), saida('menu', '2', 'fila:1'), saida('menu', 'esgotou', 'peca:apagada')],
        filas: [fila('1')],
        ramais: [ramal('7', { ao_nao_atender: 'ramal:8' }), ramal('8', { ao_nao_atender: 'ramal:7' })],
      }),
    );
    expect(achados.map((a) => a.tipo)).toEqual(['beco_sem_saida', 'ciclo_transbordo', 'redundancia', 'espera_sem_limite']);
    expect(achados.map((a) => a.gravidade)).toEqual(['grave', 'grave', 'alerta', 'observacao']);
  });

  it('grupo sem ao_esgotar é grupo_desliga, como o que tem fim:desliga', () => {
    const achados = diagnosticar(doc({ entradas: [entrada('e', 'grupo:1')], grupos: [grupo('1')] }));
    expect(achados.map((a) => [a.chave, a.gravidade])).toEqual([['grupo_desliga:grupo:1', 'alerta']]);
  });
});

describe('o que a validação promete, o diagnóstico entrega', () => {
  const casos: [string, Documento, string][] = [
    ['entrada pra destino inexistente', doc({ entradas: [entrada('e', 'peca:nada')] }), 'entrada:e'],
    ['ramal que transborda pra fila inexistente', doc({ ramais: [ramal('1', { ao_nao_atender: 'fila:9' })] }), 'ramal:1'],
    ['ramal com siga-me inexistente', doc({ ramais: [ramal('1', { siga_me_lista: ['ramal:9'] })] }), 'ramal:1'],
    ['fila com membro inexistente', doc({ filas: [fila('1', { membros: ['ramal:9'] })] }), 'fila:1'],
    ['grupo com destino de falha inexistente', doc({ grupos: [grupo('1', { ao_esgotar: 'fila:9' })] }), 'grupo:1'],
    [
      'regra de horário apontando pra horário que não existe',
      doc({ pecas: [peca('h', 'regra_horario', { horario: 'horario:x' })], saidas: [saida('h', 'sim', 'fim:desliga')] }),
      'peca:h',
    ],
    ['saída que parte de peça inexistente', doc({ saidas: [saida('nada', '1', 'fim:desliga')] }), 'saida:nada-1'],
    [
      'saída pra peça inexistente, de peça que ninguém alcança',
      doc({ pecas: [peca('solta', 'menu', { espera_s: 5, tentativas: 2 })], saidas: [saida('solta', '1', 'peca:nada')] }),
      'saida:solta-1',
    ],
  ];
  for (const [nome, d, ref] of casos) {
    it(`${nome}: o aviso do import tem achado correspondente`, () => {
      const avisos = validar(indexar(d)).filter((p) => p.mensagem.includes('diagnóstico vai marcar'));
      expect(avisos.length).toBeGreaterThan(0);
      expect(diagnosticar(d).some((a) => a.refs.includes(ref))).toBe(true);
    });
  }

  it('regra de horário sem horario e regra de feriado sem calendario viram dado_incompleto, como no motor', () => {
    const d = doc({
      pecas: [peca('h', 'regra_horario'), peca('f', 'regra_feriado')],
      saidas: [saida('h', 'sim', 'fim:desliga'), saida('f', 'sim', 'fim:desliga')],
    });
    const a = diagnosticar(d).filter((x) => x.tipo === 'dado_incompleto');
    expect(a.map((x) => x.refs[0])).toEqual(['peca:f', 'peca:h']);
    expect(a.find((x) => x.refs[0] === 'peca:h')!.texto).toContain('não diz qual horário usar (horario)');
    expect(a.find((x) => x.refs[0] === 'peca:f')!.texto).toContain('não diz qual calendário usar (calendario)');
  });

  it('regra de horário apontando pra horário que não existe é destino_inexistente grave, pela peça e pelo campo', () => {
    // Horário sem nenhuma linha na aba horarios não existe: o grupo de horário é feito das linhas.
    const d = doc({ pecas: [peca('h', 'regra_horario', { horario: 'horario:x' })], saidas: [saida('h', 'sim', 'fim:desliga')], horarios: [janela('y', ['seg'], '08:00', '18:00')] });
    const a = diagnosticar(d);
    expect(a.filter((x) => x.tipo === 'dado_incompleto')).toEqual([]);
    const quebrada = a.filter((x) => x.tipo === 'destino_inexistente');
    expect(quebrada).toEqual([
      expect.objectContaining({ gravidade: 'grave', chave: 'destino_inexistente:peca:h:horario', refs: ['peca:h', 'horario:x'], campos: ['horario'] }),
    ]);
    expect(quebrada[0]!.texto).toContain('horario:x, que não está no catálogo');
  });

  it('saída órfã é destino_inexistente grave, com chave própria', () => {
    const a = diagnosticar(doc({ saidas: [saida('nada', '1', 'fim:desliga')] }));
    expect(a).toEqual([expect.objectContaining({ tipo: 'destino_inexistente', gravidade: 'grave', chave: 'destino_inexistente:saida:nada-1:origem' })]);
    expect(a[0]!.texto).toContain('sai de peca:nada, que não está no catálogo');
  });

  it('a ordem não depende do idioma: compara por código', () => {
    const a = diagnosticar(doc({ entradas: [entrada('b', 'peca:x'), entrada('B', 'peca:x'), entrada('a', 'peca:x')] }));
    expect(a.map((x) => x.chave)).toEqual(['beco_sem_saida:entrada:B', 'beco_sem_saida:entrada:a', 'beco_sem_saida:entrada:b']);
  });
});
