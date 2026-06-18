// Prueba de los informes PDF con el CSV realista de 24 meses
// (ventas_semanales_moda.csv). Genera los PDF a la carpeta del proyecto para
// poder abrirlos y revisarlos. Uso:  node scripts/test-pdf.mjs
import fs from 'node:fs';
import { prepararMotor, recomendarReposicion } from '../lib/engine/motor.mjs';
import { generarPlanCompra } from '../lib/engine/plan.mjs';
import { construirPlanPDF } from '../lib/pdf/informe.mjs';

const FECHA = new Date(2026, 5, 18); // fija para una salida reproducible

// CSV → records (mismo camino que el E2E del motor).
const txt = fs.readFileSync(new URL('../ventas_semanales_moda.csv', import.meta.url), 'utf8');
const lineas = txt.trim().split(/\r?\n/);
const records = lineas.slice(1).map((l) => {
  const c = l.split(',');
  return {
    fecha: c[0], producto: c[1], categoria: c[2], talla: c[3], color: c[4],
    unidades: Number(c[5]), precio: Number(c[6]), ingresos: Number(c[7]),
  };
});

const motor = prepararMotor(records);
const ctx = { fechaMin: motor.perfil.fechaMin, fechaMax: motor.perfil.fechaMax, nProductos: motor.perfil.nProductos };
console.log(`Dataset: ${motor.perfil.nProductos} productos · ${motor.perfil.semanas} semanas · ${motor.perfil.fechaMin}–${motor.perfil.fechaMax}`);

function guardar(doc, nombre) {
  const buf = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(new URL(`../${nombre}`, import.meta.url), buf);
  const ok = buf.slice(0, 4).toString() === '%PDF';
  console.log(`  ${ok ? '✓' : '✗'} ${nombre} · ${(buf.length / 1024).toFixed(0)} KB · ${doc.getNumberOfPages()} pág.`);
  return ok;
}

console.log('\n— Plan de compra —');
const plan = generarPlanCompra(motor, { presupuesto: 20000, horizonte: 12, margenPct: 60, escenario: 'esperado' });
if (!plan.ok) { console.error('  ✗ el plan no se generó:', plan.motivo); process.exit(1); }
console.log(`  plan: ${plan.filas.length} productos con inversión · ${plan.unidadesTotales} uds · margen ${Math.round(plan.margenEsperado)} €`);
guardar(construirPlanPDF(plan, ctx, FECHA), `wefty-plan-compra-${FECHA.getFullYear()}-06-18.pdf`);

console.log('\nListo. Abre el PDF para revisarlo.');
