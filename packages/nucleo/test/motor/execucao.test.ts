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

  it('responde uma decisão pendente; resposta que não existe é ignorada e a decisão continua pendente', () => {
    const e = executar(base, terca10h);
    expect(e.avancar('1')[0]).toMatchObject({ tipo: 'escolheu', opcao: '1', saida: 'menu-1', como: 'resposta' });
    expect(e.pendente?.ref).toBe('fila:100');
    expect(e.avancar('9')).toEqual([expect.objectContaining({ tipo: 'resposta_ignorada', ref: 'fila:100', resposta: '9', motivo: expect.stringContaining('não é uma opção') })]);
    expect(e.pendente?.ref).toBe('fila:100');
    e.avancar('atende');
    expect(e.motivo).toBe('atendido');
    const total = e.eventos.length;
    expect(e.avancar('1')).toEqual([]);
    expect(e.eventos).toHaveLength(total);
  });

  it('pendente é uma foto estável: o mesmo objeto até a decisão mudar', () => {
    const e = executar(base, terca10h);
    const menu = e.pendente;
    expect(e.pendente).toBe(menu);
    e.avancar('9');
    expect(e.pendente).toBe(menu);
    e.avancar('1');
    const fila = e.pendente;
    expect(fila).not.toBe(menu);
    expect(fila?.ref).toBe('fila:100');
    expect(e.pendente).toBe(fila);
    e.avancar('atende');
    expect(e.pendente).toBeNull();
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
    expect(executar(doc({ pecas: [peca('a', 'audio')] }), { entrada: 'peca:a', inicio: '2026-11-24T10:00' }).motivo).toBe('beco');
    expect(executar(doc({}), { entrada: 'externo:celular', inicio: '2026-11-24T10:00' }).motivo).toBe('saiu_da_central');
  });

  describe('peça incompleta para a água', () => {
    const inicio = '2026-11-24T10:00';
    const ultimos = (e: Execucao) => e.eventos.slice(-2);

    it('menu sem tempo e fila sem toque param com o que falta', () => {
      const menu = executar(doc({ pecas: [peca('m', 'menu', { nome: 'Principal' })], saidas: [saida('m', '1', 'fim:atendido')] }), { entrada: 'peca:m', inicio, respostas: { 'peca:m': '1' } });
      expect(menu.motivo).toBe('incompleta');
      expect(ultimos(menu)).toEqual([
        expect.objectContaining({ tipo: 'chegou', ref: 'peca:m' }),
        expect.objectContaining({ tipo: 'terminou', ref: 'peca:m', motivo: 'incompleta', detalhe: expect.stringContaining('espera_s') }),
      ]);
      const f = executar(doc({ filas: [fila('1', { toque_por_membro_s: undefined })] }), { entrada: 'fila:1', inicio });
      expect(f.motivo).toBe('incompleta');
      expect(f.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'fila:1', detalhe: expect.stringContaining('toque_por_membro_s') });
    });

    it('menu sem esgotou não para', () => {
      const e = executar(doc({ pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 })], saidas: [saida('m', '1', 'fim:atendido')] }), { entrada: 'peca:m', inicio });
      expect(e.terminou).toBe(false);
      expect(e.pendente?.ref).toBe('peca:m');
    });

    const regra = (p: ReturnType<typeof peca>, extra: Partial<Parameters<typeof doc>[0]> = {}) =>
      executar(doc({ pecas: [p], saidas: [saida(p.id, 'sim', 'fim:desliga'), saida(p.id, 'nao', 'fim:atendido')], ...extra }), { entrada: `peca:${p.id}`, inicio });

    it('regra de horário sem horário ou com horário que não existe para', () => {
      const sem = regra(peca('r', 'regra_horario', { nome: 'Expediente' }));
      expect(sem.motivo).toBe('incompleta');
      expect(sem.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:r', detalhe: 'a regra "Expediente" não diz qual horário usar (horario)' });
      const vazio = regra(peca('r', 'regra_horario', { horario: 'horario:x' }));
      expect(vazio.motivo).toBe('incompleta');
      expect(vazio.eventos.at(-1)).toMatchObject({ detalhe: 'o horário "x" não existe' });
    });

    it('regra de feriado sem calendário para; calendário sem feriados responde não', () => {
      const sem = regra(peca('r', 'regra_feriado'));
      expect(sem.motivo).toBe('incompleta');
      expect(sem.eventos.at(-1)).toMatchObject({ detalhe: 'a regra "r" não diz qual calendário usar (calendario)' });
      const padrao = regra(peca('r', 'regra_feriado', { calendario: 'padrao' }));
      expect(padrao.motivo).toBe('atendido');
      expect(padrao.eventos).toContainEqual(expect.objectContaining({ tipo: 'escolheu', ref: 'peca:r', opcao: 'nao', como: 'relogio' }));
    });
  });

  it('modo livre termina como ciclo quando a ligação gira sem decisão', () => {
    const giro = doc({ pecas: [peca('a', 'audio'), peca('b', 'audio')], saidas: [saida('a', 'sempre', 'peca:b'), saida('b', 'sempre', 'peca:a')] });
    const e = executar(giro, { entrada: 'peca:a', inicio: '2026-11-24T10:00', modo: 'livre' });
    expect(e.motivo).toBe('ciclo');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', motivo: 'ciclo' });
  });

  it('saída única respeita o "quando"', () => {
    const d = doc({
      pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 }), peca('a', 'audio')],
      saidas: [saida('m', '1', 'peca:a', { define: { chave: 'tipo', valor: 'y' } }), saida('a', 'sempre', 'fim:atendido', { quando: { chave: 'tipo', valor: 'x' } })],
    });
    const e = executar(d, { entrada: 'peca:m', inicio: '2026-11-24T10:00', respostas: { 'peca:m': '1' } });
    expect(e.motivo).toBe('beco');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:a' });
  });

  it('decisão sem nenhuma saída válida termina como beco, sem esperar resposta', () => {
    const d = doc({
      pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 }), peca('c', 'consulta')],
      saidas: [
        saida('m', '1', 'peca:c', { define: { chave: 'tipo', valor: 'y' } }),
        saida('c', 'ok', 'fim:atendido', { quando: { chave: 'tipo', valor: 'x' } }),
        saida('c', 'falha', 'fim:desliga', { quando: { chave: 'tipo', valor: 'z' } }),
      ],
    });
    const e = executar(d, { entrada: 'peca:m', inicio: '2026-11-24T10:00', respostas: { 'peca:m': '1' } });
    expect(e.pendente).toBeNull();
    expect(e.motivo).toBe('beco');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:c' });
  });

  describe('voltar ao menu por escolha não é ciclo', () => {
    const repete = doc({
      pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 }), peca('r', 'audio', { duracao_s: 4 })],
      saidas: [saida('m', '9', 'peca:r'), saida('m', '1', 'fim:atendido'), saida('r', 'sempre', 'peca:m')],
    });
    const inicio = { entrada: 'peca:m', inicio: '2026-11-24T10:00' };

    it('pelo cenário', () => {
      const e = executar(repete, { ...inicio, respostas: { 'peca:m': ['9', '9', '1'] } });
      expect(e.motivo).toBe('atendido');
      expect(chegadas(e).filter((r) => r === 'peca:m')).toHaveLength(3);
    });

    it('por quem liga', () => {
      const e = executar(repete, inicio);
      for (let i = 0; i < 3; i++) {
        e.avancar('9');
        expect(e.pendente?.ref).toBe('peca:m');
      }
      e.avancar('1');
      expect(e.motivo).toBe('atendido');
    });
  });

  describe('id da saída', () => {
    const inicio = '2026-11-24T10:00';
    const naBusca = { ...terca10h, respostas: { 'peca:menu': '3', 'peca:tipo': '1' } };

    it('opções de peça e o evento "correu" trazem o id da saída; entrada, fila, grupo e ramal não', () => {
      const e = executar(base, { ...terca10h, modo: 'ninguem_atende', respostas: { 'peca:menu': '1' } });
      const correu = e.eventos.filter((x) => x.tipo === 'correu');
      expect(correu[0]).not.toHaveProperty('saida');
      expect(correu).toContainEqual(expect.objectContaining({ de: 'peca:menu', para: 'fila:100', opcao: '1', saida: 'menu-1' }));
      expect(correu.find((x) => x.de === 'fila:100')).not.toHaveProperty('saida');
      const menu = e.eventos.find((x) => x.tipo === 'decisao' && x.ref === 'peca:menu');
      expect(menu).toMatchObject({ opcoes: expect.arrayContaining([expect.objectContaining({ opcao: 'esgotou', saida: 'menu-esgotou' })]) });
    });

    it('avancar aceita saida:<id>; a opção ambígua e o id sem prefixo são ignorados', () => {
      const d = doc({
        pecas: [peca('c', 'consulta')],
        saidas: [
          saida('c', 'falha', 'fim:atendido', { quando: { chave: 'tipo', valor: 'x' } }),
          saida('c', 'falha', 'fim:desliga', { quando: { chave: 'tipo', valor: 'y' } }),
        ],
      });
      const e = executar(d, { entrada: 'peca:c', inicio });
      expect(e.pendente?.opcoes.map((o) => o.saida)).toEqual(['c-falha-x', 'c-falha-y']);
      expect(e.avancar('falha')).toEqual([
        expect.objectContaining({ tipo: 'resposta_ignorada', ref: 'peca:c', resposta: 'falha', motivo: expect.stringContaining('saida:c-falha-x, saida:c-falha-y') }),
      ]);
      expect(e.pendente?.ref).toBe('peca:c');
      expect(e.avancar('c-falha-y')).toEqual([expect.objectContaining({ tipo: 'resposta_ignorada', resposta: 'c-falha-y', motivo: expect.stringContaining('use saida:c-falha-y') })]);
      expect(e.pendente?.ref).toBe('peca:c');
      e.avancar('saida:c-falha-y');
      expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'escolheu', ref: 'peca:c', opcao: 'falha', saida: 'c-falha-y', como: 'resposta' }));
      expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'correu', de: 'peca:c', para: 'fim:desliga', saida: 'c-falha-y' }));
      expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'fim:desliga' });
    });

    it('a opção sem ambiguidade continua valendo', () => {
      const e = executar(base, naBusca);
      expect(e.pendente?.ref).toBe('peca:busca');
      e.avancar('falha');
      expect(chegadas(e).at(-1)).toBe('fila:100');
    });

    it('o cenário aceita saida:<id>', () => {
      const d = doc({
        pecas: [peca('c', 'consulta')],
        saidas: [
          saida('c', 'falha', 'fim:atendido', { quando: { chave: 'tipo', valor: 'x' } }),
          saida('c', 'falha', 'fim:desliga', { quando: { chave: 'tipo', valor: 'y' } }),
        ],
      });
      const e = executar(d, { entrada: 'peca:c', inicio, respostas: { 'peca:c': 'saida:c-falha-y' } });
      expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'escolheu', ref: 'peca:c', opcao: 'falha', saida: 'c-falha-y', como: 'cenario' }));
      expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'fim:desliga' });
    });

    describe('texto solto é sempre a opção; a saída se escolhe por saida:<id>', () => {
      // A saída de id "4" é a opção 1; a de id "5" é a opção 4.
      const d = doc({
        pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 })],
        saidas: [
          { ...saida('m', '1', 'fim:atendido'), id: '4' },
          { ...saida('m', '4', 'fim:desliga'), id: '5' },
        ],
      });
      const ultimo = (e: Execucao) => e.eventos.at(-1);

      it('avancar', () => {
        const pelaOpcao = executar(d, { entrada: 'peca:m', inicio });
        pelaOpcao.avancar('4');
        expect(pelaOpcao.eventos).toContainEqual(expect.objectContaining({ tipo: 'escolheu', ref: 'peca:m', opcao: '4', saida: '5' }));
        expect(ultimo(pelaOpcao)).toMatchObject({ tipo: 'terminou', ref: 'fim:desliga' });
        const pelaSaida = executar(d, { entrada: 'peca:m', inicio });
        pelaSaida.avancar('saida:4');
        expect(pelaSaida.eventos).toContainEqual(expect.objectContaining({ tipo: 'escolheu', ref: 'peca:m', opcao: '1', saida: '4' }));
        expect(ultimo(pelaSaida)).toMatchObject({ tipo: 'terminou', ref: 'fim:atendido' });
      });

      it('respostas do cenário, sozinhas ou em lista', () => {
        expect(ultimo(executar(d, { entrada: 'peca:m', inicio, respostas: { 'peca:m': '4' } }))).toMatchObject({ ref: 'fim:desliga' });
        expect(ultimo(executar(d, { entrada: 'peca:m', inicio, respostas: { 'peca:m': ['saida:4'] } }))).toMatchObject({ ref: 'fim:atendido' });
        const volta = doc({
          pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 }), peca('r', 'audio')],
          saidas: [saida('m', '9', 'peca:r'), saida('m', '1', 'fim:atendido'), saida('r', 'sempre', 'peca:m')],
        });
        const e = executar(volta, { entrada: 'peca:m', inicio, respostas: { 'peca:m': ['saida:m-9', '9', 'saida:m-1'] } });
        expect(e.eventos.filter((x) => x.tipo === 'escolheu').map((x) => x.tipo === 'escolheu' && x.saida)).toEqual(['m-9', 'm-9', 'm-1']);
        expect(e.motivo).toBe('atendido');
      });

      it('saida:<id> que não é desta decisão é ignorada', () => {
        const e = executar(d, { entrada: 'peca:m', inicio, respostas: { 'peca:m': 'saida:nada' } });
        expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'resposta_ignorada', resposta: 'saida:nada', motivo: expect.stringContaining('não é uma saída disponível') }));
        expect(e.pendente?.ref).toBe('peca:m');
      });
    });

    it('uma execução gravada pelos eventos "escolheu" se repete igual', () => {
      const d = doc({
        pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 }), peca('c', 'consulta')],
        saidas: [
          saida('m', '1', 'peca:c'),
          saida('m', 'esgotou', 'fim:desliga'),
          saida('c', 'falha', 'fim:atendido', { quando: { chave: 'tipo', valor: 'x' } }),
          saida('c', 'falha', 'fila:1', { quando: { chave: 'tipo', valor: 'y' } }),
        ],
        filas: [fila('1', { espera_maxima_s: 60, ao_esgotar: 'peca:m' })],
      });
      const original = executar(d, { entrada: 'peca:m', inicio });
      for (const r of ['1', 'saida:c-falha-y', 'nao_atende', '1', 'saida:c-falha-y', 'atende']) original.avancar(r);
      expect(original.motivo).toBe('atendido');

      const respostas: Record<string, string[]> = {};
      for (const x of original.eventos) {
        if (x.tipo === 'escolheu') (respostas[x.ref] ??= []).push(x.saida === undefined ? x.opcao : `saida:${x.saida}`);
      }
      const replay = executar(d, { entrada: 'peca:m', inicio, respostas });
      expect(replay.eventos).toEqual(original.eventos.map((x) => (x.tipo === 'escolheu' ? { ...x, como: 'cenario' } : x)));
    });

    it('pendente e decisão entregam cópias: mexer nelas não muda o que avancar aceita', () => {
      const e = executar(base, terca10h);
      const decisao = e.eventos.at(-1);
      if (decisao?.tipo !== 'decisao') throw new Error('esperava decisão');
      decisao.opcoes.forEach((o) => (o.disponivel = false));
      e.pendente!.opcoes.forEach((o) => {
        o.disponivel = false;
        o.para = 'fim:desliga';
      });
      e.pendente!.opcoes.length = 0;
      e.avancar('1');
      expect(e.pendente?.ref).toBe('fila:100');
    });
  });

  describe('ninguém atende e não há transbordo: desliga', () => {
    const inicio = '2026-11-24T10:00';
    const casos = [
      ['ramal', doc({ ramais: [ramal('1', { toque_s: 20 })] }), 'ramal:1', 'Não atende em 20 s: desliga (sem transbordo)'],
      ['grupo', doc({ grupos: [grupo('1', { toque_s: 20 })] }), 'grupo:1', 'Ninguém atende em 20 s: desliga (sem transbordo)'],
      ['fila', doc({ filas: [fila('1', { espera_maxima_s: 60 })] }), 'fila:1', 'Ninguém atende em 60 s: desliga (sem transbordo)'],
    ] as const;
    for (const [nome, d, ref, rotulo] of casos) {
      it(nome, () => {
        const e = executar(d, { entrada: ref, inicio, modo: 'ninguem_atende' });
        expect(e.motivo).toBe('fim');
        expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'fim:desliga' });
        const decisao = e.eventos.find((x) => x.tipo === 'decisao');
        expect(decisao).toMatchObject({ opcoes: expect.arrayContaining([expect.objectContaining({ opcao: 'nao_atende', para: 'fim:desliga', rotulo })]) });
      });
    }
  });

  describe('resposta do cenário que não serve deixa rastro', () => {
    it('opção que não existe: avisa e segue como se não houvesse resposta', () => {
      const e = executar(base, { ...terca10h, respostas: { 'peca:menu': '9' } });
      expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'resposta_ignorada', ref: 'peca:menu', resposta: '9', motivo: expect.stringContaining('não é uma opção') }));
      expect(e.pendente?.ref).toBe('peca:menu');
      expect(e.eventos.filter((x) => x.tipo === 'decisao' && x.ref === 'peca:menu')).toHaveLength(1);
    });

    it('o relógio decide depois da resposta ignorada', () => {
      const e = executar(base, { ...terca10h, respostas: { 'peca:horario': 'talvez' } });
      const i = e.eventos.findIndex((x) => x.tipo === 'resposta_ignorada');
      expect(i).toBeGreaterThan(0);
      expect(e.eventos[i - 1]).toMatchObject({ tipo: 'decisao', ref: 'peca:horario' });
      expect(e.eventos[i + 1]).toMatchObject({ tipo: 'escolheu', ref: 'peca:horario', opcao: 'sim', como: 'relogio' });
    });

    it('opção ambígua no cenário também é ignorada', () => {
      const d = doc({
        pecas: [peca('c', 'consulta')],
        saidas: [
          saida('c', 'ok', 'fim:atendido'),
          saida('c', 'falha', 'fim:atendido', { quando: { chave: 'tipo', valor: 'x' } }),
          saida('c', 'falha', 'fim:desliga', { quando: { chave: 'tipo', valor: 'y' } }),
        ],
      });
      const e = executar(d, { entrada: 'peca:c', inicio: '2026-11-24T10:00', respostas: { 'peca:c': 'falha' } });
      expect(e.eventos).toContainEqual(
        expect.objectContaining({ tipo: 'resposta_ignorada', ref: 'peca:c', resposta: 'falha', motivo: expect.stringContaining('saida:c-falha-x, saida:c-falha-y') }),
      );
      expect(e.pendente?.ref).toBe('peca:c');
    });
  });

  it('variáveis com nome de propriedade de objeto são variáveis comuns', () => {
    const d = doc({
      pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 }), peca('a', 'audio')],
      saidas: [
        saida('m', '1', 'peca:a', { define: { chave: '__proto__', valor: 'p' } }),
        saida('m', 'esgotou', 'fim:desliga'),
        saida('a', 'sempre', 'fim:atendido', { quando: { chave: 'constructor', valor: 'x' } }),
      ],
    });
    const e = executar(d, { entrada: 'peca:m', inicio: '2026-11-24T10:00', respostas: { 'peca:m': '1' } });
    expect(e.motivo).toBe('atendido');
    expect(Object.entries(e.variaveis)).toEqual([['__proto__', 'p']]);
  });
});
