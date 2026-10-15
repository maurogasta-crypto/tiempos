// ─────────────────────────────────────────────────────────────────────────────
// proyecto.js — La pantalla de UN proyecto, con todo lo que se le va juntando.
// Sello: proyecto-1
//
// Mauro, 15-oct-2026: «dame una interfaz para los proyectos como el de General
// Flores, donde se pueda visualizar toda la información que se va acumulando,
// en una pantalla por proyecto… como si fuera una app».
//
// Un proyecto es una CUENTA de Plata (General Flores, Santa Fe, la Hilux…).
// Esta pantalla no tiene datos propios salvo dos: lo demás ya existe en
// Tiempos y acá sólo se junta (`fichaDeProyecto` de nucleo.js):
//   · lo que falta y lo hecho (las tareas de su árbol, y las que lo nombran);
//   · lo que viene (la agenda, lo de los chicos y los avisos que lo nombran);
//   · la plata (sus movimientos y líneas de extracto, por moneda);
//   · DOCUMENTOS y BITÁCORA, que sí se escriben acá: `enlaces` y `notas` de la
//     cuenta en `familia/cuentas`, como MAPAS (dos teléfonos no se pisan) y sin
//     regla nueva. La bitácora es para lo que no es ni tarea ni gasto: una
//     charla con un inquilino, un trabajo hecho, un compromiso.
//
// Se abre desde Plata → Proyectos («Abrir ▸»), desde Plata → Cuentas, y desde
// afuera con `?proyecto=<cuenta>` (para tenerlo de acceso directo en el
// teléfono). Es una hoja que tapa la pantalla: «← Volver» la cierra.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, fichaDeProyecto, cuentasDe, CATEGORIAS, idNuevo, pendientesComoMovs } from "./nucleo.js";
import { agendaUnida } from "./agenda.js";
import { E, $, aviso, fallo, nombreDe, ganchos } from "./estado.js";

let abierto = null;                       // id de la cuenta, o null
const borrador = { nota: "", titulo: "", url: "" };
const ICONO = { lugar: "🏠", vehiculo: "🚙", proyecto: "📁" };
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("es", { maximumFractionDigits: 2 });
const DIA = (iso) => { try { return new Date(iso + "T12:00").toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" }); } catch { return iso; } };

/* Lo agendado con día que no es una actividad (tareas y Casa Verde), con su título. */
function piezasConDia() {
  const tareas = Object.fromEntries((E.tareas || []).map((t) => [t.id, t]));
  const cv = Object.fromEntries((E.cvActs || []).map((a) => [a.id, a]));
  return Object.entries(agendaUnida()).map(([k, m]) => ({ ...m, titulo: k.startsWith("f:") ? (tareas[k.slice(2)] || {}).titulo
    : k.startsWith("cv:") ? (cv[k.slice(3)] || {}).titulo : "" })).filter((p) => p.titulo && p.dia);
}

export function abrirProyecto(id) {
  if (!cuentasDe(E.cuentasDoc).some((c) => c.id === id) && E.cuentasDoc) { aviso("Ese proyecto no está en Plata → Cuentas.", true); }
  abierto = id;
  pintarProyecto();
}

/** La llama `pintar()` de app.js: se repinta con los datos nuevos, salvo
    mientras alguien escribe adentro (no se le borra lo que está tipeando). */
export function pintarProyecto() {
  let h = $("hoja-proyecto");
  if (!abierto) { if (h) h.remove(); return; }
  if (h && h.contains(document.activeElement) && document.activeElement.matches("input, textarea")) return;
  const f = fichaDeProyecto({ id: abierto, cuentasDoc: E.cuentasDoc, tareas: E.tareas, movs: [...(E.movs || []), ...pendientesComoMovs(E.extractos)], actividades: E.actividades,
    piezas: piezasConDia(), eventos: E.eventos, ninos: (E.familia && E.familia.ninos) || [], alertas: E.alertas, hoy: E.hoy });
  if (!h) { h = Object.assign(document.createElement("div"), { id: "hoja-proyecto", className: "hoja pantalla" }); document.body.append(h); }
  if (!f) {
    h.innerHTML = `<div class="hoja-caja"><button class="link" data-p-volver>← Volver</button><p class="gris">${E.cuentasDoc ? "No encontré ese proyecto en Plata → Cuentas." : "Cargando…"}</p></div>`;
    h.querySelector("[data-p-volver]").onclick = cerrar;
    return;
  }
  const c = f.cuenta;
  const monedas = Object.entries(f.plata || {});
  h.innerHTML = `<div class="hoja-caja proyecto-caja">
    <div class="hoja-cab"><button class="link" data-p-volver>← Volver</button><small class="gris">${esc(c.pais || "")}</small></div>
    <h1 class="proyecto-titulo">${ICONO[c.clase] || "📁"} ${esc(c.nombre)}</h1>
    ${f.partes.length ? `<p class="gris">Con ${esc(f.partes.map((p) => p.nombre).join(", "))}</p>` : ""}

    <section class="tarjeta"><h3>Lo que falta <small class="gris">${f.pendientes.length}</small></h3>
      ${f.pendientes.length ? f.pendientes.map((t) => `<button type="button" class="fila-elegir boton-fila" data-p-tarea="${esc(t.id)}">○ ${esc(t.titulo)}${t.detalle ? ` <small class="gris">${esc(String(t.detalle).slice(0, 80))}</small>` : ""}</button>`).join("")
        : `<p class="gris">Nada pendiente con este nombre.</p>`}
      <p class="gris chica">Tocá una para abrirla en Tareas. Una tarea nueva para este proyecto se agrega en Tareas, adentro de «${esc(c.nombre)}».</p></section>

    <section class="tarjeta"><h3>Lo que viene <small class="gris">${f.agenda.filter((x) => x.dia >= E.hoy).length}</small></h3>
      ${f.agenda.length || f.avisos.length ? `<ul class="resp-lista">${f.agenda.map((x) => `<li class="${x.dia < E.hoy ? "gris" : ""}"><b>${esc(DIA(x.dia))}</b> ${esc(x.hora || "")}${x.horaFin ? "–" + esc(x.horaFin) : ""} ${esc(x.titulo)}${x.lugar ? ` <small class="gris">· ${esc(x.lugar)}</small>` : ""}</li>`).join("")}
        ${f.avisos.map((a) => `<li>${a.tipo === "alarma" ? "⏰" : "🔔"} <b>${esc(DIA(a.dia))}</b> ${esc(a.hora || "")} ${esc(a.texto || "")}</li>`).join("")}</ul>`
        : `<p class="gris">Nada en la agenda que nombre «${esc(c.nombre)}».</p>`}</section>

    <section class="tarjeta"><h3>La plata <small class="gris">últimos 12 meses</small></h3>
      ${monedas.length ? monedas.map(([m, o]) => `<div class="barra-fila"><span>${esc(m)}</span><span class="txt">entró <b class="num ok">${fmt(o.entro)}</b> · salió <b class="num">${fmt(o.salio)}</b> · queda <b class="num ${o.saldo >= 0 ? "ok" : "mal"}">${fmt(o.saldo)}</b></span></div>`).join("")
        : `<p class="gris">Todavía no hay gastos ni entradas de este proyecto.</p>`}
      ${f.movimientos.length ? `<details><summary class="gris">${f.movimientos.length === 1 ? "el movimiento" : `los ${f.movimientos.length} movimientos`}</summary><ul class="resp-lista">${f.movimientos.map((m) => `<li>${esc(DIA(m.fecha))} · ${esc(fmt(m.monto))} ${esc(m.moneda)} · ${esc((CATEGORIAS[m.categoria] || {}).nombre || m.categoria)}${m.comercio ? " · " + esc(m.comercio) : ""}${m.comprobanteUrl ? ` <a href="${esc(m.comprobanteUrl)}" target="_blank" rel="noopener">📎</a>` : ""}${m.sinRegistrar ? ` <small class="gris">· del extracto, sin registrar</small>` : ""}</li>`).join("")}</ul></details>` : ""}
      <button type="button" class="mini" data-p-gasto>＋ Gasto de ${esc(c.nombre)}</button></section>

    <section class="tarjeta"><h3>Documentos</h3>
      ${f.enlaces.map((e) => `<div class="fila"><a class="txt" href="${esc(e.url)}" target="_blank" rel="noopener">📄 ${esc(e.titulo || e.url)}</a><button type="button" class="mini" data-p-sacar-enlace="${esc(e.id)}" aria-label="Sacar">✕</button></div>`).join("") || `<p class="gris">Ninguno todavía: el borrador de un contrato, un plano, un presupuesto.</p>`}
      <form class="ficha" data-p-enlace>
        <div class="dos"><label>Nombre <input name="titulo" maxlength="80" value="${esc(borrador.titulo)}" placeholder="Bosquejo del contrato"></label>
          <label>Enlace <input name="url" type="url" maxlength="400" value="${esc(borrador.url)}" placeholder="https://…"></label></div>
        <button class="mini">＋ Agregar documento</button></form></section>

    <section class="tarjeta"><h3>Bitácora</h3>
      <form class="ficha" data-p-nota>
        <label>Anotar <textarea name="texto" rows="2" maxlength="1000" placeholder="Una charla con el inquilino, un trabajo, un compromiso, una habilitación…">${esc(borrador.nota)}</textarea></label>
        <button class="boton">Anotar</button></form>
      ${f.notas.map((n) => `<div class="nota-bitacora"><small class="gris">${esc(n.fecha ? DIA(n.fecha.slice(0, 10)) : "")}${n.uid ? " · " + esc(nombreDe(n.uid)) : ""}</small>
        <p>${esc(n.texto)}</p>${n.uid === E.yo.uid ? `<button type="button" class="link chica" data-p-sacar-nota="${esc(n.id)}">sacar</button>` : ""}</div>`).join("")}</section>

    ${f.hechas.length ? `<details class="tarjeta"><summary>Lo hecho <small class="gris">${f.hechas.length}</small></summary><ul class="resp-lista">${f.hechas.map((t) => `<li>✔ ${esc(t.titulo)}</li>`).join("")}</ul></details>` : ""}
  </div>`;

  h.querySelector("[data-p-volver]").onclick = cerrar;
  for (const b of h.querySelectorAll("[data-p-tarea]")) b.onclick = () => { cerrar(); if (ganchos.irATarea) ganchos.irATarea("f:" + b.dataset.pTarea); };
  h.querySelector("[data-p-gasto]").onclick = () => { const id = abierto; cerrar(); if (ganchos.abrirGasto) ganchos.abrirGasto("", id); };
  const fe = h.querySelector("[data-p-enlace]");
  fe.oninput = () => { borrador.titulo = fe.titulo.value; borrador.url = fe.url.value; };
  fe.onsubmit = (ev) => {
    ev.preventDefault();
    const url = fe.url.value.trim(), titulo = fe.titulo.value.trim().slice(0, 80);
    if (!/^https:\/\/\S+$/.test(url)) return aviso("El enlace tiene que empezar con https://", true);
    guardar({ enlaces: { [idNuevo("e")]: { titulo: titulo || url.slice(0, 80), url: url.slice(0, 400), uid: E.yo.uid, fecha: E.hoy } } })
      .then(() => { borrador.titulo = borrador.url = ""; aviso("Documento agregado."); }).catch(fallo);
  };
  const fn = h.querySelector("[data-p-nota]");
  fn.oninput = () => { borrador.nota = fn.texto.value; };
  fn.onsubmit = (ev) => {
    ev.preventDefault();
    const texto = fn.texto.value.trim().slice(0, 1000);
    if (!texto) return aviso("Escribí qué pasó.", true);
    fn.texto.blur();
    guardar({ notas: { [idNuevo("n")]: { texto, uid: E.yo.uid, fecha: new Date().toISOString() } } })
      .then(() => { borrador.nota = ""; aviso("Anotado."); }).catch(fallo);
  };
  for (const b of h.querySelectorAll("[data-p-sacar-enlace]")) b.onclick = () => {
    if (confirm("¿Sacar este documento de la lista? (El documento en sí no se borra.)")) guardar({ enlaces: { [b.dataset.pSacarEnlace]: F.deleteField() } }).catch(fallo);
  };
  for (const b of h.querySelectorAll("[data-p-sacar-nota]")) b.onclick = () => {
    if (confirm("¿Sacar esta nota de la bitácora?")) guardar({ notas: { [b.dataset.pSacarNota]: F.deleteField() } }).catch(fallo);
  };
}

function cerrar() { abierto = null; pintarProyecto(); }

/* Sólo los campos de ESTA cuenta, con merge: lo demás de `familia/cuentas`
   —y lo que el otro teléfono agregó en el medio— queda como está. */
function guardar(campos) {
  return F.setDoc(F.doc(db, "familia", "cuentas"), { cuentas: { [abierto]: campos }, actualizadoEn: F.serverTimestamp() }, { merge: true })
    .then(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); pintarProyecto(); });
}

export const proyectoAbierto = () => abierto;
export const esCuentaValida = (id) => typeof id === "string" && /^[\w-]{1,60}$/.test(id);
