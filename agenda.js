// ─────────────────────────────────────────────────────────────────────────────
// agenda.js — Mi semana, ordenada arrastrando. Sello: agenda-13
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
//
// agenda-11 (11-oct-2026, tiempos:A25, Florencia: «la actividad, cuando se
// tiene que editar, no permite cambiar el horario… esperaría poder editar
// todo el contenido»). El ✎ abre el editor ENTERO —qué, día, horario, dónde y
// qué es—, y lo que se va escribiendo vive en `borrador`, no en el formulario:
// si llega un cambio de la base y la pantalla se redibuja, lo escrito vuelve
// igual. Antes se perdía, y el toque en Guardar caía sobre un botón que ya no
// existía. Lo mismo para una actividad nueva.
//
// agenda-12 (11-oct-2026): un toque sobre cualquier cosa del día la abre.
// agenda-13 (12-oct-2026, Mauro: «tres configuraciones totalmente diferentes,
// es muy confuso»): las tres clases —tarea, actividad propia y de los chicos—
// se ven, se arrastran y se editan IGUAL. Ver «UNA PIEZA DE LA AGENDA».
// ─────────────────────────────────────────────────────────────────────────────

import { db, F, CV } from "./firebase-init.js";
import { esc, lunesDe, sumarDias, semanaISO, ubicarEnSemana, chicosDelDia, eventosDelDia,
         grillaDelMes, MESES, cuentaDelDia, parecidas, DIAS, FRANJAS, esISO, TIPOS, tipoHeredado, arbol, colorHeredado,
         CLASES_ACTIVIDAD, validarMarca, marcasQueSePisan, idNuevo, HORA_NOCHE, franjaDe, horaEnFranja, correrFin, HORA_DE_FRANJA } from "./nucleo.js";
import { E, $, aviso, repintar, nombreDe, ninoPorId, personas, fallo } from "./estado.js";
import { bloquesDelDia } from "./balance.js";
import { pintarLugares, pintarAgente, recordarLugar } from "./lugares.js";

const NOMBRE_FRANJA = { manana: "mañana", tarde: "tarde", noche: "noche" };
let lunes = null;
let editando = null;
// agenda-5 (app-16, tiempos:V7): «en la agenda semanal tiene que haber una
// opción de visualizar el mes». El mes es para mirar: cada día dice cuántas
// cosas tiene, y tocarlo abre esa semana, donde se edita.
let vistaAg = "semana";         // "semana" | "mes"
let mesAg = null;               // [año, mes0]
let formActividad = false;
let borrador = {};              // agenda-11: { [id | "nueva"]: { campo: valor } } lo escrito y no guardado
const valorDe = (id, campo, porDefecto) => (borrador[id] && borrador[id][campo] !== undefined ? borrador[id][campo] : porDefecto);
function seguirBorrador(f, id) {
  const anotar = (el) => {
    if (!el.name) return;
    let x = el.value;
    if (el.type === "radio") x = el.checked ? el.value : (borrador[id] || {})[el.name];
    if (el.type === "checkbox") {
      const varios = f.querySelectorAll(`[name="${el.name}"]`);
      x = varios.length > 1 ? [...varios].filter((c) => c.checked).map((c) => c.value).join(",") : (el.checked ? "on" : "off");
    }
    borrador[id] = { ...(borrador[id] || {}), [el.name]: x };
  };
  for (const el of f.querySelectorAll("input, select, textarea")) { el.addEventListener("input", () => anotar(el)); el.addEventListener("change", () => anotar(el)); }
}

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
  const lugar = (f.lugar ? f.lugar.value : "").trim().slice(0, 80);
  if (!titulo || !esISO(dia) || !hi) return aviso("Falta qué, qué día o desde qué hora.", true);
  // «La noche es una actividad luego de las 8, y puede volver a la hora que
  // quiera: no tiene por qué marcar retorno.» Sin «hasta», sólo de noche.
  if (!hf && hi < HORA_NOCHE) return aviso(`Poné hasta qué hora. Sin hora de vuelta va sólo lo que empieza desde las ${HORA_NOCHE}.`, true);
  // Si termina «antes» de empezar, cruzó la medianoche: una salida de 21 a 1.
  const desde = `${dia}T${hi}`, hasta = !hf ? `${sumarDias(dia, 1)}T07:00` : `${hf <= hi ? sumarDias(dia, 1) : dia}T${hf}`;
  const marca = { uid: E.yo.uid, clase: CLASES_ACTIVIDAD[tipo].clase, desde, hasta, origen: "agenda", marcadoPor: E.yo.uid };
  const mal = validarMarca(marca, [E.yo.uid]);
  if (mal.length) return aviso("No se pudo: " + mal.join(", ") + ".", true);
  const ya = marcasQueSePisan(marca, E.marcas);
  if (ya.length && !confirm(`Ya hay ${ya.length} marca(s) tuya(s) en ese horario (${ya.map((m) => m.origen === "agenda" ? "de tu agenda" : "puesta por " + nombreDe(m.marcadoPor)).join(", ")}). En el balance ese rato cuenta una sola vez. ¿Guardar igual?`)) return;
  const id = idNuevo("a");
  try {
    await F.setDoc(F.doc(db, "marcas", id), { ...marca, creadoEn: F.serverTimestamp() });
    await F.setDoc(F.doc(db, "agendas", E.yo.uid), { actividades: { [id]: { titulo: titulo.slice(0, 120), dia, desde, hasta, tipo, hf: hf || "", lugar } },
      actualizadoEn: F.serverTimestamp() }, { merge: true });
    if (lugar) recordarLugar(lugar);
    formActividad = false; delete borrador.nueva; aviso("Anotada. Al balance va sólo el horario y la clase, no el título."); repintar();
  } catch (e) { fallo(e); }
}
async function borrarActividad(id) {
  const a = (E.actividades || {})[id]; if (!a) return;
  if (!confirm(`¿Sacar «${a.titulo}» de tu agenda? Sale también del balance.`)) return;
  try { await sacarActividad(id); } catch (e) { fallo(e); }
}
/** Sacar una actividad de MI agenda, con su marca. Sin preguntar: lo usa
 *  también el plan de la IA (sugerir.js), donde ya se marcó qué va. */
export async function sacarActividad(id) {
  if (!(E.actividades || {})[id]) throw new Error("esa actividad ya no está en tu agenda");
  await F.deleteDoc(F.doc(db, "marcas", id)).catch(() => {});
  await F.setDoc(F.doc(db, "agendas", E.yo.uid), { actividades: { [id]: F.deleteField() } }, { merge: true });
}
/* agenda-6 (7-oct-2026, Mauro: «hay que reprogramar»): una actividad se cambia
   de día y de hora. La marca del balance no se edita —la regla lo prohíbe: «se
   borra y se vuelve a marcar»—, así que se borra y se crea de nuevo con el
   mismo id y las horas nuevas, igual que al guardarla.
   agenda-10 (10-oct-2026): la cuenta vive en `reprogramarActividad`, que usa
   también el plan de la IA; devuelve el problema en palabras, o "". */
export async function reprogramarActividad(id, { dia, hi, hf = "", titulo, lugar, tipo, nota } = {}) {
  const a = (E.actividades || {})[id]; if (!a) return "esa actividad ya no está en tu agenda";
  if (!esISO(dia) || !hi) return "falta el día o la hora";
  if (!hf && hi < HORA_NOCHE) return `falta hasta qué hora (sin hora de vuelta va sólo lo que empieza desde las ${HORA_NOCHE})`;
  // agenda-11: también el título, el lugar y qué es. Lo que no viene, queda.
  const t = titulo === undefined ? a.titulo : String(titulo).trim().slice(0, 120);
  if (!t) return "falta qué es";
  const clase = tipo === undefined ? a.tipo : tipo;
  if (!CLASES_ACTIVIDAD[clase]) return "falta si es trabajo, tarea, personal o con los chicos";
  const desde = `${dia}T${hi}`, hasta = !hf ? `${sumarDias(dia, 1)}T07:00` : `${hf <= hi ? sumarDias(dia, 1) : dia}T${hf}`;
  const marca = { uid: E.yo.uid, clase: CLASES_ACTIVIDAD[clase].clase, desde, hasta, origen: "agenda", marcadoPor: E.yo.uid };
  await F.deleteDoc(F.doc(db, "marcas", id)).catch(() => {});
  await F.setDoc(F.doc(db, "marcas", id), { ...marca, creadoEn: F.serverTimestamp() });
  const lug = lugar === undefined ? (a.lugar || "") : String(lugar).trim().slice(0, 80);
  const not = nota === undefined ? (a.nota || "") : String(nota).trim().slice(0, 300);
  await F.setDoc(F.doc(db, "agendas", E.yo.uid), { actividades: { [id]: { ...a, titulo: t, tipo: clase, lugar: lug, nota: not, dia, desde, hasta, hf: hf || "", claude: F.deleteField() } },
    actualizadoEn: F.serverTimestamp() }, { merge: true });
  if (lug && lug !== (a.lugar || "")) recordarLugar(lug);
  return "";
}
/* ── UNA PIEZA DE LA AGENDA, sea lo que sea (agenda-13, 12-oct-2026) ─────────
   Mauro: «¿por qué estas tres entradas de agenda tienen tres configuraciones
   totalmente diferentes? Es muy confuso. Todos los elementos de la agenda
   deberían poder arrastrarse y moverse como el primero, y al editar darme en
   una presentación simple y clara todas las mismas opciones. Siempre el ítem
   resumido viendo la semana, y los detalles al hacer clic.»
   Hay tres clases de cosas en la agenda, y cada una se guarda donde se guarda:
     · la TAREA (de la familia o de Casa Verde), en mi agenda: día, hora, fin,
       dónde y nota son míos; el título y el ámbito son de la tarea;
     · la ACTIVIDAD propia, en mi agenda y con su marca del balance;
     · la de los CHICOS, en `eventos`, que ven los dos.
   Se VEN igual (`pieza`), se ARRASTRAN igual (`arrastrar`) y se EDITAN con el
   mismo formulario, los mismos campos en el mismo orden (`editorPieza`). Lo que
   en una no se puede cambiar se ve igual, apagado, con el porqué al lado. */
const COLOR_CHICOS = "#c89bd8";
const CLASE_DE_CAT = { produccion: "trabajo", casaverde: "trabajo", mantenimiento: "tarea", casa: "tarea", personal: "personal", ninos: "ninos" };
const hhmm = (iso) => String(iso || "").slice(11, 16);

/** Las piezas de un día, las tres clases juntas, cada una en su franja y por hora. */
function piezasDelDia(d, ubDia, agenda) {
  const out = { manana: [], tarde: [], noche: [] };
  for (const f of FRANJAS) for (const x of ubDia[f]) {
    const m = agenda[x.clave] || {};
    out[f].push({ ...x, clase: "tarea", hasta: m.hasta || "", lugar: m.lugar || "",
      sub: [x.origen === "casaverde" ? "Casa Verde" : NOMBRE_CAT(x.cat), m.lugar, x.flota ? "sin día, flota en hoy" : ""].filter(Boolean).join(" · ") });
  }
  for (const [id, a] of actividadesDelDia(d)) {
    const hora = hhmm(a.desde);
    out[franjaDe({ hora })].push({ clase: "act", clave: "act:" + id, id, titulo: a.titulo, hora, hasta: a.hf === "" ? "" : hhmm(a.hasta),
      color: COLOR_ACT[a.tipo] || "#888", claude: a.claude,
      sub: [(CLASES_ACTIVIDAD[a.tipo] || {}).nombre, a.lugar].filter(Boolean).join(" · ") });
  }
  for (const e of eventosDelDia(d, E.eventos)) {
    out[franjaDe({ hora: e.hora })].push({ clase: "chicos", clave: "ev:" + e.id + "|" + d, id: e.id, dia: d, titulo: e.titulo, hora: e.hora || "", hasta: e.horaFin || "",
      color: COLOR_CHICOS, sub: ["con los chicos", (e.ninos || []).map((n) => (ninoPorId(n) || {}).nombre || "").filter(Boolean).join(" y "),
        (e.quienes || []).length ? "van " + e.quienes.map((u) => nombreDe(u)).join(" y ") : "", e.lugar, e.semanal ? "todas las semanas" : ""].filter(Boolean).join(" · ") });
  }
  for (const f of FRANJAS) out[f].sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99") || String(a.titulo).localeCompare(String(b.titulo)));
  return out;
}

/** Lo que el editor muestra de una pieza, venga de donde venga. */
function datosDePieza(p) {
  if (p.clase === "act") {
    const a = (E.actividades || {})[p.id] || {};
    return { titulo: a.titulo || "", dia: a.dia || "", hi: hhmm(a.desde), hf: a.hf === "" ? "" : hhmm(a.hasta), lugar: a.lugar || "", nota: a.nota || "", es: a.tipo || "" };
  }
  if (p.clase === "chicos") {
    const e = (E.eventos || []).find((x) => x.id === p.id) || {};
    return { titulo: e.titulo || "", dia: p.dia, hi: e.hora || "", hf: e.horaFin || "", lugar: e.lugar || "", nota: e.nota || "", es: "ninos",
      ninos: e.ninos || [], quienes: e.quienes || [], semanal: !!e.semanal };
  }
  const m = agendaUnida()[p.clave] || {};
  return { titulo: p.titulo, dia: esISO(m.dia) ? m.dia : "", hi: m.hora || "", hf: m.hasta || "", lugar: m.lugar || "", nota: m.nota || "", es: CLASE_DE_CAT[p.cat] || "tarea" };
}

function editorPieza(p) {
  const k = p.clave, d = datosDePieza(p);
  const v = (campo, x) => valorDe(k, campo, x);
  const cv = p.clase === "tarea" && p.origen === "casaverde";
  const fijo = p.clase !== "act";               // «Es…» lo decide la tarea o la actividad de los chicos
  const ninos = E.familia.ninos || [];
  const marcado = (lista, x) => (v(lista, null) !== null ? String(v(lista, "")).split(",") : d[lista] || []).includes(x);
  return `<form class="evento-form pieza-ed" data-pieza-form="${esc(k)}">
    <label>Qué <input name="titulo" maxlength="120" required value="${esc(v("titulo", d.titulo))}"${cv ? " readonly" : ""}></label>
    <div class="tres"><label>Día <input type="date" name="dia" value="${esc(v("dia", d.dia))}"${p.clase === "tarea" ? "" : " required"}></label>
      <label>Desde <input type="time" name="hi" value="${esc(v("hi", d.hi))}"${p.clase === "act" ? " required" : ""}></label>
      <label>Hasta <input type="time" name="hf" value="${esc(v("hf", d.hf))}"${cv ? " disabled" : ""}></label></div>
    <label>Dónde <input name="lugar" maxlength="80" value="${esc(v("lugar", d.lugar))}" placeholder="Opcional"${cv ? " disabled" : ""}></label>
    <fieldset class="clases"><legend>Es…</legend>
      ${Object.entries(CLASES_ACTIVIDAD).map(([c, x]) => `<label class="check"><input type="radio" name="tipo" value="${c}"${v("tipo", d.es) === c ? " checked" : ""}${fijo ? " disabled" : ""}> ${esc(x.nombre)}</label>`).join("")}
      ${fijo ? `<small class="gris">${p.clase === "chicos" ? "Es una actividad de los chicos: la ven los dos." : `Lo define la tarea (${esc(NOMBRE_CAT(p.cat))}); se cambia en Tareas.`}</small>` : ""}</fieldset>
    ${p.clase === "chicos" ? `<div class="fila-persona"><span>Chicos</span>${ninos.map((n) => `<label class="check"><input type="checkbox" name="ninos" value="${esc(n.id)}"${marcado("ninos", n.id) ? " checked" : ""}> ${esc(n.nombre)}</label>`).join("")}</div>
      <div class="fila-persona"><span>Van</span>${personas().map((x) => `<label class="check"><input type="checkbox" name="quienes" value="${esc(x.id)}"${marcado("quienes", x.id) ? " checked" : ""}> ${esc(x.nombre)}</label>`).join("")}</div>
      <label class="check"><input type="checkbox" name="semanal"${(v("semanal", null) === null ? d.semanal : v("semanal") === "on") ? " checked" : ""}> Se repite todas las semanas</label>` : ""}
    <label>Nota <input name="nota" maxlength="300" value="${esc(v("nota", d.nota))}"${cv ? " disabled" : ""}></label>
    ${cv ? `<p class="gris">Las de Casa Verde guardan acá el día y la hora; lo demás se cambia en Casa Verde.</p>` : ""}
    <div class="botones"><button class="boton">Guardar</button><button type="button" class="mini" data-pieza-cerrar>Cancelar</button>
      ${p.clase === "tarea" ? `<button type="button" class="mini" data-pieza-flotar>Sin día</button>` : ""}
      <button type="button" class="mini" data-pieza-sacar>${p.clase === "tarea" ? "Sacar de mi agenda" : p.clase === "chicos" ? "Borrar (para los dos)" : "Borrar"}</button></div></form>`;
}

async function guardarPieza(p, f) {
  const k = p.clave;
  const val = (n) => (f[n] ? String(f[n].value || "").trim() : "");
  const titulo = val("titulo").slice(0, 120), dia = val("dia"), hi = val("hi"), hf = val("hf"), lugar = val("lugar").slice(0, 80), nota = val("nota").slice(0, 300);
  if (!titulo) return aviso("Falta qué es.", true);
  if (p.clase === "act") {
    const tipo = (f.querySelector('[name="tipo"]:checked') || {}).value;
    const mal = await reprogramarActividad(p.id, { dia, hi, hf, titulo, lugar, tipo, nota });
    if (mal) return aviso(mal[0].toUpperCase() + mal.slice(1) + ".", true);
  } else if (p.clase === "chicos") {
    if (!esISO(dia)) return aviso("Falta el día.", true);
    const e = (E.eventos || []).find((x) => x.id === p.id); if (!e) return aviso("Esa actividad ya no está.", true);
    const lista = (n) => [...f.querySelectorAll(`[name="${n}"]:checked`)].map((x) => x.value);
    const datos = { titulo, hora: hi, horaFin: hf, lugar, nota, ninos: lista("ninos"), quienes: lista("quienes"), semanal: !!(f.semanal && f.semanal.checked), actualizadoEn: F.serverTimestamp() };
    if (dia !== p.dia) { const ok = await moverEvento(e, p.dia, dia, datos); if (!ok) return; }
    else await F.updateDoc(F.doc(db, "eventos", p.id), datos);
  } else {
    // Una tarea: lo de MI agenda (día, hora, fin, dónde, nota), y el título en la tarea.
    const cv = p.origen === "casaverde";
    if (!cv && titulo !== p.titulo) await F.updateDoc(F.doc(db, "tareas", k.slice(2)), { titulo, actualizadoEn: F.serverTimestamp() });
    await guardarEnAgenda(k, cv ? { dia: dia || null, hora: hi, franja: "" } : { dia: dia || null, hora: hi, franja: "", hasta: hf, lugar, nota });
  }
  editando = null; delete borrador[k];
  aviso(p.clase === "act" ? "Cambiada. Revisá sus recordatorios y alarmas en Pizarra → «Te recordás»." : p.clase === "chicos" ? "Guardada. La ven los dos." : "Guardada.");
  repintar();
}

/* Mover una actividad de los chicos de un día a otro. Si se repite todas las
   semanas, se pregunta: mover sólo ESE día deja la serie como estaba (ese día
   pasa a `excepto`) y crea una suelta en el día nuevo. */
async function moverEvento(e, deDia, aDia, cambios = {}) {
  if (!e.semanal) { await F.updateDoc(F.doc(db, "eventos", e.id), { ...cambios, titulo: cambios.titulo || e.titulo, fecha: aDia, actualizadoEn: F.serverTimestamp() }); return true; }
  if (!confirm(`«${e.titulo}» se repite todas las semanas. ¿Moverla sólo el ${deDia.split("-").reverse().join("/")}? La serie sigue igual.`)) return false;
  const { id, excepto, ...resto } = e;
  await F.updateDoc(F.doc(db, "eventos", e.id), { titulo: e.titulo, excepto: F.arrayUnion(deDia), actualizadoEn: F.serverTimestamp() });
  await F.addDoc(F.collection(db, "eventos"), { ...resto, ...cambios, titulo: cambios.titulo || e.titulo, fecha: aDia, semanal: false, excepto: [], creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
  return true;
}

const actividadesDelDia = (d) => Object.entries(E.actividades || {}).filter(([, a]) => a && a.dia === d)
  .sort((x, y) => String(x[1].desde).localeCompare(String(y[1].desde)));
function formActividadHTML() {
  const v = (campo, x) => valorDe("nueva", campo, x);
  return `<form class="tarjeta ficha" id="form-actividad">
    <label>Qué <input name="titulo" maxlength="120" required placeholder="Ej.: salida con amigos, gimnasio, reunión" value="${esc(v("titulo", ""))}"></label>
    <div class="dos"><label>Día <input type="date" name="dia" required value="${esc(v("dia", E.hoy))}"></label>
      <label>Desde <input type="time" name="hi" required value="${esc(v("hi", ""))}"></label><label>Hasta <input type="time" name="hf" value="${esc(v("hf", ""))}"></label></div>
    <label>Dónde <input name="lugar" maxlength="80" placeholder="Opcional: queda en Mis lugares" value="${esc(v("lugar", ""))}"></label>
    <p class="gris">Desde las 20 no hace falta la hora de vuelta: es una noche.</p>
    <fieldset class="clases"><legend>Es… <small class="gris">(obligatorio)</small></legend>
      ${Object.entries(CLASES_ACTIVIDAD).map(([k, c]) => `<label class="check"><input type="radio" name="tipo" value="${k}" required${v("tipo", "") === k ? " checked" : ""}> ${esc(c.nombre)}</label>`).join("")}</fieldset>
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
    clave: "f:" + t.id, titulo: t.titulo, origen: "familia", cat: tipoHeredado(t, porId), color: colorHeredado(t, porId) || TIPOS[tipoHeredado(t, porId)].color,
    mia: (t.encargados || []).includes(E.yo.uid) || t.alcance === "personal", meta: !!t.meta }));
  const cv = (E.cvActs || []).map((a) => ({ clave: "cv:" + a.id, titulo: a.titulo || "(sin título)", cat: "casaverde",
    origen: "casaverde", color: TIPOS.produccion.color, mia: (a.competencias || []).includes(E.cv && E.cv.uid) }));
  return [...fam, ...cv];
}

/* ── El ＋ de cada día (agenda-8, 8-oct-2026, tiempos:V7) ──────────────────
   Mauro: «un pequeño + en cada día que me abra una lista desplegable con todas
   las opciones agrupadas por categoría, o agregar una nueva; escribir la
   actividad tiene que ser la primera opción; al agregar, revisar que no exista
   ya: si existe, me pregunta si es la misma o si agrega una nueva». Una nueva
   es una tarea (de su categoría; «Personal» la ve sólo uno) puesta en ese día. */
let hoja = null;                // { dia, texto, cat, dudas: null | [parecidas] }
const NOMBRE_CAT = (k) => k === "casaverde" ? "Casa Verde" : (TIPOS[k] || {}).nombre || k;
function pintarHoja() {
  let h = $("hoja-agenda");
  if (!hoja) { if (h) h.remove(); return; }
  if (!h) { h = Object.assign(document.createElement("div"), { id: "hoja-agenda", className: "hoja" }); document.body.append(h); }
  const enAgenda = agendaUnida();
  const todas = candidatas().filter((x) => !(x.clave in enAgenda) || !enAgenda[x.clave].dia);
  const grupos = {};
  for (const x of todas) (grupos[x.cat] = grupos[x.cat] || []).push(x);
  const cats = [...Object.keys(TIPOS), "casaverde"].filter((k) => grupos[k]);
  const fecha = `${DIAS[new Date(hoja.dia + "T12:00").getDay()]} ${Number(hoja.dia.slice(8))}/${Number(hoja.dia.slice(5, 7))}`;
  h.innerHTML = `<div class="hoja-caja"><div class="hoja-cab"><b>Agregar al ${esc(fecha)}</b><button class="mas" data-h-cerrar aria-label="Cerrar">✕</button></div>
    <form class="ficha" data-h-nueva>
      <label>Escribí la actividad <input name="texto" maxlength="120" value="${esc(hoja.texto)}" placeholder="Ej.: llevar el auto al taller" autofocus></label>
      <div class="tira">${Object.entries(TIPOS).map(([k, t]) => `<button type="button" class="mini${hoja.cat === k ? " on" : ""}" data-h-cat="${k}">${esc(t.nombre)}</button>`).join("")}</div>
      ${hoja.dudas ? `<div class="tarjeta chica"><b>¿Es alguna de éstas?</b>${hoja.dudas.map((x) => `<div class="fila"><span class="txt">${esc(x.titulo)} <small class="gris">${esc(NOMBRE_CAT(x.cat))}</small></span><button type="button" class="mini" data-h-poner="${esc(x.clave)}">Sí, ésta</button></div>`).join("")}
        <button type="button" class="boton sec" data-h-forzar>No, agregar una nueva</button></div>`
        : `<div class="botones"><button class="boton">Agregar</button></div>`}
    </form>
    <h3>O elegí de lo que ya tenés</h3>
    ${cats.length ? cats.map((k) => `<details${grupos[k].length <= 6 ? " open" : ""}><summary>${esc(NOMBRE_CAT(k))} <small class="gris">${grupos[k].length}</small></summary>
      ${grupos[k].map((x) => `<button type="button" class="fila-elegir boton-fila" data-h-poner="${esc(x.clave)}">${esc(x.titulo)}${x.mia ? " <small class=\"gris\">· tuya</small>" : ""}</button>`).join("")}</details>`).join("")
      : `<p class="gris">No hay nada pendiente sin día.</p>`}
  </div>`;
  const f = h.querySelector("[data-h-nueva]");
  const leer = () => { hoja.texto = f.texto.value; };
  f.texto.oninput = leer;   // si la base repinta mientras escribe, no se pierde lo escrito
  h.onclick = (ev) => { if (ev.target === h) { hoja = null; pintarHoja(); } };
  h.querySelector("[data-h-cerrar]").onclick = () => { hoja = null; pintarHoja(); };
  for (const b of h.querySelectorAll("[data-h-cat]")) b.onclick = () => { leer(); hoja.cat = b.dataset.hCat; pintarHoja(); };
  for (const b of h.querySelectorAll("[data-h-poner]")) b.onclick = () => {
    const dia = hoja.dia; hoja = null; pintarHoja();
    guardarEnAgenda(b.dataset.hPoner, { dia }).then(() => aviso("Agendada.")).catch(fallo);
  };
  const forzar = h.querySelector("[data-h-forzar]");
  if (forzar) forzar.onclick = () => { leer(); crearYPoner(); };
  f.onsubmit = (ev) => {
    ev.preventDefault(); leer();
    if (!hoja.texto.trim()) return aviso("Escribí la actividad.", true);
    const p = parecidas(hoja.texto, candidatas());
    if (p.length) { hoja.dudas = p; pintarHoja(); return; }
    crearYPoner();
  };
}
async function crearYPoner() {
  const { texto, cat, dia } = hoja;
  const personal = cat === "personal";
  try {
    const r = await F.addDoc(F.collection(db, "tareas"), {
      titulo: texto.trim().slice(0, 120), parentId: null, tipo: cat, alcance: personal ? "personal" : "comun",
      duenio: E.yo.uid, hecho: false, encargados: [E.yo.uid], meta: null, detalle: "", creadoEn: F.serverTimestamp() });
    hoja = null; pintarHoja();
    await guardarEnAgenda("f:" + r.id, { dia });
    aviso("Agregada y agendada.");
  } catch (e) { fallo(e); }
}

function pintarMesAgenda(v) {
  if (!mesAg) { const d = new Date(E.hoy + "T12:00"); mesAg = [d.getFullYear(), d.getMonth()]; }
  const [a, m] = mesAg;
  const agenda = agendaUnida();
  let h = `<nav class="solapas chicas"><button data-va="semana" aria-selected="false">Semana</button><button data-va="mes" aria-selected="true">Mes</button></nav>
    <div class="nav-semana"><button class="mini" data-mes="-1">‹</button><b>${MESES[m]} ${a}</b><button class="mini" data-mes="1">›</button></div>
    <div class="mes"><div class="mes-cab">${["L", "M", "M", "J", "V", "S", "D"].map((d) => `<span>${d}</span>`).join("")}</div>
    ${grillaDelMes(a, m).map((s) => `<div class="mes-fila">${s.map((iso) => {
      const fuera = Number(iso.slice(5, 7)) - 1 !== m;
      const c = cuentaDelDia(iso, agenda, E.actividades, eventosDelDia(iso, E.eventos));
      return `<button class="celda${fuera ? " fuera" : ""}${iso === E.hoy ? " es-hoy" : ""}" data-dia-ag="${iso}">
        <span class="n">${Number(iso.slice(8))}</span><span class="ms">${marcasChicos(chicosDelDia(iso, E.familia.patron, E.turnos))}</span>
        ${c.acts + c.ag ? `<span class="ev mio">${"•".repeat(Math.min(c.acts + c.ag, 4))}</span>` : ""}${c.chicos ? `<span class="ev">${"•".repeat(Math.min(c.chicos, 3))}</span>` : ""}</button>`;
    }).join("")}</div>`).join("")}</div>
    <p class="gris">Los puntos son lo que tenés ese día; los violeta, actividades de los chicos. Tocá un día para abrir esa semana.</p>`;
  v.innerHTML = h;
  for (const b of v.querySelectorAll("[data-va]")) b.onclick = () => { vistaAg = b.dataset.va; repintar(); };
  for (const b of v.querySelectorAll("[data-mes]")) b.onclick = () => { const d = new Date(a, m + Number(b.dataset.mes), 1); mesAg = [d.getFullYear(), d.getMonth()]; repintar(); };
  for (const b of v.querySelectorAll("[data-dia-ag]")) b.onclick = () => { lunes = lunesDe(b.dataset.diaAg); vistaAg = "semana"; repintar(); };
}

export function pintarAgenda() {
  const v = $("v-agenda");
  if (vistaAg === "mes") return pintarMesAgenda(v);
  if (!lunes) lunes = lunesDe(E.hoy);
  const dias = semanaISO(lunes);
  const todas = candidatas();
  const agenda = agendaUnida();
  const { dias: ub, atrasadas } = ubicarEnSemana(todas, agenda, E.hoy, lunes);
  const fmt = (iso) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

  let h = `<nav class="solapas chicas"><button data-va="semana" aria-selected="true">Semana</button><button data-va="mes" aria-selected="false">Mes</button></nav>
    <div class="nav-semana"><button class="mini" data-s="-7">‹</button>
    <b>${fmt(dias[0])} — ${fmt(dias[6])}</b><button class="mini" data-s="7">›</button>
    <button class="mini" data-s="0">hoy</button></div>`;
  h += formActividad ? formActividadHTML() : `<button class="mini" data-nueva-act>＋ Actividad (trabajo, tarea, personal o con los chicos)</button>`;
  const porClave = {};          // agenda-13: cada pieza a mano, para editarla y arrastrarla
  const ver = (p) => { porClave[p.clave] = p; return pieza(p); };
  if (atrasadas.length)
    h += `<div class="dia atrasadas"><h3>Quedaron de antes · ${atrasadas.length}</h3>${atrasadas.map((x) => ver({ ...x, clase: "tarea", sub: NOMBRE_CAT(x.cat) })).join("")}</div>`;
  for (const d of dias) {
    const chicos = chicosDelDia(d, E.familia.patron, E.turnos);
    h += `<div class="dia${d === E.hoy ? " es-hoy" : ""}"><h3><span class="num">${Number(d.slice(8))}</span> ${DIAS[new Date(d + "T12:00").getDay()]}${d === E.hoy ? " · hoy" : ""}
      <button class="mini agregar-dia" data-agregar-dia="${d}" title="Agregar a este día">＋</button>
      <span class="marcas">${marcasChicos(chicos)}</span></h3>`;
    // Los acuerdos de tiempo que tocan el día («Mauro trabaja afuera»): los
    // ven los dos, se acuerdan en Balance y no se arrastran.
    h += bloquesDelDia(d).map((b) => `<div class="evento bloque-dia">⏱ <b>${esc(nombreDe(b.uid))}</b> ${esc(b.titulo || ({ productivo: "trabaja", chicos: "con los chicos", libre: "tiempo personal" })[b.clase] || "")} <small class="gris">· acuerdo, se cambia en Balance</small></div>`).join("");
    const piezas = piezasDelDia(d, ub[d], agenda);
    for (const f of FRANJAS) {
      const items = piezas[f];
      h += `<div class="franja" data-zona="${d}|${f}"><div class="rot">${NOMBRE_FRANJA[f]}</div>
        ${items.length ? items.map(ver).join("") : `<div class="nada">—</div>`}</div>`;
    }
    h += `</div>`;
  }
  // agenda-8 (8-oct-2026, Mauro): lo de «Para agendar» ya no es una lista fija:
  // el ＋ de cada día abre una hoja con «escribí la actividad» primero y todo
  // lo que hay, agrupado por categoría (hojaAgregar).
  h += `<p class="gris">Tocá ＋ al lado de un día para agregarle algo. Tocá cualquier cosa de la semana para ver y cambiar sus detalles, y arrastrala del ⠿ para moverla. Tu agenda la ves sólo vos (y Claude, si lo encendés abajo); las actividades de los chicos 👦 las ven los dos.</p>`;
  piezasVistas = porClave;
  v.innerHTML = h;
  pintarAgente(v);
  pintarLugares(v);

  for (const b of v.querySelectorAll("[data-s]")) b.onclick = () => {
    const n = Number(b.dataset.s); lunes = n ? sumarDias(lunes, n) : lunesDe(E.hoy); repintar();
  };
  for (const b of v.querySelectorAll("[data-va]")) b.onclick = () => { vistaAg = b.dataset.va; if (vistaAg === "mes") { const d = new Date(lunes + "T12:00"); mesAg = [d.getFullYear(), d.getMonth()]; } repintar(); };
  for (const b of v.querySelectorAll("[data-nueva-act]")) b.onclick = () => { formActividad = true; repintar(); };
  for (const b of v.querySelectorAll("[data-cerrar-act]")) b.onclick = () => { formActividad = false; delete borrador.nueva; repintar(); };
  // agenda-13: un toque sobre cualquier pieza abre su editor; el ⠿ arrastra.
  for (const el of v.querySelectorAll("[data-abrir]")) el.onclick = () => { const c = el.dataset.abrir; editando = editando === c ? null : c; repintar(); };
  for (const f of v.querySelectorAll("[data-pieza-form]")) {
    const p = piezasVistas[f.dataset.piezaForm]; if (!p) continue;
    seguirBorrador(f, p.clave);
    f.onsubmit = (ev) => { ev.preventDefault(); guardarPieza(p, f).catch(fallo); };
    f.querySelector("[data-pieza-cerrar]").onclick = () => { delete borrador[p.clave]; editando = null; repintar(); };
    const flotar = f.querySelector("[data-pieza-flotar]");
    if (flotar) flotar.onclick = () => { editando = null; guardarEnAgenda(p.clave, { dia: null }).then(() => aviso("Sin día: flota en hoy.")).catch(fallo); };
    f.querySelector("[data-pieza-sacar]").onclick = () => sacarPieza(p).catch(fallo);
  }
  const fa = v.querySelector("#form-actividad");
  if (fa) { seguirBorrador(fa, "nueva"); fa.onsubmit = (ev) => { ev.preventDefault(); guardarActividad(fa); }; }
  for (const b of v.querySelectorAll("[data-agregar-dia]")) b.onclick = () => { hoja = { dia: b.dataset.agregarDia, texto: "", cat: "personal", dudas: null }; pintarHoja(); };
  if (hoja) pintarHoja();
  for (const g of v.querySelectorAll("[data-agarre]")) g.addEventListener("pointerdown", (ev) => arrastrar(ev, g.dataset.agarre));
}

function marcasChicos(chicos) {
  return Object.entries(chicos).map(([u, ns]) => `<span class="marca-p" title="${esc(nombreDe(u))}">${esc((nombreDe(u) || "?").slice(0, 1))}${ns.map((id) => `<i class="punto" style="--c:${esc((ninoPorId(id) || {}).color || "#c89bd8")}" title="${esc((ninoPorId(id) || {}).nombre || "")}"></i>`).join("")}</span>`).join("");
}

let piezasVistas = {};          // agenda-13: clave → pieza de lo que está dibujado

/* La pieza resumida: igual para las tres clases. Agarre, hora (y fin), color,
   el título y una línea chica que dice qué es. Tocarla abre su editor. */
function pieza(p) {
  const abierto = editando === p.clave;
  const icono = p.clase === "chicos" ? "👦 " : p.clase === "act" ? "🗓 " : "";
  return `<div class="pas pas-${p.clase}${abierto ? " abierta" : ""}" data-pas="${esc(p.clave)}" style="--c:${esc(p.color || "#888")}"><div class="pas-fila">
      <span class="pas-agarre" data-agarre="${esc(p.clave)}" title="Arrastrar">⠿</span>
      <span class="pas-hora${p.hora ? "" : " sin"}">${esc(p.hora || "—")}${p.hasta ? `<small>${esc(p.hasta)}</small>` : ""}</span>
      <i class="sem" style="background:${esc(p.color || "#888")}"></i>
      <span class="pas-txt" data-abrir="${esc(p.clave)}"><b>${icono}${esc(p.titulo)}</b><small>${esc(p.sub || "")}${p.claude && p.claude.porque ? ` · ✨ ${esc(String(p.claude.porque).slice(0, 80))}` : ""}</small></span>
      <button class="mas" data-abrir="${esc(p.clave)}" aria-label="${abierto ? "Cerrar" : "Ver y cambiar"}">${abierto ? "▴" : "⋯"}</button></div>
    ${abierto ? editorPieza(p) : ""}</div>`;
}

async function sacarPieza(p) {
  if (p.clase === "act") { editando = null; return borrarActividad(p.id); }
  if (p.clase === "chicos") {
    if (!confirm("¿Borrar esta actividad de los chicos? La dejan de ver los dos. Si se repite, se borra entera.")) return;
    editando = null; return F.deleteDoc(F.doc(db, "eventos", p.id));
  }
  editando = null; return guardarEnAgenda(p.clave, null).then(() => aviso("Salió de tu agenda."));
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
    soltarEn(clave, dia, franja).catch(fallo);
  };
  addEventListener("pointermove", mover);
  addEventListener("pointerup", soltar);
  addEventListener("pointercancel", soltar);
}

/* agenda-13: soltar es igual para las tres clases; cada una se guarda donde
   vive. La hora se queda si cae en la franja; si no, la de arriba de esa
   franja, y el fin se corre lo mismo (horaEnFranja y correrFin de nucleo.js). */
async function soltarEn(clave, dia, franja) {
  const p = piezasVistas[clave];
  if (!p || p.clase === "tarea") {
    // Una tarea: la hora sólo se borra si ya no cae ahí (una de las 9 en la noche mentiría).
    const m = agendaUnida()[clave] || {};
    const hora = m.hora && franjaDe({ hora: m.hora }) === franja ? m.hora : "";
    return guardarEnAgenda(clave, { dia, franja, hora, ...(m.hasta && !hora ? { hasta: "" } : {}) });
  }
  if (p.clase === "act") {
    const a = (E.actividades || {})[p.id]; if (!a) return;
    const hi0 = hhmm(a.desde), hi = horaEnFranja(hi0, franja) || HORA_DE_FRANJA[franja];
    const mal = await reprogramarActividad(p.id, { dia, hi, hf: a.hf === "" ? "" : correrFin(hi0, hhmm(a.hasta), hi) });
    if (mal) aviso(mal[0].toUpperCase() + mal.slice(1) + ".", true);
    return;
  }
  const e = (E.eventos || []).find((x) => x.id === p.id); if (!e) return;
  const hi = horaEnFranja(e.hora || "", franja);
  if (dia === p.dia && hi === (e.hora || "")) return;
  const cambios = { hora: hi, horaFin: correrFin(e.hora || "", e.horaFin || "", hi) };
  if (dia === p.dia && !e.semanal) return F.updateDoc(F.doc(db, "eventos", e.id), { ...cambios, titulo: e.titulo, actualizadoEn: F.serverTimestamp() });
  await moverEvento(e, p.dia, dia, cambios);
}
