// ─────────────────────────────────────────────────────────────────────────────
// familia.js — Lo de la casa que ven los dos. Sello: familia-1
//
// HOY    lo cotidiano: desayuno, almuerzo, merienda, cena, la basura, los
//        cuartos, la ropa. Se TILDA, no se cronometra, y cada tilde puede
//        llevar una observación. Queda quién lo hizo. (`dias/{fecha}`)
//
// CHICOS con quién están cada día, en la semana o en el mes, con un señalador
//        chico por persona y por chico. Sale de lo ACORDADO para cada día de
//        la semana (`familia/config.patron`) y de los cambios puntuales
//        (`turnos/{fecha}`), que mandan. Y sus actividades —básquet, kung fu,
//        amigos, la psicóloga—, que las ven LOS DOS siempre, las cargue quien
//        las cargue (`eventos`).
//
// Los nombres de los chicos viven en la base (`familia/config.ninos`), nunca
// en el código: este repositorio es público.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, COTIDIANAS, progresoDia, chicosDelDia, eventosDelDia, grillaDelMes, semanaISO,
         lunesDe, sumarDias, DIAS, MESES, esISO } from "./nucleo.js";
import { E, $, aviso, repintar, nombreDe, personas, ninoPorId, fallo } from "./estado.js";

const fmtDia = (iso) => `${DIAS[new Date(iso + "T12:00").getDay()]} ${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
const COLORES = ["#c89bd8", "#7fb4bf", "#e0a47a", "#8fbf7f", "#d8a657"];

/* ── HOY ──────────────────────────────────────────────────────────────────── */
let dejarDeEscuchar = null;
let dia = { hechos: {}, nota: "" };
const notasAbiertas = new Set();   // la observación se abre con un toque: ocho campos a la vista es ruido

export function escucharDia() {
  if (dejarDeEscuchar) dejarDeEscuchar();
  dia = { hechos: {}, nota: "" };
  dejarDeEscuchar = F.onSnapshot(F.doc(db, "dias", E.diaVisto), (d) => {
    const x = d.exists() ? d.data() : {};
    dia = { hechos: x.hechos || {}, nota: x.nota || "" };
    repintar();
  }, (e) => aviso("No se pudo leer el día: " + (e.code || e.message), true));
}

const guardarDia = (datos) =>
  F.setDoc(F.doc(db, "dias", E.diaVisto), { ...datos, actualizadoEn: F.serverTimestamp() }, { merge: true }).catch(fallo);

export function pintarHoy() {
  const v = $("v-hoy");
  const iso = E.diaVisto;
  const { listos, total } = progresoDia(dia.hechos);
  const chicos = chicosDelDia(iso, E.familia.patron, E.turnos);
  const evs = eventosDelDia(iso, E.eventos);
  const grupo = (g, titulo) => `<h2>${titulo}</h2>` + COTIDIANAS.filter((c) => c.grupo === g).map((c) => {
    const h = dia.hechos[c.id] || {};
    return `<div class="cotidiana${h.hecho === true ? " lista" : ""}">
      <label class="check"><input type="checkbox" data-c="${c.id}"${h.hecho === true ? " checked" : ""}> <b>${esc(c.nombre)}</b>
        ${h.hecho === true ? `<small class="gris">${esc(h.por === E.yo.uid ? "vos" : h.nombre || nombreDe(h.por))}${h.hora ? " · " + esc(h.hora) : ""}</small>` : ""}</label>
        ${h.nota || notasAbiertas.has(c.id) ? "" : `<button class="mini nota" data-abrir-nota="${c.id}">＋ nota</button>`}
      ${h.nota || notasAbiertas.has(c.id) ? `<input class="obs" data-obs="${c.id}" maxlength="300" placeholder="observación" value="${esc(h.nota || "")}">` : ""}</div>`;
  }).join("");
  v.innerHTML = `<div class="nav-semana"><button class="mini" data-d="-1">‹</button><b>${iso === E.hoy ? "Hoy, " : ""}${fmtDia(iso)}</b>
      <button class="mini" data-d="1"${iso >= E.hoy ? " disabled" : ""}>›</button></div>
    <p class="gris">${listos} de ${total} hechas.</p>
    ${Object.keys(chicos).length || evs.length ? `<div class="tarjeta chica">
      ${Object.entries(chicos).map(([u, ns]) => `<div>${esc(u === E.yo.uid ? "Vos" : nombreDe(u))} con ${ns.map((id) => esc((ninoPorId(id) || {}).nombre || "?")).join(" y ")}</div>`).join("")}
      ${evs.map((e) => `<div>👦 ${esc(e.hora || "")} <b>${esc(e.titulo)}</b></div>`).join("")}</div>` : ""}
    <div class="dia-notas">${grupo("comidas", "Comidas")}${grupo("casa", "La casa")}
      <h2>Observaciones del día</h2>
      <textarea id="nota-dia" rows="3" maxlength="2000" placeholder="Lo que quieras dejar registrado">${esc(dia.nota)}</textarea></div>`;
  for (const b of v.querySelectorAll("[data-d]")) b.onclick = () => {
    E.diaVisto = sumarDias(iso, Number(b.dataset.d)); if (E.diaVisto > E.hoy) E.diaVisto = E.hoy;
    escucharDia(); repintar();
  };
  for (const c of v.querySelectorAll("[data-c]")) c.onchange = () => {
    const id = c.dataset.c, antes = dia.hechos[id] || {};
    const hora = new Date().toTimeString().slice(0, 5);
    // Destildar no borra la observación: se escribió por algo.
    guardarDia({ hechos: { [id]: c.checked
      ? { ...antes, hecho: true, por: E.yo.uid, nombre: E.miembro.nombre || "", hora: iso === E.hoy ? hora : "" }
      : (antes.nota ? { nota: antes.nota, hecho: false } : F.deleteField()) } });
  };
  for (const b of v.querySelectorAll("[data-abrir-nota]")) b.onclick = () => {
    notasAbiertas.add(b.dataset.abrirNota); repintar();
    const i = v.querySelector(`[data-obs="${b.dataset.abrirNota}"]`); if (i) i.focus();
  };
  for (const o of v.querySelectorAll("[data-obs]")) o.onchange = () => {
    const id = o.dataset.obs, antes = dia.hechos[id] || {};
    guardarDia({ hechos: { [id]: { ...antes, hecho: antes.hecho === true, nota: o.value.slice(0, 300) } } });
  };
  $("nota-dia").onchange = (ev) => guardarDia({ nota: ev.target.value.slice(0, 2000) });
}

/* ── CHICOS ───────────────────────────────────────────────────────────────── */
let vista = "mes";                 // "semana" | "mes"
let mesVisto = null;               // [año, mes0]
let lunesVisto = null;
let diaElegido = null;
let editandoEvento = null;         // id, "nuevo" o null

export function pintarChicos() {
  const v = $("v-chicos");
  const ninos = E.familia.ninos || [];
  if (!mesVisto) { const d = new Date(); mesVisto = [d.getFullYear(), d.getMonth()]; }
  if (!lunesVisto) lunesVisto = lunesDe(E.hoy);
  let h = `<nav class="solapas chicas"><button data-vc="semana" aria-selected="${vista === "semana"}">Semana</button>
    <button data-vc="mes" aria-selected="${vista === "mes"}">Mes</button></nav>`;
  if (!ninos.length) h += `<p class="aviso">Todavía no están cargados los chicos. Abajo, en «Los chicos».</p>`;
  h += vista === "mes" ? mes() : semana();
  if (diaElegido) h += editorDia(diaElegido);
  h += proximos();
  h += acordado();
  h += listaNinos();
  v.innerHTML = h;
  enganchar(v);
}

const marcas = (iso) => Object.entries(chicosDelDia(iso, E.familia.patron, E.turnos)).map(([u, ns]) =>
  `<span class="marca-p">${esc(nombreDe(u).slice(0, 1))}${ns.map((id) => `<i class="punto" style="--c:${esc((ninoPorId(id) || {}).color || COLORES[0])}"></i>`).join("")}</span>`).join("");

function mes() {
  const [a, m] = mesVisto;
  const semanas = grillaDelMes(a, m);
  return `<div class="nav-semana"><button class="mini" data-m="-1">‹</button><b>${MESES[m]} ${a}</b><button class="mini" data-m="1">›</button></div>
    <div class="mes"><div class="mes-cab">${["L", "M", "M", "J", "V", "S", "D"].map((d) => `<span>${d}</span>`).join("")}</div>
    ${semanas.map((s) => `<div class="mes-fila">${s.map((iso) => {
      const fuera = Number(iso.slice(5, 7)) - 1 !== m;
      const nEv = eventosDelDia(iso, E.eventos).length;
      return `<button class="celda${fuera ? " fuera" : ""}${iso === E.hoy ? " es-hoy" : ""}${iso === diaElegido ? " elegida" : ""}${E.turnos[iso] ? " cambiado" : ""}" data-dia="${iso}">
        <span class="n">${Number(iso.slice(8))}</span><span class="ms">${marcas(iso)}</span>${nEv ? `<span class="ev">${"•".repeat(Math.min(nEv, 3))}</span>` : ""}</button>`;
    }).join("")}</div>`).join("")}</div>
    <p class="gris">Cada letra es quién los tiene; cada punto, qué chico. Los puntos de abajo son actividades. Tocá un día para cambiarlo.</p>`;
}

function semana() {
  const dias = semanaISO(lunesVisto);
  return `<div class="nav-semana"><button class="mini" data-w="-7">‹</button><b>Semana del ${Number(dias[0].slice(8))}/${Number(dias[0].slice(5, 7))}</b><button class="mini" data-w="7">›</button></div>
    ${dias.map((iso) => {
      const ch = chicosDelDia(iso, E.familia.patron, E.turnos);
      return `<button class="dia-chicos${iso === E.hoy ? " es-hoy" : ""}${iso === diaElegido ? " elegida" : ""}" data-dia="${iso}">
        <b>${esc(fmtDia(iso))}</b>${E.turnos[iso] ? ` <small class="gris">· cambiado</small>` : ""}
        <div>${Object.entries(ch).map(([u, ns]) => `${esc(nombreDe(u))}: ${ns.map((id) => `<i class="punto" style="--c:${esc((ninoPorId(id) || {}).color || COLORES[0])}"></i>${esc((ninoPorId(id) || {}).nombre || "?")}`).join(" ")}`).join(" · ") || `<span class="gris">sin nadie asignado</span>`}</div>
        ${eventosDelDia(iso, E.eventos).map((e) => `<div>👦 ${esc(e.hora || "")} ${esc(e.titulo)}</div>`).join("")}</button>`;
    }).join("")}`;
}

/* El día elegido: con quién están ESE día. Cambiarlo deja un turno puntual
   que manda sobre lo acordado; «volver a lo acordado» lo borra. */
function editorDia(iso) {
  const ch = chicosDelDia(iso, E.familia.patron, E.turnos);
  const ninos = E.familia.ninos || [];
  return `<div class="tarjeta chicos-ed"><h3>${esc(fmtDia(iso))}</h3>
    ${personas().map((p) => `<div class="fila-persona"><span>${esc(p.nombre)}</span>${ninos.map((n) =>
      `<label class="check"><input type="checkbox" data-turno="${esc(p.id)}|${esc(n.id)}"${(ch[p.id] || []).includes(n.id) ? " checked" : ""}> ${esc(n.nombre)}</label>`).join("")}</div>`).join("")}
    <div class="botones">${E.turnos[iso] ? `<button class="mini" data-acordado="${iso}">Volver a lo acordado</button>` : ""}
      <button class="mini" data-nuevo-ev="${iso}">＋ Actividad ese día</button><button class="mini" data-cerrar-dia>Cerrar</button></div>
    ${eventosDelDia(iso, E.eventos).map((e) => filaEvento(e, iso)).join("")}</div>`;
}

function filaEvento(e, iso) {
  if (editandoEvento === e.id) return formEvento(e);
  return `<div class="evento"><span>👦 <b>${esc(e.hora || "")}${e.horaFin ? "–" + esc(e.horaFin) : ""}</b> ${esc(e.titulo)}
      <small class="gris">${e.semanal ? "todos los " + DIAS[new Date(e.fecha + "T12:00").getDay()] : ""}
      ${(e.ninos || []).map((id) => esc((ninoPorId(id) || {}).nombre || "")).join(", ")}${(e.quienes || []).length ? " · van " + e.quienes.map((u) => esc(nombreDe(u))).join(" y ") : ""}</small>
      ${e.nota ? `<small>${esc(e.nota)}</small>` : ""}</span>
    <button class="mini" data-ed-ev="${esc(e.id)}">Editar</button>
    ${e.semanal && iso ? `<button class="mini" data-no-hubo="${esc(e.id)}|${iso}">Este día no</button>` : ""}</div>`;
}

function formEvento(e) {
  const ninos = E.familia.ninos || [];
  const x = e || {};
  return `<form class="tarjeta evento-form" data-form-ev="${esc(x.id || "nuevo")}">
    <label>Qué <input name="titulo" maxlength="120" required value="${esc(x.titulo || "")}" placeholder="Básquet, kung fu, psicóloga…"></label>
    <div class="dos"><label>Día <input type="date" name="fecha" required value="${esc(x.fecha || diaElegido || E.hoy)}"></label>
      <label>Desde <input type="time" name="hora" value="${esc(x.hora || "")}"></label>
      <label>Hasta <input type="time" name="horaFin" value="${esc(x.horaFin || "")}"></label></div>
    <label class="check"><input type="checkbox" name="semanal"${x.semanal ? " checked" : ""}> Se repite todas las semanas</label>
    <div class="fila-persona"><span>Chicos</span>${ninos.map((n) => `<label class="check"><input type="checkbox" name="nino" value="${esc(n.id)}"${(x.ninos || []).includes(n.id) ? " checked" : ""}> ${esc(n.nombre)}</label>`).join("")}</div>
    <div class="fila-persona"><span>Van</span>${personas().map((p) => `<label class="check"><input type="checkbox" name="quien" value="${esc(p.id)}"${(x.quienes || []).includes(p.id) ? " checked" : ""}> ${esc(p.nombre)}</label>`).join("")}</div>
    <label>Nota <input name="nota" maxlength="300" value="${esc(x.nota || "")}"></label>
    <div class="botones"><button class="boton">Guardar</button><button type="button" class="mini" data-cancelar-ev>Cancelar</button>
      ${x.id ? `<button type="button" class="mini" data-borrar-ev="${esc(x.id)}">Borrar</button>` : ""}</div></form>`;
}

function proximos() {
  const lista = [];
  for (let i = 0; i < 14; i++) { const iso = sumarDias(E.hoy, i); for (const e of eventosDelDia(iso, E.eventos)) lista.push([iso, e]); }
  return `<h2>Actividades de los chicos — próximas dos semanas</h2>
    ${editandoEvento === "nuevo" ? formEvento(null) : `<button class="mini" data-nuevo-ev="${E.hoy}">＋ Nueva actividad</button>`}
    ${lista.length ? lista.map(([iso, e]) => `<div class="prox"><small class="gris">${esc(fmtDia(iso))}</small>${filaEvento(e, iso)}</div>`).join("")
      : `<p class="gris">No hay actividades cargadas.</p>`}`;
}

/* Lo acordado: para cada día de la semana, con quién están. Es lo que se
   repite solo; un día distinto se cambia arriba, en el calendario. */
function acordado() {
  const ninos = E.familia.ninos || [];
  if (!ninos.length) return "";
  const orden = [1, 2, 3, 4, 5, 6, 0];
  return `<details class="tarjeta"><summary><b>Lo acordado cada semana</b></summary>
    <p class="gris">Esto se repite solo todas las semanas. Un día distinto se cambia tocándolo en el calendario.</p>
    ${orden.map((w) => `<div class="fila-persona"><span class="dia-n">${DIAS[w]}</span>${personas().map((p) =>
      `<span class="quien">${esc(p.nombre.slice(0, 1))}:${ninos.map((n) => `<label class="check"><input type="checkbox" data-patron="${w}|${esc(p.id)}|${esc(n.id)}"${(((E.familia.patron[String(w)] || {})[p.id]) || []).includes(n.id) ? " checked" : ""}>${esc(n.nombre.slice(0, 1))}</label>`).join("")}</span>`).join("")}</div>`).join("")}
  </details>`;
}

function listaNinos() {
  const ninos = E.familia.ninos || [];
  return `<details class="tarjeta"${ninos.length ? "" : " open"}><summary><b>Los chicos</b></summary>
    ${ninos.map((n) => `<div class="fila"><i class="punto grande" style="--c:${esc(n.color)}"></i><span class="txt">${esc(n.nombre)}</span></div>`).join("")}
    <form data-form-nino class="dos chicos-ed"><input name="nombre" maxlength="30" placeholder="Nombre" required><button class="mini">Agregar</button></form></details>`;
}

const guardarConfig = (datos) => F.setDoc(F.doc(db, "familia", "config"), { ...datos, actualizadoEn: F.serverTimestamp() }, { merge: true }).catch(fallo);

function enganchar(v) {
  const todos = (sel, fn) => { for (const el of v.querySelectorAll(sel)) fn(el); };
  todos("[data-vc]", (b) => b.onclick = () => { vista = b.dataset.vc; repintar(); });
  todos("[data-m]", (b) => b.onclick = () => { const [a, m] = mesVisto; const d = new Date(a, m + Number(b.dataset.m), 1); mesVisto = [d.getFullYear(), d.getMonth()]; repintar(); });
  todos("[data-w]", (b) => b.onclick = () => { lunesVisto = sumarDias(lunesVisto, Number(b.dataset.w)); repintar(); });
  todos("[data-dia]", (b) => b.onclick = () => { diaElegido = diaElegido === b.dataset.dia ? null : b.dataset.dia; editandoEvento = null; repintar(); });
  todos("[data-cerrar-dia]", (b) => b.onclick = () => { diaElegido = null; repintar(); });
  todos("[data-turno]", (c) => c.onchange = () => {
    const [uid, nino] = c.dataset.turno.split("|");
    const actual = chicosDelDia(diaElegido, E.familia.patron, E.turnos)[uid] || [];
    const nuevo = c.checked ? [...new Set([...actual, nino])] : actual.filter((x) => x !== nino);
    F.setDoc(F.doc(db, "turnos", diaElegido), { [uid]: nuevo, actualizadoEn: F.serverTimestamp() }, { merge: true }).catch(fallo);
  });
  todos("[data-acordado]", (b) => b.onclick = () => F.deleteDoc(F.doc(db, "turnos", b.dataset.acordado)).catch(fallo));
  todos("[data-patron]", (c) => c.onchange = () => {
    const [w, uid, nino] = c.dataset.patron.split("|");
    const actual = ((E.familia.patron[w] || {})[uid]) || [];
    const nuevo = c.checked ? [...new Set([...actual, nino])] : actual.filter((x) => x !== nino);
    guardarConfig({ patron: { [w]: { [uid]: nuevo } } });
  });
  todos("[data-form-nino]", (f) => f.onsubmit = (ev) => {
    ev.preventDefault();
    const nombre = f.nombre.value.trim(); if (!nombre) return;
    const ninos = E.familia.ninos || [];
    const id = "n" + Date.now().toString(36);
    guardarConfig({ ninos: [...ninos, { id, nombre: nombre.slice(0, 30), color: COLORES[ninos.length % COLORES.length] }] });
  });
  todos("[data-nuevo-ev]", (b) => b.onclick = () => { editandoEvento = "nuevo"; if (b.dataset.nuevoEv !== E.hoy) diaElegido = b.dataset.nuevoEv; repintar(); });
  todos("[data-ed-ev]", (b) => b.onclick = () => { editandoEvento = b.dataset.edEv; repintar(); });
  todos("[data-cancelar-ev]", (b) => b.onclick = () => { editandoEvento = null; repintar(); });
  todos("[data-borrar-ev]", (b) => b.onclick = () => {
    if (!confirm("¿Borrar esta actividad? Si se repite, se borra entera.")) return;
    editandoEvento = null; F.deleteDoc(F.doc(db, "eventos", b.dataset.borrarEv)).catch(fallo);
  });
  todos("[data-no-hubo]", (b) => b.onclick = () => {
    const [id, iso] = b.dataset.noHubo.split("|");
    F.updateDoc(F.doc(db, "eventos", id), { excepto: F.arrayUnion(iso), titulo: (E.eventos.find((e) => e.id === id) || {}).titulo || "" }).catch(fallo);
  });
  todos("[data-form-ev]", (f) => f.onsubmit = async (ev) => {
    ev.preventDefault();
    const id = f.dataset.formEv;
    const datos = {
      titulo: f.titulo.value.trim().slice(0, 120), fecha: f.fecha.value, hora: f.hora.value || "",
      horaFin: f.horaFin.value || "", semanal: f.semanal.checked,
      ninos: [...f.querySelectorAll('[name="nino"]:checked')].map((x) => x.value),
      quienes: [...f.querySelectorAll('[name="quien"]:checked')].map((x) => x.value),
      nota: f.nota.value.slice(0, 300), actualizadoEn: F.serverTimestamp(),
    };
    if (!datos.titulo || !esISO(datos.fecha)) return aviso("Falta qué o qué día.", true);
    try {
      if (id === "nuevo") await F.addDoc(F.collection(db, "eventos"), { ...datos, creadoPor: E.yo.uid, excepto: [], creadoEn: F.serverTimestamp() });
      else await F.updateDoc(F.doc(db, "eventos", id), datos);
      editandoEvento = null; aviso("Guardada. La ven los dos."); repintar();
    } catch (e) { fallo(e); }
  });
}
