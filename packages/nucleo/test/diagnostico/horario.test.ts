import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { alcancaveis } from '../../src/diagnostico/alcance';
import { agendaSemanal, buracosDeHorario, destinoNoHorario } from '../../src/diagnostico/horario';
import { lerInicio } from '../../src/motor/relogio';
import { doc, entrada, janela, peca, saida } from '../apoio';

describe('agenda e buracos de horário', () => {
  const idx = indexar(
    doc({
      entradas: [entrada('e', 'peca:feriado')],
      horarios: [janela('dia', ['seg', 'ter', 'qua', 'qui', 'sex'], '08:30', '16:55'), janela('est', ['seg', 'ter', 'qua', 'qui', 'sex'], '17:00', '18:00'), janela('est', ['sab'], '09:00', '12:00')],
      feriados: [{ id: 'f', calendario: 'nacional', data: '2024-01-01', todo_ano: true }],
      pecas: [
        peca('feriado', 'regra_feriado', { calendario: 'nacional' }),
        peca('dia', 'regra_horario', { horario: 'horario:dia' }),
        peca('est', 'regra_horario', { horario: 'horario:est' }),
        peca('ura-dia', 'audio', { nome: 'URA dia' }),
        peca('ura-est', 'audio', { nome: 'URA estendido' }),
        peca('ura-fora', 'audio', { nome: 'URA fora' }),
      ],
      saidas: [
        saida('feriado', 'sim', 'peca:ura-fora'),
        saida('feriado', 'nao', 'peca:dia'),
        saida('dia', 'sim', 'peca:ura-dia'),
        saida('dia', 'nao', 'peca:est'),
        saida('est', 'sim', 'peca:ura-est'),
        saida('est', 'nao', 'peca:ura-fora'),
      ],
    }),
  );

  it('agenda semanal, ignorando feriados', () => {
    const a = agendaSemanal(idx, 'peca:feriado');
    expect(a[0]).toEqual([
      { inicio: 0, fim: 510, destino: 'peca:ura-fora' },
      { inicio: 510, fim: 1015, destino: 'peca:ura-dia' },
      { inicio: 1015, fim: 1020, destino: 'peca:ura-fora' },
      { inicio: 1020, fim: 1080, destino: 'peca:ura-est' },
      { inicio: 1080, fim: 1440, destino: 'peca:ura-fora' },
    ]);
    expect(a[6]).toEqual([{ inicio: 0, fim: 1440, destino: 'peca:ura-fora' }]);
  });

  it('acha o buraco de 5 minutos nos dias úteis', () => {
    const b = buracosDeHorario(idx, alcancaveis(idx));
    expect(b).toHaveLength(1);
    expect(b[0]!.titulo).toBe('seg, ter, qua, qui, sex 16:55–17:00');
    expect(b[0]!.texto).toBe('Nesses 5 minutos a ligação que passa por peca:feriado cai em URA fora, entre URA dia e URA estendido.');
  });

  it('destinoNoHorario respeita o feriado quando pedido', () => {
    const quintaFeriado = lerInicio('2026-01-01T10:00');
    expect(destinoNoHorario(idx, 'peca:feriado', quintaFeriado, false)).toBe('peca:ura-fora');
    expect(destinoNoHorario(idx, 'peca:feriado', quintaFeriado, true)).toBe('peca:ura-dia');
  });
});
