/** O erro do Supabase ao pedir o link, como chega no navegador: o status HTTP e o código, quando há. */
export interface ErroDoLink {
  status?: number;
  code?: string;
  message: string;
}

/** Quanto o botão espera depois de mandar (o Supabase recusa outro pedido pro mesmo e-mail por 60 s). */
export const ESPERA_REENVIO_S = 30;
/** Depois de uma recusa por limite, o tempo inteiro do Supabase. */
export const ESPERA_LIMITE_S = 60;

/**
 * O texto pra pessoa, em português, pelo código e pelo status (nunca pelo texto, que é em inglês e muda). `limite`:
 * o pedido foi recusado por ter vindo cedo demais; o aviso de "enviado" continua valendo.
 */
export function mensagemDoErro(e: ErroDoLink): { texto: string; limite: boolean } {
  if (e.status === 429 || e.code === 'over_email_send_rate_limit' || e.code === 'over_request_rate_limit')
    return { texto: 'Já mandamos um link há pouco. Espera um minuto e manda de novo.', limite: true };
  if (e.code === 'email_address_invalid' || e.code === 'validation_failed') return { texto: 'Confere o e-mail: ele não parece certo.', limite: false };
  return { texto: 'Não deu pra mandar o link agora. Tenta de novo em instantes.', limite: false };
}
