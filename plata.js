// ─────────────────────────────────────────────────────────────────────────────
// plata.js — Lo disponible y los gastos de la familia. Sello: plata-7
//
// Pedido de Mauro, 29-sep-2026: «una parte donde se ingrese el dinero
// disponible y se registren los gastos, usando los mismos recursos que tiene
// Casa Verde para los gastos, con las fotos de las boletas, además de
// registrar pagos automáticos… la IA debe ayudar a que la información sea
// consistente y lo más detallada posible».
//
// ── LOS RECURSOS DE CASA VERDE, USADOS Y NO COPIADOS ────────────────────────
// · La foto: `CV2.subirImagen` de su núcleo (comprime y sube a su Cloudinary,
//   carpeta `tiempos`). Se sube AL GUARDAR, no al elegirla: si no, cada foto
//   que se mira y se descarta queda huérfana en Cloudinary, y sin `api_secret`
//   nadie la puede borrar desde acá.
// · La lectura: su función de IA (`CV2.NETLIFY + "/claude-proxy"`), la misma
//   que lee facturas en Casa Verde. Lo que devuelve es una SUGERENCIA: llena
//   el formulario y la persona lo corrige antes de guardar.
//
// ── LO QUE PROPONE EL AGENTE ────────────────────────────────────────────────
// Un gasto que aparece en un chat o en un WhatsApp llega como `propuesta`:
// arriba de todo, con lo que la IA ya entendió, editable. «Aprobar» escribe el
// movimiento de verdad; el agente nunca lo escribe solo.
//
// plata-5 (app-19, tiempos:V9, 8-oct-2026): cuatro solapas. «Día a día» es lo
// de siempre; «Fijos», «Año» y «Reparto» viven en finanzas.js.
//
// plata-7 (10-oct-2026, tiempos:V11): las CUENTAS. Mauro: «un control de los
// gastos de cada lugar y/o vehículo y/o persona». Un gasto o una entrada dice
// a qué cuenta fue (General Flores, su depósito, la Hilux…) y para quién;
// la plata sigue siendo toda de la familia —«los cobros entran a la
// administración general y los costos salen del presupuesto general»—, la
// cuenta sólo dice a qué fue. La solapa «Cuentas» las arma y muestra el
// balance de cada una, por moneda. Viven en `familia/cuentas` (cuentasDe).
// ─────────────────────────────────────────────────────────────────────────────

import { db, F, CV } from "./firebase-init.js";
import { esc, MONEDAS, CATEGORIAS, validarMovimiento, disponible, automaticosPendientes,
         leerSugerencia, esISO, MESES, TIPOS } from "./nucleo.js";
import { E, $, aviso, repintar, nombreDe, personas, fallo } from "./estado.js";
import { cuentasDe, idsDeCuenta, balanceDe, CLASES_CUENTA, idNuevo } from "./nucleo.js";
import { pintarFijos, pintarAnio, pintarReparto } from "./finanzas.js";

let mesVisto = null;              // "2026-09"
let form = null;                  // null | { id?, tipo, datos, archivo?, leyendo? }
let editandoProp = {};            // id de propuesta → datos editados

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nombreMes = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const sumarMes = (m, n) => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const categoriasDe = (tipo) => Object.entries(CATEGORIAS).filter(([, c]) => c.tipo === tipo);

let sub = "dia";                  // plata-5: dia | fijos | anio | reparto
const SUBS = { dia: "Día a día", cuentas: "Cuentas", fijos: "Fijos", anio: "Año", reparto: "Reparto" };

export function pintarPlata() {
  const v = $("v-plata");
  if (!mesVisto) mesVisto = E.hoy.slice(0, 7);
  const nav = `<nav class="solapas chicas">${Object.entries(SUBS).map(([k, n]) => `<button data-sub="${k}" aria-selected="${sub === k}">${n}</button>`).join("")}</nav>`;
  if (sub !== "dia") {
    v.innerHTML = nav + (sub === "anio" ? "" : `<div class="nav-semana"><button class="mini" data-mes="-1">‹</button><b>${esc(nombreMes(mesVisto))}</b><button class="mini" data-mes="1">›</button></div>`);
    if (sub === "cuentas") { v.innerHTML = nav; pintarCuentas(v); engancharSub(v); return; }
    if (sub === "fijos") pintarFijos(v, mesVisto);
    else if (sub === "anio") pintarAnio(v);
    else pintarReparto(v, mesVisto);
    engancharSub(v);
    return;
  }
  const movs = E.movs || [];
  const delMes = movs.filter((m) => String(m.fecha || "").slice(0, 7) === mesVisto)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const total = disponible(movs);
  const mes = disponible(movs, { desde: mesVisto + "-01", hasta: mesVisto + "-31" });
  const props = (E.propuestas || []).filter((p) => p.estado === "pendiente" && p.clase !== "agenda" && p.clase !== "consulta");   // plata-3: ésas van en Pizarra (app-16)
  const autos = automaticosPendientes(E.recurrentes, movs, E.hoy);

  let h = nav;
  // Disponible: el saldo de siempre, por moneda.
  h += `<div class="tarjeta disp"><h3>Disponible</h3>${Object.keys(total).length
    ? Object.entries(total).map(([mon, d]) => `<div class="barra-fila"><span>${mon}</span><b class="num">${fmt(d.saldo)}</b><small class="gris">entró ${fmt(d.entro)} · salió ${fmt(d.salio)}</small></div>`).join("")
    : `<p class="gris">Todavía no hay movimientos. Empezá cargando lo que hay: «＋ Entrada».</p>`}</div>`;

  if (props.length) h += `<h2>Por aprobar (${props.length})</h2>` + props.map(propuestaHTML).join("");
  if (autos.length) h += `<h2>Pagos automáticos de este mes</h2>` + autos.map((r) => `<div class="fila auto">
      <span class="txt"><b>${esc(r.titulo || "Pago")}</b> <small class="gris">${esc((CATEGORIAS[r.categoria] || {}).nombre || "")} · vence el ${Number(r.fecha.slice(8))}</small></span>
      <input class="monto-chico" type="number" step="0.01" data-auto-monto="${esc(r.id)}" value="${esc(r.monto)}"> <span>${esc(r.moneda)}</span>
      <button class="mini ok" data-auto-ok="${esc(r.id)}">Pagado</button><button class="mini" data-auto-no="${esc(r.id)}">Este mes no</button></div>`).join("");

  h += `<div class="botones grandes"><button class="boton" data-nuevo="salio">＋ Gasto</button><button class="boton sec" data-nuevo="entro">＋ Entrada</button></div>`;
  if (form) h += formHTML();

  h += `<div class="nav-semana"><button class="mini" data-mes="-1">‹</button><b>${esc(nombreMes(mesVisto))}</b><button class="mini" data-mes="1">›</button></div>`;
  h += Object.entries(mes).map(([mon, d]) => `<p class="gris">${mon}: entró ${fmt(d.entro)}, salió ${fmt(d.salio)} — mantenimiento ${fmt(d.mantenimiento)}, chicos ${fmt(d.chicos)}, personal ${fmt(d.personal)}.</p>`).join("");
  h += delMes.length ? delMes.map((m) => {
    const c = CATEGORIAS[m.categoria] || {};
    return `<div class="fila mov${c.tipo === "entro" ? " entro" : ""}" data-editar-mov="${esc(m.id)}">
      <span class="fecha-chica">${Number(String(m.fecha).slice(8))}</span>
      <span class="txt"><b>${esc(m.comercio || m.detalle || c.nombre || "—")}</b>
        <small class="gris">${esc(c.nombre || m.categoria)}${m.comercio && m.detalle ? " · " + esc(m.detalle) : ""}${m.cuenta && rutaCuenta(m.cuenta) ? " · 📍 " + esc(rutaCuenta(m.cuenta)) : ""}${m.para ? " · para " + esc(nombrePara(m.para)) : ""}${m.uid ? " · " + esc(nombreDe(m.uid)) : ""}${m.automatico ? " · automático" : ""}${m.origen === "propuesta" ? " · del chat" : ""}</small></span>
      ${m.comprobanteUrl ? `<a href="${esc(m.comprobanteUrl)}" target="_blank" rel="noopener" class="clip" title="Boleta">📎</a>` : ""}
      <span class="num">${c.tipo === "entro" ? "+" : "−"}${fmt(Number(m.monto))} ${esc(m.moneda)}</span></div>`;
  }).join("") : `<p class="gris">Nada en ${esc(nombreMes(mesVisto))}.</p>`;

  if ((E.recurrentes || []).length) h += `<details class="tarjeta"><summary><b>Pagos automáticos</b> (${E.recurrentes.length})</summary>
    ${E.recurrentes.map((r) => `<div class="fila"><span class="txt">${esc(r.titulo)} <small class="gris">el ${esc(r.dia)} de cada mes · ${fmt(Number(r.monto))} ${esc(r.moneda)}${r.activo === false ? " · pausado" : ""}</small></span>
      <button class="mini" data-rec-pausa="${esc(r.id)}">${r.activo === false ? "Reanudar" : "Pausar"}</button><button class="mini" data-rec-borrar="${esc(r.id)}">Borrar</button></div>`).join("")}</details>`;
  v.innerHTML = h;
  enganchar(v, autos);
}

/* ── Una propuesta del agente, editable antes de aprobar ──────────────────── */
function propuestaHTML(p) {
  const d = { ...(p.datos || {}), ...(editandoProp[p.id] || {}) };
  // plata-6: `cuentas` = un ingreso que propone herramientas/ingresos.mjs desde Casa Verde y remate.
  const cab = `<p class="gris">${esc(p.fuente === "whatsapp" ? "De un WhatsApp" : p.fuente === "cuentas" ? "De las cuentas de los negocios" : "Del chat")}${p.resumen ? ": «" + esc(p.resumen) + "»" : ""}</p>`;
  if (p.clase === "gasto") {
    const tipo = (CATEGORIAS[d.categoria] || {}).tipo || d.tipo || "salio";
    return `<form class="tarjeta ficha prop" data-prop="${esc(p.id)}">${cab}${campos(d, tipo)}
      ${(p.dudas || []).length ? `<p class="aviso">La IA no está segura de: ${p.dudas.map(esc).join(", ")}.</p>` : ""}
      <div class="botones"><button class="boton">Aprobar</button><button type="button" class="mini" data-descartar="${esc(p.id)}">Descartar</button></div></form>`;
  }
  const que = p.clase === "tarea" ? `Tarea: <b>${esc(d.titulo || "")}</b> <small class="gris">${esc((TIPOS[d.tipo] || {}).nombre || "")}</small>`
    : p.clase === "evento" ? `Actividad de los chicos: <b>${esc(d.titulo || "")}</b> <small class="gris">${esc(d.fecha || "")} ${esc(d.hora || "")}${d.semanal ? " · todas las semanas" : ""}</small>`
    : esc(p.clase);
  return `<div class="tarjeta ficha prop">${cab}<p>${que}</p>
    <div class="botones"><button class="boton" data-aprobar-otra="${esc(p.id)}">Aprobar</button><button class="mini" data-descartar="${esc(p.id)}">Descartar</button></div></div>`;
}

function campos(d, tipo) {
  const hoy = E.hoy;
  return `<div class="dos"><label>Monto <input name="monto" type="number" step="0.01" min="0" required value="${esc(d.monto ?? "")}"></label>
      <label>Moneda <select name="moneda">${MONEDAS.map((m) => `<option${(d.moneda || "BRL") === m ? " selected" : ""}>${m}</option>`).join("")}</select></label></div>
    <div class="dos"><label>Fecha <input name="fecha" type="date" required value="${esc(esISO(d.fecha) ? d.fecha : hoy)}"></label>
      <label>Categoría <select name="categoria" required><option value="">—</option>${categoriasDe(tipo).map(([k, c]) => `<option value="${k}"${d.categoria === k ? " selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select></label></div>
    <label>${tipo === "entro" ? "De dónde" : "Comercio"} <input name="comercio" maxlength="80" value="${esc(d.comercio || "")}"></label>
    <label>Detalle <input name="detalle" maxlength="300" value="${esc(d.detalle || "")}" placeholder="qué fue, para quién"></label>
    <label>${tipo === "entro" ? "Lo recibió" : "Pagó"} <select name="uid">${personas().map((p) => `<option value="${esc(p.id)}"${(d.uid || E.yo.uid) === p.id ? " selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></label>
    <div class="dos"><label>Cuenta <select name="cuenta"><option value="">— la casa en general —</option>${cuentasDe(E.cuentasDoc).map((c) => `<option value="${esc(c.id)}"${d.cuenta === c.id ? " selected" : ""}>${c.nivel ? "   " : ""}${esc(c.ruta)}</option>`).join("")}</select></label>
      <label>Para <select name="para"><option value="">— nadie en especial —</option>${[...personas().map((p) => [p.id, p.nombre]), ...((E.familia && E.familia.ninos) || []).map((n) => [n.id, n.nombre])].map(([id, nom]) => `<option value="${esc(id)}"${d.para === id ? " selected" : ""}>${esc(nom)}</option>`).join("")}</select></label></div>`;
}
const rutaCuenta = (id) => (cuentasDe(E.cuentasDoc).find((c) => c.id === id) || {}).ruta || "";
const nombrePara = (id) => (personas().find((p) => p.id === id) || ((E.familia && E.familia.ninos) || []).find((n) => n.id === id) || {}).nombre || "—";

/* ── Las cuentas (plata-7): cada una con su balance, por moneda ─────────────── */
let editandoCuenta = null;
function pintarCuentas(v) {
  const cuentas = cuentasDe(E.cuentasDoc);
  const mes = E.hoy.slice(0, 7);
  const linea = (b) => Object.entries(b.porMoneda).map(([m, o]) => `${m} ${fmt(o.saldo)} <small class="gris">(entró ${fmt(o.entro)} · salió ${fmt(o.salio)})</small>`).join(" · ") || `<small class="gris">sin registros</small>`;
  let h = `<p class="gris">A qué fue cada gasto o entrada: un lugar, un vehículo, su depósito. La plata es toda de la familia; la cuenta sólo dice a qué fue. Para un balance con explicación, preguntale a la IA: «balance de General Flores de septiembre».</p>`;
  h += cuentas.length ? cuentas.map((c) => {
    const ids = idsDeCuenta(cuentas, c.id);
    const total = balanceDe(E.movs, { cuentas: c.nivel ? new Set([c.id]) : ids });
    const delMes = balanceDe(E.movs, { cuentas: c.nivel ? new Set([c.id]) : ids, desde: mes + "-01", hasta: mes + "-31" });
    return `<div class="tarjeta cuenta${c.nivel ? " sub" : ""}"><div class="fila"><span class="txt"><b>${esc(c.nombre)}</b> <small class="gris">${esc(CLASES_CUENTA[c.clase])}${c.nivel ? " · parte de " + esc(c.ruta.split(" › ")[0]) : ""}${c.pais ? " · " + esc(c.pais) : ""}</small></span>
      <button class="mini" data-editar-cuenta="${esc(c.id)}">✎</button></div>
      <div class="gris">Este mes: ${linea(delMes)}</div><div>Total: ${linea(total)}</div>
      ${total.faltan.length ? `<small class="aviso">${esc(total.faltan.join("; "))}</small>` : ""}
      ${editandoCuenta === c.id ? formCuenta(c, cuentas) : ""}</div>`;
  }).join("") : `<p class="gris">Todavía no hay cuentas.</p>`;
  h += editandoCuenta === "nueva" ? formCuenta(null, cuentas) : `<div class="botones"><button class="boton sec" data-editar-cuenta="nueva">＋ Cuenta</button></div>`;
  v.insertAdjacentHTML("beforeend", h);
  const todos = (sel, fn) => { for (const el of v.querySelectorAll(sel)) fn(el); };
  todos("[data-editar-cuenta]", (b) => b.onclick = () => { editandoCuenta = editandoCuenta === b.dataset.editarCuenta ? null : b.dataset.editarCuenta; repintar(); });
  todos("[data-cerrar-cuenta]", (b) => b.onclick = () => { editandoCuenta = null; repintar(); });
  todos("[data-form-cuenta]", (f) => f.onsubmit = (ev) => {
    ev.preventDefault();
    const nombre = f.nombre.value.trim().slice(0, 60);
    if (!nombre) return aviso("Falta el nombre.", true);
    const id = f.dataset.formCuenta === "nueva" ? idNuevo("c") : f.dataset.formCuenta;
    const datos = { nombre, clase: f.clase.value, padre: f.padre.value, pais: f.pais.value };
    if (f.dataset.formCuenta === "nueva") datos.orden = Date.now();
    F.setDoc(F.doc(db, "familia", "cuentas"), { cuentas: { [id]: datos }, actualizadoEn: F.serverTimestamp() }, { merge: true })
      .then(() => { editandoCuenta = null; aviso("Guardada."); repintar(); }).catch(fallo);
  });
  todos("[data-baja-cuenta]", (b) => b.onclick = () => {
    if (!confirm("¿Dar de baja esta cuenta? Lo registrado queda; deja de ofrecerse.")) return;
    F.setDoc(F.doc(db, "familia", "cuentas"), { cuentas: { [b.dataset.bajaCuenta]: { baja: true } }, actualizadoEn: F.serverTimestamp() }, { merge: true })
      .then(() => { editandoCuenta = null; repintar(); }).catch(fallo);
  });
}
function formCuenta(c, cuentas) {
  const d = c || { nombre: "", clase: "lugar", padre: "", pais: "UY" };
  return `<form class="ficha" data-form-cuenta="${c ? esc(c.id) : "nueva"}">
    <label>Nombre <input name="nombre" maxlength="60" required value="${esc(d.nombre)}" placeholder="Ej.: Depósito, Pisquito"></label>
    <div class="dos"><label>Es <select name="clase">${Object.entries(CLASES_CUENTA).map(([k, n]) => `<option value="${k}"${d.clase === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>País <select name="pais">${["UY", "BR", ""].map((x) => `<option value="${x}"${d.pais === x ? " selected" : ""}>${x || "—"}</option>`).join("")}</select></label></div>
    <label>Parte de <select name="padre"><option value="">— nada, es una cuenta propia —</option>${cuentas.filter((x) => !x.nivel && (!c || x.id !== c.id)).map((x) => `<option value="${esc(x.id)}"${d.padre === x.id ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></label>
    <div class="botones"><button class="boton">Guardar</button><button type="button" class="mini" data-cerrar-cuenta>Cancelar</button>${c ? `<button type="button" class="mini" data-baja-cuenta="${esc(c.id)}">Dar de baja</button>` : ""}</div></form>`;
}

/* ── El formulario de un movimiento ───────────────────────────────────────── */
function formHTML() {
  const tipo = form.tipo, d = form.datos || {};
  const hayCV2 = !!(CV && CV.CV2);
  return `<form class="tarjeta ficha" id="form-mov"><h3>${form.id ? "Editar" : tipo === "entro" ? "Entrada de plata" : "Gasto"}</h3>
    ${tipo === "salio" ? `<div class="boleta">${hayCV2 ? `
      <label class="mini boton-archivo">📷 Sacar foto<input type="file" accept="image/*" capture="environment" data-foto hidden></label>
      <label class="mini boton-archivo">🖼 Elegir archivo<input type="file" accept="image/*" data-foto hidden></label>` : `<small class="gris">Sin Casa Verde no se pueden subir boletas.</small>`}
      ${form.archivo ? `<small>${esc(form.archivo.name)} ${form.leyendo ? "· leyendo con IA…" : form.leida ? "· leída: revisá los datos" : ""}</small>` : d.comprobanteUrl ? `<a href="${esc(d.comprobanteUrl)}" target="_blank" rel="noopener">📎 boleta</a>` : ""}
    </div>` : ""}
    ${campos(d, tipo)}
    ${!form.id && tipo === "salio" ? `<label class="check"><input type="checkbox" name="auto"> Es un pago automático: se repite todos los meses</label>` : ""}
    <div class="botones"><button class="boton">Guardar</button><button type="button" class="mini" data-cerrar-form>Cancelar</button>
      ${form.id ? `<button type="button" class="mini" data-borrar-mov="${esc(form.id)}">Borrar</button>` : ""}</div></form>`;
}

const leerCampos = (f) => ({
  monto: Math.round(Number(f.monto.value) * 100) / 100, moneda: f.moneda.value, fecha: f.fecha.value,
  categoria: f.categoria.value, comercio: f.comercio.value.trim(), detalle: f.detalle.value.trim(), uid: f.uid.value,
  cuenta: f.cuenta ? f.cuenta.value : "", para: f.para ? f.para.value : "",
});

/* La boleta, leída por la IA de Casa Verde. Nunca bloquea: si no anda, se
   completa a mano. */
const MODELO_BOLETA = "gemini-2.5-flash-lite";
const TOKENS_BOLETA = 2000;

async function leerBoleta(file) {
  const CV2 = CV.CV2;
  const blob = await CV2.comprimirImagen(file);
  const data = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = mal; r.readAsDataURL(blob); });
  const cats = Object.entries(CATEGORIAS).filter(([, c]) => c.tipo === "salio").map(([k, c]) => `${k} (${c.nombre})`).join(", ");
  const r = await fetch(CV2.NETLIFY + "/claude-proxy", {
    method: "POST", headers: { "Content-Type": "application/json" },
    // plata-2 (tiempos:A10): flash-lite y 2000 tokens. «gemini-2.5-flash»
    // piensa antes de contestar, el pensamiento se come el límite y el JSON
    // llega cortado — pasó igual en el inventario de remate.
    body: JSON.stringify({ model: MODELO_BOLETA, max_tokens: TOKENS_BOLETA, messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
      { type: "text", text: `Es una boleta o comprobante de un gasto de una familia en Brasil o Uruguay. Devolvé SOLO un JSON, sin texto alrededor:
{"monto": número total pagado, "moneda": "BRL" | "UYU" | "USD", "fecha": "AAAA-MM-DD", "comercio": nombre del comercio, "categoria": una de [${cats}], "detalle": qué se compró, en pocas palabras}.
Si un dato no se lee con seguridad, dejalo vacío (""). No inventes.` }] }] }),
  });
  if (!r.ok) throw new Error("la IA contestó " + r.status);
  const j = await r.json();
  return leerSugerencia(((j.content || [])[0] || {}).text);
}

async function guardarMovimiento(f) {
  const d = leerCampos(f);
  const tipo = form.tipo;
  const err = validarMovimiento({ ...d, tipo });
  if (err.length) return aviso("Falta: " + err.join("; ") + ".", true);
  let comprobanteUrl = (form.datos || {}).comprobanteUrl || null;
  if (form.archivo) {
    aviso("Subiendo la boleta…");
    try { comprobanteUrl = await CV.CV2.subirImagen(form.archivo, "tiempos"); }
    catch (e) { return aviso("No se pudo subir la boleta: " + e.message + ". No se guardó nada.", true); }
  }
  const base = { ...d, comprobanteUrl, actualizadoEn: F.serverTimestamp() };
  if (form.id) await F.updateDoc(F.doc(db, "movimientos", form.id), { ...base, editadoPor: E.yo.uid });
  else {
    let automatico = null;
    if (f.auto && f.auto.checked) {
      const r = await F.addDoc(F.collection(db, "recurrentes"), { titulo: d.comercio || d.detalle || "Pago automático",
        monto: d.monto, moneda: d.moneda, categoria: d.categoria, dia: Number(d.fecha.slice(8)), desde: d.fecha,
        activo: true, saltados: [], creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
      automatico = r.id;
    }
    await F.addDoc(F.collection(db, "movimientos"), { ...base, automatico, origen: form.archivo ? "foto" : "app",
      creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
  }
  form = null;
  aviso("Guardado.");
  repintar();
}

function engancharSub(v) {
  for (const b of v.querySelectorAll("[data-sub]")) b.onclick = () => { sub = b.dataset.sub; repintar(); };
  for (const b of v.querySelectorAll("[data-mes]")) b.onclick = () => { mesVisto = sumarMes(mesVisto, Number(b.dataset.mes)); repintar(); };
}

function enganchar(v, autos) {
  const todos = (sel, fn) => { for (const el of v.querySelectorAll(sel)) fn(el); };
  engancharSub(v);
  todos("[data-nuevo]", (b) => b.onclick = () => {
    form = { tipo: b.dataset.nuevo, datos: { categoria: b.dataset.nuevo === "entro" ? "ingreso" : "" } }; repintar();
  });
  todos("[data-cerrar-form]", (b) => b.onclick = () => { form = null; repintar(); });
  todos("[data-editar-mov]", (el) => el.onclick = (ev) => {
    if (ev.target.closest("a")) return;
    const m = (E.movs || []).find((x) => x.id === el.dataset.editarMov); if (!m) return;
    form = { id: m.id, tipo: (CATEGORIAS[m.categoria] || {}).tipo || "salio", datos: m }; repintar(); scrollTo(0, 0);
  });
  todos("[data-borrar-mov]", (b) => b.onclick = () => {
    if (!confirm("¿Borrar este movimiento?")) return;
    F.deleteDoc(F.doc(db, "movimientos", b.dataset.borrarMov)).then(() => { form = null; repintar(); }).catch(fallo);
  });
  todos("[data-foto]", (inp) => inp.onchange = async () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    const f = $("form-mov");
    form.datos = { ...form.datos, ...leerCamposSueltos(f) };
    form.archivo = file; form.leyendo = true; form.leida = false; repintar();
    try {
      const s = await leerBoleta(file);
      if (s) for (const [k, val] of Object.entries(s)) if (val !== "" && !form.datos[k]) form.datos[k] = val;
      form.leida = !!s;
      if (!s) aviso("La IA no pudo leer la boleta: completala a mano.", true);
    } catch (e) { aviso("No se pudo leer con IA (" + e.message + "): completala a mano.", true); }
    form.leyendo = false; repintar();
  });
  const f = $("form-mov");
  if (f) f.onsubmit = (ev) => { ev.preventDefault(); guardarMovimiento(f).catch(fallo); };

  todos("[data-auto-ok]", (b) => b.onclick = () => {
    const r = autos.find((x) => x.id === b.dataset.autoOk);
    const monto = Math.round(Number(v.querySelector(`[data-auto-monto="${r.id}"]`).value) * 100) / 100;
    if (!(monto > 0)) return aviso("Poné el monto que se pagó.", true);
    F.addDoc(F.collection(db, "movimientos"), { monto, moneda: r.moneda, fecha: r.fecha, categoria: r.categoria || "casa",
      comercio: r.titulo || "", detalle: "pago automático", uid: E.yo.uid, automatico: r.id, comprobanteUrl: null,
      origen: "automatico", creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() }).then(() => aviso("Registrado.")).catch(fallo);
  });
  todos("[data-auto-no]", (b) => b.onclick = () =>
    F.updateDoc(F.doc(db, "recurrentes", b.dataset.autoNo), { saltados: F.arrayUnion(E.hoy.slice(0, 7)) }).catch(fallo));
  todos("[data-rec-pausa]", (b) => b.onclick = () => {
    const r = E.recurrentes.find((x) => x.id === b.dataset.recPausa);
    F.updateDoc(F.doc(db, "recurrentes", r.id), { activo: r.activo === false }).catch(fallo);
  });
  todos("[data-rec-borrar]", (b) => b.onclick = () => {
    if (confirm("¿Borrar este pago automático? Lo ya registrado queda.")) F.deleteDoc(F.doc(db, "recurrentes", b.dataset.recBorrar)).catch(fallo);
  });

  // Propuestas del agente
  todos("[data-prop]", (fp) => {
    const id = fp.dataset.prop;
    fp.oninput = () => { editandoProp[id] = leerCamposSueltos(fp); };
    fp.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = leerCampos(fp);
      const tipo = (CATEGORIAS[d.categoria] || {}).tipo;
      const err = validarMovimiento({ ...d, tipo });
      if (err.length) return aviso("Falta: " + err.join("; ") + ".", true);
      try {
        const r = await F.addDoc(F.collection(db, "movimientos"), { ...d, comprobanteUrl: null, automatico: null,
          origen: "propuesta", propuestaId: id, creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
        await decidir(id, "aprobada", r.id);
        aviso("Aprobado y registrado.");
      } catch (e) { fallo(e); }
    };
  });
  todos("[data-aprobar-otra]", (b) => b.onclick = () => aprobarOtra(b.dataset.aprobarOtra).catch(fallo));
  todos("[data-descartar]", (b) => b.onclick = () => decidir(b.dataset.descartar, "descartada").catch(fallo));
}

const leerCamposSueltos = (f) => {
  const o = {};
  for (const n of ["monto", "moneda", "fecha", "categoria", "comercio", "detalle", "uid"]) if (f[n] && f[n].value !== "") o[n] = n === "monto" ? Number(f[n].value) : f[n].value;
  return o;
};

async function decidir(id, estado, resultadoId = null) {
  delete editandoProp[id];
  await F.updateDoc(F.doc(db, "propuestas", id), { estado, decididoPor: E.yo.uid, decididoEn: F.serverTimestamp(), resultadoId });
}

/* Una tarea o una actividad propuestas: se crean con lo que trae, y se
   corrigen después en su solapa, que ya sabe editarlas. */
export async function aprobarOtra(id) {
  const p = (E.propuestas || []).find((x) => x.id === id); if (!p) return;
  const d = p.datos || {};
  let r;
  if (p.clase === "tarea") {
    r = await F.addDoc(F.collection(db, "tareas"), { titulo: String(d.titulo || "").slice(0, 120) || "(sin título)",
      tipo: TIPOS[d.tipo] ? d.tipo : "casa", alcance: "comun", duenio: E.yo.uid, parentId: null, hecho: false,
      encargados: [], meta: null, detalle: String(d.detalle || "").slice(0, 2000), creadoEn: F.serverTimestamp() });
  } else if (p.clase === "evento") {
    if (!d.titulo || !esISO(d.fecha)) return aviso("A esa actividad le falta el nombre o la fecha: cargala a mano en Chicos.", true);
    r = await F.addDoc(F.collection(db, "eventos"), { titulo: String(d.titulo).slice(0, 120), fecha: d.fecha, hora: d.hora || "",
      horaFin: d.horaFin || "", semanal: !!d.semanal, ninos: Array.isArray(d.ninos) ? d.ninos : [], quienes: Array.isArray(d.quienes) ? d.quienes : [],
      nota: String(d.nota || "").slice(0, 300), excepto: [], creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
  } else return aviso("No sé aprobar eso desde acá.", true);
  await decidir(id, "aprobada", r.id);
  aviso("Aprobado.");
}
