import { afterEach, describe, expect, it, vi } from 'vitest';
import { mensagemDoErro } from '@/lib/erros';

describe('mensagemDoErro', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => log.mockClear());

  it('devolve a mensagem do código e guarda o erro cru no log', () => {
    const erro = { code: '23505', message: 'duplicate key value violates unique constraint "x"' };
    expect(mensagemDoErro('convidar', erro, { '23505': 'Já existe.' })).toBe('Já existe.');
    expect(log).toHaveBeenCalledWith('[convidar]', '23505', erro.message);
  });

  it('sem acesso tem mensagem própria; o resto, uma genérica sem o texto do banco', () => {
    expect(mensagemDoErro('x', { code: '42501', message: 'permission denied for table imports' })).toBe('Sem acesso a esta empresa.');
    const generica = mensagemDoErro('x', { code: 'XX000', message: 'internal error: segredo' });
    expect(generica).not.toContain('segredo');
    expect(generica).toBe('Não deu certo agora. Tenta de novo em instantes.');
  });
});
