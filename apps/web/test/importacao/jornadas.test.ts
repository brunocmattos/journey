import { describe, expect, it } from 'vitest';
import { doc, entrada, fila, peca, ramal, saida } from '@journey/nucleo/teste';
import { jornadasDoImport, refsUsadas } from '@/importacao/jornadas';

describe('jornadasDoImport', () => {
  it('uma jornada por canal, cada uma com as suas entradas', () => {
    const d = doc({ entradas: [entrada('t', 'fim:desliga'), entrada('w', 'fim:desliga', { canal: 'whatsapp' })] });
    const js = jornadasDoImport(d);
    expect(js.map((j) => [j.nome, j.canal, j.documento.entradas.map((e) => e.id)])).toEqual([
      ['Telefonia', 'telefonia', ['t']],
      ['WhatsApp', 'whatsapp', ['w']],
    ]);
  });

  it('o que só outro canal alcança não é "não recebe ligação"; o órfão de verdade aparece nas duas', () => {
    const d = doc({
      entradas: [entrada('t', 'peca:mt'), entrada('w', 'peca:mw', { canal: 'whatsapp' })],
      pecas: [peca('mt', 'audio'), peca('mw', 'audio'), peca('orfa', 'audio')],
      saidas: [saida('mt', 'fim', 'fim:desliga'), saida('mw', 'fim', 'fim:desliga'), saida('orfa', 'fim', 'fim:desliga')],
    });
    const semEntrada = (nome: string) =>
      jornadasDoImport(d)
        .find((j) => j.nome === nome)!
        .diagnostico.filter((a) => a.tipo === 'sem_entrada')
        .map((a) => a.refs[0]);
    expect(semEntrada('Telefonia')).toEqual(['peca:orfa']);
    expect(semEntrada('WhatsApp')).toEqual(['peca:orfa']);
  });

  it('sem entradas, uma jornada de telefonia com o documento inteiro', () => {
    const d = doc({ filas: [fila('f')] });
    const [j] = jornadasDoImport(d);
    expect(j!.nome).toBe('Telefonia');
    expect(j!.documento).toBe(d);
    expect(j!.diagnostico.map((a) => a.tipo)).toContain('sem_entrada');
  });
});

describe('refsUsadas', () => {
  it('o que as entradas alcançam, mais membros, siga-me e horários, só do catálogo', () => {
    const d = doc({
      entradas: [entrada('e', 'peca:h')],
      pecas: [peca('h', 'regra_horario', { horario: 'horario:tg' })],
      saidas: [saida('h', 'sim', 'fila:f'), saida('h', 'nao', 'ramal:r')],
      filas: [fila('f', { membros: ['ramal:m1'] }), fila('solta')],
      ramais: [ramal('r', { siga_me_lista: ['ramal:s', 'externo:celular'] })],
    });
    expect(refsUsadas(d)).toEqual(['entrada:e', 'fila:f', 'horario:tg', 'ramal:m1', 'ramal:r', 'ramal:s']);
  });
});
