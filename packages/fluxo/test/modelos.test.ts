import { describe, expect, it } from 'vitest';
import { CANAIS_PADRAO } from '../src/cadastros';
import { diagnosticar } from '../src/diagnostico';
import { MODELOS, instanciarModelo, type Modelo } from '../src/modelos';
import { simular, type Evento } from '../src/motor';
import { lerDocumento } from '../src/validar';

const ultimo = (es: readonly Evento[]) => es[es.length - 1]!;
const inicioDe = (m: Modelo) => m.documento.pecas.find((p) => p.tipo === 'inicio')!.id;

/** Todos os finais possíveis, escolhendo cada opção em cada pergunta. */
function finais(m: Modelo, quando: string): Evento[] {
  const out: Evento[] = [];
  const pilha: string[][] = [[]];
  while (pilha.length && out.length < 1000) {
    const escolhas = pilha.pop()!;
    const x = simular(m.documento, { cadastros: m.cadastros, canal: m.canal }, { inicio: inicioDe(m), quando, escolhas });
    if (x.pendente) for (const o of x.pendente.opcoes) pilha.push([...escolhas, o.conexao]);
    else out.push(ultimo(x.eventos));
  }
  return out;
}

describe.each(MODELOS.map((m) => [m.nome, m] as const))('modelo %s', (_nome, m) => {
  const conhecidos = { canais: CANAIS_PADRAO.map((c) => c.chave), cadastros: m.cadastros.map((k) => k.id) };

  it('é um documento válido, sem aviso', () => {
    const r = lerDocumento(m.documento, conhecidos);
    expect(r.problemas).toEqual([]);
    expect(r.documento).toEqual(m.documento);
  });

  it('não tem achado nenhum', () => {
    expect(diagnosticar(m.documento, { cadastros: m.cadastros })).toEqual([]);
  });

  it('todo caminho chega num Fim, numa segunda às 10h e num domingo', () => {
    for (const quando of ['2026-11-23T10:00', '2026-11-22T10:00']) {
      const fs = finais(m, quando);
      expect(fs.length).toBeGreaterThan(0);
      for (const f of fs) expect(f).toMatchObject({ tipo: 'terminou', motivo: 'fim' });
    }
  });
});

describe('modelos', () => {
  it('chaves e ids de cadastro não se repetem entre modelos', () => {
    expect(new Set(MODELOS.map((m) => m.chave)).size).toBe(MODELOS.length);
    const ids = MODELOS.flatMap((m) => m.cadastros.map((k) => `${k.id}=${k.tipo}:${k.nome}`));
    expect(new Set(ids.map((x) => x.split('=')[0])).size).toBe(new Set(ids).size);
  });

  it('num domingo e no Natal, o relógio manda pro "fora do horário"', () => {
    const comHorario = MODELOS.filter((x) => x.documento.conexoes.some((c) => c.regra === 'horario'));
    expect(comHorario).toHaveLength(2);
    for (const m of comHorario) {
      for (const quando of ['2026-11-22T10:00', '2026-12-25T10:00']) {
        const x = simular(m.documento, { cadastros: m.cadastros }, { inicio: inicioDe(m), quando });
        const pelo = x.eventos.find((e) => e.tipo === 'escolheu' && e.quem === 'relogio');
        expect(pelo).toBeDefined();
        expect(m.documento.conexoes.find((c) => c.id === (pelo as { conexao: string }).conexao)!.horario).toBe('fora');
      }
    }
  });

  it('são congelados: editar um fluxo nunca muda o modelo', () => {
    const m = MODELOS[0]!;
    expect(Object.isFrozen(m.documento.pecas[0])).toBe(true);
    expect(Object.isFrozen(m.cadastros[0]!.campos)).toBe(true);
    expect(() => {
      (m.documento.pecas as unknown[]).push({});
    }).toThrow();
  });

  it('instanciar: cópia editável com os cadastros da empresa', () => {
    const m = MODELOS.find((x) => x.chave === 'ura')!;
    const ids = Object.fromEntries(m.cadastros.map((k, i) => [k.id, `00000000-0000-0000-0000-00000000000${i}`]));
    const d = instanciarModelo(m, ids);
    const daEmpresa = m.cadastros.map((k) => ({ ...k, id: ids[k.id]! }));
    expect(lerDocumento(d, { cadastros: Object.values(ids) }).problemas).toEqual([]);
    expect(diagnosticar(d, { cadastros: daEmpresa })).toEqual([]);
    d.pecas[0]!.nome = 'mudou';
    expect(m.documento.pecas[0]!.nome).not.toBe('mudou');
    expect(m.documento.pecas.find((p) => p.id === 'horario')!.responsavel).toBe('horario-comercial');
    const x = simular(d, { cadastros: daEmpresa }, { inicio: 'liga', quando: '2026-11-22T10:00' });
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'fim', peca: 'desliga' });
  });

  it('instanciar sem um dos cadastros é erro', () => {
    expect(() => instanciarModelo(MODELOS[1]!, { bureau: 'x' })).toThrow('Analistas de crédito');
  });
});
