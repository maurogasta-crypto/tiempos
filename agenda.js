// ─────────────────────────────────────────────────────────────────────────────
// agenda.js — Mi semana, ordenada arrastrando. Sello: agenda-3
//
// La tomamos de la agenda de Casa Verde (`interno/agenda.html`), con sus
// mismas decisiones:
//   · La lista de tareas es de los dos; la agenda es de CADA UNO. Mover algo
//     al jueves no le cambia nada al otro.
//   · Estar en el mapa es «está en mi agenda». Sin día FLOTA en hoy, hasta
//     que se le da uno (ver `ubicarEnSemana` en nucleo.js).
//   · Se arrastra con un AGARRE (⠿) de 44 px, con eventos de puntero: la API
//     de arrastrar del navegador no existe en el teléfono, y la pastilla
//     entera tiene que seguir abriéndose de un toque.
//
// ── DOS LUGARES, UNA AGENDA ──────────────────────────────────────────────────
// · Las tareas de la familia van a `agendas/{uid}` de ESTA base («f:<id>»).
// · Las de Casa Verde van a `estado_usuario/{uid}.agenda` de CASA VERDE, con
//   la misma forma que usa su agenda. Así lo que se ordena acá se ve igual en
//   la agenda de Casa Verde, y al revés. Casa Verde tiene sólo mañana y
//   tarde: una suya soltada en «noche» queda en la tarde.
//
// Las actividades con los chicos (`eventos`) y los acuerdos de tiempo
// (`bloques`) aparecen en la agenda de los DOS, siempre, y no se arrastran.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F, CV } from "./firebase-init.js";
import { esc, lunesDe, sumarDias, semanaISO, ubicarEnSemana, chicosDelDia, eventosDelDia,
         DIAS, FRANJAS, esISO, TIPOS, tipoHeredado, arbol, colorHeredado,
         CLASES_ACTIVIDAD, validarMarca, marcasQueSePisan, idNuevo } from "./nucleo.js";
import { E, $, aviso, repintar, nombreDe, ninoPorId, fallo } from "./estado.js";
import { bloquesDelDia } from "./balance.js";

const NOMBRE_FRANJA = { manana: "mañana", tarde: "tarde", noche: "noche" };
let lunes = null;
let editando = null;
let formActividad = false;

/* ── Las actividades propias de la agenda (agenda-3, 30-sep-2026) ────────────
   «En la agenda, cuando marco una actividad, tengo que tener marcado sí o sí
   si es trabajo, tarea, personal o actividad con los chicos.» La actividad
   —con su título— queda en MI agenda, que el otro no ve; al balance va sólo
   su MARCA (de quién, qué clase, de cuándo a cuándo), con el mismo id. */
const COLOR_ACT = { trabajo: "#d8a657", tarea: "#7fb4bf", personal: "#a8a49c", ninos: "#c89bd8" };
async function guardarActividad(f) {
  const tipo = (f.querySelector('[name="tipo"]:checked') || {}).value;
  if (!CLASES_ACTIVIDAD[tipo]) return aviso("Elegí qué es: trabajo, tarea, personal o con los chicos.", true);
  const titulo = f.titulo.value.trim(), dia = f.dia.value, hi = f.hi.value, hf = f.hf.value;
  if (!titulo || !esISO(dia) || !hi || !hf) return aviso("Falta qué, qué día o el horario.", true);
  // Si termina «antes» de empezar, cruzó la medianoche: una salida de 21 a 1.
  const desde = `${dia}T${hi}`, hasta = `${hf <= hi ? sumarDias(dia, 1) : dia}T${hf}`;
  const marca = { uid: E.yo.uid, clase: CLASES_ACTIVIDAD[tipo].clase, desde, hasta, origen: "agenda", marcadoPor: E.yo.uid };
  const mal = validarMarca(marca, [E.yo.uid]);
  if (mal.length) return aviso("No se pudo: " + mal.join(", ") + ".", true);
  const ya = marcasQueSePisan(marca, E.marcas);
  if (ya.length && !confirm(`Ya hay ${ya.length} marca(s) tuya(s) en ese horario (${ya.map((m) => m.origen === "agenda" ? "de tu agenda" : "puesta por " + nombreDe(m.marcadoPor)).join(", ")}). En el balance ese rato cuenta una sola vez. ¿Guardar igual?`)) return;
  const id = idNuevo("a");
  try {
    await F.setDoc(F.doc(db, "marcas", id), { ...marca, creadoEn: F.serverTimestamp() });
    await F.setDoc(F.doc(db, "agendas", E.yo.uid), { actividades: { [id]: { titulo: titulo.slice(0, 120), dia, desde, hasta, tipo } },
      actualizadoEn: F.serverTimestamp() }, { merge: true });
    formActividad = false; aviso("Anotada. Al balance va sólo el horario y la clase, no el título."); repintar();
  } catch (e) { fallo(e); }
}
async function borrarActividad(id) {
  const a = (E.actividades || {})[id]; if (!a) return;
  if (!confirm(`¿Sacar «${a.titulo}» de tu agenda? Sale también del balance.`)) return;
  try {
    await F.deleteDoc(F.doc(db, "marcas", id)).catch(() => {});
    await F.setDoc(F.doc(db, "agendas", E.yo.uid), { actividades: { [id]: F.deleteField() } }, { merge: true });
  } catch (e) { fallo(e); }
}
const actividadesDelDia = (d) => Object.entries(E.actividades || {}).filter(([, a]) => a && a.dia === d)
  .sort((x, y) => String(x[1].desde).localeCompare(String(y[1].desde)));
function formActividadHTML() {
  return `<form class="tarjeta ficha" id="form-actividad">
    <label>Qué <input name="titulo" maxlength="120" required placeholder="Ej.: salida con amigos, gimnasio, reunión"></label>
    <div class="dos"><label>Día <input type="date" name="dia" required value="${E.hoy}"></label>
      <label>Desde <input type="time" name="hi" required></label><label>Hasta <input type="time" name="hf" required></label></div>
    <fieldset class="clases"><legend>Es… <small class="gris">(obligatorio)</small></legend>
      ${Object.entries(CLASES_ACTIVIDAD).map(([k, c]) => `<label class="check"><input type="radio" name="tipo" value="${k}" required> ${esc(c.nombre)}</label>`).join("")}</fieldset>
    <p class="gris">El título queda en tu agenda, que ves sólo vos. Al balance va sólo el horario y qué es.</p>
    <div class="botones"><button class="boton">Guardar</button><button type="button" class="mini" data-cerrar-act>Cancelar</button></div></form>`;
}

/* La agenda entera, con las dos fuentes bajo una sola clave. */
export function agendaUnida() {
  const out = {};
  for (const [k, v] of Object.entries(E.agenda || {})) out[k] = v || {};
  for (const [k, v] of Object.entries(E.cvAgenda || {})) out["cv:" + k] = v || {};
  return out;
}
export const estaEnAgenda = (clave) => Object.prototype.hasOwnProperty.call(agendaUnida(), clave);

/* Guardar SÓLO esa clave: escribir el mapa entero pisaría lo que se haya
   guardado desde otro teléfono. `null` la saca. */
export async function guardarEnAgenda(clave, campos) {
  if (clave.startsWith("cv:")) {
    if (!CV || !E.cv) return aviso("Para agendar algo de Casa Verde hace falta la sesión de Casa Verde.", true);
    const id = clave.slice(3), M = CV.mod;
    const valor = campos === null ? M.deleteField()
      : { ...(E.cvAgenda[id] || {}), ...campos, franja: campos.franja === "noche" ? "tarde" : (campos.franja ?? (E.cvAgenda[id] || {}).franja ?? "") };
    await M.setDoc(M.doc(M.db, "estado_usuario", E.cv.uid),
      { agenda: { [id]: valor }, actualizadoEn: M.serverTimestamp() }, { merge: true });
    return;
  }
  const valor = campos === null ? F.deleteField() : { ...(E.agenda[clave] || {}), ...campos };
  await F.setDoc(F.doc(db, "agendas", E.yo.uid), { items: { [clave]: valor }, actualizadoEn: F.serverTimestamp() }, { merge: true });
}

export function alternarEnAgenda(clave) {
  const ya = estaEnAgenda(clave);
  guardarEnAgenda(clave, ya ? null : {}).then(() => aviso(ya ? "Salió de tu agenda." : "Está en tu agenda: flota en hoy hasta que le des un día."))
    .catch(fallo);
}

/* Lo que puede estar en mi agenda: las tareas de la familia que veo y las de
   Casa Verde. Lo hecho no. */
function candidatas() {
  const { porId } = arbol(E.tareas);
  const fam = E.tareas.filter((t) => !t.hecho).map((t) => ({
    clave: "f:" + t.id, titulo: t.titulo, origen: "familia", color: colorHeredado(t, porId) || TIPOS[tipoHeredado(t, porId)].color,
    mia: (t.encargados || []).includes(E.yo.uid) || t.alcance === "personal", meta: !!t.meta }));
  const cv = (E.cvActs || []).map((a) => ({ clave: "cv:" + a.id, titulo: a.titulo || "(sin título)",
    origen: "casaverde", color: TIPOS.produccion.color, mia: (a.competencias || []).includes(E.cv && E.cv.uid) }));
  return [...fam, ...cv];
}

export function pintarAgenda() {
  const v = $("v-agenda");
  if (!lunes) lunes = lunesDe(E.hoy);
  const dias = semanaISO(lunes);
  const todas = candidatas();
  const agenda = agendaUnida();
  const { dias: ub, atrasadas } = ubicarEnSemana(todas, agenda, E.hoy, lunes);
  const fmt = (iso) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

  let h = `<div class="nav-semana"><button class="mini" data-s="-7">‹</button>
    <b>${fmt(dias[0])} — ${fmt(dias[6])}</b><button class="mini" data-s="7">›</button>
    <button class="mini" data-s="0">hoy</button></div>`;
  h += formActividad ? formActividadHTML() : `<button class="mini" data-nueva-act>＋ Actividad (trabajo, tarea, personal o con los chicos)</button>`;
  if (atrasadas.length)
    h += `<div class="dia atrasadas"><h3>Quedaron de antes · ${atrasadas.length}</h3>${atrasadas.map((x) => pastilla(x, agenda)).join("")}</div>`;
  for (const d of dias) {
    const chicos = chicosDelDia(d, E.familia.patron, E.turnos);
    const evs = eventosDelDia(d, E.eventos);
    h += `<div class="dia${d === E.hoy ? " es-hoy" : ""}"><h3><span class="num">${Number(d.slice(8))}</span> ${DIAS[new Date(d + "T12:00").getDay()]}${d === E.hoy ? " · hoy" : ""}
      <span class="marcas">${marcasChicos(chicos)}</span></h3>`;
    // Los acuerdos de tiempo que tocan el día («Mauro trabaja afuera»): los
    // ven los dos, y no se arrastran.
    h += bloquesDelDia(d).map((b) => `<div class="evento bloque-dia">⏱ <b>${esc(nombreDe(b.uid))}</b> ${esc(b.titulo || ({ productivo: "trabaja", chicos: "con los chicos", libre: "tiempo personal" })[b.clase] || "")}</div>`).join("");
    h += actividadesDelDia(d).map(([id, a]) => `<div class="evento actividad" style="--c:${COLOR_ACT[a.tipo] || "#888"}">🗓 <b>${esc(String(a.desde).slice(11))}–${esc(String(a.hasta).slice(11))}</b> ${esc(a.titulo)}
      <small class="gris">· ${esc((CLASES_ACTIVIDAD[a.tipo] || {}).nombre || a.tipo)}</small> <button class="mini nota" data-borrar-act="${esc(id)}" title="Sacar">✕</button></div>`).join("");
    h += evs.map((e) => `<div class="evento">👦 <b>${esc(e.hora || "")}</b> ${esc(e.titulo)}${(e.ninos || []).length ? ` <small>${e.ninos.map((id) => esc((ninoPorId(id) || {}).nombre || "")).join(", ")}</small>` : ""}${(e.quienes || []).length ? ` <small class="gris">· ${e.quienes.map((u) => esc(nombreDe(u))).join(" y ")}</small>` : ""}</div>`).join("");
    for (const f of FRANJAS) {
      const items = ub[d][f];
      h += `<div class="franja" data-zona="${d}|${f}"><div class="rot">${NOMBRE_FRANJA[f]}</div>
        ${items.length ? items.map((x) => pastilla(x, agenda)).join("") : `<div class="nada">—</div>`}</div>`;
    }
    h += `</div>`;
  }
  // Para agendar: primero lo que tomé yo y las metas; después el resto.
  const fuera = todas.filter((x) => !(x.clave in agenda)).sort((a, b) => Number(b.mia) - Number(a.mia) || Number(b.meta) - Number(a.meta));
  h += `<h2>Para agendar</h2>${fuera.length ? fuera.slice(0, 60).map((x) => `<div class="fila"><button class="mini" data-poner="${esc(x.clave)}">＋</button>
      <span class="txt">${esc(x.titulo)} <small class="gris">${x.origen === "casaverde" ? "Casa Verde" : "familia"}${x.mia ? " · tuya" : ""}${x.meta ? " · ★ meta" : ""}</small></span></div>`).join("")
    : `<p class="gris">Todo lo pendiente ya está en tu agenda.</p>`}
    <p class="gris">Tocá ＋ y queda flotando en hoy; arrastrala del ⠿ al día y la franja que quieras. Tu agenda la ves sólo vos.</p>`;
  v.innerHTML = h;

  for (const b of v.querySelectorAll("[data-s]")) b.onclick = () => {
    const n = Number(b.dataset.s); lunes = n ? sumarDias(lunes, n) : lunesDe(E.hoy); repintar();
  };
  for (const b of v.querySelectorAll("[data-nueva-act]")) b.onclick = () => { formActividad = true; repintar(); };
  for (const b of v.querySelectorAll("[data-cerrar-act]")) b.onclick = () => { formActividad = false; repintar(); };
  for (const b of v.querySelectorAll("[data-borrar-act]")) b.onclick = () => borrarActividad(b.dataset.borrarAct);
  const fa = v.querySelector("#form-actividad");
  if (fa) fa.onsubmit = (ev) => { ev.preventDefault(); guardarActividad(fa); };
  for (const b of v.querySelectorAll("[data-poner]")) b.onclick = () => guardarEnAgenda(b.dataset.poner, {}).catch(fallo);
  for (const b of v.querySelectorAll("[data-editar]")) b.onclick = () => { editando = editando === b.dataset.editar ? null : b.dataset.editar; repintar(); };
  for (const b of v.querySelectorAll("[data-ed-ok]")) b.onclick = () => {
    const c = b.dataset.edOk, caja = b.closest(".pas-ed");
    const val = (n) => caja.querySelector(`[data-ed="${n}"]`).value;
    editando = null;
    guardarEnAgenda(c, { dia: val("dia") || null, hora: val("hora") || "", franja: val("franja") || "" }).catch(fallo);
  };
  for (const b of v.querySelectorAll("[data-ed-flotar]")) b.onclick = () => { editando = null; guardarEnAgenda(b.dataset.edFlotar, { dia: null }).catch(fallo); };
  for (const b of v.querySelectorAll("[data-ed-sacar]")) b.onclick = () => { editando = null; guardarEnAgenda(b.dataset.edSacar, null).catch(fallo); };
  for (const g of v.querySelectorAll("[data-agarre]")) g.addEventListener("pointerdown", (ev) => arrastrar(ev, g.dataset.agarre));
}

function marcasChicos(chicos) {
  return Object.entries(chicos).map(([u, ns]) => `<span class="marca-p" title="${esc(nombreDe(u))}">${esc((nombreDe(u) || "?").slice(0, 1))}${ns.map((id) => `<i class="punto" style="--c:${esc((ninoPorId(id) || {}).color || "#c89bd8")}" title="${esc((ninoPorId(id) || {}).nombre || "")}"></i>`).join("")}</span>`).join("");
}

function pastilla(x, agenda) {
  const m = agenda[x.clave] || {};
  const abierto = editando === x.clave;
  return `<div class="pas" data-pas="${esc(x.clave)}"><div class="pas-fila">
      <span class="pas-agarre" data-agarre="${esc(x.clave)}" title="Arrastrar">⠿</span>
      <span class="pas-hora${x.hora ? "" : " sin"}">${esc(x.hora || "—")}</span>
      <i class="sem" style="background:${x.color}"></i>
      <span class="pas-txt"><b>${esc(x.titulo)}</b><small>${x.origen === "casaverde" ? "Casa Verde" : "familia"}${x.flota ? " · sin día, flota en hoy" : ""}</small></span>
      <button class="mas" data-editar="${esc(x.clave)}">${abierto ? "▴" : "⋯"}</button></div>
    ${abierto ? `<div class="pas-ed">
      <label>Día <input type="date" data-ed="dia" value="${esc(esISO(m.dia) ? m.dia : "")}"></label>
      <label>Hora <input type="time" data-ed="hora" value="${esc(m.hora || "")}"></label>
      <label>Franja <select data-ed="franja"><option value="">según la hora</option>
        ${FRANJAS.map((f) => `<option value="${f}"${m.franja === f ? " selected" : ""}>${NOMBRE_FRANJA[f]}</option>`).join("")}</select></label>
      <div class="botones"><button class="mini ok" data-ed-ok="${esc(x.clave)}">Guardar</button>
        <button class="mini" data-ed-flotar="${esc(x.clave)}">Sin día</button>
        <button class="mini" data-ed-sacar="${esc(x.clave)}">Sacar de mi agenda</button></div></div>` : ""}</div>`;
}

/* ── El arrastre, a mano ──────────────────────────────────────────────────────
   Un fantasma sigue al dedo; la franja de abajo se ilumina; al soltar se
   guarda el día y la franja. Cerca del borde la pantalla se desplaza sola:
   sin eso no se llega del lunes al domingo con el dedo apretado. */
function arrastrar(ev, clave) {
  ev.preventDefault();
  const origen = ev.target.closest(".pas");
  const fantasma = origen.cloneNode(true);
  const r = origen.getBoundingClientRect();
  Object.assign(fantasma.style, { position: "fixed", left: r.left + "px", width: r.width + "px", top: r.top + "px",
    pointerEvents: "none", zIndex: 50, opacity: ".9" });
  fantasma.classList.add("fantasma");
  document.body.append(fantasma);
  origen.classList.add("arrastrando");
  document.body.classList.add("arrastrando-algo");     // que el dedo no seleccione texto
  const dy = ev.clientY - r.top;
  let zona = null, rueda = 0, ultimoY = ev.clientY, ultimoX = ev.clientX;
  const zonaEn = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest("[data-zona]"); };
  const marcar = () => {
    const z = zonaEn(ultimoX, ultimoY);
    if (z !== zona) { if (zona) zona.classList.remove("encima"); zona = z; if (zona) zona.classList.add("encima"); }
  };
  const mover = (e) => {
    ultimoY = e.clientY; ultimoX = e.clientX;
    fantasma.style.top = (e.clientY - dy) + "px";
    marcar();
  };
  // Mientras la pantalla se desplaza sola, lo que está bajo el dedo cambia
  // aunque el dedo no se mueva: por eso se vuelve a mirar en cada cuadro.
  const desplazar = () => {
    const alto = innerHeight;
    if (ultimoY < 80) { scrollBy(0, -12); marcar(); } else if (ultimoY > alto - 80) { scrollBy(0, 12); marcar(); }
    rueda = requestAnimationFrame(desplazar);
  };
  rueda = requestAnimationFrame(desplazar);
  const soltar = () => {
    cancelAnimationFrame(rueda);
    removeEventListener("pointermove", mover); removeEventListener("pointerup", soltar); removeEventListener("pointercancel", soltar);
    fantasma.remove(); origen.classList.remove("arrastrando"); document.body.classList.remove("arrastrando-algo");
    if (!zona) return;
    zona.classList.remove("encima");
    const [dia, franja] = zona.dataset.zona.split("|");
    // Soltar en otra franja cambia la franja y borra la hora solo si la hora
    // ya no cae ahí: una hora de las 9 en la franja de la noche mentiría.
    const m = agendaUnida()[clave] || {};
    const hora = m.hora && ((franja === "manana" && m.hora < "13:00") || (franja === "tarde" && m.hora >= "13:00" && m.hora < "19:00") || (franja === "noche" && m.hora >= "19:00")) ? m.hora : "";
    guardarEnAgenda(clave, { dia, franja, hora }).catch(fallo);
  };
  addEventListener("pointermove", mover);
  addEventListener("pointerup", soltar);
  addEventListener("pointercancel", soltar);
}
