// ─────────────────────────────────────────────────────────────────────────────
// hoy.js — La pantalla «Hoy»: los ítems de todos mis espacios. Sello: hoy-3 (19-nov-2026: cada ítem puede ser de un proyecto)
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
         ordenarItems, cuandoItem, urgenciaItem, validarItem, materializarHoy, cuentasDe, idsDeCuenta } from "./nucleo.js";
import { E, $, aviso, nombreDe, fallo, repintar } from "./estado.js";

/* El filtro de espacio es de esta pantalla y de este teléfono, como el
   «de quién» de Tareas: no se guarda en la base. */
let filtro = (() => { try { return localStorage.getItem("tiempos:espacio") || "todo"; } catch { return "todo"; } })();
let abierto = null;

/* hoy-3: el filtro de proyecto también es de esta pantalla y de este teléfono.
   "" = todos, "-" = sin proyecto, otro = el id de una cuenta (y sus partes).
   Los proyectos son las cuentas de Plata → Cuentas: no hay un catálogo aparte. */
let filtroProy = (() => { try { return localStorage.getItem("tiempos:proyecto") || ""; } catch { return ""; } })();
const cuentas = () => cuentasDe(E.cuentasDoc);
const nombreProyecto = (id) => (cuentas().find((c) => c.id === id) || {}).nombre || "";
const delProyecto = (i) => filtroProy === "" || (filtroProy === "-" ? !i.proyecto : idsDeCuenta(cuentas(), filtroProy).has(i.proyecto));

const COLOR_ESPACIO = { mio: "#d8a657", fam: "#c87f5a" };
const puntoDe = (espacio) =>
  `<span class="punto" style="--c:${espacio === "familia" ? COLOR_ESPACIO.fam : COLOR_ESPACIO.mio}" title="${espacio === "familia" ? "Familia" : "Mío"}"></span>`;

const misItems = () => (E.items || []).filter((i) => esEspacioMio(i.espacio, E.yo.uid));
const visibles = () => misItems().filter((i) =>
  (filtro === "todo" || (filtro === "fam" ? i.espacio === "familia" : i.espacio === espacioPersonal(E.yo.uid))) && delProyecto(i));

function filaItem(it) {
  const f = document.createElement("div");
  f.className = "fila-tarea" + (it.hecho ? " hecha" : "");
  const esta = abierto === it.id;
  const cuando = cuandoItem(it, E.hoy);
  const vencido = urgenciaItem(it, E.hoy) === "vencido";
  f.innerHTML = `<div class="fila">
      <button class="tilde" aria-label="${it.hecho ? "Volver a pendiente" : "Marcar hecha"}">${it.hecho ? "✓" : "○"}</button>
      <span class="txt">${esc(it.titulo)}${it.importancia === 2 && !it.hecho ? ` <b class="alta" title="Importancia alta">!</b>` : ""}
        ${cuando ? ` <small class="${vencido ? "mal" : "gris"}">${esc(cuando)}</small>` : ""}
        ${it.proyecto && nombreProyecto(it.proyecto) ? ` <small class="gris">· ${esc(nombreProyecto(it.proyecto))}</small>` : ""}</span>
      ${puntoDe(it.espacio)}
      <button class="mas" aria-label="Más">${esta ? "▴" : "⋯"}</button></div>`;
  f.querySelector(".tilde").onclick = () =>
    F.updateDoc(F.doc(db, "items", it.id), { hecho: !it.hecho, hechoPor: it.hecho ? null : E.yo.uid, actualizadoEn: F.serverTimestamp() }).catch(fallo);
  f.querySelector(".mas").onclick = () => { abierto = esta ? null : it.id; repintar(); };
  if (esta) f.append(fichaItem(it));
  return f;
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
  filtro = "todo"; filtroProy = "";
}

export function pintarInicio() {
  const v = $("v-inicio"); v.replaceChildren();

  // Mirar: el filtro de espacio (Casa Verde y los otros negocios llegan con la etapa 8).
  const nav = document.createElement("nav");
  nav.className = "solapas chicas"; nav.setAttribute("aria-label", "Espacio");
  nav.innerHTML = [["todo", "Todo"], ["mio", "Mío"], ["fam", "Familia"]]
    .map(([k, t]) => `<button data-esp="${k}" aria-selected="${filtro === k}">${t}</button>`).join("");
  for (const b of nav.querySelectorAll("[data-esp]")) b.onclick = () => {
    filtro = b.dataset.esp; abierto = null;
    try { localStorage.setItem("tiempos:espacio", filtro); } catch { /* sin memoria: igual anda */ }
    repintar();
  };
  v.append(nav);

  // hoy-3: y el proyecto, si hay cuentas. Un filtro que apunta a una cuenta dada de baja se suelta.
  const cs = cuentas().filter((c) => c.nivel === 0);
  if (filtroProy && filtroProy !== "-" && !cuentas().some((c) => c.id === filtroProy)) filtroProy = "";
  if (cs.length) {
    const np = document.createElement("nav");
    np.className = "solapas chicas"; np.setAttribute("aria-label", "Proyecto");
    np.innerHTML = [["", "Todos"], ...cs.map((c) => [c.id, c.nombre]), ["-", "Sin proyecto"]]
      .map(([k, t]) => `<button data-proy="${esc(k)}" aria-selected="${filtroProy === k}">${esc(t)}</button>`).join("");
    for (const b of np.querySelectorAll("[data-proy]")) b.onclick = () => {
      filtroProy = b.dataset.proy; abierto = null;
      try { localStorage.setItem("tiempos:proyecto", filtroProy); } catch { /* sin memoria: igual anda */ }
      repintar();
    };
    v.append(np);
  }

  // La lista, en el orden de nucleo.js: lo hecho al final, tachado.
  const lista = ordenarItems(visibles(), E.hoy);
  if (!lista.length) {
    const p = document.createElement("p"); p.className = "gris";
    p.textContent = "Nada por acá. Agregá abajo, o seguí usando Tareas: durante la semana de prueba conviven.";
    v.append(p);
  }
  for (const it of lista) v.append(filaItem(it));

  // Hacer: agregar al espacio del filtro («Todo» anota en Mío).
  const form = document.createElement("form");
  form.className = "fila-agregar";
  form.innerHTML = `<input id="inicio-texto" maxlength="120" placeholder="Agregar…" aria-label="Agregar un pendiente" autocomplete="off">
    <button class="boton" aria-label="Agregar">＋</button>`;
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const titulo = form.querySelector("input").value.trim().slice(0, 120);
    if (!titulo) return;
    const it = { tipo: "tarea", espacio: filtro === "fam" ? "familia" : espacioPersonal(E.yo.uid),
      titulo, importancia: 1, hecho: false, creadoPor: E.yo.uid };
    // hoy-3: lo que se agrega mirando un proyecto nace en ese proyecto.
    if (filtroProy && filtroProy !== "-") it.proyecto = filtroProy;
    const e = validarItem(it, E.yo.uid);
    if (e.length) return aviso("No se pudo: " + e[0], true);
    try {
      await F.setDoc(F.doc(db, "items", idNuevo("it")), { ...it, creadoEn: F.serverTimestamp(), actualizadoEn: F.serverTimestamp() });
      form.querySelector("input").value = "";
    } catch (err) { fallo(err); }
  };
  v.append(form);

  const pie = document.createElement("p"); pie.className = "gris chico";
  pie.textContent = "Los puntos: dorado es tuyo, terracota es de la familia. El orden: la fecha pone la urgencia y vos la importancia.";
  v.append(pie);
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
    const doc = materializarHoy(misItems(), E.yo.uid, E.hoy, { cuentas: cuentas() });
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
