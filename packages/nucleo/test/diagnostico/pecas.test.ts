import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { alcancaveis } from '../../src/diagnostico/alcance';
import { becos, dadosIncompletos, nosInativos, redundancias, semEntrada, voltasSemLimite } from '../../src/diagnostico/pecas';
import { doc, entrada, fila, peca, saida } from '../apoio';

describe('diagnóstico das peças', () => {
  const idx = indexar(
    doc({
      entradas: [entrada('e', 'peca:menu')],
      pecas: [
        peca('menu', 'menu', { nome: 'Menu', espera_s: 5, tentativas: 2 }),
        peca('sub', 'menu', { nome: 'Sub', espera_s: 5, tentativas: 2 }),
        peca('aviso', 'audio', { nome: 'Aviso' }),
        peca('mudo', 'audio', { nome: 'Mudo' }),
        peca('solta', 'audio'),
      ],
      saidas: [
        saida('menu', '1', 'peca:sub'),
        saida('menu', '2', 'peca:aviso'),
        saida('menu', '3', 'fila:1'),
        saida('menu', 'esgotou', 'peca:apagada'),
        saida('menu', '9', 'peca:mudo'),
        saida('sub', '0', 'peca:menu'),
        saida('sub', '1', 'fila:1'),
        saida('sub', 'esgotou', 'fila:2', { ativo: false }),
        saida('aviso', 'sempre', 'fila:1'),
      ],
      filas: [fila('1'), fila('2')],
    }),
  );
  const alc = alcancaveis(idx);

  it('becos: peça alcançável sem saída e saída pra peça que não existe', () => {
    expect(becos(idx, alc).map((a) => a.chave)).toEqual(['beco_sem_saida:peca:mudo', 'beco_sem_saida:saida:menu-esgotou']);
  });

  it('volta sem limite só na saída que fecha o círculo', () => {
    expect(voltasSemLimite(idx, alc).map((a) => a.chave)).toEqual(['volta_sem_limite:saida:sub-0']);
  });

  it('volta sem limite também depois de fila, e não no menu que repete ao esgotar', () => {
    const i = indexar(
      doc({
        entradas: [entrada('e', 'fila:1')],
        filas: [fila('1', { ao_esgotar: 'peca:a' })],
        pecas: [peca('a', 'audio'), peca('b', 'audio'), peca('m', 'menu', { espera_s: 5, tentativas: 2 })],
        saidas: [saida('a', 'sempre', 'peca:b', { id: 'a-b' }), saida('b', 'sempre', 'peca:a', { id: 'b-a' }), saida('b', '1', 'peca:m', { id: 'b-m' }), saida('m', 'esgotou', 'peca:m', { id: 'm-m' })],
      }),
    );
    expect(voltasSemLimite(i, alcancaveis(i)).map((a) => a.chave)).toEqual(['volta_sem_limite:saida:b-a']);
  });

  it('redundância atravessa peças de saída única', () => {
    const r = redundancias(idx, alc);
    expect(r.map((a) => a.chave)).toEqual(['redundancia:peca:menu>fila:1']);
    expect(r[0]!.texto).toBe('As opções 2 e 3 de Menu terminam no mesmo lugar: fila 1.');
  });

  it('sem entrada', () => {
    expect(semEntrada(idx, alc).map((a) => a.chave)).toEqual(['sem_entrada:peca:solta']);
  });

  it('nó inativo no caminho', () => {
    expect(nosInativos(idx, alc).map((a) => a.chave)).toEqual(['no_inativo:saida:sub-esgotou']);
  });

  it('dados incompletos viram observação', () => {
    const a = dadosIncompletos(indexar(doc({ pecas: [peca('m', 'menu')] })));
    expect(a.map((x) => x.chave)).toEqual(['dado_incompleto:menu_sem_tempo:peca:m', 'dado_incompleto:menu_sem_esgotou:peca:m']);
    expect(a[0]!.gravidade).toBe('observacao');
  });
});
