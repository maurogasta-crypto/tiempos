// ─────────────────────────────────────────────────────────────────────────────
// lugares.js — Mis lugares y dónde estoy. Sello: lugares-2
//
// 7-oct-2026, tiempos:V7 (Mauro): la alarma de salir cuenta el viaje; para eso
// hace falta saber de dónde se sale. La casa depende del país en el que está
// (Uruguay o Brasil), y lo dice la ubicación APROXIMADA del teléfono, que se
// pide sólo al armar un plan y no se guarda. Los lugares de las actividades se
// anotan solos en una lista y se les pone la dirección una vez.
//
// TODO vive en `agendas/{uid}` —`casas` y `lugares`—, que sólo lee su dueño:
// ni el otro, ni el agente salvo que el dueño lo encienda (abajo). Ninguna
// dirección entra al código, que es público.
//
// lugares-2 (8-oct-2026, Mauro: «quiero que la IA pueda organizar mi agenda
// editando los contenidos… que pueda ayudarme activamente»): el interruptor
// «Claude organiza mi agenda» escribe `agente: true` en MI agenda. Con eso
// (reglas v11) el agente la lee, mueve y agrega actividades y sus alarmas,
// con una copia de cada cambio en `agendas/{uid}/copias` que sólo veo yo.
// Es de cada uno: encenderlo no abre la agenda del otro.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F } from "./firebase-init.js";
import { esc, paisDe, PAISES_CASA, lugarNuevo, claveLugar } from "./nucleo.js";
import { E, aviso, repintar, fallo } from "./estado.js";

const guardar = (campos) => F.setDoc(F.doc(db, "agendas", E.yo.uid), { ...campos, actualizadoEn: F.serverTimestamp() }, { merge: true });

/** Anota el lugar de una actividad si todavía no está. Nunca frena lo que se guarda. */
export function recordarLugar(nombre) {
  const n = lugarNuevo(E.lugares, nombre);
  if (!n) return;
  guardar({ lugares: { [n[0]]: n[1] } }).catch(() => {});
}

/** El país donde está ahora, por la ubicación aproximada. "" si no se puede (sin permiso, sin señal). */
export function dondeEstoy(espera = 4000) {
  return new Promise((ok) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return ok("");
    const t = setTimeout(() => ok(E.pais || ""), espera);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); E.pais = paisDe(p.coords.latitude, p.coords.longitude); ok(E.pais); },
      () => { clearTimeout(t); ok(E.pais || ""); },
      { enableHighAccuracy: false, maximumAge: 3600e3, timeout: espera });
  });
}

/** El interruptor de «Claude organiza mi agenda» (lugares-2). */
export function pintarAgente(v) {
  const c = document.createElement("div");
  c.className = "tarjeta ficha";
  c.innerHTML = `<label class="check"><input type="checkbox" data-agente ${E.agenteAgenda ? "checked" : ""}> 🤝 Claude organiza mi agenda</label>
    <p class="gris">${E.agenteAgenda
      ? "Encendido: Claude puede leer tu agenda y tus lugares, mover y agregar actividades y poner alarmas con el viaje. Cada cambio dice ✨ y deja una copia de cómo estaba, que sólo ves vos. No toca la agenda de nadie más."
      : "Apagado: Claude no lee ni toca tu agenda. Encendelo si querés que te ayude a ordenarla (mover, agregar, alarmas con el viaje). Lo apagás cuando quieras."}</p>`;
  v.append(c);
  const i = c.querySelector("[data-agente]");
  i.onchange = () => guardar({ agente: i.checked })
    .then(() => aviso(i.checked ? "Listo: Claude puede organizar tu agenda." : "Apagado: Claude ya no la ve."))
    .catch((e) => { i.checked = !i.checked; fallo(e); });
}

let abiertos = false;
export function pintarLugares(v) {
  const lugares = Object.entries(E.lugares || {}).sort((a, b) => String(a[1].nombre).localeCompare(String(b[1].nombre)));
  const sinDir = lugares.filter(([, l]) => !l.direccion).length;
  const c = document.createElement("div");
  c.innerHTML = `<h2>📍 Mis lugares <button class="mini" data-lug-ver>${abiertos ? "Cerrar" : "Ver"}</button></h2>
    ${abiertos ? `<div class="tarjeta ficha">
      <p class="gris">De acá sale el viaje de la alarma de salir. La casa se elige sola según el país en el que estés (ubicación aproximada del teléfono). Sólo lo ves vos.</p>
      ${Object.entries(PAISES_CASA).map(([k, n]) => `<label>Casa en ${esc(n)} <input data-casa="${k}" maxlength="160" value="${esc((E.casas || {})[k] || "")}" placeholder="Calle, número, localidad"></label>`).join("")}
      <h3>Lugares de tus actividades${sinDir ? ` · ${sinDir} sin dirección` : ""}</h3>
      ${lugares.length ? lugares.map(([k, l]) => `<div class="fila"><label class="txt">${esc(l.nombre)} <input data-lug="${esc(k)}" maxlength="160" value="${esc(l.direccion || "")}" placeholder="Dirección, localidad"></label>
        <button class="mini nota" data-lug-sacar="${esc(k)}" title="Sacar">✕</button></div>`).join("") : `<p class="gris">Todavía ninguno: se anotan solos al agendar algo con lugar.</p>`}
      <form class="fila" data-lug-nuevo><input name="nombre" maxlength="80" placeholder="Lugar nuevo (p. ej. Intendencia de Atlántida)"><button class="mini">＋</button></form>
    </div>` : sinDir ? `<p class="gris">${sinDir} lugar(es) sin dirección: tocá «Ver» para completarlos.</p>` : ""}`;
  v.append(c);
  c.querySelector("[data-lug-ver]").onclick = () => { abiertos = !abiertos; repintar(); };
  for (const i of c.querySelectorAll("[data-casa]")) i.onchange = () => guardar({ casas: { [i.dataset.casa]: i.value.trim().slice(0, 160) } }).then(() => aviso("Guardada.")).catch(fallo);
  for (const i of c.querySelectorAll("[data-lug]")) i.onchange = () =>
    guardar({ lugares: { [i.dataset.lug]: { ...(E.lugares[i.dataset.lug] || {}), direccion: i.value.trim().slice(0, 160) } } }).then(() => aviso("Guardada.")).catch(fallo);
  for (const b of c.querySelectorAll("[data-lug-sacar]")) b.onclick = () => guardar({ lugares: { [b.dataset.lugSacar]: F.deleteField() } }).catch(fallo);
  const f = c.querySelector("[data-lug-nuevo]");
  if (f) f.onsubmit = (ev) => {
    ev.preventDefault();
    const n = lugarNuevo(E.lugares, f.nombre.value);
    if (!n) return aviso(claveLugar(f.nombre.value) ? "Ese lugar ya está." : "Escribí el nombre.", true);
    guardar({ lugares: { [n[0]]: n[1] } }).catch(fallo);
  };
}
