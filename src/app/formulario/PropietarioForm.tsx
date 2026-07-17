import { submitPropietarioAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const labelClass = "block text-sm font-medium text-slate-700";

export function PropietarioForm({ token, showError }: { token: string | null; showError: boolean }) {
  const action = submitPropietarioAction.bind(null, token);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Contanos de tu propiedad</h1>
      {showError && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Revisá los datos obligatorios e intentá de nuevo.
        </p>
      )}
      <form action={action} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" type="text" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="telefono">Tu WhatsApp</label>
          <input id="telefono" name="telefono" type="tel" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="que_quiere_hacer">Qué querés hacer</label>
          <select id="que_quiere_hacer" name="que_quiere_hacer" className={inputClass} defaultValue="Vender">
            <option value="Vender">Vender</option>
            <option value="Alquilar">Alquilar</option>
            <option value="Alquiler temporario">Alquiler temporario</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="direccion">Dirección</label>
          <input id="direccion" name="direccion" type="text" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tipo_propiedad">Tipo de propiedad</label>
          <select id="tipo_propiedad" name="tipo_propiedad" className={inputClass} defaultValue="Departamento">
            <option value="Departamento">Departamento</option>
            <option value="Casa">Casa</option>
            <option value="PH">PH</option>
            <option value="Lote">Lote</option>
            <option value="Local/Oficina">Local/Oficina</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="precio">Precio</label>
            <input id="precio" name="precio" type="number" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="moneda">Moneda</label>
            <select id="moneda" name="moneda" className={inputClass} defaultValue="USD">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="descripcion">Descripción (opcional)</label>
          <textarea id="descripcion" name="descripcion" rows={3} className={inputClass} />
        </div>
        <button
          type="submit"
          className="min-h-[48px] w-full rounded-lg bg-indigo-600 px-4 font-medium text-white transition hover:bg-indigo-700 active:scale-[0.98]"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
