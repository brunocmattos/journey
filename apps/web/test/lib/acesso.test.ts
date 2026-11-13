import { describe, expect, it } from 'vitest';
import { avisoDaVolta, caminhoInterno, mensagemDoErro, tipoDoEmail } from '@/lib/acesso';

describe('acesso: os erros do Supabase Auth', () => {
  it('limite de e-mail: em português, e o que foi mandado continua valendo', () => {
    expect(mensagemDoErro({ status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 58 seconds.' })).toEqual({
      texto: 'Já mandamos um e-mail há pouco. Espera um minuto e tenta de novo.',
      limite: true,
    });
  });

  it('limite de pedidos (tentativas de senha), ou 429 sem código: muitas tentativas, e não "já mandamos um e-mail"', () => {
    for (const e of [{ status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' }, { status: 429, message: 'Too many requests' }])
      expect(mensagemDoErro(e)).toEqual({ texto: 'Muitas tentativas seguidas. Espera um pouco e tenta de novo.', limite: true });
  });

  it('senha errada, e-mail não confirmado, senha fraca, senha igual, reautenticação', () => {
    expect(mensagemDoErro({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }).texto).toBe('E-mail ou senha não conferem.');
    expect(mensagemDoErro({ status: 400, code: 'email_not_confirmed', message: 'Email not confirmed' }).texto).toContain('Usa “Criar conta”');
    expect(mensagemDoErro({ status: 422, code: 'weak_password', message: 'Password should be at least 8 characters.' }).texto).toBe('Senha fraca: use pelo menos 8 caracteres.');
    expect(mensagemDoErro({ status: 422, code: 'same_password', message: 'New password should be different' }).texto).toBe('A senha nova é igual à de antes.');
    expect(mensagemDoErro({ status: 401, code: 'reauthentication_needed', message: 'Password update requires reauthentication' }).texto).toContain('entra de novo');
  });

  it('o resto: genérico, sem o texto em inglês', () => {
    expect(mensagemDoErro({ status: 500, message: 'Error sending magic link email' })).toEqual({ texto: 'Não deu certo agora. Tenta de novo em instantes.', limite: false });
  });
});

describe('acesso: a volta pro entrar', () => {
  it('link que não valeu, Google que não terminou, e nada', () => {
    expect(avisoDaVolta('link')).toBe('O link expirou ou já foi usado. Pede outro.');
    expect(avisoDaVolta('google')).toContain('O Google não completou a entrada');
    expect(avisoDaVolta(undefined)).toBeNull();
    expect(avisoDaVolta('<script>')).toBeNull();
  });

  it('os tipos do link do e-mail: só os dos modelos (email e recovery)', () => {
    expect(tipoDoEmail('email')).toBe('email');
    expect(tipoDoEmail('recovery')).toBe('recovery');
    for (const t of ['signup', 'magiclink', 'invite', 'email_change', 'sms', '', null]) expect(tipoDoEmail(t), String(t)).toBeNull();
  });
});

describe('acesso: o next da volta', () => {
  it('caminho deste app passa', () => {
    expect(caminhoInterno('/conta/senha')).toBe('/conta/senha');
    expect(caminhoInterno('/e/123?x=1')).toBe('/e/123?x=1');
  });

  it('outro site, ou nada, vira a raiz', () => {
    for (const n of ['//evil.com', '//evil.com/conta', '/\\evil.com', 'https://evil.com', 'evil.com', '', null, undefined, '/\tevil', '/\nevil']) expect(caminhoInterno(n), String(n)).toBe('/');
  });
});
