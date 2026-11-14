import { describe, expect, it } from 'vitest';
import { avisoDaVolta, caminhoInterno, destinoDaLanding, jeitosDeEntrar, mensagemDoErro, modoDoEntrar, tipoDoEmail } from '@/lib/acesso';

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

  it('só com o Google, o aviso do Google não manda entrar com o e-mail', () => {
    expect(avisoDaVolta('google')).toContain('ou entra com o e-mail');
    expect(avisoDaVolta('google', { email: false })).toBe('O Google não completou a entrada (cancelada ou recusada). Tenta de novo.');
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

describe('acesso: os jeitos de entrar', () => {
  it('e-mail ligado por padrão; Google só com "sim"', () => {
    expect(jeitosDeEntrar(undefined, undefined)).toEqual({ google: false, email: true });
    expect(jeitosDeEntrar('sim', undefined)).toEqual({ google: true, email: true });
    expect(jeitosDeEntrar('nao', 'sim')).toEqual({ google: false, email: true });
  });

  it('só o Google: e-mail "nao" com o Google ligado', () => {
    expect(jeitosDeEntrar('sim', 'nao')).toEqual({ google: true, email: false });
  });

  it('nunca fica sem jeito nenhum: sem o Google, o e-mail volta', () => {
    expect(jeitosDeEntrar(undefined, 'nao')).toEqual({ google: false, email: true });
    expect(jeitosDeEntrar('nao', 'nao')).toEqual({ google: false, email: true });
  });
});

describe('acesso: os botões da landing', () => {
  const soGoogle = { google: true, email: false };
  const osDois = { google: true, email: true };
  const soEmail = { google: false, email: true };

  it('só o Google: entrar e criar conta abrem o Google direto (a conta nasce no primeiro acesso)', () => {
    for (const b of ['entrar', 'criar', 'chamada'] as const) expect(destinoDaLanding(b, soGoogle)).toEqual({ tipo: 'google' });
  });

  it('com o e-mail: entrar vai pra /entrar e criar conta pra aba de criar', () => {
    for (const j of [osDois, soEmail]) {
      expect(destinoDaLanding('entrar', j)).toEqual({ tipo: 'pagina', href: '/entrar' });
      expect(destinoDaLanding('criar', j)).toEqual({ tipo: 'pagina', href: '/entrar?modo=criar' });
    }
  });

  it('a chamada ("Continuar com o Google") é o Google sempre que ele está ligado; sem ele, a aba de criar', () => {
    expect(destinoDaLanding('chamada', osDois)).toEqual({ tipo: 'google' });
    expect(destinoDaLanding('chamada', soEmail)).toEqual({ tipo: 'pagina', href: '/entrar?modo=criar' });
  });
});

describe('acesso: o modo do entrar pela URL', () => {
  it('só "criar" muda a aba; o resto é entrar', () => {
    expect(modoDoEntrar('criar')).toBe('criar');
    for (const m of [undefined, '', 'entrar', 'esqueci', 'CRIAR', ['criar']]) expect(modoDoEntrar(m as string | undefined)).toBe('entrar');
  });
});
