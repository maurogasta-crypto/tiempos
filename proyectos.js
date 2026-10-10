// ─────────────────────────────────────────────────────────────────────────────
// proyectos.js — Plata → Proyectos: la economía centralizada. Sello: proyectos-1
//
// Mauro, 10-oct-2026 (tiempos:V13): «quiero que la economía esté centralizada
// para poder, de un solo lugar, saber cómo se están derivando los gastos…
// Casa Verde, el auto, el triciclo, la actividad de los niños, salidas para
// uno o para el otro… la plata es toda una y viene a un solo lugar, que es la
// familia… analizar el funcionamiento de cada proyecto y su viabilidad:
// cuántos recursos se le dedican y si es rentable».
//
// Las cuentas las hace `economiaFamiliar` de nucleo.js (un movimiento, un
// destino); acá sólo se dibujan. Entran los movimientos y lo que dicen los
// extractos todavía sin registrar (si ya tienen categoría), marcado.
//
// Casa Verde además tiene su LIBRO PROPIO, en su base: lo que cobra por las
// reservas y lo que gasta el negocio. Se lee con la sesión de Casa Verde de
// quien mira (`CV.mod`, como las horas en balance.js) y SÓLO se lee: si esa
// persona no tiene el permiso de finanzas allá, se dice, no se inventa.
// ─────────────────────────────────────────────────────────────────────────────

import { CV } from "./firebase-init.js";
import { esc, CATEGORIAS, MESES, cuentasDe, economiaFamiliar, pendientesComoMovs, libroDeNegocio,
         trimestreDe, mesesDelTrimestre, sumarMeses } from "./nucleo.js";
import { E, repintar, personas } from "./estado.js";

let periodo = "anio";             // mes | trimestre | anio (los 12 meses hasta el visto)
let libroCV = null;               // null = sin pedir · { movs } · { error }
let pidiendoCV = false;
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nombreMes = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const ICONO = { lugar: "🏠", vehiculo: "🚙", proyecto: "📁", chico: "🧒", persona: "🙋", casa: "🏡" };

function rango(mes) {
  if (periodo === "mes") return { desde: mes + "-01", hasta: mes + "-31", texto: nombreMes(mes) };
  if (periodo === "trimestre") { const ms = mesesDelTrimestre(trimestreDe(mes)); return { desde: ms[0] + "-01", hasta: ms[2] + "-31", texto: trimestreDe(mes).replace("-T", " · T") }; }
  const ini = sumarMeses(mes, -11);
  return { desde: ini + "-01", hasta: mes + "-31", texto: `${nombreMes(ini)} a ${nombreMes(mes)}` };
}

function pedirLibroCV() {
  if (libroCV || pidiendoCV || !CV || !E.cv) return;
  pidiendoCV = true;
  const M = CV.mod;
  M.getDocs(M.collection(M.db, "movimientos"))
    .then((s) => { libroCV = { movs: s.docs.map((d) => d.data()) }; })
    .catch((e) => { libroCV = { error: /permission/i.test(e.message) ? "tu usuario de Casa Verde no ve su libro (hace falta el permiso de finanzas)" : e.message }; })
    .finally(() => { pidiendoCV = false; repintar(); });
}

const lineaMoneda = (mon, o, conParte) => `<div class="barra-fila"><span>${esc(mon)}</span>
  <span class="txt"><b class="num">−${fmt(o.salio)}</b>${conParte && o.parte ? ` <small class="gris">${o.parte}% de lo que salió</small>` : ""}
  ${o.entro ? ` · <b class="num ok">+${fmt(o.entro)}</b>` : ""}
  ${o.entro ? ` · neto <b class="num ${o.neto >= 0 ? "ok" : "mal"}">${o.neto >= 0 ? "+" : "−"}${fmt(Math.abs(o.neto))}</b>` : ""}</span></div>`;

export function pintarProyectos(v, mes) {
  const r = rango(mes);
  const ninos = (E.familia && E.familia.ninos) || [];
  const movs = [...(E.movs || []), ...pendientesComoMovs(E.extractos)];
  const eco = economiaFamiliar({ movs, cuentas: cuentasDe(E.cuentasDoc), ninos, personas: personas(), desde: r.desde, hasta: r.hasta });
  pedirLibroCV();

  let h = `<nav class="solapas chicas">${[["mes", "Mes"], ["trimestre", "Trimestre"], ["anio", "12 meses"]].map(([k, n]) => `<button data-periodo="${k}" aria-selected="${periodo === k}">${n}</button>`).join("")}</nav>`;
  h += `<div class="tarjeta disp"><h3>Toda la familia · ${esc(r.texto)}</h3>${Object.keys(eco.total).length
    ? Object.entries(eco.total).map(([mon, t]) => `<div class="barra-fila"><span>${esc(mon)}</span><span class="txt">entró <b class="num ok">${fmt(t.entro)}</b> · salió <b class="num">${fmt(t.salio)}</b> · queda <b class="num ${t.entro - t.salio >= 0 ? "ok" : "mal"}">${fmt(t.entro - t.salio)}</b></span></div>`).join("")
    : `<p class="gris">Nada en este período.</p>`}
    ${eco.sinRegistrar ? `<p class="gris chica">Incluye ${eco.sinRegistrar} línea(s) de extractos todavía sin registrar (Plata → Extractos).</p>` : ""}
    <p class="gris chica">Cada moneda va aparte: no se suman ni se convierten. Un gasto va al proyecto de su cuenta; si no tiene, al chico o a la persona para quien fue; si no, a la casa.</p></div>`;

  for (const d of eco.destinos) {
    const esCV = d.id === "c:casa-verde";
    const cats = Object.entries(d.porCategoria).map(([k, o]) => `${esc((CATEGORIAS[k] || {}).nombre || k)}: ${Object.entries(o).map(([m, x]) => (x < 0 ? "−" : "+") + fmt(Math.abs(x)) + " " + m).join(" · ")}`);
    h += `<div class="tarjeta proyecto"><h3>${ICONO[d.clase] || "📁"} ${esc(d.nombre)} <small class="gris">${d.n} mov.${d.sinRegistrar ? `, ${d.sinRegistrar} sin registrar` : ""}</small></h3>
      ${Object.entries(d.porMoneda).map(([mon, o]) => lineaMoneda(mon, o, true)).join("")}
      ${esCV ? libroCVHTML(r) : ""}
      <details><summary class="gris">en qué</summary><p class="gris chica">${cats.join("<br>")}</p></details></div>`;
  }
  if (!eco.destinos.some((d) => d.id === "c:casa-verde") && libroCV && libroCV.movs)
    h += `<div class="tarjeta proyecto"><h3>🏠 Casa Verde <small class="gris">sin gastos de la familia en el período</small></h3>${libroCVHTML(r)}</div>`;
  v.insertAdjacentHTML("beforeend", h);
  for (const b of v.querySelectorAll("[data-periodo]")) b.onclick = () => { periodo = b.dataset.periodo; repintar(); };
}

function libroCVHTML(r) {
  if (!CV || !E.cv) return `<p class="gris chica">Su libro propio está en Casa Verde: entrá a Casa Verde desde Tiempos para verlo acá.</p>`;
  if (!libroCV) return `<p class="gris chica">Leyendo el libro de Casa Verde…</p>`;
  if (libroCV.error) return `<p class="gris chica">No pude leer el libro de Casa Verde: ${esc(libroCV.error)}.</p>`;
  const lib = libroDeNegocio(libroCV.movs, { desde: r.desde, hasta: r.hasta });
  if (!Object.keys(lib).length) return `<p class="gris chica">Su libro propio no tiene movimientos en este período.</p>`;
  return `<p class="chica"><b>Su libro propio</b> (lo que cobra y gasta el negocio, en su base):</p>`
    + Object.entries(lib).map(([mon, o]) => lineaMoneda(mon, o, false)).join("")
    + `<p class="gris chica">Rentable en una moneda si su neto, menos lo que la familia le puso arriba en esa misma moneda, queda positivo.</p>`;
}
