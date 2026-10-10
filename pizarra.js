// ─────────────────────────────────────────────────────────────────────────────
// pizarra.js — La primera solapa: anotar, recordar y la pizarra. Sello: pizarra-web-2
//
// app-16 (7-oct-2026, tiempos:V7, pedido de Mauro): «la primera corresponde a
// las anotaciones rápidas con recordatorios, la edición de la pizarra, alarmas
// y actividades; para seleccionar las actividades de la pizarra tiene que ser
// una ventana o menú desplegable por categorías, no una lista fija».
//
// LA PIZARRA es la del teléfono: `pizarra.<uid>` de cada tarea, la misma que
// muestra el widget de la app. Antes sólo la escribía la app (pizarra-2);
// desde acá se escribe con la MISMA forma (`cuerpoFijar` de Logica.kt): un
// mapa uid → true, y sacar es borrar la clave. Tachar es lo mismo que «✔
// Hecha» (`hecho`, `hechoPor`). Si cambia una de las dos formas, cambia la
// otra en la misma tanda.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, arbol, TIPOS, tipoHeredado, colorHeredado, bloquesPorConfirmar, automaticosPendientes,
         enMiPizarra, paraElegirPorCategoria } from "./nucleo.js";
import { E, $, aviso, repintar, personas, fallo } from "./estado.js";
import { tarjetasPropone, CLASES_PROPONE, alertasYDeseos } from "./propone.js";
import { abrirDictado } from "./sugerir.js";

let eligiendo = false;          // la ventana de elegir está abierta
let categoria = "";             // la categoría abierta en esa ventana

const fijar = (id, si) => F.updateDoc(F.doc(db, "tareas", id),
  { ["pizarra." + E.yo.uid]: si ? true : F.deleteField(), actualizadoEn: F.serverTimestamp() });
const tachar = (id, hecho) => F.updateDoc(F.doc(db, "tareas", id),
  hecho ? { hecho: true, hechoPor: E.yo.uid, actualizadoEn: F.serverTimestamp() } : { hecho: false, actualizadoEn: F.serverTimestamp() });

export function pintarPizarra(irA) {
  const v = $("v-pizarra"); v.replaceChildren();
  const caja = (html, clase = "tarjeta") => { const d = document.createElement("div"); d.className = clase; d.innerHTML = html; v.append(d); return d; };

  // 1 · Pedirle a la IA (pizarra-web-2, 10-oct-2026, Mauro: «más neutro el
  // cuadro»): lo que sea que Tiempos registra —un gasto, los chicos, mover o
  // sacar algo de la agenda, una alarma, un deseo, compras—. La IA arma el
  // plan y la persona marca qué va (sugerir.js).
  const an = caja(`<label>✨ Pedile a la IA <textarea id="anotar" rows="3" maxlength="2000" placeholder="Ej.: gasté 850 en la farmacia · el básquet pasa a las 18 · mañana alarma 7:30"></textarea></label>
    <div class="botones"><button class="boton" data-armar>✨ Armar el plan</button></div>
    <small class="gris">Escribí, o dictá con el 🎤 del teclado: un gasto, algo de los chicos, cambiar tu agenda, una alarma, un deseo, una compra. La IA propone y vos marcás qué va.</small>`, "tarjeta ficha");
  an.querySelector("[data-armar]").onclick = () => {
    const t = an.querySelector("#anotar").value.trim();
    if (!t) return aviso("Escribí algo primero.", true);
    an.querySelector("#anotar").value = "";
    abrirDictado(t, null, { precargar: true });
  };

  // 2 · Lo que espera una decisión tuya, con un toque para ir.
  const avisos = [];
  const props = (E.propuestas || []).filter((p) => !CLASES_PROPONE.includes(p.clase)).length;
  if (props) avisos.push([`${props} cosa(s) que propuso el agente, para aprobar`, "plata"]);
  const conf = bloquesPorConfirmar(E.bloques, E.yo.uid, personas().map((p) => p.id)).length;
  if (conf) avisos.push([`${conf} acuerdo(s) de tiempo: ¿se cumplieron?`, "balance"]);
  const autos = automaticosPendientes(E.recurrentes, E.movs, E.hoy).length;
  if (autos) avisos.push([`${autos} pago(s) automático(s) de este mes para confirmar`, "plata"]);
  for (const [t, a] of avisos) {
    const b = Object.assign(document.createElement("button"), { className: "aviso-ir", textContent: t + " →" });
    b.onclick = () => irA(a);
    v.append(b);
  }

  // 3 · La pizarra: lo que va en el widget del teléfono.
  const mias = enMiPizarra(E.tareas, E.yo.uid);
  const { porId } = arbol(E.tareas);
  const piz = caja(`<div class="cab-piz"><h2>📝 Mi pizarra</h2><button class="mini" data-elegir>＋ Elegir</button></div>
    ${mias.length ? mias.map((t) => `<label class="fila-piz${t.hecho ? " hecha" : ""}" style="--c:${esc(colorHeredado(t, porId) || TIPOS[tipoHeredado(t, porId)].color)}">
      <input type="checkbox" data-tachar="${esc(t.id)}" ${t.hecho ? "checked" : ""}> <span>${esc(t.titulo)}</span>
      <button class="mini nota" data-sacar="${esc(t.id)}" title="Sacar de la pizarra">✕</button></label>`).join("")
      : `<p class="gris">Vacía. Tocá «＋ Elegir» y marcá lo que querés tener a la vista.</p>`}`);
  piz.querySelector("[data-elegir]").onclick = () => { eligiendo = true; pintarVentana(); };
  for (const c of piz.querySelectorAll("[data-tachar]")) c.onchange = () => tachar(c.dataset.tachar, c.checked).catch(fallo);
  for (const b of piz.querySelectorAll("[data-sacar]")) b.onclick = (ev) => { ev.preventDefault(); fijar(b.dataset.sacar, false).catch(fallo); };

  // 4 · Lo que Claude propone, los recordatorios, las alarmas y los deseos.
  tarjetasPropone(v);
  alertasYDeseos(v);
  if (eligiendo) pintarVentana();
}

/* La ventana para elegir: las categorías como pestañas, y adentro las tareas
   con su casilla. Tocar una casilla la pone o la saca en el acto. */
function pintarVentana() {
  let h = $("hoja-pizarra");
  if (!eligiendo) { if (h) h.remove(); return; }
  if (!h) { h = Object.assign(document.createElement("div"), { id: "hoja-pizarra", className: "hoja" }); document.body.append(h); }
  const grupos = paraElegirPorCategoria(E.tareas, E.yo.uid);
  const cats = Object.keys(TIPOS).filter((k) => grupos[k]);
  if (!categoria || !grupos[categoria]) categoria = cats[0] || "";
  const lista = grupos[categoria] || [];
  h.innerHTML = `<div class="hoja-caja"><div class="hoja-cab"><b>Elegir para la pizarra</b><button class="mas" data-cerrar aria-label="Cerrar">✕</button></div>
    <nav class="solapas chicas">${cats.map((k) => `<button data-cat="${k}" aria-selected="${k === categoria}">${esc(TIPOS[k].nombre)} <small>${grupos[k].length}</small></button>`).join("")}</nav>
    ${cats.length ? lista.map((t) => `<label class="check fila-elegir"><input type="checkbox" data-fijar="${esc(t.id)}" ${t.pizarra && t.pizarra[E.yo.uid] ? "checked" : ""}> ${esc(t.ruta)}</label>`).join("")
      : `<p class="gris">No hay tareas pendientes. Creá una en «Tareas».</p>`}
    <div class="botones"><button class="boton" data-cerrar>Listo</button></div></div>`;
  h.onclick = (ev) => { if (ev.target === h) cerrar(); };
  for (const b of h.querySelectorAll("[data-cerrar]")) b.onclick = cerrar;
  for (const b of h.querySelectorAll("[data-cat]")) b.onclick = () => { categoria = b.dataset.cat; pintarVentana(); };
  for (const c of h.querySelectorAll("[data-fijar]")) c.onchange = () => fijar(c.dataset.fijar, c.checked).catch((e) => { c.checked = !c.checked; fallo(e); });
}
function cerrar() { eligiendo = false; pintarVentana(); repintar(); }
