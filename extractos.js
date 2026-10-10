// ─────────────────────────────────────────────────────────────────────────────
// extractos.js — Plata → Extractos. Sello: extractos-2
//
// Mauro, 10-oct-2026: «vamos integrando esta información para tener datos
// estadísticos… dejar un registro vivo y unificado. Cuando se haga un análisis
// de gastos habrá que incluir esta información» (tiempos:V12).
//
// Lo que dice el banco —Prex de Mauro, BTG de cada uno— vive en `extractos/`,
// una línea por documento, con el id que sale de la línea misma (idExtracto):
// cargar dos veces lo mismo no duplica. El agente las carga y las clasifica
// (herramientas/extractos.mjs de `datos`); acá una persona las corrige y las
// REGISTRA de a muchas. Registrar escribe el movimiento con SU sesión —el
// agente sigue sin escribir plata— y con id fijo (`x-<id de la línea>`): si
// dos teléfonos registran a la vez, queda uno solo.
//
// Lo que no es gasto ni entrada (cargas, cambios de moneda, una seña que ya
// está en Casa Verde, una compra devuelta) se ve, con su clase, y no se
// registra. «A revisar» es lo que el agente no supo: se decide acá.
//
// extractos-2 (tiempos:V13): cada línea elige también PARA QUIÉN (una persona
// o un chico): es lo que separa en Plata → Proyectos una salida de Mauro de
// una de Florencia, o la actividad de un chico.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, CATEGORIAS, MESES, CLASES_EXTRACTO, faltaParaRegistrar, movimientoDeExtracto,
         resumenExtractos, cuentasDe } from "./nucleo.js";
import { E, aviso, repintar, fallo, personas } from "./estado.js";

let medioVisto = "";
let trabajando = false;
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nombreMes = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const NOMBRE_MEDIO = (m) => String(m || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const porMoneda = (o) => Object.entries(o || {}).map(([mon, v]) => `${v < 0 ? "−" : "+"}${fmt(Math.abs(v))} ${mon}`).join(" · ") || "—";

export function pintarExtractos(v, mes) {
  const todas = E.extractos || [];
  const medios = [...new Set(todas.map((l) => l.medio).filter(Boolean))].sort();
  if (!medios.length) {
    v.insertAdjacentHTML("beforeend", `<div class="tarjeta"><h3>Extractos</h3><p class="gris">Todavía no hay extractos cargados.
      Mandale a Claude las capturas o el archivo de una cuenta (Prex, BTG…) y las líneas aparecen acá para registrarlas.</p></div>`);
    return;
  }
  if (!medios.includes(medioVisto)) medioVisto = medios[0];
  const lineas = todas.filter((l) => l.medio === medioVisto);
  const listas = lineas.filter((l) => !faltaParaRegistrar(l).length);
  const listasMes = listas.filter((l) => String(l.fecha).slice(0, 7) === mes);
  const n = (f) => lineas.filter(f).length;
  const total = resumenExtractos(lineas);
  const rango = total.meses.length ? `${nombreMes(total.meses[0])} a ${nombreMes(total.meses[total.meses.length - 1])}` : "";

  let h = `<nav class="solapas chicas">${medios.map((m) => `<button data-medio="${esc(m)}" aria-selected="${m === medioVisto}">${esc(NOMBRE_MEDIO(m))}</button>`).join("")}</nav>`;
  h += `<div class="tarjeta"><h3>${esc(NOMBRE_MEDIO(medioVisto))}</h3>
    <p class="gris">${lineas.length} líneas${rango ? ", de " + esc(rango) : ""}: ${n((l) => l.estado === "registrado")} registradas,
      ${listas.length} listas para registrar, ${n((l) => l.estado === "pendiente" && l.clase === "revisar")} a revisar,
      ${n((l) => l.estado === "pendiente" && !CLASES_EXTRACTO[l.clase]?.cuenta && l.clase !== "revisar")} que no son gasto (cargas, cambios, devoluciones…).</p>
    ${Object.entries(total.porClase).map(([k, o]) => `<div class="barra-fila"><span>${esc((CLASES_EXTRACTO[k] || {}).nombre || k)}</span><small class="gris">${Object.entries(o).map(([mon, x]) => fmt(x) + " " + mon).join(" · ")}</small></div>`).join("")}
    <div class="botones">${listas.length ? `<button class="boton" data-registrar="todas"${trabajando ? " disabled" : ""}>Registrar las ${listas.length} listas</button>` : ""}
      ${listasMes.length && listasMes.length !== listas.length ? `<button class="boton sec" data-registrar="mes"${trabajando ? " disabled" : ""}>Sólo las ${listasMes.length} de ${esc(nombreMes(mes))}</button>` : ""}</div>
    <p class="gris chica">Registrar escribe cada una como un movimiento a nombre de quien es la cuenta. Antes podés cambiar la clase, la categoría o la cuenta de cualquier línea.</p></div>`;

  const delMes = lineas.filter((l) => String(l.fecha).slice(0, 7) === mes).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const r = resumenExtractos(delMes);
  h += `<p class="gris">${esc(nombreMes(mes))}: ${porMoneda(r.porMes[mes])}${delMes.length ? "" : " — nada en este mes"}</p>`;
  h += delMes.map(lineaHTML).join("");
  v.insertAdjacentHTML("beforeend", h);
  enganchar(v, listas, listasMes);
}

function lineaHTML(l) {
  const hecha = l.estado !== "pendiente";
  const signo = l.sentido === "entro" ? "+" : "−";
  const tipo = l.clase === "entrada" ? "entro" : "salio";
  const cats = Object.entries(CATEGORIAS).filter(([, c]) => c.tipo === tipo);
  const falta = faltaParaRegistrar(l);
  const sel = (campo, opciones, valor) => `<select class="chico" data-campo="${campo}" data-linea="${esc(l.id)}"${hecha ? " disabled" : ""}>${opciones.map(([k, nom]) => `<option value="${esc(k)}"${valor === k ? " selected" : ""}>${esc(nom)}</option>`).join("")}</select>`;
  return `<div class="fila mov extracto${l.sentido === "entro" ? " entro" : ""}${hecha ? " hecha" : ""}">
    <span class="fecha-chica">${Number(String(l.fecha).slice(8))}</span>
    <span class="txt"><b>${esc(l.desc || "—")}</b>
      <small class="gris">${l.estado === "registrado" ? "✓ registrado" : l.estado === "excluido" ? "excluido" : esc((CLASES_EXTRACTO[l.clase] || {}).nombre || l.clase)}${l.nota ? " · " + esc(l.nota) : ""}</small>
      ${(l.dudas || []).length && !hecha ? `<small class="aviso-chico">❓ ${l.dudas.map(esc).join(" · ")}</small>` : ""}
      ${hecha ? "" : `<span class="selects">${sel("clase", Object.entries(CLASES_EXTRACTO).map(([k, c]) => [k, c.nombre]), l.clase)}
        ${l.clase === "gasto" || l.clase === "entrada" ? sel("categoria", [["", "— categoría —"], ...cats.map(([k, c]) => [k, c.nombre])], l.categoria || "")
          + sel("cuenta", [["", "— la casa en general —"], ...cuentasDe(E.cuentasDoc).map((c) => [c.id, c.ruta])], l.cuenta || "")
          + sel("para", [["", "— para nadie en especial —"], ...personas().map((p) => [p.id, "para " + p.nombre]), ...((E.familia && E.familia.ninos) || []).map((n) => [n.id, "para " + n.nombre])], l.para || "") : ""}
        ${falta.length && (l.clase === "gasto" || l.clase === "entrada") ? `<small class="gris">falta ${esc(falta.join(", "))}</small>` : ""}</span>`}</span>
    <span class="num">${signo}${fmt(Number(l.monto))} ${esc(l.moneda)}</span></div>`;
}

function enganchar(v, listas, listasMes) {
  for (const b of v.querySelectorAll("[data-medio]")) b.onclick = () => { medioVisto = b.dataset.medio; repintar(); };
  for (const s of v.querySelectorAll("select[data-linea]")) s.onchange = () => {
    const cambio = { [s.dataset.campo]: s.value, actualizadoEn: F.serverTimestamp() };
    // Pasar a gasto o a entrada pide otra categoría: la vieja no corresponde.
    if (s.dataset.campo === "clase") cambio.categoria = "";
    F.updateDoc(F.doc(db, "extractos", s.dataset.linea), cambio).catch(fallo);
  };
  for (const b of v.querySelectorAll("[data-registrar]")) b.onclick = () => registrar(b.dataset.registrar === "mes" ? listasMes : listas).catch(fallo);
}

/** Registra de a 200 (cada una son dos escrituras; el lote de Firestore llega a 500). */
export async function registrar(lineas) {
  if (!lineas.length || trabajando) return;
  if (!confirm(`¿Registrar ${lineas.length} línea(s) como movimientos?`)) return;
  trabajando = true; repintar();
  let hechas = 0;
  try {
    for (let i = 0; i < lineas.length; i += 200) {
      const b = F.writeBatch(db);
      for (const l of lineas.slice(i, i + 200)) {
        const movId = "x-" + l.id;
        b.set(F.doc(db, "movimientos", movId), { ...movimientoDeExtracto(l, E.yo.uid), comprobanteUrl: null, automatico: null,
          creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
        b.update(F.doc(db, "extractos", l.id), { estado: "registrado", movId, decididoPor: E.yo.uid, decididoEn: F.serverTimestamp() });
      }
      await b.commit();
      hechas += Math.min(200, lineas.length - i);
    }
    aviso(`Listo: ${hechas} movimiento(s) registrados.`);
  } finally { trabajando = false; repintar(); }
}
