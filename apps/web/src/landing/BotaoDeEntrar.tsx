'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BotaoGoogle } from '@/componentes/BotaoGoogle';
import type { DestinoDaLanding } from '@/lib/acesso';
import { entrarComGoogle, preCarregarGoogle } from '@/lib/google';

/**
 * Um botão de entrar da landing. Pra uma página, é um link. Pro Google, abre o login dele daqui (`entrarComGoogle`, com
 * o cliente do Supabase baixado só quando o ponteiro ou o foco chega no botão); se o pedido nem sai (provedor
 * desligado, rede), vai pra /entrar com o aviso do Google, como quem cancelou lá. Depois do primeiro clique, o botão
 * fica ocupado e o segundo não pede de novo.
 * - `google`: o botão do Google, no padrão da marca (a chamada da abertura e do fechamento);
 * - `pilula`: o botão escuro da barra ("Criar conta"); `texto`: só o texto ("Entrar").
 */
export function BotaoDeEntrar({ destino, rotulo, jeito }: { destino: DestinoDaLanding; rotulo: string; jeito: 'google' | 'pilula' | 'texto' }) {
  // Antes de o React assumir a página, o clique não faria nada: o botão fica desligado até lá.
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  const [ocupado, setOcupado] = useState(false);
  // Quem volta do Google pelo "voltar" do navegador acha a página como deixou (cache de página): o botão solta.
  useEffect(() => {
    const voltou = (e: PageTransitionEvent) => e.persisted && setOcupado(false);
    addEventListener('pageshow', voltou);
    return () => removeEventListener('pageshow', voltou);
  }, []);
  const classe = jeito === 'pilula' ? 'l-pilula' : 'l-texto';

  if (destino.tipo === 'pagina')
    // Sem o Google ligado, a chamada vira o botão escuro, grande.
    return (
      <Link className={jeito === 'google' ? 'l-pilula grande' : classe} href={destino.href}>
        {rotulo}
      </Link>
    );

  async function comGoogle() {
    if (ocupado) return;
    setOcupado(true);
    if (!(await entrarComGoogle())) window.location.assign('/entrar?erro=google');
  }

  if (jeito === 'google') return <BotaoGoogle disabled={!pronto} onClick={comGoogle} rotulo={rotulo} ocupado={ocupado} aoChegar={preCarregarGoogle} />;
  return (
    <button
      className={classe}
      type="button"
      disabled={!pronto}
      aria-disabled={ocupado || undefined}
      onClick={comGoogle}
      onPointerEnter={preCarregarGoogle}
      onFocus={preCarregarGoogle}
    >
      {rotulo}
    </button>
  );
}
