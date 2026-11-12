'use client';

import { useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';

/**
 * O pedido do link sai do navegador: o código do PKCE fica num cookie deste navegador,
 * e o /auth/callback troca o código pela sessão. Pedido pelo servidor, o cookie não chega aqui.
 */
export function FormularioEntrar({ google }: { google: boolean }) {
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'enviado' | { erro: string }>('livre');
  const destino = () => `${window.location.origin}/auth/callback`;

  async function enviar(form: FormData) {
    setEstado('enviando');
    const email = String(form.get('email') ?? '').trim();
    const { error } = await supabaseNavegador().auth.signInWithOtp({ email, options: { emailRedirectTo: destino() } });
    setEstado(error ? { erro: error.message } : 'enviado');
  }

  async function comGoogle() {
    await supabaseNavegador().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: destino() } });
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <form action={enviar} style={{ display: 'grid', gap: 10 }}>
        <label className="campo">
          E-mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button className="botao primario" type="submit" disabled={estado === 'enviando'}>
          Receber o link
        </button>
      </form>
      {estado === 'enviado' && (
        <p role="status" className="aviso-caixa ok">
          Link enviado. Confere o e-mail e abre o link neste navegador.
        </p>
      )}
      {typeof estado === 'object' && <p className="aviso-caixa erro">{estado.erro}</p>}
      {google && (
        <button className="botao" type="button" onClick={comGoogle}>
          Entrar com Google
        </button>
      )}
    </div>
  );
}
