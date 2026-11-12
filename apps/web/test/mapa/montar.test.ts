import { describe, expect, it } from 'vitest';
import { doc, entrada, fila, janela, peca, ramal, saida } from '@journey/nucleo/teste';
import { montarMapa, type Mapa } from '@/mapa/montar';
import { central } from '../central';

const no = (m: Mapa, id: string) => m.nos.find((n) => n.id === id)!;
const cano = (m: Mapa, de: string, para: string) => m.canos.find((c) => c.de === de && c.para === para);

/** Nenhum par de nós na mesma coluna se sobrepõe. */
function semSobreposicao(m: Mapa) {
  const porColuna = new Map<number, typeof m.nos>();
  for (const n of m.nos) porColuna.set(n.x, [...(porColuna.get(n.x) ?? []), n]);
  for (const col of porColuna.values()) {
    const ord = [...col].sort((a, b) => a.y - b.y);
    for (let i = 1; i < ord.length; i++) expect(ord[i]!.y - ord[i]!.h / 2).toBeGreaterThanOrEqual(ord[i - 1]!.y + ord[i - 1]!.h / 2);
  }
}

const menu = doc({
  entradas: [entrada('e1', 'peca:m'), entrada('e2', 'peca:m', { nome: 'Outro' }), entrada('e3', 'ramal:100')],
  pecas: [peca('m', 'menu', { nome: 'Menu', espera_s: 5, tentativas: 2 }), peca('a', 'audio', { nome: 'Aviso' })],
  saidas: [saida('m', '1', 'fila:f1'), saida('m', '2', 'ramal:100'), saida('m', '3', 'fila:f1'), saida('m', 'esgotou', 'peca:a')],
  filas: [fila('f1', { nome: 'Fila 1', espera_maxima_s: 60, ao_esgotar: 'peca:m' })],
  ramais: [ramal('100', { ao_nao_atender: 'ramal:999' })],
});

describe('montarMapa', () => {
  it('junta entradas com o mesmo destino e põe as que vão direto pra ramal num nó só', () => {
    const m = montarMapa(menu);
    const raizes = m.nos.filter((n) => n.x === 0);
    expect(raizes.map((n) => [n.tipo, n.titulo])).toEqual([
      ['entrada', '2 números'],
      ['ramais_diretos', 'Ramais diretos'],
    ]);
    expect(no(m, 'entradas>peca:m').entradas).toEqual(['entrada:e1', 'entrada:e2']);
    expect(m.porRef.get('entrada:e2')).toEqual(['entradas>peca:m']);
  });

  it('agrupa num cano só as opções que vão pro mesmo lugar, com as teclas no chip', () => {
    const m = montarMapa(menu);
    const c = cano(m, 'peca:m', 'fila:f1')!;
    expect(c.rotulo).toBe('1·3');
    expect(c.saidas).toEqual(['m-1', 'm-3']);
    expect(m.porSaida.get('m-3')).toBe(c.id);
    expect(no(m, 'peca:m').decisao).toBe(true);
  });

  it('a segunda chegada num ponto vira atalho; se o ponto está no caminho, é volta', () => {
    const m = montarMapa(menu);
    const daFila = m.canos.find((c) => c.de === 'fila:f1')!;
    const atalho = no(m, daFila.para!);
    expect(atalho.tipo).toBe('atalho');
    expect(atalho.atalho).toEqual({ alvo: 'peca:m', volta: true });
    expect(daFila.tipo).toBe('retorno');
    expect(m.porRef.get('peca:m')).toEqual(['peca:m', atalho.id]);
  });

  it('referência que não existe vira nó próprio; peça sem saída ganha cano quebrado', () => {
    const m = montarMapa(menu);
    expect(no(m, 'ramal:999').tipo).toBe('inexistente');
    expect(m.canos.find((c) => c.de === 'peca:a')).toMatchObject({ para: null, tipo: 'sem_saida' });
  });

  it('cano por saída inativa ou pra peça inativa é tracejado', () => {
    const m = montarMapa(
      doc({
        entradas: [entrada('e', 'peca:r')],
        pecas: [peca('r', 'consulta'), peca('x', 'transferencia', { ativo: false })],
        saidas: [saida('r', 'ok', 'peca:x'), saida('r', 'erro', 'fim:desliga', { ativo: false })],
      }),
    );
    expect(cano(m, 'peca:r', 'peca:x')!.tipo).toBe('inativo');
    expect(cano(m, 'peca:r', 'fim:desliga')!.tipo).toBe('inativo');
  });

  it('cada ramo final de uma regra de horário é uma faixa com o nome do horário', () => {
    const m = montarMapa(
      doc({
        entradas: [entrada('e', 'peca:h1')],
        horarios: [{ ...janela('tg1', ['seg', 'ter'], '08:00', '18:00'), nome: 'Comercial' }, janela('tg2', ['sab'], '09:00', '12:00')],
        pecas: [peca('h1', 'regra_horario', { horario: 'horario:tg1' }), peca('h2', 'regra_horario', { horario: 'horario:tg2' })],
        saidas: [saida('h1', 'sim', 'fila:f'), saida('h1', 'nao', 'peca:h2'), saida('h2', 'sim', 'fila:f'), saida('h2', 'nao', 'fim:desliga')],
        filas: [fila('f')],
      }),
    );
    expect(m.faixas.map((f) => f.titulo)).toEqual(['Comercial', 'tg2', 'Fora do horário']);
    expect(m.faixas[0]!.subtitulo).toBe('seg ter 08:00–18:00');
    for (let i = 1; i < m.faixas.length; i++) expect(m.faixas[i]!.y1).toBeGreaterThanOrEqual(m.faixas[i - 1]!.y2 - 52);
  });

  it('como o motor: fila com espera e ramal sem transbordo desligam; pontas se repetem em vez de virar atalho', () => {
    const m = montarMapa(
      doc({
        entradas: [entrada('e', 'peca:m')],
        pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 })],
        saidas: [saida('m', '1', 'fila:f'), saida('m', '2', 'ramal:r'), saida('m', 'esgotou', 'fim:desliga')],
        filas: [fila('f', { espera_maxima_s: 30 })],
        ramais: [ramal('r')],
      }),
    );
    expect(m.canos.find((c) => c.de === 'fila:f')).toMatchObject({ rotulo: 'ninguém atende (sem transbordo)', opcoes: ['nao_atende'] });
    expect(m.porRef.get('fim:desliga')).toHaveLength(3);
    expect(m.nos.filter((n) => n.tipo === 'atalho')).toEqual([]);
  });

  it('com raízes dadas, desenha só o que sai delas', () => {
    const m = montarMapa(menu, { raizes: ['ramal:100'] });
    expect(m.nos.map((n) => n.id)).toEqual(['ramal:100', 'ramal:999']);
    expect(m.nos[1]!.tipo).toBe('inexistente');
  });

  it('documento vazio dá mapa vazio', () => {
    const m = montarMapa(doc({}));
    expect(m.nos).toEqual([]);
    expect(m.limites).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
  });

  it('nós não se sobrepõem e todo cano liga nós que existem', () => {
    const m = montarMapa(menu);
    semSobreposicao(m);
    const ids = new Set(m.nos.map((n) => n.id));
    for (const c of m.canos) {
      expect(ids.has(c.de)).toBe(true);
      if (c.para) expect(ids.has(c.para)).toBe(true);
    }
  });

  it('entradas inativas ficam num nó próprio, apagado, com cano tracejado', () => {
    const m = montarMapa(
      doc({
        entradas: [entrada('a', 'peca:m'), entrada('b', 'peca:m', { ativo: false }), entrada('c', 'peca:m', { ativo: false })],
        pecas: [peca('m', 'audio')],
        saidas: [saida('m', 'sempre', 'fim:desliga')],
      }),
    );
    const raizes = m.nos.filter((n) => n.tipo === 'entrada');
    expect(raizes.map((n) => [n.entradas, n.inativo])).toEqual([
      [['entrada:a'], false],
      [['entrada:b', 'entrada:c'], true],
    ]);
    expect(m.canos.filter((c) => c.de === raizes[0]!.id).map((c) => c.tipo)).toEqual(['normal']);
    expect(m.canos.filter((c) => c.de === raizes[1]!.id).map((c) => c.tipo)).toEqual(['inativo']);
  });

  it('cano que o motor nunca usa sai marcado como não simulável', () => {
    const m = montarMapa(doc({ entradas: [entrada('e', 'fila:f')], filas: [fila('f', { ao_esgotar: 'fim:desliga' })] }));
    expect(m.canos.find((c) => c.de === 'fila:f')).toMatchObject({ rotulo: 'nunca: sem espera máxima', simulavel: false });
    expect(m.canos.find((c) => c.de === 'entrada:e')!.simulavel).toBe(true);
  });

  it('tecla de mais de um dígito aparece no chip', () => {
    const m = montarMapa(
      doc({
        entradas: [entrada('e', 'peca:m')],
        pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 })],
        saidas: [saida('m', '10', 'fila:f', { rotulo: 'Dez' }), saida('m', 'esgotou', 'fim:desliga')],
        filas: [fila('f')],
      }),
    );
    expect(cano(m, 'peca:m', 'fila:f')!.rotulo).toBe('10');
  });

  it('ids de atalhos e cópias de pontas vêm do cano que chega: uma saída nova antes não muda os de depois', () => {
    const base = {
      entradas: [entrada('e', 'peca:m')],
      pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 }), peca('a', 'audio'), peca('b', 'consulta'), peca('c', 'audio'), peca('x', 'audio')],
      filas: [fila('f')],
    };
    const depois = [saida('m', '1', 'peca:a'), saida('m', '2', 'peca:b'), saida('m', 'esgotou', 'fim:desliga'), saida('a', 'sempre', 'peca:x'), saida('x', 'sempre', 'fim:desliga')];
    depois.push(saida('b', 'ok', 'peca:x'), saida('b', 'erro', 'fim:desliga'));
    const antes = montarMapa(doc({ ...base, saidas: depois }));
    const comNova = montarMapa(doc({ ...base, saidas: [saida('m', '0', 'peca:c'), saida('c', 'sempre', 'peca:x'), ...depois] }));
    const doB = (m: Mapa) => m.canos.filter((c) => c.de === 'peca:b').map((c) => c.para);
    expect(doB(antes)).toEqual(['atalho:peca:b>b-ok', 'fim:desliga@peca:b>b-erro']);
    expect(doB(comNova)).toEqual(doB(antes));
    expect(cano(antes, 'peca:m', 'fim:desliga@peca:m>m-esgotou')).toBeDefined();
    expect(cano(comNova, 'peca:m', 'fim:desliga@peca:m>m-esgotou')).toBeDefined();
  });

  it('regra cujo sim e não vão pro mesmo ponto não abre faixa', () => {
    const m = montarMapa(
      doc({
        entradas: [entrada('e', 'peca:h')],
        horarios: [janela('tg', ['seg'], '08:00', '18:00')],
        pecas: [peca('h', 'regra_horario', { horario: 'horario:tg' })],
        saidas: [saida('h', 'sim', 'fila:f'), saida('h', 'nao', 'fila:f')],
        filas: [fila('f')],
      }),
    );
    expect(m.faixas).toEqual([]);
  });

  it('faixa dentro de faixa fica inteira por dentro, sem borda em comum', () => {
    const m = montarMapa(
      doc({
        entradas: [entrada('e', 'peca:h')],
        horarios: [{ ...janela('tg', ['seg'], '08:00', '18:00'), nome: 'Comercial' }],
        pecas: [peca('h', 'regra_horario', { horario: 'horario:tg' }), peca('m', 'menu', { espera_s: 5, tentativas: 1 }), peca('f2', 'regra_feriado', { calendario: 'padrao' })],
        saidas: [saida('h', 'sim', 'peca:m'), saida('h', 'nao', 'fim:desliga'), saida('m', '1', 'peca:f2'), saida('f2', 'sim', 'fila:a'), saida('f2', 'nao', 'fila:b')],
        filas: [fila('a'), fila('b')],
      }),
    );
    const por = (t: string) => m.faixas.find((f) => f.titulo === t)!;
    const fora = por('Comercial');
    expect(fora.nivel).toBe(0);
    expect(por('Fora do horário').nivel).toBe(0);
    for (const dentro of [por('Feriado'), por('Fora de feriado')]) {
      expect(dentro.nivel).toBe(1);
      expect(dentro.x1).toBeGreaterThan(fora.x1);
      expect(dentro.y1).toBeGreaterThan(fora.y1);
      expect(dentro.x2).toBeLessThan(fora.x2);
      expect(dentro.y2).toBeLessThan(fora.y2);
    }
    // A faixa seguinte não invade a de fora.
    expect(por('Fora do horário').y1).toBeGreaterThanOrEqual(fora.y2 - 52);
    semSobreposicao(m);
  });

  it('300 peças em menos de 200 ms', () => {
    const n = 300;
    const pecas = Array.from({ length: n }, (_, i) => peca(`p${i}`, 'menu', { espera_s: 5, tentativas: 1 }));
    const saidas = pecas.flatMap((_, i) => [saida(`p${i}`, '1', `peca:p${(i + 1) % n}`), saida(`p${i}`, '2', `peca:p${(i * 7 + 3) % n}`)]);
    const d = doc({ entradas: [entrada('e', 'peca:p0')], pecas, saidas });
    const t0 = performance.now();
    const m = montarMapa(d);
    expect(performance.now() - t0).toBeLessThan(200);
    expect(m.nos.filter((x) => x.tipo === 'peca')).toHaveLength(n);
    semSobreposicao(m);
  });
});

describe('montarMapa com a central (aceitação)', () => {
  it('toda peça, fila e grupo que uma entrada alcança aparece uma vez como ponto', async () => {
    const d = await central();
    const m = montarMapa(d);
    semSobreposicao(m);
    const pontos = m.nos.filter((n) => n.tipo !== 'atalho');
    expect(new Set(pontos.map((n) => n.id)).size).toBe(pontos.length);
    expect(m.nos.find((n) => n.tipo === 'ramais_diretos')).toBeDefined();
    expect(m.porRef.has('peca:fase-29')).toBe(true);
    expect(m.nos.find((n) => n.id === 'peca:fase-29')!.tipo).toBe('inexistente');
  });
});
