import { describe, expect, it } from 'vitest';
import { executar, type Execucao } from '../../src/motor/execucao';
import { doc, entrada, fila, grupo, janela, peca, ramal, saida } from '../apoio';

/**
 * Entrada → feriado? → horário? → menu
 *   menu 1 → fila 100 (espera 60 s → grupo 200 → caixa postal)
 *   menu 2 → ramal 2001 ↔ 2002 (ciclo)
 *   menu 3 → tipo (guarda variável) → busca → e-mail (troca de canal) ou falha conforme o tipo
 *   menu esgotou → fim
 *   fora do horário ou feriado → áudio de 9 s → fim
 */
const base = doc({
  entradas: [entrada('e', 'peca:feriado')],
  horarios: [janela('h', ['seg', 'ter', 'qua', 'qui', 'sex'], '08:00', '18:00')],
  feriados: [{ id: 'natal', calendario: 'nacional', data: '2026-12-25', todo_ano: true }],
  pecas: [
    peca('feriado', 'regra_feriado', { calendario: 'nacional' }),
    peca('horario', 'regra_horario', { horario: 'horario:h' }),
    peca('menu', 'menu', { espera_s: 5, tentativas: 2 }),
    peca('fora', 'audio', { duracao_s: 9 }),
    peca('tipo', 'menu', { espera_s: 3, tentativas: 1, guarda_variavel: 'tipo' }),
    peca('busca', 'consulta'),
    peca('email', 'fim', { canal: 'email' }),
    peca('fim', 'fim'),
  ],
  saidas: [
    saida('feriado', 'sim', 'peca:fora'),
    saida('feriado', 'nao', 'peca:horario'),
    saida('horario', 'sim', 'peca:menu'),
    saida('horario', 'nao', 'peca:fora'),
    saida('menu', '1', 'fila:100'),
    saida('menu', '2', 'ramal:2001'),
    saida('menu', '3', 'peca:tipo'),
    saida('menu', 'esgotou', 'peca:fim'),
    saida('fora', 'sempre', 'peca:fim'),
    saida('tipo', '1', 'peca:busca', { define: { chave: 'tipo', valor: 'aluguel' } }),
    saida('tipo', '2', 'peca:busca', { define: { chave: 'tipo', valor: 'condominio' } }),
    saida('busca', 'ok', 'peca:email'),
    saida('busca', 'falha', 'fila:100', { quando: { chave: 'tipo', valor: 'aluguel' } }),
    saida('busca', 'falha', 'peca:nada', { quando: { chave: 'tipo', valor: 'condominio' } }),
  ],
  filas: [fila('100', { espera_maxima_s: 60, ao_esgotar: 'grupo:200' })],
  grupos: [grupo('200', { ao_esgotar: 'fim:caixa_postal' })],
  ramais: [ramal('2001', { toque_s: 20, ao_nao_atender: 'ramal:2002' }), ramal('2002', { siga_me_so_ramal_s: 7, siga_me_com_lista_s: 20, ao_nao_atender: 'ramal:2001' })],
});

const terca10h = { entrada: 'entrada:e', inicio: '2026-11-24T10:00' };
const chegadas = (e: Execucao) => e.eventos.flatMap((x) => (x.tipo === 'chegou' ? [x.ref] : []));

describe('motor', () => {
  it('o relógio decide feriado e horário; o menu espera quem liga', () => {
    const e = executar(base, terca10h);
    expect(e.terminou).toBe(false);
    expect(e.pendente?.ref).toBe('peca:menu');
    expect(e.eventos.filter((x) => x.tipo === 'escolheu')).toEqual([
      expect.objectContaining({ ref: 'peca:feriado', opcao: 'nao', como: 'relogio' }),
      expect.objectContaining({ ref: 'peca:horario', opcao: 'sim', como: 'relogio' }),
    ]);
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'decisao', quem: 'quem_liga' });
  });

  it('fora do horário passa pelo áudio e soma a duração', () => {
    const e = executar(base, { ...terca10h, inicio: '2026-11-24T20:00' });
    expect(e.motivo).toBe('fim');
    expect(e.segundos).toBe(9);
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:fim' });
  });

  it('feriado de todo ano vale em qualquer ano', () => {
    const e = executar(base, { ...terca10h, inicio: '2027-12-25T10:00' });
    expect(e.eventos.find((x) => x.tipo === 'escolheu')).toMatchObject({ ref: 'peca:feriado', opcao: 'sim' });
  });

  it('respostas do cenário, variável guardada e saída condicionada', () => {
    const e = executar(base, { ...terca10h, respostas: { 'peca:menu': '3', 'peca:tipo': '2', 'peca:busca': 'falha' } });
    expect(e.variaveis).toEqual({ tipo: 'condominio' });
    expect(e.motivo).toBe('destino_inexistente');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:nada' });
  });

  it('esgotar o menu custa espera × tentativas', () => {
    const e = executar(base, { ...terca10h, respostas: { 'peca:menu': 'esgotou' } });
    expect(e.segundos).toBe(10);
    expect(e.motivo).toBe('fim');
  });

  it('responde uma decisão pendente e recusa opção inexistente', () => {
    const e = executar(base, terca10h);
    expect(e.avancar('1')[0]).toMatchObject({ tipo: 'escolheu', opcao: '1', como: 'resposta' });
    expect(e.pendente?.ref).toBe('fila:100');
    expect(() => e.avancar('9')).toThrow('não é uma opção');
    e.avancar('atende');
    expect(e.motivo).toBe('atendido');
  });

  it('ninguém atende: a fila transborda pelo tempo máximo, o grupo vai pro destino', () => {
    const e = executar(base, { ...terca10h, modo: 'ninguem_atende', respostas: { 'peca:menu': '1' } });
    expect(chegadas(e)).toEqual(['entrada:e', 'peca:feriado', 'peca:horario', 'peca:menu', 'fila:100', 'grupo:200', 'fim:caixa_postal']);
    expect(e.motivo).toBe('fim');
    expect(e.segundos).toBe(3 + 60 + 20);
  });

  it('ciclo entre ramais termina na terceira visita, contando o siga-me', () => {
    const e = executar(base, { entrada: 'ramal:2001', inicio: '2026-11-24T10:00', modo: 'ninguem_atende' });
    expect(e.motivo).toBe('ciclo');
    expect(chegadas(e)).toEqual(['ramal:2001', 'ramal:2002', 'ramal:2001', 'ramal:2002', 'ramal:2001']);
    expect(e.segundos).toBe(20 + 27 + 20 + 27);
  });

  it('modo livre pergunta até o relógio e sugere a resposta', () => {
    const e = executar(base, { ...terca10h, modo: 'livre' });
    expect(e.pendente?.ref).toBe('peca:feriado');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'decisao', quem: 'relogio', sugestao: 'nao' });
  });

  it('troca de canal ao chegar numa peça de outro canal', () => {
    const e = executar(base, { ...terca10h, respostas: { 'peca:menu': '3', 'peca:tipo': '1', 'peca:busca': 'ok' } });
    expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'trocou_canal', de: 'telefonia', para: 'email' }));
    expect(e.motivo).toBe('fim');
  });

  it('becos, destinos que saem da central e peça sem saída', () => {
    expect(executar(doc({ ramais: [ramal('1')] }), { entrada: 'ramal:1', inicio: '2026-11-24T10:00', modo: 'ninguem_atende' }).motivo).toBe('beco');
    expect(executar(doc({ pecas: [peca('a', 'audio')] }), { entrada: 'peca:a', inicio: '2026-11-24T10:00' }).motivo).toBe('beco');
    expect(executar(doc({}), { entrada: 'externo:celular', inicio: '2026-11-24T10:00' }).motivo).toBe('saiu_da_central');
  });
});
