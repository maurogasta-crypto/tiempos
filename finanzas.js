// ─────────────────────────────────────────────────────────────────────────────
// finanzas.js — Fijos, el año y el reparto, adentro de Plata. Sello: finanzas-5
//
// app-19 (8-oct-2026, tiempos:V9). Mauro, con la captura de su planilla
// «Gastos Uruguay»: «la misma idea que en Casa Verde pero para las finanzas
// personales y cómo se reparten con Florencia… un estimativo de gastos anuales
// para saber el prorrateo de la temporada y lo que sería dinero libre».
//
//   FIJOS    la planilla: cada gasto que se repite, mes por mes; tocar una
//            casilla registra el pago (un movimiento con `fijo: <id>`).
//   AÑO      el presupuesto: los conceptos con su monto y cada cuánto vencen.
//            Lo que cuesta el año ÷ 12 es la reserva de cada mes.
//   REPARTO  el libre del mes y cómo se divide, con todas las cuentas a la
//            vista, y el cierre que confirman los dos.
//
// Las cuentas viven en nucleo.js (`presupuestoAnual`, `fijosDeMeses`,
// `repartoDelMes`) y tienen su banco. Todo es por moneda: BRL, UYU y USD no se
// suman nunca. El presupuesto y los repartos van en `familia/` como MAPAS
// —como las compras—, así dos teléfonos no se pisan y no hizo falta otra regla.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, MONEDAS, CATEGORIAS, CADAS, PAISES, MESES, validarConcepto, presupuestoAnual,
         fijosDeMeses, repartoDelMes, sumarMeses, idNuevo, esISO, ajusteTrimestral, posiblesFijos, firmaTrimestre, mesesDelTrimestre , baseAnual, pendientesComoMovs , anualDe, cuentasDe } from "./nucleo.js";
import { pedirAnalisis } from "./sugerir.js";
import { E, aviso, repintar, nombreDe, personas, fallo } from "./estado.js";
import { salidasDelMes } from "./balance.js";

let editando = null;           // null | "nuevo" | id del concepto
let pagando = null;            // "id|mes" de la casilla que se está pagando

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const mesCorto = (m) => MESES[Number(m.slice(5)) - 1].slice(0, 3);
const nombreMes = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const gastos = () => Object.entries(CATEGORIAS).filter(([, c]) => c.tipo === "salio");
const guardarConcepto = (id, datos) => F.setDoc(F.doc(db, "familia", "presupuesto"),
  { conceptos: { [id]: datos }, actualizadoEn: F.serverTimestamp() }, { merge: true });

/* ── FIJOS: la planilla ────────────────────────────────────────────────────── */
export function pintarFijos(v, mesVisto) {
  const meses = [sumarMeses(mesVisto, -1), mesVisto, sumarMeses(mesVisto, 1)];
  const filas = fijosDeMeses(E.conceptos, E.movs, meses);
  const actual = E.hoy.slice(0, 7);
  let h = `<p class="gris">Lo que vence todos los meses (o cada tantos). Tocá una casilla para registrar el pago: queda como gasto, con su categoría. Los conceptos se agregan en «Año».</p>`;
  if (!filas.length) h += `<p class="gris">Todavía no hay gastos fijos. Agregalos en «Año».</p>`;
  else {
    h += `<div class="planilla"><div class="pl-fila pl-cab"><span>Gasto</span>${meses.map((m) => `<span${m === actual ? ' class="hoy"' : ""}>${esc(mesCorto(m))}</span>`).join("")}</div>`;
    let pais = null;
    for (const f of filas) {
      if ((f.pais || "") !== pais) { pais = f.pais || ""; h += `<div class="pl-grupo">${esc(PAISES[pais] || "Sin país")}</div>`; }
      h += `<div class="pl-fila"><span class="pl-nombre">${esc(f.nombre)}<small class="gris">${f.monto > 0 ? fmt(f.monto) + " " + esc(f.moneda) : "sin estimar"}${f.deuda ? ` · quedan ${fmt(f.deuda.queda)}` : ""}</small></span>
        ${f.celdas.map((c) => {
          const k = f.id + "|" + c.mes;
          if (c.pagado > 0) return `<button class="pl-celda pagada" data-pagar="${esc(k)}" title="Pagado">✓ ${fmt(c.pagado)}</button>`;
          if (!c.toca) return `<span class="pl-celda nada">·</span>`;
          return `<button class="pl-celda ${c.mes < actual ? "atrasada" : c.mes === actual ? "toca" : "futura"}" data-pagar="${esc(k)}">${c.mes > actual ? "—" : "Pagar"}</button>`;
        }).join("")}</div>`;
      if (pagando && pagando.startsWith(f.id + "|")) h += formPago(f, pagando.split("|")[1]);
    }
    h += `</div>`;
  }
  v.insertAdjacentHTML("beforeend", h);
  for (const b of v.querySelectorAll("[data-pagar]")) b.onclick = () => { pagando = pagando === b.dataset.pagar ? null : b.dataset.pagar; repintar(); };
  const fp = v.querySelector("#form-fijo");
  if (fp) {
    fp.querySelector("[data-cancelar]").onclick = () => { pagando = null; repintar(); };
    fp.onsubmit = async (ev) => {
      ev.preventDefault();
      const [id] = pagando.split("|"), c = E.conceptos[id];
      const monto = Math.round(Number(fp.monto.value) * 100) / 100;
      if (!(monto > 0)) return aviso("Poné cuánto se pagó.", true);
      if (!esISO(fp.fecha.value)) return aviso("Falta la fecha.", true);
      try {
        await F.addDoc(F.collection(db, "movimientos"), { monto, moneda: c.moneda, fecha: fp.fecha.value, categoria: c.categoria,
          comercio: c.nombre, detalle: "gasto fijo", uid: fp.uid.value, fijo: id, automatico: null, comprobanteUrl: null,
          origen: "fijo", creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
        pagando = null; aviso("Pago registrado.");
      } catch (e) { fallo(e); }
    };
  }
}

function formPago(f, mes) {
  const celda = f.celdas.find((c) => c.mes === mes) || {};
  const fecha = mes === E.hoy.slice(0, 7) ? E.hoy : mes + "-01";
  return `<form class="tarjeta ficha" id="form-fijo"><b>${esc(f.nombre)} · ${esc(nombreMes(mes))}</b>
    ${celda.pagado > 0 ? `<p class="gris">Ya se registraron ${fmt(celda.pagado)} ${esc(f.moneda)} este mes. Para corregir, tocá el movimiento en «Día a día».</p>` : ""}
    <div class="dos"><label>Monto (${esc(f.moneda)}) <input name="monto" type="number" step="0.01" min="0" value="${f.monto > 0 ? esc(f.monto) : ""}" required></label>
    <label>Fecha <input name="fecha" type="date" value="${esc(fecha)}" required></label></div>
    <label>Pagó <select name="uid">${personas().map((p) => `<option value="${esc(p.id)}"${p.id === E.yo.uid ? " selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></label>
    <div class="botones"><button class="boton">Registrar el pago</button><button type="button" class="mini" data-cancelar>Cancelar</button></div></form>`;
}

/* ── AÑO: el presupuesto ───────────────────────────────────────────────────── */
export function pintarAnio(v) {
  const pres = presupuestoAnual(E.conceptos);
  const lista = Object.entries(E.conceptos || {}).filter(([, c]) => c)
    .sort((a, b) => String(a[1].categoria).localeCompare(String(b[1].categoria)) || String(a[1].nombre).localeCompare(String(b[1].nombre)));
  // finanzas-3 (11-oct-2026, tiempos:V12): lo que de verdad costó el año, de
  // lo que hay —movimientos y extractos, registrados o no—, por moneda y
  // categoría. Mauro: «sirven para cifrar nuestro presupuesto anual… no
  // quiero hacer un trabajo manual». Las cuentas, en baseAnual de nucleo.js.
  const base = baseAnual([...(E.movs || []), ...pendientesComoMovs(E.extractos)], { hasta: E.hoy });
  let h = Object.keys(base).length ? `<div class="tarjeta disp"><h3>Lo que costó vivir un año</h3>
    <p class="gris chica">De todo lo cargado —lo registrado y las líneas de los extractos de Prex y BTG—, llevado a 12 meses con los meses que cada moneda tiene medidos. Cada moneda aparte.</p>
    ${Object.entries(base).filter(([, o]) => o.meses).map(([mon, o]) => `<div class="barra-fila"><span>${esc(mon)}</span>
      <b class="num">${fmt(o.anual)}</b><small class="gris">al año · ${fmt(o.porMes)} por mes · medido en ${o.meses} mes${o.meses === 1 ? "" : "es"}${o.desde ? ` (${esc(o.desde)} a ${esc(o.hasta)})` : ""}</small></div>
      <details><summary class="gris chica">por categoría</summary>${o.categorias.map((c) => `<div class="barra-fila"><span class="txt chica">${esc((CATEGORIAS[c.categoria] || {}).nombre || c.categoria)}</span><small class="gris">${fmt(c.porMes)}/mes · <b>${fmt(c.anual)}</b>/año</small></div>`).join("")}</details>`).join("")}
  </div>` : "";
  h += `<p class="gris">Todo lo que se paga en el año —la casa, los vehículos, los servicios, los chicos, los impuestos, el negocio—, con cada cuánto vence. Lo que cuesta el año dividido 12 es lo que hay que apartar <b>todos</b> los meses: así se sabe qué parte de lo que entra en la temporada es libre de verdad.</p>`;
  h += Object.keys(pres).length ? `<div class="tarjeta rep">${Object.entries(pres).map(([mon, p]) => `<div class="barra-fila"><span>${esc(mon)}</span>
      <b class="num">${fmt(p.total)}</b><small class="gris">al año · apartar ${fmt(p.reservaMes)} por mes${p.total !== p.enLibre ? ` (sin los gastos del negocio, que ya salen de su neto)` : ""}${p.sinEstimar ? ` · ${p.sinEstimar} sin estimar` : ""}</small></div>`).join("")}</div>` : "";
  h += editando === "nuevo" ? formConcepto("nuevo", {}) : `<button class="boton" data-concepto-nuevo>＋ Gasto del año</button>`;
  let cat = null;
  for (const [id, c] of lista) {
    if (c.categoria !== cat) { cat = c.categoria; h += `<h3>${esc((CATEGORIAS[cat] || {}).nombre || cat)}</h3>`; }
    if (editando === id) { h += formConcepto(id, c); continue; }
    h += `<div class="fila${c.activo === false ? " apagada" : ""}" data-concepto="${esc(id)}"><span class="txt"><b>${esc(c.nombre)}</b>
      <small class="gris">${Number(c.monto) > 0 ? fmt(c.monto) + " " + esc(c.moneda) : "sin estimar"} · ${esc(CADAS[c.cada] || "")}${c.cada > 1 ? " (desde " + esc(MESES[Number(c.mes) - 1]) + ")" : ""}${c.pais ? " · " + esc(PAISES[c.pais] || c.pais) : ""}${Number(c.total) > 0 ? " · deuda de " + fmt(c.total) : ""}${c.activo === false ? " · pausado" : ""}${c.temporada ? " · en temporada (dic–feb) " + fmt(c.temporada.monto) : ""}${c.cuenta && rutaDe(c.cuenta) ? " · 📍 " + esc(rutaDe(c.cuenta)) : ""}${c.estimado ? " · ≈ estimado, a corregir" : ""}${c.desde ? " · desde " + esc(c.desde) : ""}</small></span>
      <span class="num">${fmt(anualDe(c))}<small class="gris">/año</small></span></div>`;
  }
  v.insertAdjacentHTML("beforeend", h);
  const nuevo = v.querySelector("[data-concepto-nuevo]");
  if (nuevo) nuevo.onclick = () => { editando = "nuevo"; repintar(); };
  for (const el of v.querySelectorAll("[data-concepto]")) el.onclick = () => { editando = el.dataset.concepto; repintar(); };
  const f = v.querySelector("#form-concepto");
  if (f) {
    f.querySelector("[data-cancelar]").onclick = () => { editando = null; repintar(); };
    const borrar = f.querySelector("[data-borrar]");
    if (borrar) borrar.onclick = () => {
      if (!confirm("¿Sacar este gasto del año? Los pagos ya registrados quedan.")) return;
      F.setDoc(F.doc(db, "familia", "presupuesto"), { conceptos: { [editando]: F.deleteField() } }, { merge: true })
        .then(() => { editando = null; }).catch(fallo);
    };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = { nombre: f.nombre.value.trim().slice(0, 80), categoria: f.categoria.value, monto: f.monto.value === "" ? 0 : Math.round(Number(f.monto.value) * 100) / 100,
        moneda: f.moneda.value, cada: Number(f.cada.value), mes: Number(f.mes.value), pais: f.pais.value,
        total: f.total.value === "" ? null : Number(f.total.value), activo: !f.pausado.checked,
        // finanzas-5: el proyecto, la temporada, y que una persona lo revisó (deja de ser «estimado»).
        cuenta: f.cuenta.value, temporada: f.temporada.value === "" ? null : { meses: [12, 1, 2], monto: Math.round(Number(f.temporada.value) * 100) / 100 }, estimado: false };
      const err = validarConcepto(d);
      if (err.length) return aviso("Falta: " + err.join("; ") + ".", true);
      try {
        await guardarConcepto(editando === "nuevo" ? idNuevo("g") : editando, { ...d, editadoPor: E.yo.uid });
        editando = null; aviso("Guardado.");
      } catch (e) { fallo(e); }
    };
  }
}

const rutaDe = (id) => (cuentasDe(E.cuentasDoc).find((x) => x.id === id) || {}).ruta || "";

function formConcepto(id, c) {
  return `<form class="tarjeta ficha" id="form-concepto"><h3>${id === "nuevo" ? "Gasto del año" : "Editar"}</h3>
    <label>Qué es <input name="nombre" maxlength="80" required value="${esc(c.nombre || "")}" placeholder="luz, patente de la camioneta, cuota de la escuela…"></label>
    <label>De qué es <select name="categoria" required><option value="">—</option>${gastos().map(([k, x]) => `<option value="${k}"${c.categoria === k ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></label>
    <div class="dos"><label>Cuánto cada vez <input name="monto" type="number" step="0.01" min="0" value="${esc(c.monto ?? "")}" placeholder="0 = sin estimar"></label>
      <label>Moneda <select name="moneda">${MONEDAS.map((m) => `<option${(c.moneda || "UYU") === m ? " selected" : ""}>${m}</option>`).join("")}</select></label></div>
    <div class="dos"><label>Cada cuánto <select name="cada">${Object.entries(CADAS).map(([k, n]) => `<option value="${k}"${Number(c.cada || 1) === Number(k) ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label>Vence en <select name="mes">${MESES.map((n, i) => `<option value="${i + 1}"${Number(c.mes || Number(E.hoy.slice(5, 7))) === i + 1 ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label></div>
    <div class="dos"><label>País <select name="pais"><option value="">—</option>${Object.entries(PAISES).map(([k, n]) => `<option value="${k}"${c.pais === k ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label>Si es una deuda, el total <input name="total" type="number" step="0.01" min="0" value="${esc(c.total ?? "")}"></label></div>
    <div class="dos"><label>Proyecto <select name="cuenta"><option value="">— la casa —</option>${cuentasDe(E.cuentasDoc).map((x) => `<option value="${esc(x.id)}"${c.cuenta === x.id ? " selected" : ""}>${esc(x.ruta)}</option>`).join("")}</select></label>
      <label>En temporada (dic–feb), cada vez <input name="temporada" type="number" step="0.01" min="0" value="${esc(c.temporada ? c.temporada.monto : "")}" placeholder="vacío = igual todo el año"></label></div>
    <label class="check"><input type="checkbox" name="pausado"${c.activo === false ? " checked" : ""}> Pausado (no cuenta para el año)</label>
    <div class="botones"><button class="boton">Guardar</button><button type="button" class="mini" data-cancelar>Cancelar</button>
      ${id !== "nuevo" ? `<button type="button" class="mini" data-borrar>Sacar</button>` : ""}</div></form>`;
}

/* ── REPARTO: el libre del mes y cómo se divide ────────────────────────────── */
export function pintarReparto(v, mesVisto) {
  const ps = personas(), uids = ps.map((p) => p.id);
  const salidas = salidasDelMes(mesVisto);
  const r = repartoDelMes({ movs: E.movs, conceptos: E.conceptos, mes: mesVisto, uids, salidas });
  const cierre = (E.repartos || {})[mesVisto] || {};
  const confirmados = cierre.confirmado || {};
  let h = `<p class="gris">El libre es lo que entró menos lo que hay que apartar para los gastos del año. Producir y estar con los chicos pesan igual, así que va mitad y mitad; las salidas que no se equipararon en el mes se compensan con el valor de un día. Lo que cada uno gastó en lo personal ya lo retiró.</p>`;
  if (!Object.keys(r).length) h += `<p class="gris">En ${esc(nombreMes(mesVisto))} no entró ni salió nada todavía.</p>`;
  for (const [mon, x] of Object.entries(r)) {
    const sigue = x.libre > 0;
    h += `<div class="tarjeta rep"><h3>${esc(mon)}</h3>
      <div class="barra-fila"><span>Entró</span><b class="num">${fmt(x.entro)}</b></div>
      <div class="barra-fila"><span>${x.sinPresupuesto ? "Gastos de la casa y los chicos" : "Reserva para el año"}</span><b class="num">− ${fmt(x.reserva)}</b>
        <small class="gris">${x.sinPresupuesto ? "todavía no hay gastos del año en esta moneda: se usa lo gastado" : `gastado de verdad este mes: ${fmt(x.gastoReal)}`}</small></div>
      <div class="barra-fila"><span><b>Libre</b></span><b class="num">${fmt(x.libre)}</b>${sigue ? `<small class="gris">un día vale ${fmt(x.valorDia)} (÷ ${x.dias})</small>` : ""}</div>
      ${!sigue ? `<p class="gris">No hubo libre: no hay nada que repartir este mes en ${esc(mon)}.</p>`
      : `${x.compensa > 0 ? `<p>Salidas: <b>${esc(nombreDe(x.aQuien))}</b> tiene ${String(x.diferenciaDias).replace(".", ",")} día(s) a favor → ${esc(nombreDe(x.deQuien))} le pasa <b>${fmt(x.compensa)}</b>.</p>` : `<p class="gris">Salidas parejas: mitad y mitad.</p>`}
        ${ps.map((p) => { const y = x.porPersona[p.id]; return `<div class="barra-fila"><span>${esc(p.nombre)}</span><b class="num">${fmt(y.parte)}</b>
          <small class="gris">${y.gastoPersonal > 0 ? `ya gastó ${fmt(y.gastoPersonal)} en lo personal → le quedan ${fmt(y.queda)}` : "sin gastos personales este mes"}</small></div>`; }).join("")}`}
    </div>`;
  }
  if (Object.keys(r).length) {
    const firma = JSON.stringify(Object.fromEntries(Object.entries(r).map(([m, x]) => [m, Object.fromEntries(uids.map((u) => [u, x.porPersona[u].parte]))])));
    const yo = confirmados[E.yo.uid];
    const cambio = Object.values(confirmados).some((c) => c && c.firma !== firma);
    h += `<div class="tarjeta"><b>Cierre de ${esc(nombreMes(mesVisto))}</b>
      ${ps.map((p) => `<p>${confirmados[p.id] ? "✓" : "…"} ${esc(p.nombre)}${confirmados[p.id] ? "" : " todavía no confirmó"}</p>`).join("")}
      ${cambio ? `<p class="aviso">Los números cambiaron después de confirmar (entró o salió algo). Hay que volver a confirmar.</p>` : ""}
      ${!yo || yo.firma !== firma ? `<button class="boton" data-confirmar>Estoy de acuerdo con este reparto</button>` : `<p class="gris">Confirmaste estos números.</p>`}</div>`;
    v.insertAdjacentHTML("beforeend", h);
    const b = v.querySelector("[data-confirmar]");
    if (b) b.onclick = () => F.setDoc(F.doc(db, "familia", "repartos"),
      { [mesVisto]: { confirmado: { [E.yo.uid]: { firma, en: new Date().toISOString() } } } }, { merge: true })
      .then(() => aviso("Confirmado.")).catch(fallo);
  } else v.insertAdjacentHTML("beforeend", h);
}

/* ── EL TRIMESTRE (finanzas-2, 10-oct-2026, tiempos:V11) ─────────────────────
   Mauro: «resumir un neto de todos los ingresos descontando todos los gastos
   fijos… ajustes trimestrales, identificando los gastos que son fijos para
   tener un costo estimado de funcionamiento». Por moneda: lo que entró, los
   fijos y lo demás, el neto, y el costo de funcionamiento estimado (el Año ÷
   4). Concepto por concepto, lo estimado contra lo pagado, con «Usar lo real»
   para ajustar el monto del Año; y lo que se repite sin ser un concepto, con
   «Sumar al Año». El ajuste lo confirman los dos, con la firma de los números
   (como el reparto), en `familia/cierres` → trimestres. */
const NOMBRE_T = (t) => `${["enero a marzo", "abril a junio", "julio a septiembre", "octubre a diciembre"][Number(t.slice(-1)) - 1]} ${t.slice(0, 4)}`;
export function pintarTrimestre(v, trimestre) {
  const aj = ajusteTrimestral({ conceptos: E.conceptos, movs: E.movs, trimestre, hoyMes: E.hoy.slice(0, 7) });
  const posibles = posiblesFijos(E.movs, E.conceptos, E.hoy.slice(0, 7));
  const firma = firmaTrimestre(aj);
  const conf = ((((E.cierresDoc || {}).trimestres || {})[trimestre] || {}).confirmado) || {};
  let h = `<p class="gris">${esc(NOMBRE_T(trimestre))}. Lo que entró menos lo que salió, separando los gastos FIJOS (los del Año) de lo demás, y el costo de funcionamiento que estima el Año. Cada moneda va aparte.</p>`;
  const ms = Object.entries(aj.porMoneda).filter(([, x]) => x.entro || x.salio || x.costoEstimado);
  h += ms.length ? `<div class="tarjeta rep">${ms.map(([mon, x]) => `<h3>${esc(mon)}</h3>
      <div class="barra-fila"><span>Entró</span><b class="num">${fmt(x.entro)}</b></div>
      <div class="barra-fila"><span>Gastos fijos</span><b class="num">${x.fijos ? "−" + fmt(x.fijos) : "0"}</b></div>
      <div class="barra-fila"><span>Otros gastos</span><b class="num">${x.variables ? "−" + fmt(x.variables) : "0"}</b></div>
      <div class="barra-fila"><span><b>Neto</b></span><b class="num">${fmt(x.neto)}</b></div>
      <div class="barra-fila"><span>Costo de funcionamiento estimado</span><b class="num">${fmt(x.costoEstimado)}</b><small class="gris">${fmt(x.costoEstimado / 3)} por mes, según el Año</small></div>
      <div class="barra-fila"><span>Lo que entró, menos ese costo</span><b class="num">${fmt(x.netoContraCosto)}</b></div>`).join("")}</div>`
    : `<p class="gris">Nada registrado en este trimestre todavía.</p>`;
  if (aj.conceptos.length) h += `<h3>Fijos: lo estimado y lo pagado</h3>` + aj.conceptos.map((c) => `<div class="fila"><span class="txt"><b>${esc(c.nombre)}</b>
      <small class="gris">${esc(c.moneda)} · estimado ${fmt(c.estimado)} (${c.vencen === 1 ? "1 vez" : c.vencen + " veces"} ${fmt(c.monto)}) · pagado ${fmt(c.real)}${c.pagos ? ` en ${c.pagos === 1 ? "1 pago" : c.pagos + " pagos"}` : ""}${c.diferencia ? ` · diferencia ${c.diferencia > 0 ? "+" : ""}${fmt(c.diferencia)}` : ""}</small></span>
      ${c.sugerido != null ? `<button class="mini" data-usar-real="${esc(c.id)}" data-monto="${c.sugerido}">Usar ${fmt(c.sugerido)}</button>` : ""}</div>`).join("");
  if (posibles.length) h += `<h3>Se repiten y no están en el Año</h3><p class="gris">Gastos que aparecen en 3 meses o más de los últimos 6. Si son fijos, sumalos: así el costo de funcionamiento los cuenta.</p>` +
    posibles.map((x, i) => `<div class="fila"><span class="txt"><b>${esc(x.nombre)}</b> <small class="gris">${esc((CATEGORIAS[x.categoria] || {}).nombre || "")} · ${x.meses} meses · ≈ ${fmt(x.porMes)} ${esc(x.moneda)} por mes</small></span>
      <button class="mini" data-sumar-fijo="${i}">Sumar al Año</button></div>`).join("");
  if (aj.faltan.length) h += `<p class="aviso">Falta: ${esc(aj.faltan.join("; "))}.</p>`;
  const ps = personas();
  const cambio = Object.values(conf).some((c) => c && c.firma !== firma);
  h += `<div class="tarjeta"><h3>El ajuste del trimestre</h3>
    ${ps.map((p) => `<p>${conf[p.id] && conf[p.id].firma === firma ? "✓" : "…"} ${esc(p.nombre)}${conf[p.id] ? (conf[p.id].firma === firma ? " lo confirmó" : " lo confirmó antes de un cambio") : " todavía no lo confirmó"}</p>`).join("")}
    ${cambio ? `<p class="aviso">Los números cambiaron después de confirmar. Hay que volver a confirmar.</p>` : ""}
    <div class="botones">${!conf[E.yo.uid] || conf[E.yo.uid].firma !== firma ? `<button class="boton" data-confirmar-trim>Estoy de acuerdo con este trimestre</button>` : ""}
      <button class="mini" data-analisis-trim>📊 Análisis de Claude</button></div></div>`;
  v.insertAdjacentHTML("beforeend", h);
  for (const b of v.querySelectorAll("[data-usar-real]")) b.onclick = () => {
    const id = b.dataset.usarReal, c = (E.conceptos || {})[id]; if (!c) return;
    guardarConcepto(id, { ...c, monto: Number(b.dataset.monto), editadoPor: E.yo.uid }).then(() => aviso("Ajustado en el Año.")).catch(fallo);
  };
  for (const b of v.querySelectorAll("[data-sumar-fijo]")) b.onclick = () => {
    const x = posibles[Number(b.dataset.sumarFijo)]; if (!x) return;
    const d = { nombre: String(x.nombre).slice(0, 80), categoria: x.categoria, monto: x.porMes, moneda: x.moneda, cada: 1, mes: Number(E.hoy.slice(5, 7)), pais: "", total: null, activo: true, editadoPor: E.yo.uid };
    const err = validarConcepto(d);
    if (err.length) return aviso("No se pudo: " + err.join("; ") + ".", true);
    guardarConcepto(idNuevo("g"), d).then(() => aviso(`«${d.nombre}» quedó en el Año: revisá el monto.`)).catch(fallo);
  };
  const ok = v.querySelector("[data-confirmar-trim]");
  if (ok) ok.onclick = () => F.setDoc(F.doc(db, "familia", "cierres"),
    { trimestres: { [trimestre]: { confirmado: { [E.yo.uid]: { firma, en: new Date().toISOString() } } } }, actualizadoEn: F.serverTimestamp() }, { merge: true })
    .then(() => aviso("Confirmado.")).catch(fallo);
  const an = v.querySelector("[data-analisis-trim]");
  if (an) an.onclick = () => {
    an.disabled = true;
    const [m0, , m2] = mesesDelTrimestre(trimestre);
    pedirAnalisis({ pregunta: `Ajuste del trimestre ${NOMBRE_T(trimestre)}: neto, gastos fijos y costo de funcionamiento`, que: "trimestre", desde: m0 + "-01", hasta: m2 + "-31" })
      .then(() => aviso("Pedido. Claude lo analiza y te lo deja en Pizarra.")).catch(fallo);
  };
}
