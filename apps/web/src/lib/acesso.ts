/**
 * Entrar e a conta: os textos dos erros do Supabase Auth em português, a senha mínima, os avisos de quem volta de um
 * link ou do Google e o `next` das voltas (/auth/confirm e /auth/callback). Sem nada de servidor: as páginas de entrar e da
 * senha usam no navegador, e as rotas de volta no servidor.
 */

/** O erro do Supabase Auth, como chega no navegador: o status HTTP e o código, quando há. */
export interface ErroDoAuth {
  status?: number;
  code?: string;
  message: string;
}

/**
 * A senha mínima do app. O Supabase confere a dele (`minimum_password_length`: 8 no config.toml local; no hospedado o
 * padrão é 6, e o README manda subir pra 8); o app pede 8 antes de mandar.
 */
export const SENHA_MINIMA = 8;

/** Quanto o botão espera depois de mandar um e-mail (o Supabase recusa outro pro mesmo e-mail por 60 s). */
export const ESPERA_REENVIO_S = 30;
/** Depois de uma recusa por limite, o tempo inteiro do Supabase. */
export const ESPERA_LIMITE_S = 60;

export interface MensagemDoAuth {
  texto: string;
  /** Recusado por ter vindo cedo demais: o que foi mandado antes continua valendo, e o botão espera. */
  limite: boolean;
}

const msg = (texto: string, limite = false): MensagemDoAuth => ({ texto, limite });

/**
 * O texto pra pessoa, pelo código e pelo status (nunca pelo texto, que é em inglês e muda). O que o Supabase esconde
 * (se um e-mail tem conta, num cadastro com confirmação) continua escondido: a tela só repete o que ele devolve.
 */
export function mensagemDoErro(e: ErroDoAuth): MensagemDoAuth {
  // Dois limites diferentes: o de e-mails (por endereço e por hora) e o de pedidos (tentativas de senha, por IP).
  if (e.code === 'over_email_send_rate_limit') return msg('Já mandamos um e-mail há pouco. Espera um minuto e tenta de novo.', true);
  if (e.code === 'over_request_rate_limit' || e.status === 429) return msg('Muitas tentativas seguidas. Espera um pouco e tenta de novo.', true);
  switch (e.code) {
    case 'invalid_credentials':
      return msg('E-mail ou senha não conferem.');
    case 'email_not_confirmed':
      // Só acontece com conta de antes da confirmação sem senha: o "Criar conta" de agora manda o link de novo.
      return msg('Esse e-mail ainda não foi confirmado. Usa “Criar conta” pra receber o link de confirmação.');
    case 'weak_password':
      return msg(`Senha fraca: use pelo menos ${SENHA_MINIMA} caracteres.`);
    case 'same_password':
      return msg('A senha nova é igual à de antes.');
    case 'reauthentication_needed':
      // Só com "Secure password change" ligado no painel (aqui fica desligado: quem está logado troca sem a atual).
      return msg('Pra trocar a senha, entra de novo: sai, entra e troca logo em seguida.');
    case 'signup_disabled':
    case 'email_provider_disabled':
      return msg('Criar conta com e-mail está desligado neste servidor.');
    case 'email_address_invalid':
    case 'validation_failed':
      return msg('Confere o e-mail: ele não parece certo.');
    case 'session_not_found':
    case 'session_expired':
      return msg('A sessão venceu. Entra de novo, ou pede um link novo pra trocar a senha.');
    default:
      return msg('Não deu certo agora. Tenta de novo em instantes.');
  }
}

/** O aviso de quem volta pro entrar (`/entrar?erro=…`): o link do e-mail que não valeu, ou o Google que não terminou. */
export function avisoDaVolta(erro: string | undefined): string | null {
  if (erro === 'link') return 'O link expirou ou já foi usado. Pede outro.';
  if (erro === 'google') return 'O Google não completou a entrada (cancelada ou recusada). Tenta de novo, ou entra com o e-mail.';
  return null;
}

/** Os tipos do link do e-mail que o /auth/confirm aceita: só os dos modelos em supabase/templates. */
const TIPOS_DO_EMAIL = ['email', 'recovery'] as const;
export type TipoDoEmail = (typeof TIPOS_DO_EMAIL)[number];
export const tipoDoEmail = (t: string | null): TipoDoEmail | null => ((TIPOS_DO_EMAIL as readonly string[]).includes(t ?? '') ? (t as TipoDoEmail) : null);

/**
 * O `next` do /auth/confirm e do /auth/callback (pra onde ir depois de entrar): só caminho deste app. "//outro.site" e "/\\outro.site"
 * seriam outro site pro navegador, e "https://…" também; nesses casos (e sem `next`), a raiz.
 */
export function caminhoInterno(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f]/.test(next)) return '/';
  return next;
}
