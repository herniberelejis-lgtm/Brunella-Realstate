import { getPool } from "../db/pool";
import { createContactosModule } from "./contactos";
import { createPropiedadesModule } from "./propiedades";
import { createBusquedasModule } from "./busquedas";
import { createConversacionesModule } from "./conversaciones";
import { createMuestrasModule } from "./muestras";
import { createConsultasModule } from "./consultas";
import { createOfertasModule } from "./ofertas";
import { createLeadsPendientesModule } from "./leadsPendientes";
import { createInMemoryTable } from "./inMemoryStore";
import { CONTACTOS_SEED, PROPIEDADES_SEED } from "./seedData";

export type DomainModules = {
  contactos: ReturnType<typeof createContactosModule>;
  propiedades: ReturnType<typeof createPropiedadesModule>;
  busquedas: ReturnType<typeof createBusquedasModule>;
  conversaciones: ReturnType<typeof createConversacionesModule>;
  muestras: ReturnType<typeof createMuestrasModule>;
  consultas: ReturnType<typeof createConsultasModule>;
  ofertas: ReturnType<typeof createOfertasModule>;
  leadsPendientes: ReturnType<typeof createLeadsPendientesModule>;
};

let cachedInMemoryModules: DomainModules | undefined;

function buildInMemoryModules(): DomainModules {
  const contactosTable = createInMemoryTable(CONTACTOS_SEED);
  const propiedadesTable = createInMemoryTable(PROPIEDADES_SEED);
  const busquedasTable = createInMemoryTable([]);
  const conversacionesTable = createInMemoryTable([]);
  const muestrasTable = createInMemoryTable([]);
  const consultasTable = createInMemoryTable([]);
  const ofertasTable = createInMemoryTable([]);
  const leadsPendientesTable = createInMemoryTable([]);

  return {
    contactos: {
      ...contactosTable,
      findByNombreLike: async (nombre: string) =>
        (await contactosTable.list()).filter((c) =>
          c.nombre.toLowerCase().includes(nombre.toLowerCase())
        ),
      findNecesitanSeguimiento: async () => [],
      marcarActividad: async () => {},
    } as any,
    propiedades: {
      ...propiedadesTable,
      findByDireccionLike: async (direccion: string) =>
        (await propiedadesTable.list()).filter((p) =>
          p.direccion.toLowerCase().includes(direccion.toLowerCase())
        ),
      withTotales: async (propiedad: any) => ({
        ...propiedad,
        consultas_totales: propiedad.consultas_historicas,
        visitas_totales: propiedad.visitas_historicas,
      }),
    } as any,
    busquedas: {
      ...busquedasTable,
      findByContactoId: async (id: string) =>
        (await busquedasTable.list()).filter((b: any) => b.contacto_id === id),
    } as any,
    conversaciones: {
      ...conversacionesTable,
      findByContactoId: async (id: string) =>
        (await conversacionesTable.list()).filter((c: any) => c.contacto_id === id),
    } as any,
    muestras: {
      ...muestrasTable,
      findByContactoId: async (id: string) =>
        (await muestrasTable.list()).filter((m: any) => m.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await muestrasTable.list()).filter((m: any) => m.propiedad_id === id),
    } as any,
    consultas: {
      ...consultasTable,
      findByContactoId: async (id: string) =>
        (await consultasTable.list()).filter((c: any) => c.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await consultasTable.list()).filter((c: any) => c.propiedad_id === id),
    } as any,
    ofertas: {
      ...ofertasTable,
      findByContactoId: async (id: string) =>
        (await ofertasTable.list()).filter((o: any) => o.contacto_id === id),
      findByPropiedadId: async (id: string) =>
        (await ofertasTable.list()).filter((o: any) => o.propiedad_id === id),
    } as any,
    leadsPendientes: {
      ...leadsPendientesTable,
      findByToken: async (token: string) =>
        (await leadsPendientesTable.list()).find((l: any) => l.token === token) ?? null,
      marcarUsado: async (id: string) => {
        const item = await leadsPendientesTable.findById(id);
        if (item) await leadsPendientesTable.update(id, { usado: true } as any);
      },
    } as any,
  };
}

export function getDomainModules(): DomainModules {
  if (!process.env.DATABASE_URL) {
    if (!cachedInMemoryModules) {
      cachedInMemoryModules = buildInMemoryModules();
    }
    return cachedInMemoryModules;
  }

  const pool = getPool();
  return {
    contactos: createContactosModule(pool),
    propiedades: createPropiedadesModule(pool),
    busquedas: createBusquedasModule(pool),
    conversaciones: createConversacionesModule(pool),
    muestras: createMuestrasModule(pool),
    consultas: createConsultasModule(pool),
    ofertas: createOfertasModule(pool),
    leadsPendientes: createLeadsPendientesModule(pool),
  };
}
