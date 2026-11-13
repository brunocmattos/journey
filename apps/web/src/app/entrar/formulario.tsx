'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ESPERA_LIMITE_S, ESPERA_REENVIO_S, mensagemDoErro, type ErroDoAuth } from '@/lib/acesso';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { BotaoGoogle } from './botao-google';

/**
 * - entrar: e-mail e senha (o caminho principal);
 * - criar: só o e-mail; o link de confirmação leva a escolher a senha (/conta/senha). A senha não vai no cadastro:
 *   quem cadastrou o e-mail antes da dona não pode ficar com uma senha que vale depois que ela confirma (o banco apaga
 *   a senha na confirmação, migração 20261116000000);
 * - esqueci: manda o link de recuperação, que também leva a /conta/senha;
 * - link: o link mágico por e-mail, como alternativa.
 * Sem o e-mail (NEXT_PUBLIC_LOGIN_EMAIL=nao, enquanto o envio não tem domínio próprio), só o botão do Google.
 */
type Modo = 'entrar' | 'criar' | 'esqueci' | 'link';
type Enviado = 'link' | 'confirmacao' | 'recuperacao';

const BOTAO: Record<Modo, string> = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Mandar o link pra trocar a senha', link: 'Receber o link' };
const ENVIA: Record<Exclude<Modo, 'entrar'>, Enviado> = { criar: 'confirmacao', esqueci: 'recuperacao', link: 'link' };
const ABAS = ['entrar', 'criar'] as const;

/**
 * Os e-mails voltam pelo /auth/confirm (os modelos em supabase/templates dizem pra onde): a página tem um botão, e o
 * POST dele (/auth/confirmar) confirma no servidor, então o link abre em qualquer navegador. O Google volta pelo /auth/callback, com o código do PKCE que fica neste navegador.
 */
export function FormularioEntrar({ google, email: comEmail, aviso }: { google: boolean; email: boolean; aviso: string | null }) {
  // Antes de o React assumir a página, os botões ficam desligados: um Enter ali mandaria o formulário pelo navegador.
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  const [modo, setModo] = useState<Modo>('entrar');
  // Controlados e sem `name`: nada vai pra URL, e o e-mail continua no campo entre os modos e depois de enviar.
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // O que foi mandado por e-mail (e pra quem): o aviso de "enviado" fica enquanto vale.
  const [enviado, setEnviado] = useState<{ tipo: Enviado; para: string } | null>(null);
  const [erro, setErro] = useState<string | null>(aviso);
  // Até quando (relógio daqui) o botão espera pra mandar outro e-mail pro mesmo endereço.
  const [esperaAte, setEsperaAte] = useState(0);
  const [agora, setAgora] = useState(0);
  const campoEmail = useRef<HTMLInputElement>(null);
  const idSenha = useId();
  const idExplica = useId();
  const idPainel = useId();

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
  const mandaEmail = modo !== 'entrar';
  const comAbas = modo === 'entrar' || modo === 'criar';
  const mesmoEmail = enviado !== null && para.toLowerCase() === enviado.para.toLowerCase();
  const faltam = mesmoEmail && esperaAte > agora ? Math.ceil((esperaAte - agora) / 1000) : 0;
  // aria-disabled, e não disabled: o botão continua com o foco enquanto envia ou espera.
  const ocupado = enviando || (mandaEmail && faltam > 0);

  const trocarModo = (m: Modo) => {
    setModo(m);
    setErro(null);
    setVerSenha(false);
  };

  const falhou = (e: ErroDoAuth, onde: string) => {
    console.error(`[entrar: ${onde}]`, e.status, e.code, e.message);
    const m = mensagemDoErro(e);
    setErro(m.texto);
    // Cedo demais: o e-mail de antes ainda vale, e o aviso de "enviado" fica.
    if (m.limite) setEsperaAte(Date.now() + ESPERA_LIMITE_S * 1000);
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado || !para) return;
    if (modo === 'entrar' && !senha) return;
    const auth = supabaseNavegador().auth;
    setEnviando(true);
    setErro(null);
    try {
      if (modo === 'entrar') {
        const { error } = await auth.signInWithPassword({ email: para, password: senha });
        if (error) return falhou(error, 'senha');
        // Página nova (e não só a rota): o servidor lê a sessão do cookie, e a raiz aceita os convites.
        return window.location.assign('/');
      }
      // Criar conta e o link mágico são o mesmo pedido: conta nova recebe a confirmação (que leva a escolher a senha),
      // e quem já tem conta recebe o link de entrar. A tela diz o mesmo nos dois casos: não conta quem tem conta.
      const { error } =
        modo === 'esqueci' ? await auth.resetPasswordForEmail(para) : await auth.signInWithOtp({ email: para, options: { shouldCreateUser: true } });
      if (error) return falhou(error, modo);
      setEnviado({ tipo: ENVIA[modo], para });
      setEsperaAte(Date.now() + ESPERA_REENVIO_S * 1000);
    } finally {
      setEnviando(false);
    }
  }

  // Dando certo, o navegador sai pro Google; só volta aqui com erro (provedor desligado, rede).
  async function comGoogle() {
    setErro(null);
    const { error } = await supabaseNavegador().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) {
      console.error('[entrar com Google]', error.message);
      setErro(`Não deu pra entrar com o Google agora. Tenta de novo${comEmail ? ', ou entra com o e-mail' : ''}.`);
    }
  }

  const textoBotao = enviando
    ? 'Enviando…'
    : mandaEmail && mesmoEmail && enviado?.tipo === ENVIA[modo]
      ? faltam
        ? `Mandar de novo em ${faltam} s`
        : 'Mandar de novo'
      : BOTAO[modo];

  const avisoEnviado =
    enviado &&
    (enviado.tipo === 'link'
      ? 'Link enviado para'
      : enviado.tipo === 'confirmacao'
        ? 'Confirma o e-mail: mandamos um link para'
        : 'Se houver uma conta com esse e-mail, mandamos um link pra trocar a senha para');

  const explica: Record<Exclude<Modo, 'entrar'>, string> = {
    criar: 'Chega um link no teu e-mail pra confirmar a conta; por ele tu escolhe a senha.',
    esqueci: 'Chega um link no teu e-mail pra escolher uma senha nova.',
    link: 'Sem senha: chega um link no teu e-mail, e é só abrir.',
  };

  const alerta = <div role="alert">{erro && <div className="aviso-caixa erro">{erro}</div>}</div>;

  if (!comEmail)
    return (
      <div className="form-entrar">
        <BotaoGoogle disabled={!pronto} onClick={comGoogle} />
        <p className="so-google">Primeira vez? A conta é criada na hora, com o e-mail do teu Google.</p>
        {alerta}
      </div>
    );

  return (
    <div className="form-entrar">
      {comAbas ? (
        // Abas (e não botões): "Entrar" e "Criar conta" também são os botões de envio, e o leitor de tela diferencia.
        <div
          className="modos"
          role="tablist"
          aria-label="Entrar ou criar conta"
          onKeyDown={(e) => {
            // Setas trocam de aba; Home e End vão pra primeira e a última, como em qualquer lista de abas.
            const proximo =
              e.key === 'Home' ? 'entrar' : e.key === 'End' ? 'criar' : e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? (modo === 'criar' ? 'entrar' : 'criar') : null;
            if (!proximo) return;
            e.preventDefault();
            trocarModo(proximo);
            e.currentTarget.querySelector<HTMLElement>(`[data-modo="${proximo}"]`)?.focus();
          }}
        >
          {ABAS.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              data-modo={m}
              aria-selected={modo === m}
              aria-controls={idPainel}
              tabIndex={modo === m ? 0 : -1}
              onClick={() => trocarModo(m)}
            >
              {BOTAO[m]}
            </button>
          ))}
        </div>
      ) : (
        // Fora das abas, um título: o formulário não é painel de aba nenhuma.
        <h2 className="titulo-modo">{modo === 'esqueci' ? 'Esqueci a senha' : 'Entrar com um link'}</h2>
      )}
      <form
        onSubmit={enviar}
        className="form-entrar-email"
        id={idPainel}
        role={comAbas ? 'tabpanel' : undefined}
        aria-label={comAbas ? BOTAO[modo] : undefined}
      >
        <label className="campo">
          E-mail
          <input ref={campoEmail} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {modo === 'entrar' && (
          <div className="campo">
            <label htmlFor={idSenha}>Senha</label>
            <div className="senha">
              <input
                id={idSenha}
                type={verSenha ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button type="button" className="ver-senha" aria-pressed={verSenha} aria-controls={idSenha} onClick={() => setVerSenha(!verSenha)}>
                {verSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
        )}
        {modo !== 'entrar' && (
          <p className="explica-modo" id={idExplica}>
            {explica[modo]}
          </p>
        )}
        <button
          className="botao primario"
          type="submit"
          disabled={!pronto}
          aria-disabled={ocupado || undefined}
          aria-describedby={modo !== 'entrar' ? idExplica : undefined}
        >
          {textoBotao}
        </button>
      </form>
      <div className="outros-modos">
        {modo === 'entrar' && (
          <>
            <button type="button" className="link-modo" onClick={() => trocarModo('esqueci')}>
              Esqueci a senha
            </button>
            <button type="button" className="link-modo" onClick={() => trocarModo('link')}>
              Receber um link por e-mail
            </button>
          </>
        )}
        {!comAbas && (
          <button type="button" className="link-modo" onClick={() => trocarModo('entrar')}>
            Entrar com a senha
          </button>
        )}
      </div>
      {/* Montadas vazias: o leitor de tela anuncia o que entra numa região que já existia. */}
      <div role="status">
        {enviado && (
          <p className="aviso-caixa ok enviado">
            {avisoEnviado} <b>{enviado.para}</b>.{enviado.tipo === 'confirmacao' ? ' Pelo link, tu escolhe a senha.' : ''}
          </p>
        )}
      </div>
      {enviado && (
        <div className="acoes-enviado">
          <button
            className="botao pequeno"
            type="button"
            onClick={() => {
              setEmail('');
              setEnviado(null);
              setErro(null);
              setEsperaAte(0);
              campoEmail.current?.focus();
            }}
          >
            Usar outro e-mail
          </button>
        </div>
      )}
      {alerta}
      {google && (
        <>
          <div className="ou" aria-hidden="true">
            ou
          </div>
          <BotaoGoogle disabled={!pronto} onClick={comGoogle} />
        </>
      )}
    </div>
  );
}
