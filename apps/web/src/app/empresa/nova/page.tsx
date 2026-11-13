import { Marca } from '@/componentes/Marca';
import { FormularioEmpresa } from './formulario';

export default function NovaEmpresa() {
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca />
        <h1>Tua empresa</h1>
        <p className="mudo">É o espaço onde ficam o catálogo da central, as jornadas e quem pode editar. Depois tu convida os colegas.</p>
        <FormularioEmpresa />
      </div>
    </main>
  );
}
