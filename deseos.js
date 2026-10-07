// ─────────────────────────────────────────────────────────────────────────────
// deseos.js — Lo que nos gustaría hacer, y lo que se puede hacer hoy. Sello: deseos-2
//
// Pedido de Mauro, 5-oct-2026: «Cuando lo que se guarda es un flyer de una
// actividad de frecuencia semanal, que quede registrado que es algo con
// frecuencia, y cuando yo quiera saber qué se puede hacer el día de hoy ya
// tenga esa información, además de las especiales con una fecha exclusiva. Y
// que esas actividades recurrentes que me gustan puedan ser editables si
// tienen modificaciones, en una lista con un acceso muy fácil para la
// edición, y eventualmente cambiar el flyer.»
//
// Un deseo vive en `deseos/` (reglas v10): lo ven y lo editan los dos; lo
// crea y lo borra su dueño. `dias` (0 = domingo) si es semanal, `fecha` si es
// una vez. Las cuentas están en nucleo.js (posiblesDelDia, textoFrecuencia).
//
// La edición se dibuja adentro de la lista y la app se repinta con cada cambio
// de la base: por eso lo que se está escribiendo vive en `borrador` y se
// vuelve a poner en el formulario en cada pintada. Si no, un cambio del otro
// teléfono borraría lo que uno está tipeando.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F, CV } from "./firebase-init.js";
import { esc, DIAS, PARA_DESEO, posiblesDelDia, textoFrecuencia, frecuenciaDeseo, esISO } from "./nucleo.js";
import { E, aviso, repintar, fallo } from "./estado.js";
import { abrirDictado } from "./sugerir.js";

let borrador = null;          // { id ("" = uno nuevo), titulo, detalle, lugar, para, cual, dias, fecha, hi, hf, archivo, sacarFlyer }
let verTodos = false;
let guardando = false;

const nombreMiembro = (uid) => ((E.miembros || []).find((m) => m.id === uid) || {}).nombre || "el otro";
const deQuien = (d) => d.uid === E.yo.uid ? "tuyo" : "de " + nombreMiembro(d.uid);
const PARA_TXT = { yo: "", chicos: "para los chicos", familia: "familia" };

/* «Hoy se puede»: lo de ese día, semanal o de fecha única. */
export function htmlPosibles(iso, titulo) {
  const ps = posiblesDelDia(E.deseos, iso);
  if (!ps.length) return "";
  return `<h2>${esc(titulo)}</h2><div class="tarjeta chica posibles">${ps.map((d) => `<div class="fila">
    ${d.imagen ? `<a href="${esc(d.imagen)}" target="_blank" rel="noopener"><img class="flyer mini-flyer" src="${esc(d.imagen)}" alt=""></a>` : "<span>⭐</span>"}
    <span class="txt">${d.hi ? `<b>${esc(d.hi)}${d.hf ? "–" + esc(d.hf) : ""}</b> ` : ""}${esc(d.titulo)}
      <small class="gris">${esc([d.lugar, d.fecha ? "sólo ese día" : "cada semana", PARA_TXT[d.para] || ""].filter(Boolean).join(" · "))}</small></span>
    <button class="mini" data-deseo-editar="${esc(d.id)}" title="Editar">✏️</button></div>`).join("")}</div>`;
}

function empezar(d) {
  borrador = d ? { id: d.id, titulo: d.titulo || "", detalle: d.detalle || "", lugar: d.lugar || "", para: d.para || "yo",
    cual: d.fecha ? "fecha" : (d.dias || []).length ? "semana" : "nada", dias: [...(d.dias || [])], fecha: d.fecha || "",
    hi: d.hi || "", hf: d.hf || "", cuando: d.cuando || "", archivo: null, sacarFlyer: false, imagen: d.imagen || "" }
    : { id: "", titulo: "", detalle: "", lugar: "", para: "yo", cual: "semana", dias: [], fecha: "", hi: "", hf: "", cuando: "",
      archivo: null, sacarFlyer: false, imagen: "" };
}

function htmlFormulario(b) {
  const sel = (v, x) => (v === x ? " selected" : "");
  return `<form class="tarjeta ficha editar-deseo" data-form-deseo>
    <h3>${b.id ? "Editar" : "Agregar a mano"}</h3>
    <label>Qué<input name="titulo" maxlength="120" required value="${esc(b.titulo)}"></label>
    <label>Dónde<input name="lugar" maxlength="120" value="${esc(b.lugar)}"></label>
    <label>Para<select name="para">${PARA_DESEO.map((p) => `<option value="${p}"${sel(b.para, p)}>${p === "yo" ? "mí" : p === "chicos" ? "los chicos" : "la familia"}</option>`).join("")}</select></label>
    <div class="botones tira-clase">
      <label class="check"><input type="radio" name="cual" value="semana"${b.cual === "semana" ? " checked" : ""}> Cada semana</label>
      <label class="check"><input type="radio" name="cual" value="fecha"${b.cual === "fecha" ? " checked" : ""}> Una fecha</label>
      <label class="check"><input type="radio" name="cual" value="nada"${b.cual === "nada" ? " checked" : ""}> Sin fecha</label></div>
    ${b.cual === "semana" ? `<div class="botones dias-semana">${[1, 2, 3, 4, 5, 6, 0].map((i) =>
      `<label class="check"><input type="checkbox" name="dia" value="${i}"${b.dias.includes(i) ? " checked" : ""}> ${DIAS[i].slice(0, 3)}</label>`).join("")}</div>` : ""}
    ${b.cual === "fecha" ? `<label>Fecha<input type="date" name="fecha" value="${esc(b.fecha)}"></label>` : ""}
    ${b.cual !== "nada" ? `<div class="dos"><label>Desde<input type="time" name="hi" value="${esc(b.hi)}"></label><label>Hasta<input type="time" name="hf" value="${esc(b.hf)}"></label></div>`
      : `<label>Cuándo, en palabras<input name="cuando" maxlength="120" value="${esc(b.cuando)}"></label>`}
    <label>Detalle<textarea name="detalle" rows="2" maxlength="400">${esc(b.detalle)}</textarea></label>
    <div class="botones">
      ${b.imagen && !b.sacarFlyer && !b.archivo ? `<img class="flyer mini-flyer" src="${esc(b.imagen)}" alt="">` : ""}
      ${b.archivo ? `<small class="gris">Flyer nuevo: ${esc(b.archivo.name || "foto")} (se sube al guardar)</small>` : ""}
      <label class="mini boton-archivo">📷 Sacar foto<input type="file" accept="image/*" capture="environment" data-flyer-deseo hidden></label>
      <label class="mini boton-archivo">🖼 ${b.imagen || b.archivo ? "Cambiar el flyer" : "Elegir flyer"}<input type="file" accept="image/*" data-flyer-deseo hidden></label>
      ${(b.imagen || b.archivo) && !b.sacarFlyer ? `<button type="button" class="mini" data-sacar-flyer>Sacar el flyer</button>` : ""}</div>
    <div class="botones"><button class="boton"${guardando ? " disabled" : ""}>${guardando ? "Guardando…" : "Guardar"}</button>
      <button type="button" class="mini" data-cancelar-deseo>Cancelar</button>
      ${b.id && ((E.deseos || []).find((d) => d.id === b.id) || {}).uid === E.yo.uid ? `<button type="button" class="mini" data-borrar-deseo>Borrar</button>` : ""}</div>
  </form>`;
}

function leerFormulario(f) {
  borrador.titulo = f.titulo.value; borrador.lugar = f.lugar.value; borrador.para = f.para.value; borrador.detalle = f.detalle.value;
  borrador.cual = (f.querySelector("[name=cual]:checked") || {}).value || "nada";
  if (f.querySelector("[name=dia]")) borrador.dias = [...f.querySelectorAll("[name=dia]:checked")].map((c) => Number(c.value));
  if (f.fecha) borrador.fecha = f.fecha.value;
  if (f.hi) { borrador.hi = f.hi.value; borrador.hf = f.hf.value; }
  if (f.cuando) borrador.cuando = f.cuando.value;
}

async function guardar() {
  const b = borrador;
  if (!b.titulo.trim()) return aviso("Falta qué es.", true);
  if (b.cual === "semana" && !b.dias.length) return aviso("Marcá qué días de la semana.", true);
  if (b.cual === "fecha" && !esISO(b.fecha)) return aviso("Falta la fecha.", true);
  guardando = true; repintar();
  try {
    // El flyer se sube al GUARDAR, nunca al elegirlo (como las boletas).
    let imagen = b.sacarFlyer ? "" : b.imagen;
    if (b.archivo) imagen = await CV.CV2.subirImagen(b.archivo, "tiempos");
    const fr = frecuenciaDeseo({ dias: b.cual === "semana" ? b.dias : [], fecha: b.cual === "fecha" ? b.fecha : "",
      hi: b.cual === "nada" ? "" : b.hi, hf: b.cual === "nada" ? "" : b.hf });
    const datos = { titulo: b.titulo.trim().slice(0, 120), lugar: b.lugar.trim().slice(0, 120), para: b.para,
      detalle: b.detalle.trim().slice(0, 400), cuando: b.cual === "nada" ? b.cuando.trim().slice(0, 120) : "", imagen, ...fr,
      editadoPor: E.yo.uid, editadoEn: F.serverTimestamp() };
    if (b.id) await F.updateDoc(F.doc(db, "deseos", b.id), datos);
    else await F.addDoc(F.collection(db, "deseos"), { ...datos, uid: E.yo.uid, estado: "deseo", creadoEn: F.serverTimestamp() });
    borrador = null; aviso("Guardado.");
  } catch (e) { fallo(e); }
  guardando = false; repintar();
}

/* La lista entera, para editar: arriba lo que espera acordarse, después lo
   que ya está (lo semanal que les gusta), y lo descartado no aparece. */
export function pintarDeseos(v) {
  const todos = (E.deseos || []).filter((d) => d.estado !== "descartado")
    .sort((a, b) => Number(a.estado === "agendado") - Number(b.estado === "agendado") || String(a.titulo).localeCompare(String(b.titulo)));
  const c = document.createElement("div");
  const muestra = verTodos ? todos : todos.slice(0, 4);
  c.innerHTML = `<h2>⭐ Deseos y actividades que nos gustan (${todos.length})</h2>
    ${borrador && !borrador.id ? htmlFormulario(borrador) : ""}
    ${muestra.map((d) => borrador && borrador.id === d.id ? htmlFormulario(borrador) : `<div class="tarjeta chica deseo">
      <div class="fila">${d.imagen ? `<a href="${esc(d.imagen)}" target="_blank" rel="noopener"><img class="flyer mini-flyer" src="${esc(d.imagen)}" alt=""></a>` : ""}
        <span class="txt"><b>${esc(d.titulo)}</b>
          <small class="gris">${esc([textoFrecuencia(d), d.lugar, PARA_TXT[d.para] || "", deQuien(d), d.estado === "coordinando" ? "coordinando" : d.estado === "agendado" ? "agendado" : ""].filter(Boolean).join(" · "))}</small></span>
        <button class="mini" data-deseo-editar="${esc(d.id)}" title="Editar">✏️</button></div>
      ${d.uid === E.yo.uid && d.estado !== "agendado" ? `<div class="botones"><button class="mini" data-deseo-agendar="${esc(d.id)}">Ya lo acordamos: agendar</button><button class="mini" data-deseo-no="${esc(d.id)}">Ya no</button></div>` : ""}
    </div>`).join("")}
    <div class="botones">${todos.length > 4 ? `<button class="mini" data-ver-deseos>${verTodos ? "Ver menos" : `Ver los ${todos.length}`}</button>` : ""}
      ${borrador ? "" : `<button class="mini" data-nuevo-deseo>＋ Agregar a mano</button>`}</div>`;
  v.append(c);
  enganchar(c);
}

/* Los botones de las dos listas (la de hoy y la entera). */
export function enganchar(c) {
  const todos = (sel, fn) => { for (const el of c.querySelectorAll(sel)) fn(el); };
  todos("[data-deseo-editar]", (b) => b.onclick = () => {
    const d = (E.deseos || []).find((x) => x.id === b.dataset.deseoEditar); if (!d) return;
    empezar(d); verTodos = true;
    // Se edita en la lista de Pizarra (app-16): desde Hoy, se va ahí.
    const ir = document.querySelector('[data-solapa="pizarra"]');
    if (E.solapa !== "pizarra" && ir) ir.click(); else repintar();
    setTimeout(() => { const f = document.querySelector("[data-form-deseo]"); if (f) f.scrollIntoView({ block: "center" }); }, 50);
  });
  todos("[data-nuevo-deseo]", (b) => b.onclick = () => { empezar(null); repintar(); });
  todos("[data-ver-deseos]", (b) => b.onclick = () => { verTodos = !verTodos; repintar(); });
  todos("[data-deseo-no]", (b) => b.onclick = () => F.updateDoc(F.doc(db, "deseos", b.dataset.deseoNo), { estado: "descartado" }).catch(fallo));
  todos("[data-deseo-agendar]", (b) => b.onclick = () => {
    const d = (E.deseos || []).find((x) => x.id === b.dataset.deseoAgendar); if (!d) return;
    // Se agenda dictando CUÁNDO: el globo abre con el deseo ya escrito. Al
    // agendarse, el deseo pasa a «agendado» (sugerir.js).
    abrirDictado(`Agendar «${d.titulo}»${d.lugar ? " en " + d.lugar : ""}${textoFrecuencia(d) ? " (" + textoFrecuencia(d) + ")" : ""}: `, d.id);
  });
  const f = c.querySelector("[data-form-deseo]");
  if (!f) return;
  f.oninput = () => leerFormulario(f);
  // Cambiar «cada semana / una fecha / sin fecha» cambia los campos.
  for (const r of f.querySelectorAll("[name=cual]")) r.onchange = () => { leerFormulario(f); repintar(); };
  for (const i of f.querySelectorAll("[data-flyer-deseo]")) i.onchange = () => {
    leerFormulario(f);
    if (i.files && i.files[0]) { borrador.archivo = i.files[0]; borrador.sacarFlyer = false; }
    repintar();
  };
  const sacar = f.querySelector("[data-sacar-flyer]");
  if (sacar) sacar.onclick = () => { leerFormulario(f); borrador.archivo = null; borrador.sacarFlyer = true; repintar(); };
  f.querySelector("[data-cancelar-deseo]").onclick = () => { borrador = null; repintar(); };
  const borrar = f.querySelector("[data-borrar-deseo]");
  if (borrar) borrar.onclick = () => {
    if (!confirm("¿Borrar este deseo? Si sólo cambió, mejor editalo.")) return;
    F.deleteDoc(F.doc(db, "deseos", borrador.id)).then(() => { borrador = null; repintar(); }).catch(fallo);
  };
  f.onsubmit = (ev) => { ev.preventDefault(); leerFormulario(f); guardar(); };
}
