// ─────────────────────────────────────────────────────────────────────────────
// propone.js — Lo que Claude propone para TU agenda, en Pizarra (desde app-16). Sello: propone-5
//
// 5-oct-2026, pedido de Mauro: que lo dictado (o la captura de un flyer)
// vuelva «en la misma interfaz, para que el usuario dé ok». Claude lo
// interpreta en la consulta en vivo y deja en `propuestas/` una por persona:
//
//   · clase "agenda"  → una actividad para la agenda de ESA persona
//                       (datos.para = su uid). Aceptar la escribe con la
//                       sesión de esa persona —la agenda es de cada uno y la
//                       escribe su dueño— y suma su marca de tiempo, igual que
//                       cargarla a mano en Agenda.
//   · clase "consulta"→ una pregunta para quien queda LIBRE mientras el otro
//                       hace algo («Mauro lleva a los chicos el jueves de 15 a
//                       18: ¿qué tenés pensado para ese rato?»). Se contesta
//                       acá, y la respuesta vuelve a Claude como un pedido más.
//
// Las de los chicos (`evento`), las tareas y la plata siguen en Plata, como
// antes: son de los dos y no de una agenda.
//
// Lo dictado es espontáneo y el teléfono a veces entiende mal: por eso la
// tarjeta se puede CORREGIR antes de aceptar, muestra lo que se dijo tal cual
// y las dudas que tuvo la IA.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, CLASES_ACTIVIDAD, MODOS_AGENDA, actividadDePropuesta, paraMi, marcasQueSePisan, idNuevo } from "./nucleo.js";
import { E, aviso, repintar, fallo } from "./estado.js";
import { mandarReporte } from "./sugerir.js";
import { htmlPosibles, pintarDeseos, enganchar } from "./deseos.js";

export const CLASES_PROPONE = ["agenda", "consulta"];
const editando = {};          // id de propuesta → campos corregidos

export const mias = () => (E.propuestas || []).filter((p) =>
  p.estado === "pendiente" && CLASES_PROPONE.includes(p.clase) && paraMi(p, E.yo && E.yo.uid));

const fechaLinda = (iso) => {
  try { return new Date(iso + "T12:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }); }
  catch (e) { return iso; }
};

function tarjetaAgenda(p) {
  const d = { ...(p.datos || {}), ...(editando[p.id] || {}) };
  const quien = p.creadoPara || "";
  return `<form class="tarjeta ficha prop propone" data-prop-agenda="${esc(p.id)}">
    <p class="gris">✨ Claude propone${p.fuente === "captura" ? " (de una captura)" : p.fuente === "dictado" ? " (de lo que dictaste)" : ""}${d.modo && MODOS_AGENDA[d.modo] ? " · " + esc(MODOS_AGENDA[d.modo]) : ""}</p>
    ${d.imagen ? `<a href="${esc(d.imagen)}" target="_blank" rel="noopener"><img class="flyer" src="${esc(d.imagen)}" alt="La captura"></a>` : ""}
    <label>Qué <input name="titulo" maxlength="120" value="${esc(d.titulo || "")}"></label>
    <div class="dos"><label>Día <input name="dia" type="date" value="${esc(d.dia || "")}"></label>
      <label>Lugar <input name="lugar" maxlength="120" value="${esc(d.lugar || "")}"></label></div>
    <div class="dos"><label>Desde <input name="hi" type="time" value="${esc(d.hi || "")}"></label>
      <label>Hasta <input name="hf" type="time" value="${esc(d.hf || "")}"></label></div>
    <div class="tira-clase">${Object.entries(CLASES_ACTIVIDAD).map(([k, c]) =>
      `<label class="check"><input type="radio" name="tipo" value="${k}"${d.tipo === k ? " checked" : ""}> ${esc(c.nombre)}</label>`).join("")}</div>
    <label class="check"><input type="checkbox" name="recordar"${d.recordar ? " checked" : ""}> Recordármelo ese día por WhatsApp (si encendiste «Avisos de Claude»)</label>
    ${d.conQuien ? `<p class="gris">${esc(d.conQuien)}</p>` : ""}
    ${p.resumen ? `<p class="gris">Entendí: «${esc(p.resumen)}»</p>` : ""}
    ${p.textoOriginal ? `<details><summary class="gris">Lo que se dijo</summary><p class="gris">${esc(p.textoOriginal)}</p></details>` : ""}
    ${(p.dudas || []).length ? `<p class="aviso">No estoy seguro de: ${p.dudas.map(esc).join(", ")}. Revisalo antes de aceptar.</p>` : ""}
    ${quien ? `<p class="gris">${esc(quien)}</p>` : ""}
    <div class="botones"><button class="boton">Aceptar</button><button type="button" class="mini" data-prop-no="${esc(p.id)}">No</button></div>
  </form>`;
}

function tarjetaConsulta(p) {
  const d = p.datos || {};
  return `<form class="tarjeta ficha prop propone" data-prop-consulta="${esc(p.id)}">
    <p class="gris">✨ Claude pregunta</p>
    <p><b>${esc(d.pregunta || "")}</b></p>
    ${d.sugerencia ? `<p class="gris">Una idea: ${esc(d.sugerencia)}</p>` : ""}
    <label>Tu respuesta <textarea name="respuesta" rows="2" maxlength="600" placeholder="Voy a aprovechar para…"></textarea></label>
    <div class="botones"><button class="boton">Responder</button><button type="button" class="mini" data-prop-no="${esc(p.id)}">Ahora no</button></div>
  </form>`;
}

/* Lo que se agrega a Pizarra (antes, Ahora). Nada si no hay propuestas para vos. */
export function tarjetasPropone(v) {
  const ps = mias();
  if (!ps.length) return;
  const caja = document.createElement("div");
  caja.innerHTML = `<h2>Claude propone (${ps.length})</h2>` + ps.map((p) => p.clase === "consulta" ? tarjetaConsulta(p) : tarjetaAgenda(p)).join("");
  v.append(caja);
  for (const f of caja.querySelectorAll("[data-prop-agenda]")) {
    f.oninput = () => { editando[f.dataset.propAgenda] = leer(f); };
    f.onsubmit = (ev) => { ev.preventDefault(); aceptarAgenda(f.dataset.propAgenda, leer(f)).catch(fallo); };
  }
  for (const f of caja.querySelectorAll("[data-prop-consulta]")) {
    f.onsubmit = (ev) => { ev.preventDefault(); responder(f.dataset.propConsulta, f.respuesta.value.trim()).catch(fallo); };
  }
  for (const b of caja.querySelectorAll("[data-prop-no]")) b.onclick = () => decidir(b.dataset.propNo, "descartada").then(() => aviso("Listo, no se agregó.")).catch(fallo);
}

const leer = (f) => ({ titulo: f.titulo.value.trim(), dia: f.dia.value, lugar: f.lugar.value.trim(), hi: f.hi.value, hf: f.hf.value,
  tipo: (f.querySelector('[name="tipo"]:checked') || {}).value || "", recordar: f.recordar.checked });

async function decidir(id, estado, resultadoId = null) {
  delete editando[id];
  await F.updateDoc(F.doc(db, "propuestas", id), { estado, decididoPor: E.yo.uid, decididoEn: F.serverTimestamp(), resultadoId });
}

/* Aceptar = lo mismo que cargarla a mano en Agenda: la marca (sin título) y la
   actividad en MI agenda, con el mismo id. */
/* Agendar en MI agenda: lo usa aceptar una propuesta y también la tarjeta que
   precarga Gemini al dictar (sugerir.js). Devuelve el id, o null si no se pudo. */
export async function agendarMio(datos, extra = {}) {
  const r = actividadDePropuesta(datos, E.yo.uid);
  if (!r.ok) { aviso("Antes de agendar: " + r.motivos.join(", ") + ".", true); return null; }
  const ya = marcasQueSePisan(r.marca, E.marcas);
  if (ya.length && !confirm(`Ya tenés ${ya.length} cosa(s) en ese horario. En el balance ese rato cuenta una sola vez. ¿Agendar igual?`)) return null;
  const nuevo = idNuevo("a");
  await F.setDoc(F.doc(db, "marcas", nuevo), { ...r.marca, creadoEn: F.serverTimestamp() });
  await F.setDoc(F.doc(db, "agendas", E.yo.uid), { actividades: { [nuevo]: { ...r.actividad, ...extra } },
    actualizadoEn: F.serverTimestamp() }, { merge: true });
  aviso(r.supuesto ? "Agendado. No decía hasta qué hora: puse una hora, corregila en Agenda si hace falta." : "Agendado.");
  return nuevo;
}

async function aceptarAgenda(id, corregido) {
  const p = (E.propuestas || []).find((x) => x.id === id); if (!p) return;
  const nuevo = await agendarMio({ ...(p.datos || {}), ...corregido }, { propuesta: id });
  if (!nuevo) return;
  await decidir(id, "aprobada", nuevo);
  repintar();
}

/* La respuesta vuelve a Claude como un pedido: así la lee en vivo o en la ronda. */
async function responder(id, texto) {
  if (!texto) return aviso("Escribí algo, o tocá «Ahora no».", true);
  const p = (E.propuestas || []).find((x) => x.id === id); if (!p) return;
  await mandarReporte({ texto: `Respuesta a «${String((p.datos || {}).pregunta || "").slice(0, 200)}»: ${texto}`, agenda: true, respondeA: id });
  await decidir(id, "aprobada");
  aviso("Respondido.");
  repintar();
}

/* ── propone-3 (app-13): lo que te recordás hoy y la lista de deseos ─────────
   Las alertas son de cada uno: un recordatorio (aviso ese día) o una alarma
   (con hora; suena en la APK cuando exista, y mientras tanto llega por
   WhatsApp en la ronda). Los deseos los ven los dos: lo que uno quisiera
   hacer, o que hagan los chicos, hasta que se acuerda y se agenda. */
const nombreMiembro = (uid) => ((E.miembros || []).find((m) => m.id === uid) || {}).nombre || "el otro";
export function alertasYDeseos(v) {
  const hoy = (E.alertas || []).filter((a) => a.dia === E.hoy).sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
  const proximas = (E.alertas || []).filter((a) => a.dia > E.hoy).length;
  if (hoy.length || proximas) {
    const c = document.createElement("div");
    c.innerHTML = `<h2>Te recordás</h2><div class="tarjeta chica">${hoy.map((a) =>
      `<div class="fila"><span class="txt">${a.tipo === "alarma" ? "⏰" : "🔔"} hoy ${esc(a.hora || "")} <b>${esc(a.texto)}</b></span>
       <button class="mini" data-alerta-borrar="${esc(a.id)}">Listo</button></div>`).join("")}
      ${proximas ? `<small class="gris">${hoy.length ? "y " : ""}${proximas} para los próximos días</small>` : ""}</div>`;
    v.append(c);
    for (const b of c.querySelectorAll("[data-alerta-borrar]"))
      b.onclick = () => F.deleteDoc(F.doc(db, "alertas", b.dataset.alertaBorrar)).catch(fallo);
  }
  // Los deseos tienen su módulo desde deseos-1: lo de hoy arriba, la lista
  // entera para editar abajo.
  const hoyDeseos = htmlPosibles(E.hoy, "⭐ Hoy se puede");
  if (hoyDeseos) { const c = document.createElement("div"); c.innerHTML = hoyDeseos; v.append(c); enganchar(c); }
  pintarDeseos(v);
}
