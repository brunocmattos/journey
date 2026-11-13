'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { ESPERA_LIMITE_S, ESPERA_REENVIO_S, mensagemDoErro } from './mensagens';

/**
 * O pedido do link sai do navegador: o código do PKCE fica num cookie deste navegador,
 * e o /auth/callback troca o código pela sessão. Pedido pelo servidor, o cookie não chega aqui.
 */
export function FormularioEntrar({ google, linkVencido }: { google: boolean; linkVencido: boolean }) {
  // Antes de o React assumir a página, o botão fica desligado: um Enter ali mandaria o formulário pelo navegador
  // (pra URL). Com o botão de envio desligado, o navegador não manda nem pelo Enter.
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  // Controlado e sem `name`: o e-mail continua no campo depois de enviar, e nunca vai pra URL.
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(linkVencido ? 'O link expirou ou já foi usado. Pede outro.' : null);
  // Até quando (relógio daqui) o botão espera pra mandar de novo pro mesmo e-mail.
  const [esperaAte, setEsperaAte] = useState(0);
  const [agora, setAgora] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const destino = () => `${window.location.origin}/auth/callback`;

  // O relógio da espera anda de segundo em segundo, só enquanto há espera.
  useEffect(() => {
    if (!esperaAte) return;
    setAgora(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (n >= esperaAte) {
        setEsperaAte(0);
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [esperaAte]);

  const para = email.trim();
  const mesmoEmail = enviadoPara !== null && para.toLowerCase() === enviadoPara.toLowerCase();
  const faltam = mesmoEmail && esperaAte > agora ? Math.ceil((esperaAte - agora) / 1000) : 0;
  // aria-disabled, e não disabled: o botão continua com o foco (o leitor de tela não perde onde estava).
  const ocupado = enviando || faltam > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado || !para) return;
    setEnviando(true);
    setErro(null);
    const { error } = await supabaseNavegador().auth.signInWithOtp({ email: para, options: { emailRedirectTo: destino() } });
    setEnviando(false);
    if (error) {
      console.error('[entrar: link por e-mail]', error.status, error.code, error.message);
      const m = mensagemDoErro(error);
      setErro(m.texto);
      // Cedo demais: o link de antes ainda vale, e o aviso de "enviado" fica.
      if (m.limite) setEsperaAte(Date.now() + ESPERA_LIMITE_S * 1000);
      return;
    }
    setEnviadoPara(para);
    setEsperaAte(Date.now() + ESPERA_REENVIO_S * 1000);
  }

  // Dando certo, o navegador sai pro Google; só volta aqui com erro (provedor desligado, rede).
  async function comGoogle() {
    setErro(null);
    const { error } = await supabaseNavegador().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: destino() } });
    if (error) {
      console.error('[entrar com Google]', error.message);
      setErro('Não deu pra entrar com o Google agora. Tenta de novo ou recebe o link por e-mail.');
    }
  }

  return (
    <div className="form-entrar">
      <form onSubmit={enviar} className="form-entrar-email">
        <label className="campo">
          E-mail
          <input ref={campo} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="botao primario" type="submit" disabled={!pronto} aria-disabled={ocupado || undefined}>
          {enviando ? 'Enviando…' : !mesmoEmail ? 'Receber o link' : faltam ? `Mandar de novo em ${faltam} s` : 'Mandar de novo'}
        </button>
        <p className="dica-entrar">Sem senha: chega um link no teu e-mail, e é só abrir.</p>
      </form>
      {/* Montadas vazias: o leitor de tela anuncia o que entra numa região que já existia. */}
      <div role="status">
        {enviadoPara && (
          <p className="aviso-caixa ok enviado">
            Link enviado para <b>{enviadoPara}</b>. Abre o e-mail e o link neste navegador.
          </p>
        )}
      </div>
      {enviadoPara && (
        <button
          className="botao pequeno outro-email"
          type="button"
          onClick={() => {
            setEmail('');
            setEnviadoPara(null);
            setErro(null);
            setEsperaAte(0);
            campo.current?.focus();
          }}
        >
          Usar outro e-mail
        </button>
      )}
      <div role="alert">{erro && <p className="aviso-caixa erro">{erro}</p>}</div>
      {google && (
        <>
          <div className="ou" aria-hidden="true">
            ou
          </div>
          <button className="botao" type="button" disabled={!pronto} onClick={comGoogle}>
            Entrar com Google
          </button>
        </>
      )}
    </div>
  );
}
