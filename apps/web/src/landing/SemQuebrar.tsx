'use client';

import { Component, type ReactNode } from 'react';

/**
 * Um erro no visualizador dos exemplos (o pedaço que não baixou, uma falha dentro dele) não derruba a página: some só
 * ele, e a miniatura que fica por baixo continua à vista.
 */
export class SemQuebrar extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };

  static getDerivedStateFromError(): { erro: boolean } {
    return { erro: true };
  }

  componentDidCatch(e: unknown) {
    console.error('[landing: exemplo]', e);
  }

  render() {
    return this.state.erro ? null : this.props.children;
  }
}
