'use client';

import { useState } from 'react';
import type { VersaoResumo } from '@/lib/dados';
import { FUSO } from '@/lib/fuso';
import { Confirmacao, focarDepois } from './Confirmacao';

const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * As versões marcadas do fluxo (a mais nova primeiro), "Marcar versão" e "Restaurar" (com confirmação). Só leitura:
 * só a lista.
 */
export function Versoes({
  versoes,
  soLeitura,
  acoes,
}: {
  versoes: readonly VersaoResumo[];
  soLeitura: boolean;
  acoes: { marcar(nome: string): Promise<boolean>; restaurar(v: VersaoResumo): Promise<void> };
}) {
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  return (
    <>
      {!soLeitura && (
        <form
          className="linha-pop"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const nome = (new FormData(form).get('nome') as string).trim();
            if (!nome) return;
            setEnviando(true);
            if (await acoes.marcar(nome)) form.reset();
            setEnviando(false);
          }}
        >
          <input className="entrada-texto" name="nome" aria-label="Nome da versão" placeholder="Ex.: antes do horário novo" maxLength={120} required />
          <button className="botao pequeno primario" type="submit" disabled={enviando}>
            Marcar versão
          </button>
        </form>
      )}
      {versoes.length === 0 ? (
        <p className="dica">Nenhuma versão marcada. O editor salva sozinho; marcar uma versão é guardar uma foto com nome, pra voltar nela ou mandar num link.</p>
      ) : (
        <ul className="lista-pop">
          {versoes.map((v) => (
            <li key={v.numero} className="item-pop" data-testid="versao">
              <div className="linha-pop">
                <b>
                  {v.numero}. {v.nome}
                </b>
              </div>
              <small className="mudo">
                {quando.format(new Date(v.criada_em))}
                {v.autor && ` · ${v.autor}`}
              </small>
              {!soLeitura && (
                <div className="acoes-achado">
                  {confirmar === v.numero ? (
                    <Confirmacao
                      nao="Não restaurar"
                      sim={`Restaurar a versão ${v.numero}`}
                      aoCancelar={() => {
                        setConfirmar(null);
                        focarDepois(() => document.querySelector<HTMLElement>(`[data-restaurar="${v.numero}"]`));
                      }}
                      aoConfirmar={async () => {
                        setConfirmar(null);
                        await acoes.restaurar(v);
                        // Restaurada, o pop fecha e o editor devolve o foco pro botão Versões; se não deu, volta pro Restaurar.
                        focarDepois(() => document.querySelector<HTMLElement>(`[data-restaurar="${v.numero}"]`));
                      }}
                    />
                  ) : (
                    <button className="botao pequeno" type="button" data-restaurar={v.numero} onClick={() => setConfirmar(v.numero)}>
                      Restaurar
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
