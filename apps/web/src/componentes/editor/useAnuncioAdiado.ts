'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * O texto pra uma região viva, só depois que ele parou de mudar por `ms` (digitar um nome muda o diagnóstico a cada
 * tecla: o leitor de tela ouve só o resultado). O texto do primeiro desenho não é anunciado: a região começa vazia.
 */
export function useAnuncioAdiado(texto: string, ms = 1500): string {
  const [anuncio, setAnuncio] = useState('');
  // Comparar com o último anunciado (e não "pular o primeiro efeito"): no modo estrito o efeito roda duas vezes ao montar.
  const ultimo = useRef(texto);
  useEffect(() => {
    if (texto === ultimo.current) return;
    const t = setTimeout(() => {
      ultimo.current = texto;
      setAnuncio(texto);
    }, ms);
    return () => clearTimeout(t);
  }, [texto, ms]);
  return anuncio;
}
