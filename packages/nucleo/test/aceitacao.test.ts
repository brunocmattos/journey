/**
 * Aceitação da etapa 1 (spec, seção 12.3): com a central real (sem nomes),
 * o diagnóstico precisa encontrar sozinho os problemas que o protótipo mostrou,
 * e o motor precisa percorrer os cenários "E se…".
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { diagnosticar } from '../src/diagnostico/diagnosticar';
import type { Achado } from '../src/diagnostico/tipos';
import type { Documento } from '../src/formato/documento';
import { importar } from '../src/importacao/importar';
import { executar } from '../src/motor/execucao';

const PASTA = join(import.meta.dirname, 'fixtures', 'central');
let central: Documento;
let achados: Achado[];
const doTipo = (tipo: Achado['tipo']) => achados.filter((a) => a.tipo === tipo);

beforeAll(async () => {
  const nomes = (await readdir(PASTA)).filter((n) => n.endsWith('.csv'));
  const r = await importar(await Promise.all(nomes.map(async (nome) => ({ nome, conteudo: await readFile(join(PASTA, nome), 'utf-8') }))));
  expect(r.problemas.filter((p) => p.gravidade === 'erro')).toEqual([]);
  central = r.efetivo;
  achados = diagnosticar(central);
});

describe('aceitação: diagnóstico da central de 11/11/2026', () => {
  it('1. fase 29 apagada, alcançada pelos menus Aluguéis, Condomínios e estendido ao esgotar', () => {
    const f29 = doTipo('beco_sem_saida').filter((a) => a.refs.includes('peca:fase-29'));
    expect(f29.map((a) => a.refs[0]).sort()).toEqual(['saida:fase-30-esgotou', 'saida:fase-31-esgotou', 'saida:fase-64-esgotou']);
  });

  it('2. 25 ramais em ciclo, incluindo 9019 ↔ 9507', () => {
    const ciclos = doTipo('ciclo_transbordo');
    expect(new Set(ciclos.flatMap((a) => a.refs)).size).toBe(25);
    expect(ciclos.some((a) => a.refs.slice(0, 2).sort().join() === 'ramal:9019,ramal:9507')).toBe(true);
  });

  it('3. 24 ramais transbordam pra ramal fora da lista', () => {
    const ramais = doTipo('destino_inexistente').filter((a) => a.refs[0]!.startsWith('ramal:') && a.campos?.includes('ao_nao_atender'));
    expect(new Set(ramais.map((a) => a.refs[0])).size).toBe(24);
  });

  it('4. emergência POA: elétrica e hidráulica na fila 99951; a 99950 sem entrada', () => {
    expect(doTipo('redundancia').map((a) => a.chave)).toContain('redundancia:peca:fase-180>fila:99951');
    expect(doTipo('sem_entrada').map((a) => a.refs[0])).toContain('fila:99950');
  });

  it('5. seg–sex 16h55–17h sem atendimento', () => {
    expect(doTipo('buraco_horario').map((a) => a.titulo)).toEqual(['seg, ter, qua, qui, sex 16:55–17:00']);
  });

  it('6. menus com opções que vão pro mesmo lugar', () => {
    expect(doTipo('redundancia').map((a) => a.chave)).toEqual(
      expect.arrayContaining(['redundancia:peca:fase-16>fila:90015', 'redundancia:peca:fase-30>fila:90011', 'redundancia:peca:fase-267>fila:90019']),
    );
  });

  it('7. sete transferências por nó inativo (99954 a 99960)', () => {
    const inativos = doTipo('no_inativo').filter((a) => a.refs[0]!.startsWith('saida:'));
    expect(inativos.map((a) => a.refs[2]).sort()).toEqual(['fila:99954', 'fila:99955', 'fila:99956', 'fila:99957', 'fila:99958', 'fila:99959', 'fila:99960']);
  });

  it('25 ramais voltam pra própria fila (sem contar os de anti-loop)', () => {
    expect(doTipo('volta_propria_fila')).toHaveLength(25);
  });
});

describe('aceitação: cenários "E se…" na central', () => {
  const comercial = 'entrada:did-5133279001';

  it('2ª via do boleto numa terça às 14h10 termina no e-mail', () => {
    const e = executar(central, {
      entrada: comercial,
      inicio: '2026-11-24T14:10',
      respostas: { 'peca:fase-305': 'esgotou', 'peca:fase-16': '1', 'peca:fase-252': '1', 'peca:fase-206': 'ok', 'peca:fase-5': 'ok' },
    });
    expect(e.motivo).toBe('fim');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:fase-8' });
    expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'trocou_canal', para: 'email' }));
  });

  it('não digitar nada no Submenu Aluguéis cai na fase 29, que não existe', () => {
    const e = executar(central, { entrada: comercial, inicio: '2026-11-24T15:40', respostas: { 'peca:fase-305': 'esgotou', 'peca:fase-16': '2', 'peca:fase-341': 'nao', 'peca:fase-30': 'esgotou' } });
    expect(e.motivo).toBe('destino_inexistente');
    expect(e.eventos.at(-1)).toMatchObject({ ref: 'peca:fase-29' });
  });

  it('falta de luz em POA num domingo às 21h30 cai na fila do hidráulico', () => {
    const e = executar(central, { entrada: comercial, inicio: '2026-11-29T21:30', respostas: { 'peca:fase-105': '2', 'peca:fase-117': '1', 'peca:fase-180': '1', 'fila:99951': 'atende' } });
    expect(e.motivo).toBe('atendido');
    expect(e.eventos.filter((x) => x.tipo === 'chegou').map((x) => (x as { ref: string }).ref)).toEqual(
      expect.arrayContaining(['peca:tc-3', 'peca:tc-2', 'peca:tc-1', 'peca:fase-103', 'peca:fase-105', 'fila:99951']),
    );
  });

  it('ligação às 16h57 de uma terça vai pro menu de fora do horário', () => {
    const e = executar(central, { entrada: comercial, inicio: '2026-11-24T16:57' });
    expect(e.pendente?.ref).toBe('peca:fase-105');
  });

  it('ninguém atende no ramal 9004: a ligação termina presa no ciclo 9019 ↔ 9507', () => {
    const e = executar(central, { entrada: 'ramal:9004', inicio: '2026-11-24T10:00', modo: 'ninguem_atende' });
    expect(e.motivo).toBe('ciclo');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'ramal:9019' });
  });
});
