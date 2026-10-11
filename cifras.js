// ─────────────────────────────────────────────────────────────────────────────
// cifras.js — Plata → Análisis: lo estimado contra lo real. Sello: cifras-1
//
// Mauro, 11-oct-2026 (tiempos:V14): «todos los gastos deberán ser ordenados
// para ir depurando estos gastos estimativos anuales y corregir el costo anual
// total y particular por cada proyecto separado… tienes que permitir desde la
// app de Tiempos tener esa visualización que permita el análisis de cifras y
// gastos».
//
// Por moneda y categoría: lo que dice el Año contra lo que dicen los datos
// —movimientos, boletas subidas con foto y extractos—, llevado a 12 meses.
// De toda la familia o de un proyecto. Lo más grande arriba: se depura primero
// lo que más pesa. Las cuentas las hace `estimadoVsReal` de nucleo.js.
//
// «Usar lo real» sólo en la vista de toda la familia y sólo sobre un concepto
// BASE (el de la categoría entera): ajusta su monto para que el Año diga lo que
// dicen los datos, con la sesión de quien toca. Un concepto propio (la luz, la
// patente) se corrige en el Año o con «Usar lo real» del Trimestre, que mira
// sus pagos de verdad.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, CATEGORIAS, cuentasDe, estimadoVsReal, pendientesComoMovs, anualDe } from "./nucleo.js";
import { E, repintar, aviso, fallo } from "./estado.js";

let proyecto = "";                 // "" = toda la familia · id de cuenta raíz · "casa"
const fmt = (n) => Math.round(n).toLocaleString("es");
const signo = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n));

export function pintarCifras(v) {
  const cuentas = cuentasDe(E.cuentasDoc);
  const raices = cuentas.filter((c) => !c.nivel);
  const ev = estimadoVsReal({ conceptos: E.conceptos, movs: [...(E.movs || []), ...pendientesComoMovs(E.extractos)], cuentas, hasta: E.hoy, proyecto });

  let h = `<nav class="solapas chicas">${[["", "Toda la familia"], ...raices.map((c) => [c.id, c.nombre]), ["casa", "La casa"]]
    .map(([k, n]) => `<button data-proyecto="${esc(k)}" aria-selected="${proyecto === k}">${esc(n)}</button>`).join("")}</nav>`;
  h += `<p class="gris chica">Lo que dice el <b>Año</b> (lo estimado) contra lo que dicen los <b>datos</b>: lo registrado, las boletas subidas con foto y los extractos, llevado a 12 meses. Lo más grande arriba. Lo personal no entra: el Año es lo que cuesta funcionar.</p>`;
  if (!Object.keys(ev).length) h += `<p class="gris">Nada para comparar en ${proyecto ? "este proyecto" : "la familia"} todavía.</p>`;

  for (const [mon, o] of Object.entries(ev)) {
    const dif = o.real - o.estimado;
    h += `<div class="tarjeta disp"><h3>${esc(mon)} · por año</h3>
      <div class="barra-fila"><span>Estimado</span><b class="num">${fmt(o.estimado)}</b>${o.porVerificar ? `<small class="gris">${o.porVerificar} concepto(s) por verificar</small>` : ""}</div>
      <div class="barra-fila"><span>Real</span><b class="num">${fmt(o.real)}</b><small class="gris">${o.meses ? `medido en ${o.meses} mes(es)${o.desde ? `, ${esc(o.desde)} a ${esc(o.hasta)}` : ""}` : "sin datos todavía"}</small></div>
      <div class="barra-fila"><span>Diferencia</span><b class="num ${dif > 0 ? "mal" : "ok"}">${signo(dif)}</b><small class="gris">${dif > 0 ? "los datos dicen más de lo estimado" : dif < 0 ? "lo estimado es más de lo que dicen los datos" : ""}</small></div></div>`;
    for (const f of o.filas) {
      const base = f.conceptos.find((c) => c.base && !c.cuenta);
      const otros = f.estimado - (base ? base.anual : 0);
      const puede = !proyecto && f.real > 0 && Math.abs(f.diferencia) >= 1 && (base || !f.conceptos.length);
      h += `<details class="tarjeta cifra"><summary><span class="txt"><b>${esc((CATEGORIAS[f.categoria] || {}).nombre || f.categoria)}</b>
          <small class="gris">estimado ${fmt(f.estimado)} · real ${fmt(f.real)}${f.diferencia ? ` · <span class="${f.diferencia > 0 ? "mal" : "ok"}">${signo(f.diferencia)}</span>` : ""}</small></span></summary>
        ${f.conceptos.length ? f.conceptos.map((c) => `<div class="barra-fila"><span class="txt chica">${esc(c.nombre)}${c.estimado ? " <small class=\"gris\">≈ por verificar</small>" : ""}</span><small class="gris">${fmt(c.anual)}/año</small></div>`).join("")
          : `<p class="gris chica">No hay concepto en el Año para esto.</p>`}
        ${puede ? `<button class="mini" data-usar-real="${esc(mon)}|${esc(f.categoria)}|${base ? esc(base.id) : ""}|${Math.max(0, f.real - otros)}">${base ? "Usar lo real en el Año" : "Sumar al Año"}</button>` : ""}
      </details>`;
    }
  }
  h += `<p class="gris chica">Para que lo real se afine: subí cada boleta con foto en <b>Día a día</b> y elegí su cuenta (Santa Fe, Casa Verde, la Hilux…). Cada una corrige estos números sola.</p>`;
  v.insertAdjacentHTML("beforeend", h);
  for (const b of v.querySelectorAll("[data-proyecto]")) b.onclick = () => { proyecto = b.dataset.proyecto; repintar(); };
  for (const b of v.querySelectorAll("[data-usar-real]")) b.onclick = () => usarReal(...b.dataset.usarReal.split("|")).catch(fallo);
}

/** Ajusta (o crea) el concepto base de una categoría para que el Año diga lo que dicen los datos. */
async function usarReal(mon, cat, baseId, anualBase) {
  const porMes = Math.round(Number(anualBase) / 12 * 100) / 100;
  const id = baseId || `g-base-${mon.toLowerCase()}-${cat}`;
  const nombre = `${(CATEGORIAS[cat] || {}).nombre || cat} (base de los datos)`;
  if (!confirm(`¿Poner «${nombre}» en ${porMes} ${mon} por mes en el Año?`)) return;
  const previo = (E.conceptos || {})[id] || {};
  await F.setDoc(F.doc(db, "familia", "presupuesto"), { conceptos: { [id]: {
    ...(baseId ? {} : { nombre, categoria: cat, moneda: mon, cada: 1, mes: Number(E.hoy.slice(5, 7)), pais: mon === "UYU" ? "UY" : mon === "BRL" ? "BR" : "", activo: true, total: null, base: true }),
    monto: porMes, estimado: false, editadoPor: E.yo.uid,
    nota: `${previo.nota ? previo.nota + " · " : ""}ajustado a lo real el ${E.hoy} (antes ${anualDe(previo) || 0}/año)` } } }, { merge: true });
  aviso("Ajustado en el Año.");
  repintar();
}
