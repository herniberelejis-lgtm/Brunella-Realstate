import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";
import { parsePropiedadesFromExcel } from "./import-excel";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "propiedades-ejemplo.xlsx");

beforeAll(async () => {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Propiedades");
  worksheet.columns = [
    { header: "fecha", key: "fecha" },
    { header: "tipo", key: "tipo" },
    { header: "descripcion", key: "descripcion" },
    { header: "precio", key: "precio" },
    { header: "consultas", key: "consultas" },
    { header: "visitas", key: "visitas" },
  ];
  worksheet.addRow({
    fecha: "2026-01-15",
    tipo: "Departamento",
    descripcion: "2 dormitorios, luminoso",
    precio: 95000,
    consultas: 4,
    visitas: 1,
  });
  worksheet.addRow({
    fecha: "2026-02-01",
    tipo: "Casa",
    descripcion: "Con patio",
    precio: 150000,
    consultas: 2,
    visitas: 0,
  });
  await workbook.xlsx.writeFile(FIXTURE_PATH);
});

describe("parsePropiedadesFromExcel", () => {
  it("parses each row into a Propiedad-shaped insert payload", async () => {
    const rows = await parsePropiedadesFromExcel(FIXTURE_PATH);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tipo_propiedad: "Departamento",
      descripcion: "2 dormitorios, luminoso",
      precio: 95000,
      consultas_historicas: 4,
      visitas_historicas: 1,
    });
    expect(rows[0].direccion).toBeTruthy();
    expect(rows[1].tipo_propiedad).toBe("Casa");
  });
});
