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
