import { describe, expect, it } from 'vitest';
import { diagnosticar, lerRef } from '@journey/nucleo';
import { doc, entrada, fila, janela, peca, ramal, saida } from '@journey/nucleo/teste';
import { cenarioAte } from '@/diagnostico/caminho';
import { rodar } from '@/simulacao/sessao';
import { central } from '../central';

const d = doc({
  entradas: [entrada('e', 'peca:h')],
  horarios: [janela('tg', ['seg'], '08:00', '18:00')],
  pecas: [peca('h', 'regra_horario', { horario: 'horario:tg' }), peca('m', 'menu', { espera_s: 5, tentativas: 2 }), peca('a', 'audio')],
  saidas: [saida('h', 'sim', 'peca:m'), saida('h', 'nao', 'fim:desliga'), saida('m', '1', 'fila:f'), saida('m', 'esgotou', 'peca:a'), saida('a', 'sempre', 'peca:x')],
  filas: [fila('f', { espera_maxima_s: 30, ao_esgotar: 'ramal:r' })],
  ramais: [ramal('r')],
});

/** Roda o cenário no modo livre e devolve onde a água parou ou terminou. */
function chegada(doc: Parameters<typeof cenarioAte>[0], alvo: string) {
  const c = cenarioAte(doc, alvo)!;
  const e = rodar(doc, { entrada: c.entrada, inicio: '2026-11-22T03:00', modo: 'livre', escolhas: c.escolhas });
  return { c, e, chegou: e.eventos.filter((x) => x.tipo === 'chegou').map((x) => (x as { ref: string }).ref) };
}

describe('cenarioAte', () => {
  it('passa pelo relógio e pelo menu, mesmo fora do horário', () => {
    const { c, chegou } = chegada(d, 'ramal:r');
    expect(c).toEqual({ entrada: 'entrada:e', escolhas: ['saida:h-sim', 'saida:m-1', 'nao_atende'] });
    expect(chegou.at(-1)).toBe('ramal:r');
  });

  it('peça de caminho único não vira escolha; saída como alvo termina escolhendo a saída', () => {
    const { c, e } = chegada(d, 'saida:a-sempre');
    expect(c.escolhas).toEqual(['saida:h-sim', 'saida:m-esgotou']);
    expect(e.motivo).toBe('destino_inexistente');
  });

  it('ponto que nenhuma entrada alcança dá null', () => {
    expect(cenarioAte(doc({ ...d, filas: [...d.filas, fila('solta')] }), 'fila:solta')).toBeNull();
  });
});

describe('cenarioAte com a central (aceitação)', () => {
  it('todo achado grave alcançável tem um cenário que leva a água até o ponto dele', async () => {
    const c = await central();
    const graves = diagnosticar(c).filter((a) => a.gravidade === 'grave');
    let comCaminho = 0;
    for (const a of graves) {
      const alvo = a.refs[0]!;
      const cen = cenarioAte(c, alvo);
      if (!cen) continue;
      comCaminho++;
      const e = rodar(c, { entrada: cen.entrada, inicio: '2026-11-22T03:00', modo: 'livre', escolhas: cen.escolhas });
      const refs = e.eventos.flatMap((x) => (x.tipo === 'chegou' ? [x.ref] : x.tipo === 'escolheu' && x.saida ? [`saida:${x.saida}`] : []));
      const r = lerRef(alvo)!;
      expect(refs, a.chave).toContain(r.tipo === 'saida' ? alvo : alvo);
    }
    expect(comCaminho).toBeGreaterThan(0);
  });
});
