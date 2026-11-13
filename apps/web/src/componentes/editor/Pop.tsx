'use client';

import { useEffect, useRef } from 'react';
import { Icone } from '@/componentes/Icone';

/**
 * Um painel que abre embaixo de um botão do topo (Cenários, Versões). Ao abrir, o foco vai pro primeiro controle;
 * Esc ou "Fechar" fecham e devolvem o foco pro botão que abriu (`voltarPara`). Clicar fora (menos no próprio botão,
 * que já alterna) também fecha, sem mexer no foco: quem clicou foi pra outro lugar.
 */
export function Pop({ titulo, voltarPara, aoFechar, children }: { titulo: string; voltarPara: React.RefObject<HTMLElement | null>; aoFechar: () => void; children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;
  useEffect(() => {
    caixa.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo) || voltarPara.current?.contains(alvo)) return;
      fecharRef.current();
    };
    // Esc com o foco fora do pop (no body, depois de um item sumir): o pop fecha do mesmo jeito.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || caixa.current?.contains(e.target as Node) || (e.target as Element | null)?.closest?.('dialog, input, textarea, select')) return;
      fecharRef.current();
      voltarPara.current?.focus();
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [voltarPara]);
  const fechar = () => {
    aoFechar();
    voltarPara.current?.focus();
  };
  return (
    <div
      ref={caixa}
      className="pop"
      role="dialog"
      aria-label={titulo}
      // Pra receber o foco quando o item em que ele estava some (apagar um cenário): o Esc continua fechando.
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        // Esc é do pop: não chega no atalho do editor (que soltaria a seleção).
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        fechar();
      }}
    >
      <div className="pop-cab">
        <h2>{titulo}</h2>
        <button className="bi" type="button" aria-label="Fechar" onClick={fechar}>
          <Icone nome="fechar" />
        </button>
      </div>
      {children}
    </div>
  );
}
