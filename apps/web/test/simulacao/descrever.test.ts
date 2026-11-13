import { describe, expect, it } from 'vitest';
import { indexar, lerInicio } from '@journey/nucleo';
import { doc, entrada, fila, peca, ramal, saida } from '@journey/nucleo/teste';
import { comparar } from '@/simulacao/comparar';
import { descrever, duracao, horaEm, pergunta, resumir } from '@/simulacao/descrever';
import { canalInicial, escolher, rodar, type Sessao } from '@/simulacao/sessao';

const d = doc({
  entradas: [entrada('e', 'peca:m')],
  pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 2 }), peca('w', 'audio', { canal: 'whatsapp' })],
  saidas: [saida('m', '1', 'fila:f', { rotulo: 'Boleto' }), saida('m', '2', 'peca:w'), saida('w', 'sempre', 'fim:atendido')],
  filas: [fila('f', { nome: 'Aluguéis' })],
});
const idx = indexar(d);
const s0: Sessao = { entrada: 'entrada:e', inicio: '2026-11-24T16:57', modo: 'cenario', escolhas: [] };

describe('descrever', () => {
  it('hora de parede com segundos e duração em minutos', () => {
    expect(horaEm(lerInicio('2026-11-24T16:57'), 75)).toBe('ter 16:58:15');
    expect(duracao(185)).toBe('3:05');
    expect(duracao(3599)).toBe('59:59');
    expect(duracao(3700)).toBe('1:01:40');
  });

  it('pergunta de cada decisão, com o nome do ponto', () => {
    expect(pergunta(idx, 'quem_liga', 'peca:m')).toBe('O que a pessoa digita?');
    expect(pergunta(idx, 'fila', 'fila:f')).toBe('Alguém da fila f (Aluguéis) atende?');
  });

  it('linha do tempo: chegada, escolha, troca de canal e fim', () => {
    const e = rodar(d, escolher(s0, rodar(d, s0).pendente!.opcoes[1]!));
    const linhas = e.eventos.map((x) => descrever(idx, e.inicioMs, x)).filter((x) => x !== null);
    expect(linhas.map((l) => l.texto)).toEqual([
      'Chegou em e',
      'Chegou em m',
      'Opção 2 (escolha de quem simula)',
      'Chegou em w',
      'A jornada mudou de telefonia para whatsapp',
      'Chegou em atendido',
      'Atendido',
    ]);
    expect(resumir(e.eventos)).toEqual({ segundos: 3, decisoes: 1, canais: ['telefonia', 'whatsapp'] });
  });

  it('opção sem tecla aparece por extenso, não pelo código', () => {
    const dd = doc({
      entradas: [entrada('e', 'peca:m')],
      pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 1 })],
      saidas: [saida('m', '1', 'ramal:r'), saida('m', 'esgotou', 'fila:f')],
      filas: [fila('f', { espera_maxima_s: 30 })],
      ramais: [ramal('r')],
    });
    const ix = indexar(dd);
    const textos = (escolhas: string[], modo: Sessao['modo'] = 'livre') => {
      const e = rodar(dd, { ...s0, modo, escolhas });
      return e.eventos.filter((x) => x.tipo === 'escolheu').map((x) => descrever(ix, e.inicioMs, x)!.texto);
    };
    expect(textos(['1', 'atende'])).toEqual(['Opção 1 (escolha de quem simula)', 'Atende (escolha de quem simula)']);
    expect(textos(['esgotou', 'nao_atende'])).toEqual(['Nada (esgotou) (escolha de quem simula)', 'Ninguém atende (escolha de quem simula)']);
    expect(textos(['esgotou'], 'ninguem_atende')).toEqual(['Nada (esgotou) (escolha de quem simula)', 'Ninguém atende (modo ninguém atende)']);
  });

  it('entrada de WhatsApp: o resumo conta só o WhatsApp', () => {
    const dw = doc({ entradas: [entrada('w', 'peca:a', { canal: 'whatsapp' })], pecas: [peca('a', 'audio', { canal: 'whatsapp' })], saidas: [saida('a', 'sempre', 'fim:atendido')] });
    const e = rodar(dw, { ...s0, entrada: 'entrada:w' });
    expect(resumir(e.eventos, canalInicial(dw, 'entrada:w')).canais).toEqual(['whatsapp']);
  });

  it('comparar acha o primeiro evento diferente', () => {
    const a = rodar(d, escolher(s0, rodar(d, s0).pendente!.opcoes[0]!)).eventos;
    const b = rodar(d, escolher(s0, rodar(d, s0).pendente!.opcoes[1]!)).eventos;
    expect(comparar(a, a)).toBeNull();
    const dif = comparar(a, b)!;
    expect(dif.esperado).toMatchObject({ tipo: 'escolheu', opcao: '1' });
    expect(dif.atual).toMatchObject({ tipo: 'escolheu', opcao: '2' });
  });

  it('comparar ignora a ordem das chaves (o jsonb do banco reordena)', () => {
    const a = rodar(d, escolher(s0, rodar(d, s0).pendente!.opcoes[0]!)).eventos;
    const doBanco = JSON.parse(JSON.stringify(a), (_k, v) =>
      v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v,
    );
    expect(comparar(a, doBanco)).toBeNull();
  });
});
