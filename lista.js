// ─────────────────────────────────────────────────────────────────────────────
// lista.js — La página de una lista compartida sin cuenta. Sello: lista-1
//
// compras-4 (9-oct-2026). Lee `compartidas/{token}` en vivo y deja tildar y
// agregar cosas, con el nombre que la persona escribe una vez (se recuerda
// en ESTE teléfono). Escribe sólo `items.<id>` y `actualizadoEn`, que es lo
// único que la regla v13 deja cambiar sin sesión. Se dibuja con el mismo
// `recorridoDeCompra` y las mismas clases que el modo súper de Tiempos.
// ─────────────────────────────────────────────────────────────────────────────

import { cargar, db, F } from "./firebase-init.js";
import { esc, listasDeCompras, recorridoDeCompra, idNuevo } from "./nucleo.js";

const v = document.getElementById("v");
const token = (new URLSearchParams(location.search).get("c") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
const CLAVE = "tiempos-lista-nombre";
let nombre = "";
try { nombre = localStorage.getItem(CLAVE) || ""; } catch { nombre = ""; }
let vistos = null, ultimo = null;

const cartel = (t) => { v.innerHTML = `<div class="tarjeta" style="margin-top:2rem"><p>${t}</p></div>`; };

function pintar(d) {
  ultimo = d;
  const [l] = listasDeCompras({ listas: { x: { nombre: d.nombre || "Lista", items: d.items || {}, secciones: d.secciones || {} } } });
  const vence = d.vence && d.vence.toMillis ? d.vence.toMillis() : 0;
  const ahora = new Set(l.items.filter((i) => i.hecho).map((i) => i.id));
  // Quien tildó desde Tiempos deja su nombre en `porNombre`; lo propio no se marca.
  const quien = (it) => it.porNombre && (it.por || it.porNombre !== nombre) ? it.porNombre : "";
  const nuevo = (it) => vistos && it.hecho && !vistos.has(it.id) && quien(it);
  let h = `<div class="super">
    <div class="super-cab"><div><b>🛒 ${esc(l.nombre)}</b><small class="gris">${l.faltan ? `faltan ${l.faltan} de ${l.items.length}` : l.items.length ? "¡todo en el carrito!" : "vacía"}</small></div></div>
    <form class="dos" data-nombre><input name="n" maxlength="30" aria-label="Tu nombre" placeholder="Tu nombre, para que vean quién lo consiguió" value="${esc(nombre)}"><button class="mini">${nombre ? "Cambiar" : "Listo"}</button></form>`;
  for (const g of recorridoDeCompra(l)) {
    if (l.secciones.length) h += `<h3 class="pasillo">${esc(g.nombre)}</h3>`;
    h += g.items.map((it) => `<label class="item-super${it.hecho ? " hecho" : ""}${nuevo(it) ? " recien" : ""}">
        <input type="checkbox" data-item="${esc(it.id)}"${it.hecho ? " checked" : ""}>
        <span><span class="t">${esc(it.texto)}</span>${it.nota ? `<small class="t">${esc(it.nota)}</small>` : ""}${it.hecho && quien(it)
          ? `<small class="quien">✓ ${esc(quien(it))}</small>` : ""}</span></label>`).join("");
  }
  vistos = ahora;
  h += `<form class="agregar-lista" data-agregar><input name="t" maxlength="80" placeholder="＋ Agregar algo a la lista" required>${l.secciones.length
      ? `<select name="s" aria-label="Pasillo">${l.secciones.map((x) => `<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join("")}<option value="">Otras cosas</option></select>` : ""}<button class="mini">Agregar</button></form>
    <p class="gris" style="margin-top:1.5rem">Lista compartida desde Tiempos. Lo que tildás lo ven al instante.${vence ? ` El enlace se cierra el ${esc(new Date(vence).toLocaleString("es-UY", { weekday: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }))} h.` : ""}</p></div>`;
  v.innerHTML = h;

  const ref = F.doc(db, "compartidas", token);
  const yo = () => nombre || "Alguien";
  const error = (e) => alert(e && e.code === "permission-denied" ? "El enlace venció o se cerró." : "No se pudo guardar: fijate la señal y probá de nuevo.");
  v.querySelector("[data-nombre]").onsubmit = (ev) => {
    ev.preventDefault();
    nombre = ev.target.elements.n.value.trim().slice(0, 30);
    try { localStorage.setItem(CLAVE, nombre); } catch { /* sin almacenamiento: se usa sólo esta vez */ }
    pintar(ultimo);
  };
  for (const c of v.querySelectorAll("[data-item]")) c.onchange = () => {
    const k = "items." + c.dataset.item;
    F.updateDoc(ref, { [k + ".hecho"]: c.checked, [k + ".porNombre"]: yo(), [k + ".por"]: F.deleteField(), actualizadoEn: F.serverTimestamp() }).catch(error);
  };
  v.querySelector("[data-agregar]").onsubmit = (ev) => {
    ev.preventDefault();
    const t = ev.target.elements.t.value.trim(); if (!t) return;
    ev.target.elements.t.blur();      // así la pintada que trae lo agregado no se saltea
    const it = { texto: t.slice(0, 80), hecho: false, orden: Date.now(), porNombre: yo() };
    if (ev.target.elements.s && ev.target.elements.s.value) it.seccion = ev.target.elements.s.value;
    F.updateDoc(ref, { ["items." + idNuevo("i")]: it, actualizadoEn: F.serverTimestamp() }).catch(error);
  };
}

if (token.length < 20) cartel("Este enlace no está completo. Pedile a quien te lo mandó que lo vuelva a compartir.");
else {
  try {
    await cargar({ casaVerde: false });
    F.onSnapshot(F.doc(db, "compartidas", token), (d) => {
      if (!d.exists()) { cartel("Esta lista ya no está compartida."); return; }
      const foco = document.activeElement && document.activeElement.name;
      if (foco === "t" || foco === "n") { ultimo = d.data(); return; }   // no pisar lo que se está escribiendo
      pintar(d.data());
    }, (e) => cartel(e && e.code === "permission-denied"
      ? "El enlace venció o se cerró. Pedile a quien te lo mandó que lo renueve."
      : "No se pudo traer la lista. Fijate la señal y volvé a abrir el enlace."));
  } catch {
    cartel("No se pudo cargar. Suele ser falta de señal: volvé a abrir el enlace.");
  }
}
