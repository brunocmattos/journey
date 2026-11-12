import { describe, expect, it } from 'vitest';
import { indexar } from '@journey/nucleo/formato';
import { doc, entrada, peca, saida } from '@journey/nucleo/teste';
import { pontosComAgenda } from '@/diagnostico/agenda';

const regras = [peca('h', 'regra_horario', { horario: 'horario:tg' }), peca('f', 'regra_feriado')];
const saidasDasRegras = [saida('h', 'sim', 'fim:desliga'), saida('h', 'nao', 'fim:desliga'), saida('f', 'sim', 'fim:desliga'), saida('f', 'nao', 'peca:h')];

describe('pontosComAgenda', () => {
  it('entrada direto na regra', () => {
    const d = doc({ entradas: [entrada('e', 'peca:h')], pecas: regras, saidas: saidasDasRegras });
    expect(pontosComAgenda(indexar(d))).toEqual(['peca:h']);
  });

  it('passa por áudios de saída única até a primeira regra (e não segue depois dela)', () => {
    const d = doc({
      entradas: [entrada('e', 'peca:boas-vindas')],
      pecas: [peca('boas-vindas', 'audio'), peca('lgpd', 'audio'), ...regras],
      saidas: [saida('boas-vindas', 'sempre', 'peca:lgpd'), saida('lgpd', 'sempre', 'peca:f'), ...saidasDasRegras],
    });
    expect(pontosComAgenda(indexar(d))).toEqual(['peca:f']);
  });

  it('menu, peça com várias saídas e destino fora das peças param a busca', () => {
    const d = doc({
      entradas: [entrada('m', 'peca:menu'), entrada('c', 'peca:consulta'), entrada('x', 'fila:f'), entrada('s', 'peca:sem-saida')],
      pecas: [peca('menu', 'menu'), peca('consulta', 'consulta'), peca('sem-saida', 'audio'), ...regras],
      saidas: [saida('menu', '1', 'peca:h'), saida('consulta', 'sim', 'peca:h'), saida('consulta', 'nao', 'peca:h'), ...saidasDasRegras],
    });
    expect(pontosComAgenda(indexar(d))).toEqual([]);
  });

  it('uma agenda por regra, mesmo com várias entradas chegando nela; laço de áudios não trava', () => {
    const d = doc({
      entradas: [entrada('e1', 'peca:h'), entrada('e2', 'peca:a'), entrada('e3', 'peca:laco1')],
      pecas: [peca('a', 'audio'), peca('laco1', 'audio'), peca('laco2', 'audio'), ...regras],
      saidas: [saida('a', 'sempre', 'peca:h'), saida('laco1', 'sempre', 'peca:laco2'), saida('laco2', 'sempre', 'peca:laco1'), ...saidasDasRegras],
    });
    expect(pontosComAgenda(indexar(d))).toEqual(['peca:h']);
  });
});
