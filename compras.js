// ─────────────────────────────────────────────────────────────────────────────
// compras.js — La lista de compras de la casa. Sello: compras-1
//
// Pedido de Mauro, 30-sep-2026, desde el globo 💡: «Falta la lista de compras.
// En categorías editables —súper, ferretería, o alimentos, materiales—;
// dentro de esas listas, al entrar se despliega la lista con checkbox.»
//
// Vive en `familia/compras` (mapas, no listas: cada tilde toca una sola
// clave y dos teléfonos no se pisan; ver `listasDeCompras` en nucleo.js). Es
// de los dos, como todo lo de `familia/`, y por eso no hizo falta una regla
// nueva. Qué lista está desplegada es cosa de ESTE teléfono.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, listasDeCompras, idNuevo, LISTAS_DE_ENTRADA } from "./nucleo.js";
import { E, repintar, fallo } from "./estado.js";

const abiertas = new Set();

const guardar = (listas) =>
  F.setDoc(F.doc(db, "familia", "compras"), { listas, actualizadoEn: F.serverTimestamp() }, { merge: true }).catch(fallo);

function nuevaLista(nombre) {
  const id = idNuevo("l");
  abiertas.add(id);
  guardar({ [id]: { nombre: nombre.slice(0, 40), orden: Date.now(), items: {} } });
}

export function pintarCompras(v) {
  const listas = listasDeCompras(E.compras);
  let h = "";
  if (!listas.length) h += `<p class="gris">Todavía no hay listas. Empezá por una de éstas o creá la tuya abajo:</p>
    <div class="botones">${LISTAS_DE_ENTRADA.map((n) => `<button class="mini" data-lista-base="${esc(n)}">＋ ${esc(n)}</button>`).join("")}</div>`;
  for (const l of listas) {
    const ab = abiertas.has(l.id);
    h += `<div class="tarjeta compra">
      <div class="fila"><button class="flecha" data-abrir-lista="${esc(l.id)}" aria-expanded="${ab}">${ab ? "▾" : "▸"}</button>
        <span class="txt" data-abrir-lista="${esc(l.id)}"><b>${esc(l.nombre)}</b>
          <small class="gris">${l.faltan ? `${l.faltan} por comprar` : l.items.length ? "todo comprado" : "vacía"}</small></span></div>
      ${ab ? `${l.items.map((it) => `<div class="item-compra${it.hecho ? " hecho" : ""}">
          <label class="check"><input type="checkbox" data-item="${esc(l.id)}|${esc(it.id)}"${it.hecho ? " checked" : ""}> ${esc(it.texto)}</label>
          <button class="mini nota" data-sacar="${esc(l.id)}|${esc(it.id)}" title="Sacar">✕</button></div>`).join("")}
        <form class="dos" data-nuevo-item="${esc(l.id)}"><input name="texto" maxlength="80" placeholder="＋ Agregar a ${esc(l.nombre)}" required><button class="mini">Agregar</button></form>
        <div class="botones">${l.items.some((i) => i.hecho) ? `<button class="mini" data-limpiar="${esc(l.id)}">Sacar lo comprado</button>` : ""}
          <button class="mini" data-renombrar="${esc(l.id)}">Cambiar el nombre</button>
          <button class="mini" data-borrar-lista="${esc(l.id)}">Borrar la lista</button></div>` : ""}
    </div>`;
  }
  h += `<form class="dos" data-nueva-lista><input name="nombre" maxlength="40" placeholder="Lista nueva: súper, ferretería, materiales…" required><button class="mini">Crear</button></form>`;
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
  todos("[data-item]", (c) => c.onchange = () => {
    const [lid, iid] = c.dataset.item.split("|");
    guardar({ [lid]: { items: { [iid]: { hecho: c.checked, por: E.yo.uid } } } });
  });
  todos("[data-nuevo-item]", (f) => f.onsubmit = (ev) => {
    ev.preventDefault();
    const t = f.texto.value.trim(); if (!t) return;
    guardar({ [f.dataset.nuevoItem]: { items: { [idNuevo("i")]: { texto: t.slice(0, 80), hecho: false, por: E.yo.uid, orden: Date.now() } } } });
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
