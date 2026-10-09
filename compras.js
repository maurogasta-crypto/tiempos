// ─────────────────────────────────────────────────────────────────────────────
// compras.js — La lista de compras de la casa. Sello: compras-2
//
// Pedido de Mauro, 30-sep-2026, desde el globo 💡: «Falta la lista de compras.
// En categorías editables —súper, ferretería, o alimentos, materiales—;
// dentro de esas listas, al entrar se despliega la lista con checkbox.»
//
// Vive en `familia/compras` (mapas, no listas: cada tilde toca una sola
// clave y dos teléfonos no se pisan; ver `listasDeCompras` en nucleo.js). Es
// de los dos, como todo lo de `familia/`, y por eso no hizo falta una regla
// nueva. Qué lista está desplegada es cosa de ESTE teléfono.
//
// compras-2 (9-oct-2026). Mauro: «quiero que mi lista de compras se visualice
// como ésta cuando vaya al súper». El MODO SÚPER muestra una sola lista, por
// pasillos en el orden en que se camina el local, con tildes grandes, y lo
// tildado se tacha y se queda en su lugar (`recorridoDeCompra`). Mientras está
// abierto la pantalla no se apaga, si el teléfono lo deja. Al terminar,
// «Destildar todo» deja la lista lista para la próxima vez.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, listasDeCompras, recorridoDeCompra, idNuevo, LISTAS_DE_ENTRADA } from "./nucleo.js";
import { E, repintar, fallo } from "./estado.js";

const abiertas = new Set();
let enSuper = null;          // la lista abierta en modo súper, en ESTE teléfono
let despierta = null;        // el pedido de pantalla encendida

async function mantenerDespierta(si) {
  try {
    if (si && !despierta && navigator.wakeLock) despierta = await navigator.wakeLock.request("screen");
    if (!si && despierta) { await despierta.release(); despierta = null; }
  } catch { despierta = null; }   // sin permiso o sin soporte: la lista anda igual
}
// El sistema suelta el pedido cuando la app pasa a segundo plano: al volver,
// si seguía en el súper, se vuelve a pedir.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && enSuper) { despierta = null; mantenerDespierta(true); }
});

const guardar = (listas) =>
  F.setDoc(F.doc(db, "familia", "compras"), { listas, actualizadoEn: F.serverTimestamp() }, { merge: true }).catch(fallo);

function nuevaLista(nombre) {
  const id = idNuevo("l");
  abiertas.add(id);
  guardar({ [id]: { nombre: nombre.slice(0, 40), orden: Date.now(), items: {} } });
}

function pintarSuper(l) {
  const grupos = recorridoDeCompra(l);
  const conPasillos = l.secciones.length > 0;
  let h = `<div class="super">
    <div class="super-cab"><button class="mini" data-salir-super>← Listas</button>
      <div><b>🛒 ${esc(l.nombre)}</b><small class="gris">${l.faltan ? `faltan ${l.faltan} de ${l.items.length}` : l.items.length ? "¡todo en el carrito!" : "vacía"}</small></div></div>`;
  for (const g of grupos) {
    if (conPasillos) h += `<h3 class="pasillo">${esc(g.nombre)}</h3>`;
    h += g.items.map((it) => `<label class="item-super${it.hecho ? " hecho" : ""}">
        <input type="checkbox" data-item="${esc(l.id)}|${esc(it.id)}"${it.hecho ? " checked" : ""}>
        <span>${esc(it.texto)}${it.nota ? `<small>${esc(it.nota)}</small>` : ""}</span></label>`).join("");
  }
  if (!l.items.length) h += `<p class="gris">La lista está vacía: agregá cosas desde «← Listas».</p>`;
  h += `<div class="botones">${l.items.some((i) => i.hecho) ? `<button class="mini" data-destildar="${esc(l.id)}">↺ Destildar todo</button>
      <button class="mini" data-limpiar="${esc(l.id)}">Sacar lo comprado</button>` : ""}</div></div>`;
  return h;
}

export function pintarCompras(v) {
  const listas = listasDeCompras(E.compras);
  const lSuper = enSuper && listas.find((l) => l.id === enSuper);
  if (enSuper && !lSuper) { enSuper = null; mantenerDespierta(false); }
  let h = "";
  if (lSuper) h = pintarSuper(lSuper);
  else {
  if (!listas.length) h += `<p class="gris">Todavía no hay listas. Empezá por una de éstas o creá la tuya abajo:</p>
    <div class="botones">${LISTAS_DE_ENTRADA.map((n) => `<button class="mini" data-lista-base="${esc(n)}">＋ ${esc(n)}</button>`).join("")}</div>`;
  for (const l of listas) {
    const ab = abiertas.has(l.id);
    h += `<div class="tarjeta compra">
      <div class="fila"><button class="flecha" data-abrir-lista="${esc(l.id)}" aria-expanded="${ab}">${ab ? "▾" : "▸"}</button>
        <span class="txt" data-abrir-lista="${esc(l.id)}"><b>${esc(l.nombre)}</b>
          <small class="gris">${l.faltan ? `${l.faltan} por comprar` : l.items.length ? "todo comprado" : "vacía"}</small></span></div>
      ${ab ? `<button class="super-boton" data-super="${esc(l.id)}">🛒 Ir al súper con esta lista</button>
        ${l.items.map((it) => `<div class="item-compra${it.hecho ? " hecho" : ""}">
          <label class="check"><input type="checkbox" data-item="${esc(l.id)}|${esc(it.id)}"${it.hecho ? " checked" : ""}> ${esc(it.texto)}${it.nota ? ` <small class="gris">· ${esc(it.nota)}</small>` : ""}</label>
          <button class="mini nota" data-sacar="${esc(l.id)}|${esc(it.id)}" title="Sacar">✕</button></div>`).join("")}
        <form class="dos" data-nuevo-item="${esc(l.id)}"><input name="texto" maxlength="80" placeholder="＋ Agregar a ${esc(l.nombre)}" required>${l.secciones.length
          ? `<select name="seccion" aria-label="Pasillo">${l.secciones.map((x) => `<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join("")}<option value="">Otras cosas</option></select>` : ""}<button class="mini">Agregar</button></form>
        <div class="botones">${l.items.some((i) => i.hecho) ? `<button class="mini" data-limpiar="${esc(l.id)}">Sacar lo comprado</button>` : ""}
          <button class="mini" data-renombrar="${esc(l.id)}">Cambiar el nombre</button>
          <button class="mini" data-borrar-lista="${esc(l.id)}">Borrar la lista</button></div>` : ""}
    </div>`;
  }
  h += `<form class="dos" data-nueva-lista><input name="nombre" maxlength="40" placeholder="Lista nueva: súper, ferretería, materiales…" required><button class="mini">Crear</button></form>`;
  }
  v.innerHTML = h;

  const todos = (sel, fn) => { for (const el of v.querySelectorAll(sel)) fn(el); };
  const lista = (id) => listas.find((l) => l.id === id);
  todos("[data-lista-base]", (b) => b.onclick = () => nuevaLista(b.dataset.listaBase));
  todos("[data-nueva-lista]", (f) => f.onsubmit = (ev) => {
    ev.preventDefault();
    const n = f.nombre.value.trim(); if (n) nuevaLista(n);
  });
  todos("[data-abrir-lista]", (b) => b.onclick = () => {
    const id = b.dataset.abrirLista;
    abiertas.has(id) ? abiertas.delete(id) : abiertas.add(id);
    repintar();
  });
  todos("[data-super]", (b) => b.onclick = () => { enSuper = b.dataset.super; mantenerDespierta(true); repintar(); scrollTo(0, 0); });
  todos("[data-salir-super]", (b) => b.onclick = () => { enSuper = null; mantenerDespierta(false); repintar(); });
  todos("[data-destildar]", (b) => b.onclick = () => {
    const l = lista(b.dataset.destildar); if (!l) return;
    guardar({ [l.id]: { items: Object.fromEntries(l.items.filter((i) => i.hecho).map((i) => [i.id, { hecho: false }])) } });
  });
  todos("[data-item]", (c) => c.onchange = () => {
    const [lid, iid] = c.dataset.item.split("|");
    guardar({ [lid]: { items: { [iid]: { hecho: c.checked, por: E.yo.uid } } } });
  });
  todos("[data-nuevo-item]", (f) => f.onsubmit = (ev) => {
    ev.preventDefault();
    const t = f.texto.value.trim(); if (!t) return;
    const it = { texto: t.slice(0, 80), hecho: false, por: E.yo.uid, orden: Date.now() };
    if (f.seccion && f.seccion.value) it.seccion = f.seccion.value;
    guardar({ [f.dataset.nuevoItem]: { items: { [idNuevo("i")]: it } } });
  });
  todos("[data-sacar]", (b) => b.onclick = () => {
    const [lid, iid] = b.dataset.sacar.split("|");
    guardar({ [lid]: { items: { [iid]: F.deleteField() } } });
  });
  todos("[data-limpiar]", (b) => b.onclick = () => {
    const l = lista(b.dataset.limpiar); if (!l) return;
    guardar({ [l.id]: { items: Object.fromEntries(l.items.filter((i) => i.hecho).map((i) => [i.id, F.deleteField()])) } });
  });
  todos("[data-renombrar]", (b) => b.onclick = () => {
    const l = lista(b.dataset.renombrar); if (!l) return;
    const n = prompt("Nombre de la lista", l.nombre);
    if (n && n.trim()) guardar({ [l.id]: { nombre: n.trim().slice(0, 40) } });
  });
  todos("[data-borrar-lista]", (b) => b.onclick = () => {
    const l = lista(b.dataset.borrarLista); if (!l) return;
    if (!confirm(`¿Borrar la lista «${l.nombre}» con todo lo que tiene?`)) return;
    abiertas.delete(l.id);
    guardar({ [l.id]: F.deleteField() });
  });
}
