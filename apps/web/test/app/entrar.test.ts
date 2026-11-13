import { describe, expect, it } from 'vitest';
import { mensagemDoErro } from '@/app/entrar/mensagens';

describe('entrar: o erro ao pedir o link', () => {
  it('limite do Supabase (429 ou o código): em português, e o "enviado" continua valendo', () => {
    const limite = { texto: 'Já mandamos um link há pouco. Espera um minuto e manda de novo.', limite: true };
    expect(mensagemDoErro({ status: 429, message: 'For security purposes, you can only request this after 58 seconds.' })).toEqual(limite);
    expect(mensagemDoErro({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' })).toEqual(limite);
  });

  it('e-mail inválido e o resto: em português, sem o texto em inglês', () => {
    expect(mensagemDoErro({ status: 400, code: 'email_address_invalid', message: 'Email address "x" is invalid' })).toEqual({ texto: 'Confere o e-mail: ele não parece certo.', limite: false });
    expect(mensagemDoErro({ status: 500, message: 'Error sending magic link email' })).toEqual({ texto: 'Não deu pra mandar o link agora. Tenta de novo em instantes.', limite: false });
  });
});
