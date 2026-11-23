// ─────────────────────────────────────────────────────────────────────────────
// hoy.js — La pantalla «Hoy»: los ítems de todos mis espacios. Sello: hoy-6 (23-nov-2026: una tarea que se REPITE dice «🔁 cada…» y al tildarla vuelve sola —cuerpoHecha de nucleo-51—, con el aviso «Vuelve el …»). hoy-5 (22-nov-2026: cada proyecto con su color suave en el chip y en el renglón, el punto de Familia, y al agregar se elige Mío o Familia). hoy-4 (20-nov-2026: la versión simplificada; muestra también las tareas de siempre, de sólo lectura, con su proyecto)
//
// Plan «Timón», etapa 4 (16-nov-2026; prototipo aprobado por Mauro ese día):
// «Hoy» junta lo de todos los espacios de la persona en UNA lista —tildás,
// elegís o agregás; tocando el texto se abre el detalle—. En esta tanda entra
// SÓLO el tipo `tarea`, en PARALELO con la solapa Tareas de siempre (regla 8
// de ARQUITECTURA.md: nada se apaga hasta que lo nuevo se usó una semana).
// Los espacios son dos e implícitos: `familia` y `p-<uid>` (ver nucleo.js).
//
// El orden no se elige acá: es `ordenarItems` de nucleo.js (la fecha pone la
// urgencia, la persona la importancia), probado en el banco. Esta pantalla
// sólo dibuja y llama, como todas.
//
// Y acá vive la MATERIALIZACIÓN de `hoy/{uid}` (regla 3 de ARQUITECTURA.md):
// cada vez que cambian mis ítems, la app deja ARMADO en la base el documento
// que el widget de la Pizarra (etapa 5) sólo pinta: cada renglón con su
// texto, su hora, la clave que abre Timón y la acción exacta que escribe el
// tilde. Se escribe con un respiro (2 s) y sólo si cambió: una lista quieta
// no gasta escrituras. Lo lee sólo su dueño (la regla lo exige).
// ─────────────────────────────────────────────────────────────────────────────

import { db, auth, F } from "./firebase-init.js";
import { esc, idNuevo, isoDe, TIPOS_ITEM, IMPORTANCIAS, espacioPersonal, esEspacioMio, nombreEspacio,
         ordenarItems, cuandoItem, urgenciaItem, validarItem, materializarHoy, cuentasDe, idsDeCuenta, tareasComoItems, lunesDe, colorDeProyecto, cuerpoHecha, avisoHecha, textoRepite } from "./nucleo.js";
import { E, $, aviso, nombreDe, fallo, repintar, ganchos } from "./estado.js";

let abierto = null;
/* hoy-5: lo que se agrega es «Mío» o «Familia», a elección (lo recuerda este teléfono). Antes de hoy-5,
   sin proyecto nacía siempre en lo mío y la otra persona no lo veía. */
let nuevoEsp = (() => { try { return localStorage.getItem("tiempos:nuevo") === "fam" ? "fam" : "mio"; } catch { return "mio"; } })();

/* hoy-3: el filtro de proyecto también es de esta pantalla y de este teléfono.
   "" = todos, "-" = sin proyecto, otro = el id de una cuenta (y sus partes).
   Los proyectos son las cuentas de Plata → Cuentas: no hay un catálogo aparte. */
let filtroProy = (() => { try { return localStorage.getItem("tiempos:proyecto") || ""; } catch { return ""; } })();
const cuentas = () => cuentasDe(E.cuentasDoc);
const nombreProyecto = (id) => (cuentas().find((c) => c.id === id) || {}).nombre || "";
const delProyecto = (i) => filtroProy === "" || (filtroProy === "-" ? !i.proyecto : idsDeCuenta(cuentas(), filtroProy).has(i.proyecto));

/* hoy-5: el color de un proyecto (colorDeProyecto, en el orden de Plata → Cuentas) y el terracota de
   Familia, el mismo del widget de Android. Lo mío sin proyecto no lleva punto: es lo de siempre. */
const COLOR_FAMILIA = "#c87f5a";
const colorProy = (id) => colorDeProyecto(cuentas(), id);
const puntoP = (c) => (c ? `<span class="pp" style="--p:${c}" aria-hidden="true"></span>` : "");

const misItems = () => (E.items || []).filter((i) => esEspacioMio(i.espacio, E.yo.uid));
/* hoy-4: lo de Hoy = mis ítems + las tareas de siempre (de sólo lectura, sin copiar). Todo junto:
   para una persona no importa si es suya o de la familia, importa el foco del día. */
const lasTareas = () => tareasComoItems(E.tareas, cuentas(), E.yo.uid, E.hoy);
const todos = () => [...misItems(), ...lasTareas()];
const visibles = () => todos().filter(delProyecto);
const FOCO = 5;            // lo primero de la lista es el foco del día; el resto espera
let verTodo = false;

function filaItem(it) {
  const f = document.createElement("div");
  f.className = "fila-tarea" + (it.hecho ? " hecha" : "");
  const esta = abierto === it.id;
  const cuando = cuandoItem(it, E.hoy);
  const vencido = urgenciaItem(it, E.hoy) === "vencido";
  const proy = nombreProyecto(it.proyecto);
  const origen = proy ? puntoP(colorProy(it.proyecto)) + esc(proy)
    : it.espacio === "familia" && !it.rama ? puntoP(COLOR_FAMILIA) + "Familia"
    : it.rama ? esc(it.rama) : "";
  const sub = [origen, cuando && `<span class="${vencido ? "mal" : ""}">${esc(cuando)}</span>`, it.repite && "🔁 " + esc(textoRepite(it.repite))].filter(Boolean).join(" · ");
  f.innerHTML = `<div class="fila">
      <button class="tilde" aria-label="${it.hecho ? "Volver a pendiente" : "Marcar hecha"}">${it.hecho ? "✓" : "○"}</button>
      <button class="txt abrir" aria-expanded="${esta}">${esc(it.titulo)}${it.importancia === 2 && !it.hecho ? ` <b class="alta" title="Importante">!</b>` : ""}
        ${sub ? `<small class="gris sub">${sub}</small>` : ""}</button></div>`;
  f.querySelector(".tilde").onclick = () => {
    // hoy-6: la tarea que se repite no se cierra: vuelve sola en su próxima vez.
    if (it.origen === "tareas" && it.repite && !it.hecho)
      return F.updateDoc(F.doc(db, "tareas", it.tareaId), { ...cuerpoHecha(it, E.yo.uid, E.hoy), actualizadoEn: F.serverTimestamp() })
        .then(() => aviso(avisoHecha(it, E.hoy))).catch(fallo);
    const x = { hecho: !it.hecho, hechoPor: it.hecho ? null : E.yo.uid, actualizadoEn: F.serverTimestamp() };
    F.updateDoc(F.doc(db, it.origen === "tareas" ? "tareas" : "items", it.origen === "tareas" ? it.tareaId : it.id), x).catch(fallo);
  };
  f.querySelector(".abrir").onclick = () => { abierto = esta ? null : it.id; repintar(); };
  if (esta) f.append(it.origen === "tareas" ? fichaTarea(it) : fichaItem(it));
  return f;
}

/* hoy-4: la ficha de una tarea de siempre. Acá sólo se ORDENA (meta de la semana y «Para cuándo»,
   con la misma forma que Tareas); todo lo demás se edita en Tareas. */
function fichaTarea(it) {
  const t = (E.tareas || []).find((x) => x.id === it.tareaId) || {};
  const lunes = lunesDe(E.hoy);
  const d = document.createElement("div");
  d.className = "ficha";
  d.innerHTML = `<p class="gris">${it.rama ? "De «" + esc(it.rama) + "» · " : ""}viene de Tareas: ahí se edita todo; acá se ordena.</p>
    ${t.alcance !== "personal" ? `<div class="botones"><button type="button" class="mini${t.meta ? " on" : ""}" data-a="meta">${t.meta ? "★" : "☆"} Meta de la semana</button></div>` : ""}
    <label>Para cuándo <input type="date" data-a="limite" value="${esc(t.limite || "")}"> <small class="gris">sin fecha, flota en hoy</small></label>
    ${it.repite ? `<p class="gris">🔁 Se repite ${esc(textoRepite(it.repite))}: al tildarla vuelve sola. Se cambia en Tareas.</p>` : ""}
    <div class="botones"><button type="button" class="mini" data-a="abrir">Abrir en Tareas</button></div>`;
  const up = (x) => F.updateDoc(F.doc(db, "tareas", it.tareaId), { ...x, actualizadoEn: F.serverTimestamp() }).catch(fallo);
  const m = d.querySelector('[data-a="meta"]');
  if (m) m.onclick = () => up({ meta: t.meta ? null : lunes });
  d.querySelector('[data-a="limite"]').onchange = (ev) => up({ limite: ev.target.value || null });
  d.querySelector('[data-a="abrir"]').onclick = () => { if (ganchos.irATarea) ganchos.irATarea("f:" + it.tareaId); };
  return d;
}

function fichaItem(it) {
  const d = document.createElement("div");
  d.className = "ficha";
  d.innerHTML = `
    <p class="gris">${esc(nombreEspacio(it.espacio, E.yo.uid))}${it.creadoPor ? " · la anotó " + esc(it.creadoPor === E.yo.uid ? "vos" : nombreDe(it.creadoPor)) : ""}${it.hecho && it.hechoPor ? " · la hizo " + esc(it.hechoPor === E.yo.uid ? "vos" : nombreDe(it.hechoPor)) : ""}</p>
    <div class="botones" data-imp>
      <span class="gris">Importancia</span>
      ${IMPORTANCIAS.map(([v, n]) => `<button type="button" class="mini${(it.importancia == null ? 1 : it.importancia) === v ? " on" : ""}" data-v="${v}">${n}</button>`).join("")}
    </div>
    <label>Título <input data-a="titulo" maxlength="120" value="${esc(it.titulo || "")}"></label>
    <label>Proyecto <select data-a="proyecto">
      <option value="">Sin proyecto</option>
      ${cuentas().map((c) => `<option value="${esc(c.id)}"${it.proyecto === c.id ? " selected" : ""}>${esc(c.ruta)}</option>`).join("")}
      ${it.proyecto && !nombreProyecto(it.proyecto) ? `<option value="${esc(it.proyecto)}" selected>(cuenta que ya no está)</option>` : ""}
    </select></label>
    <label>El día <input type="date" data-a="dia" value="${esc(it.dia || "")}"> <small class="gris">sin día, flota en hoy</small></label>
    <label>Hora <input type="time" data-a="hora" value="${esc(it.hora || "")}"></label>
    <div class="botones">${it.hecho ? `<button class="mini" data-a="reabrir">Volver a pendiente</button>` : ""}
      <button class="mini" data-a="borrar">Borrar</button></div>`;
  const up = (x) => F.updateDoc(F.doc(db, "items", it.id), { ...x, actualizadoEn: F.serverTimestamp() }).catch(fallo);
  for (const b of d.querySelectorAll("[data-imp] [data-v]")) b.onclick = () => up({ importancia: Number(b.dataset.v) });
  d.querySelector('[data-a="titulo"]').onchange = (ev) => {
    const titulo = ev.target.value.trim().slice(0, 120);
    if (!titulo) { ev.target.value = it.titulo; return aviso("El título no puede quedar vacío.", true); }
    up({ titulo });
  };
  d.querySelector('[data-a="proyecto"]').onchange = (ev) => up({ proyecto: ev.target.value || null });
  d.querySelector('[data-a="dia"]').onchange = (ev) => up({ dia: ev.target.value || null });
  d.querySelector('[data-a="hora"]').onchange = (ev) => up({ hora: ev.target.value || null });
  const re = d.querySelector('[data-a="reabrir"]');
  if (re) re.onclick = () => up({ hecho: false, hechoPor: null });
  d.querySelector('[data-a="borrar"]').onclick = () => {
    if (!confirm(`¿Borrar «${it.titulo}»?`)) return;
    abierto = null;
    F.deleteDoc(F.doc(db, "items", it.id)).catch(fallo);
  };
  return d;
}

/* hoy-2 (17-nov-2026, etapa 5): el widget «Hoy» de Android abre Timón con
   ?solapa=inicio&abrir=it:<id> — la `clave` del renglón de `hoy/{uid}` —, y
   el ítem aparece con su ficha abierta. Una clave que no es de un ítem, o de
   uno que ya no está, abre «Hoy» y nada más. */
export function irAItem(clave) {
  const m = /^it:(.{1,80})$/.exec(String(clave || ""));
  abierto = m ? m[1] : null;
  filtroProy = "";
}

export function pintarInicio() {
  const v = $("v-inicio"); v.replaceChildren();

  const cab = document.createElement("div"); cab.className = "hoy-cab";
  const fecha = new Date(E.hoy + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "numeric" });
  cab.innerHTML = `<h2>Hoy</h2><span class="gris">${esc(fecha)}</span>`;
  v.append(cab);

  // El proyecto: un solo filtro, discreto; sólo los que tienen algo pendiente (y el elegido).
  const cs = cuentas().filter((c) => c.nivel === 0);
  if (filtroProy && filtroProy !== "-" && !cuentas().some((c) => c.id === filtroProy)) filtroProy = "";
  const pendientes = todos().filter((i) => !i.hecho);
  const cuantas = (k) => k === "" ? pendientes.length : k === "-" ? pendientes.filter((i) => !i.proyecto).length
    : pendientes.filter((i) => idsDeCuenta(cuentas(), k).has(i.proyecto)).length;
  const opciones = [["", "Todos"], ...cs.map((c) => [c.id, c.nombre]), ["-", "Sin proyecto"]]
    .filter(([k]) => k === "" || k === filtroProy || cuantas(k) > 0);
  if (cs.length && opciones.length > 1) {
    const np = document.createElement("nav");
    np.className = "chips"; np.setAttribute("aria-label", "Proyecto");
    // hoy-5: cada chip lleva el color suave de su proyecto (el fondo al 10 %, un punto); el elegido, neutro y marcado.
    np.innerHTML = opciones.map(([k, t]) => { const c = k && k !== "-" ? colorProy(k) : "";
      return `<button data-proy="${esc(k)}" aria-selected="${filtroProy === k}"${c ? ` class="con-p" style="--p:${c}"` : ""}>${puntoP(c)}${esc(t)}${k !== "" ? ` <small>${cuantas(k)}</small>` : ""}</button>`; }).join("");
    for (const b of np.querySelectorAll("[data-proy]")) b.onclick = () => {
      filtroProy = b.dataset.proy; abierto = null; verTodo = false;
      try { localStorage.setItem("tiempos:proyecto", filtroProy); } catch { /* sin memoria: igual anda */ }
      repintar();
    };
    v.append(np);
  }

  // La lista, en el orden de nucleo.js: el foco primero; el resto, plegado.
  const lista = ordenarItems(visibles(), E.hoy);
  const abiertas = lista.filter((i) => !i.hecho), hechas = lista.filter((i) => i.hecho);
  const foco = abiertas.slice(0, FOCO), resto = [...abiertas.slice(FOCO), ...hechas];
  const seccion = (t) => { const h = document.createElement("h3"); h.className = "sec-hoy"; h.textContent = t; return h; };
  if (!lista.length) {
    const p = document.createElement("p"); p.className = "gris";
    p.textContent = "Nada pendiente por acá. Agregá abajo.";
    v.append(p);
  }
  // hoy-5: cada sección en su tarjeta (un tono de superficie, sin bordes).
  const caja = (filas) => { const c = document.createElement("div"); c.className = "caja-hoy"; for (const it of filas) c.append(filaItem(it)); return c; };
  if (foco.length) { v.append(seccion("Foco de hoy")); v.append(caja(foco)); }
  if (resto.length) {
    const ver = document.createElement("button"); ver.type = "button"; ver.className = "link ver-resto";
    ver.textContent = verTodo ? "Ocultar el resto" : `Ver lo que sigue (${resto.length})`;
    ver.onclick = () => { verTodo = !verTodo; repintar(); };
    if (verTodo) { v.append(seccion("Después")); v.append(caja(resto)); }
    v.append(ver);
  }

  // Hacer: agregar. Mirando un proyecto nace en él; Mío o Familia lo elige la persona (hoy-5).
  const quien = document.createElement("div");
  quien.className = "segmentado chico"; quien.setAttribute("role", "group"); quien.setAttribute("aria-label", "De quién es lo que agregás");
  quien.innerHTML = [["mio", "Mío"], ["fam", "Familia"]].map(([k, t]) => `<button type="button" data-nuevo="${k}" aria-pressed="${nuevoEsp === k}" aria-selected="${nuevoEsp === k}">${t}</button>`).join("");
  for (const b of quien.querySelectorAll("[data-nuevo]")) b.onclick = () => {
    nuevoEsp = b.dataset.nuevo;
    try { localStorage.setItem("tiempos:nuevo", nuevoEsp); } catch { /* sin memoria: igual anda */ }
    for (const x of quien.querySelectorAll("[data-nuevo]")) { const si = x === b; x.setAttribute("aria-pressed", String(si)); x.setAttribute("aria-selected", String(si)); }
  };
  v.append(quien);
  const form = document.createElement("form");
  form.className = "fila-agregar";
  form.innerHTML = `<input id="inicio-texto" maxlength="120" placeholder="Agregar…" aria-label="Agregar un pendiente" autocomplete="off">
    <button class="boton" aria-label="Agregar">＋</button>`;
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const titulo = form.querySelector("input").value.trim().slice(0, 120);
    if (!titulo) return;
    const conProyecto = filtroProy && filtroProy !== "-";
    const it = { tipo: "tarea", espacio: nuevoEsp === "fam" ? "familia" : espacioPersonal(E.yo.uid),
      titulo, importancia: 1, hecho: false, creadoPor: E.yo.uid };
    // hoy-3: lo que se agrega mirando un proyecto nace en ese proyecto.
    if (conProyecto) it.proyecto = filtroProy;
    const e = validarItem(it, E.yo.uid);
    if (e.length) return aviso("No se pudo: " + e[0], true);
    try {
      await F.setDoc(F.doc(db, "items", idNuevo("it")), { ...it, creadoEn: F.serverTimestamp(), actualizadoEn: F.serverTimestamp() });
      form.querySelector("input").value = "";
    } catch (err) { fallo(err); }
  };
  v.append(form);
}

/* ── Publicar `hoy/{uid}` (la materialización) ───────────────────────────────
   Con un respiro y sólo si cambió: tres tildes seguidos escriben una vez, y
   abrir la app con todo igual no escribe nada. El error se calla a propósito
   (el dato de verdad ya quedó en `items`; el documento se rearma al próximo
   cambio o apertura), salvo la primera vez, que avisa. */
let timerHoy = null, ultimoHoy = "", aviseErrorHoy = false;
export function publicarHoy() {
  if (!E.yo || !E.miembro) return;
  clearTimeout(timerHoy);
  timerHoy = setTimeout(async () => {
    // hoy-5: el widget muestra lo mismo que la pantalla: los ítems Y las tareas de siempre (su tilde va a tareas/).
    const doc = materializarHoy(todos(), E.yo.uid, E.hoy, { cuentas: cuentas() });
    const firma = JSON.stringify(doc);
    if (firma === ultimoHoy) return;
    try {
      await F.setDoc(F.doc(db, "hoy", E.yo.uid), { ...doc, actualizadoEn: F.serverTimestamp() });
      ultimoHoy = firma;
    } catch (e) {
      if (!aviseErrorHoy) { aviseErrorHoy = true; aviso("No se pudo armar el documento del widget (hoy/): " + (e.code || e.message) + ". Hay que publicar firestore.rules v25.", true); }
    }
  }, 2000);
}
