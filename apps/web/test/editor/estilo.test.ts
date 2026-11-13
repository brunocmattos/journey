import { describe, expect, it } from 'vitest';
import { ESTILO_PADRAO, corDoCanal, lerEstilo } from '@/editor/estilo';

describe('editor/estilo', () => {
  it('o que falta ou vem errado fica no padrão; números ficam nos limites', () => {
    expect(lerEstilo(null)).toEqual(ESTILO_PADRAO);
    expect(lerEstilo({ cano: 'arco-íris', espessura: 99, velocidade: -3, bolhas: 'sim', autoEscolha: 3.4, canais: { whatsapp: '#000000', email: 'azul' } })).toEqual({
      ...ESTILO_PADRAO,
      espessura: 20,
      velocidade: 0.25,
      autoEscolha: 3,
      canais: { whatsapp: '#000000' },
    });
  });

  it('canais que não são um objeto de cores ficam vazios; o padrão não muda', () => {
    expect(lerEstilo({ canais: ['#000000'] }).canais).toEqual({});
    expect(lerEstilo(JSON.parse('{"canais":{"__proto__":"#000000","email":"#111111"}}')).canais).toEqual({ email: '#111111' });
    expect(lerEstilo('lixo')).toEqual(ESTILO_PADRAO);
    expect(Object.isFrozen(ESTILO_PADRAO) && Object.isFrozen(ESTILO_PADRAO.canais)).toBe(true);
  });

  it('cor da água: a do fluxo, senão a da empresa, senão azul', () => {
    const canais = [{ chave: 'whatsapp', nome: 'WhatsApp', cor: '#159e5a' }];
    expect(corDoCanal(lerEstilo({ canais: { whatsapp: '#111111' } }), canais, 'whatsapp')).toBe('#111111');
    expect(corDoCanal(ESTILO_PADRAO, canais, 'whatsapp')).toBe('#159e5a');
    expect(corDoCanal(ESTILO_PADRAO, canais, 'fax')).toBe('#1e8bdc');
    expect(corDoCanal(ESTILO_PADRAO, canais, null)).toBe('#1e8bdc');
    expect(corDoCanal(ESTILO_PADRAO, [{ chave: 'constructor', nome: 'C', cor: '#222222' }], 'constructor')).toBe('#222222');
  });
});
