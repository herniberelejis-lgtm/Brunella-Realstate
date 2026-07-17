import { describe, it, expect, beforeEach } from "vitest";
import { createTestPool } from "../db/testDb";
import { createBusquedasModule } from "./busquedas";
import { createConversacionesModule } from "./conversaciones";
import { createMuestrasModule } from "./muestras";
import { createConsultasModule } from "./consultas";
import { createOfertasModule } from "./ofertas";
import type { Pool } from "pg";

async function crearContacto(pool: Pool, nombre: string) {
  const result = await pool.query(
    "insert into contactos (nombre, fuente, tipo) values ($1, 'Otro', 'Comprador') returning *",
    [nombre]
  );
  return result.rows[0];
}

async function crearPropiedad(pool: Pool, direccion: string) {
  const result = await pool.query(
    "insert into propiedades (direccion, tipo_propiedad, precio, moneda) values ($1, 'Departamento', 100000, 'USD') returning *",
    [direccion]
  );
  return result.rows[0];
}

describe("evento domain modules", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = createTestPool();
  });

  it("busquedas: creates and finds by contacto_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Uno");
    const busquedas = createBusquedasModule(pool);
    await busquedas.create({
      contacto_id: contacto.id,
      tipo_operacion: "Compra",
      presupuesto_min: 80000,
      presupuesto_max: 100000,
      moneda: "USD",
      zona: "Nueva Córdoba",
      tipo_propiedad: "Departamento",
      dormitorios: 2,
      otros_requisitos: null,
      activa: true,
    } as any);
    const found = await busquedas.findByContactoId(contacto.id);
    expect(found).toHaveLength(1);
    expect(found[0].zona).toBe("Nueva Córdoba");
  });

  it("conversaciones: creates and finds by contacto_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Dos");
    const conversaciones = createConversacionesModule(pool);
    await conversaciones.create({
      contacto_id: contacto.id,
      canal: "WhatsApp",
      resumen: "Preguntó por el depto",
      proximo_paso: "Coordinar muestra",
      origen: "manual",
    } as any);
    const found = await conversaciones.findByContactoId(contacto.id);
    expect(found).toHaveLength(1);
    expect(found[0].resumen).toBe("Preguntó por el depto");
  });

  it("muestras: creates and finds by propiedad_id and by contacto_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Tres");
    const propiedad = await crearPropiedad(pool, "Calle Uno 100");
    const muestras = createMuestrasModule(pool);
    await muestras.create({
      contacto_id: contacto.id,
      propiedad_id: propiedad.id,
      propiedad_mostrada_texto: null,
      feedback: "Le gustó",
      interes_resultante: "Le interesó",
    } as any);
    const porPropiedad = await muestras.findByPropiedadId(propiedad.id);
    expect(porPropiedad).toHaveLength(1);
    expect(porPropiedad[0].interes_resultante).toBe("Le interesó");
    const porContacto = await muestras.findByContactoId(contacto.id);
    expect(porContacto).toHaveLength(1);
  });

  it("consultas: creates and finds by propiedad_id and by contacto_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Consulta");
    const propiedad = await crearPropiedad(pool, "Calle Dos 200");
    const consultas = createConsultasModule(pool);
    await consultas.create({
      propiedad_id: propiedad.id,
      contacto_id: contacto.id,
      canal: "Instagram",
      origen: "nota_de_voz",
    } as any);
    const porPropiedad = await consultas.findByPropiedadId(propiedad.id);
    expect(porPropiedad).toHaveLength(1);
    expect(porPropiedad[0].canal).toBe("Instagram");
    const porContacto = await consultas.findByContactoId(contacto.id);
    expect(porContacto).toHaveLength(1);
  });

  it("ofertas: creates and finds by contacto_id and by propiedad_id", async () => {
    const contacto = await crearContacto(pool, "Comprador Cuatro");
    const propiedad = await crearPropiedad(pool, "Calle Tres 300");
    const ofertas = createOfertasModule(pool);
    await ofertas.create({
      propiedad_id: propiedad.id,
      contacto_id: contacto.id,
      monto: 95000,
      estado: "Pendiente",
      origen: "nota_de_voz",
    } as any);
    const porContacto = await ofertas.findByContactoId(contacto.id);
    expect(porContacto).toHaveLength(1);
    expect(porContacto[0].monto).toBe(95000);
    const porPropiedad = await ofertas.findByPropiedadId(propiedad.id);
    expect(porPropiedad).toHaveLength(1);
  });
});
