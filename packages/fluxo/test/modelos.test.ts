import { describe, expect, it } from 'vitest';
import { diagnosticar } from '../src/diagnostico';
import { MODELOS } from '../src/modelos';
import { simular, type Evento } from '../src/motor';
import { lerDocumento } from '../src/validar';

const ultimo = (es: readonly Evento[]) => es[es.length - 1]!;

describe.each(MODELOS.map((m) => [m.nome, m] as const))('modelo %s', (_nome, m) => {
  const conhecidos = { canais: ['telefonia', 'whatsapp', 'email', 'chat', 'interno'], cadastros: m.cadastros.map((k) => k.id) };

  it('é um documento válido, sem aviso', () => {
    const r = lerDocumento(m.documento, conhecidos);
    expect(r.problemas).toEqual([]);
    expect(r.documento).toEqual(m.documento);
  });

  it('não tem achado grave nem alerta', () => {
    expect(diagnosticar(m.documento, { cadastros: m.cadastros }).filter((a) => a.gravidade !== 'observacao')).toEqual([]);
  });

  it('chega num Fim escolhendo sempre a primeira opção, numa segunda às 10h', () => {
    const inicio = m.documento.pecas.find((p) => p.tipo === 'inicio')!.id;
    const ctx = { cadastros: m.cadastros, canal: m.canal };
    const escolhas: string[] = [];
    let x = simular(m.documento, ctx, { inicio, quando: '2026-11-23T10:00' });
    while (x.pendente) {
      escolhas.push(x.pendente.opcoes[0]!.conexao);
      x = simular(m.documento, ctx, { inicio, quando: '2026-11-23T10:00', escolhas });
    }
    expect(ultimo(x.eventos)).toMatchObject({ tipo: 'terminou', motivo: 'fim' });
  });
});

describe('modelos com horário', () => {
  it('num domingo, o relógio manda pro "fora do horário"', () => {
    for (const m of MODELOS.filter((x) => x.documento.conexoes.some((c) => c.regra === 'horario'))) {
      const inicio = m.documento.pecas.find((p) => p.tipo === 'inicio')!.id;
      const x = simular(m.documento, { cadastros: m.cadastros }, { inicio, quando: '2026-11-22T10:00' });
      const pelo = x.eventos.find((e) => e.tipo === 'escolheu' && e.quem === 'relogio');
      expect(m.documento.conexoes.find((c) => c.id === (pelo as { conexao: string }).conexao)!.horario).toBe('fora');
    }
  });
});
