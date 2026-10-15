// ─────────────────────────────────────────────────────────────────────────────
// sugerir.js — El globo flotante: preguntarle a la IA, una sugerencia o una
// falla. Sello: sugerir-22
//
// Pedido de Mauro, 29-sep-2026: «un cuadro flotante con una sugerencia que
// llegue al chat para que sea tomado en las rutinas diarias, como en los
// sitios». Es el MISMO circuito de los sitios (el molde es `REPORTES.md` de
// remate): va a `reportes/` de ESTA base con un campo `tipo` —«pedido» o
// «falla»—, y la ronda diaria lo convierte en un pendiente del panel. Una
// falla tiene `gravedad`; un pedido, `urgencia`; nunca las dos. La nota de
// abajo dice quién contesta y cuánto tarda ANTES de mandar.
//
// sugerir-22 (15-oct-2026): LA IA SÓLO CONTESTA. Mauro: «vamos a sacar y
// limpiar en el código el pedido a la IA; quiero que sea para hacer una
// consulta, como qué día tengo odontólogo… no fue bueno editando». Desde
// sugerir-3 hasta sugerir-21 el cuadro armaba un PLAN (actividades, tareas,
// alarmas, gastos, compras, cambios de la agenda) y en la práctica proponía
// de más, partía una cosa en dos y se olvidaba los detalles. Se sacó entero
// —acá y en nucleo.js— y lo que se agrega va por la ficha de cada cosa.
// Ahora la IA entiende la pregunta y dice qué buscar (`leerConsultaIA`); la
// respuesta la arma la app con lo que ve esta sesión (`buscarEnAgenda`,
// `actividadesDeChicos`, `balanceDe`, `horasPorCuenta`), y la IA, si se le
// pide («✨ Explicar»), sólo comenta esos números. Nada se escribe.
//
// Lo que no cambió: los nombres de los chicos no viajan (pasan a «Chico1» y
// vuelven, `escudarNombres`), lo pegado sale sin cédula, teléfono ni mail
// (`sinDatosPersonales`), y «📊 Análisis de Claude» manda la consulta a
// Claude, que la contesta en Pizarra (sugerir-19).
// ─────────────────────────────────────────────────────────────────────────────

import { db, auth, F, CV } from "./firebase-init.js";
import { esc, limpiarDictado, escudarNombres, devolverNombres, CATEGORIAS, cuentasDe, cuentaPorNombre, idsDeCuenta, balanceDe,
  actividadesDeChicos, horasPorCuenta, CONSULTAS, sumarDias, sinDatosPersonales, leerConsultaIA, buscarEnAgenda } from "./nucleo.js";
import { agendaUnida } from "./agenda.js";
import { E, $, aviso, fallo, otro } from "./estado.js";

export const MODOS = {
  consulta: { titulo: "Preguntale a la IA", que: "Tu pregunta", quePh: "¿Qué día tengo el odontólogo? · ¿Qué tienen los chicos el jueves? · ¿Cuánto gastamos en el súper en septiembre?" },
  pedido: { titulo: "Una sugerencia", que: "¿Qué te gustaría?", quePh: "Que en la agenda se vea también la semana de Florencia.",
            esp: "¿Para qué te serviría?", espPh: "Para no pisarnos los horarios.", campo: "urgencia",
            opciones: [["cuando-se-pueda", "Cuando se pueda"], ["pronto", "Pronto"], ["ya", "Lo necesito ya"]] },
  falla:  { titulo: "Algo anda mal", que: "¿Qué pasó?", quePh: "Toqué Aprobar y no pasó nada.",
            esp: "¿Qué esperabas que pasara?", espPh: "Que el gasto apareciera en la lista.", campo: "gravedad",
            opciones: [["molesta", "Molesta, sigo"], ["traba", "Me traba algo"], ["no-anda", "No puedo usar la app"]] },
};
export const NOMBRE_SOLAPA = { pizarra: "Pizarra", ahora: "Ahora", hoy: "Hoy", agenda: "Agenda", tareas: "Tareas", chicos: "Chicos", plata: "Plata", balance: "Balance" };

let abierta = false, modo = "consulta", enviando = false;
let pregunta = "";            // lo escrito, para que un repintado no lo borre
let consulta = null;          // la última consulta contestada: { ...consulta, resultado }
let preguntando = false;

/* Los chicos de la casa, de la base. Se usan SÓLO para escudar los nombres
   antes de que algo salga hacia la IA, y para traducirlos a la vuelta. */
const chicosDeLaCasa = () => (E.familia && E.familia.ninos) || [];
/* Lo que tengo con día en la agenda que no es una actividad: las tareas y lo
   de Casa Verde que puse en un día, con su título. */
function piezasConDia() {
  const tareas = Object.fromEntries((E.tareas || []).map((t) => [t.id, t]));
  const cv = Object.fromEntries((E.cvActs || []).map((a) => [a.id, a]));
  return Object.entries(agendaUnida()).map(([k, m]) => ({ ...m, titulo: k.startsWith("f:") ? (tareas[k.slice(2)] || {}).titulo
    : k.startsWith("cv:") ? (cv[k.slice(3)] || {}).titulo : "" })).filter((p) => p.titulo && p.dia);
}

/* La IA entiende la pregunta: qué se busca, de cuándo, de qué cuenta. No ve
   la agenda ni los gastos: la respuesta la arma la app. */
async function preguntar(texto) {
  const CV2 = CV && CV.CV2;
  if (!CV2) throw new Error("sin Casa Verde no hay IA");
  const hoy = E.hoy;
  const dia = new Date(hoy + "T12:00").toLocaleDateString("es", { weekday: "long" });
  const ninos = chicosDeLaCasa();
  const t = escudarNombres(sinDatosPersonales(limpiarDictado(texto)), ninos);
  const prompt = `Hoy es ${dia} ${hoy}. Alguien de una familia pregunta algo sobre su agenda, la de sus hijos, sus gastos o sus horas: «${t}».
Los chicos se llaman Chico1, Chico2… (hay ${ninos.length}). Cuentas de gastos: ${JSON.stringify(cuentasDe(E.cuentasDoc).map((c) => c.ruta))}. Categorías: ${JSON.stringify(Object.keys(CATEGORIAS))}.
Devolvé SOLO un JSON, sin texto alrededor:
{"que": "agenda" (cuándo tiene algo, qué tiene un día) | "chicos" (qué tienen los chicos) | "gastos" | "balance" | "horas",
 "buscar": [palabras para encontrarlo en los títulos, con sinónimos y variantes: para «odontólogo» → ["odontólogo","dentista","odonto"]; vacío si pregunta por un día o un período entero],
 "desde": "AAAA-MM-DD", "hasta": "AAAA-MM-DD" (vacíos si no dice cuándo; «esta semana» es de lunes a domingo, «el jueves» es el próximo jueves, «septiembre» del 1 al 30),
 "ninos": ["Chico1"] si pregunta por uno, "cuenta": una de las cuentas o "", "categorias": [de la lista] o [], "persona": "yo" | "otro" | "",
 "pregunta": la pregunta en una línea}
No contestes la pregunta: sólo decí qué buscar.`;
  const r = await fetch(CV2.NETLIFY + "/claude-proxy", {
    method: "POST", headers: { "Content-Type": "application/json" },
    // flash-lite: el que piensa se come los tokens y corta el JSON (plata-2).
    body: JSON.stringify({ model: "gemini-2.5-flash-lite", max_tokens: 600, messages: [{ role: "user", content: [{ type: "text", text: prompt }] }] }),
  });
  if (!r.ok) throw new Error("la IA contestó " + r.status);
  const j = await r.json();
  const c = leerConsultaIA(((j.content || [])[0] || {}).text);
  if (!c) throw new Error("no entendí la pregunta");
  c.pregunta = devolverNombres(c.pregunta || texto, ninos);
  c.buscar = c.buscar.map((w) => devolverNombres(w, ninos));
  c.resultado = await contestar(c);
  return c;
}

/* sugerir-18: la respuesta a una consulta, calculada acá con lo que ve esta
   sesión. Las horas se piden en el momento (no se escuchan siempre). */
async function contestar(a) {
  const cuentas = cuentasDe(E.cuentasDoc);
  const hoy = E.hoy;
  const desde = a.desde || "", hasta = a.hasta || "";
  const uidDe = (p) => p === "yo" ? E.yo.uid : p === "otro" ? (otro() || {}).id || "" : "";
  const cuenta = a.cuenta ? cuentaPorNombre(cuentas, a.cuenta) : null;
  if (a.cuenta && !cuenta) return { error: `No encontré la cuenta «${a.cuenta}». Las que hay: ${cuentas.map((c) => c.ruta).join(", ") || "ninguna todavía (Plata → Cuentas)"}.` };
  const nombreCuenta = cuenta ? cuentas.find((c) => c.id === cuenta).ruta : "";
  if (a.que === "chicos" || a.que === "agenda") {
    const d0 = desde || hoy, d1 = hasta || sumarDias(d0, 6);
    const nino = (a.ninos || []).length === 1 ? (chicosDeLaCasa()[a.ninos[0]] || {}).id || "" : "";
    if (a.que === "chicos") return { tipo: "lista", desde: d0, hasta: d1, de: nino ? (chicosDeLaCasa()[a.ninos[0]] || {}).nombre : "los chicos",
      items: actividadesDeChicos({ eventos: E.eventos, actividades: E.actividades, ninos: chicosDeLaCasa(), desde: d0, hasta: d1, nino }) };
    // sugerir-22: con palabras («odontólogo», «dentista») se busca en toda la
    // agenda —mía, las tareas con día y las de los chicos—, no sólo una semana.
    const items = buscarEnAgenda({ actividades: E.actividades, piezas: piezasConDia(), eventos: E.eventos, ninos: chicosDeLaCasa(),
      palabras: a.buscar || [], desde: a.desde, hasta: a.hasta, hoy });
    const desdeR = items.length ? items[0].dia : d0, hastaR = items.length ? items[items.length - 1].dia : d1;
    return { tipo: "lista", desde: a.desde || desdeR, hasta: a.hasta || hastaR, de: (a.buscar || []).length ? `«${a.buscar.join("», «")}»` : "tu agenda", items };
  }
  if (a.que === "horas") {
    let sesiones = [];
    try {
      const r = await F.getDocs(F.query(F.collection(db, "sesiones"), F.where("estado", "==", "finalizada")));
      sesiones = r.docs.map((d) => ({ id: d.id, ...d.data(), inicioMs: d.data().inicio && d.data().inicio.toMillis ? d.data().inicio.toMillis() : 0 }));
    } catch (e) { return { error: "No pude traer las horas: " + (e.message || e) }; }
    return { tipo: "horas", desde, hasta, cuenta: nombreCuenta, ...horasPorCuenta(sesiones, E.tareas, cuentas, { desde, hasta, cuenta: cuenta || "", uid: uidDe(a.persona) }),
      nombresCuenta: Object.fromEntries(cuentas.map((c) => [c.id, c.ruta])) };
  }
  const b = balanceDe(E.movs, { cuentas: cuenta ? idsDeCuenta(cuentas, cuenta) : null, desde, hasta, categorias: a.categorias || [], uid: uidDe(a.persona) });
  return { tipo: a.que === "balance" ? "balance" : "gastos", desde, hasta, cuenta: nombreCuenta, categorias: a.categorias || [], ...b };
}

/* «✨ Explicar»: la IA comenta los números que ya calculó la app; no suma nada. */
async function explicar(a) {
  const CV2 = CV && CV.CV2;
  if (!CV2) throw new Error("sin Casa Verde no hay IA");
  const r = a.resultado || {};
  const datos = r.tipo === "lista" ? { periodo: [r.desde, r.hasta], de: r.de, items: (r.items || []).slice(0, 80) }
    : r.tipo === "horas" ? { periodo: [r.desde, r.hasta], cuenta: r.cuenta, total: r.total, porCuenta: r.porCuenta, sesiones: r.n }
    : { periodo: [r.desde || "todo", r.hasta || "hoy"], cuenta: r.cuenta || "todas", porMoneda: r.porMoneda, faltan: r.faltan, registros: (r.lista || []).length,
        categorias: Object.fromEntries(Object.entries(CATEGORIAS).map(([k, c]) => [k, c.nombre])) };
  const texto = escudarNombres(`Pregunta: «${a.pregunta || CONSULTAS[a.que]}». Datos YA calculados por la app (JSON): ${JSON.stringify(datos)}.
Explicá en castellano rioplatense, en 4 a 8 renglones cortos y sin inventar números: qué muestran, qué llama la atención, y qué falta registrar para que el análisis sea completo. Cada moneda es aparte: nunca sumes reales, pesos y dólares ni conviertas. Si no hay datos, decilo y sugerí qué cargar.`, chicosDeLaCasa());
  const res = await fetch(CV2.NETLIFY + "/claude-proxy", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-2.5-flash-lite", max_tokens: 900, messages: [{ role: "user", content: [{ type: "text", text: texto }] }] }) });
  if (!res.ok) throw new Error("la IA contestó " + res.status);
  const j = await res.json();
  return devolverNombres(String(((j.content || [])[0] || {}).text || "").trim(), chicosDeLaCasa());
}

const plata = (n) => Number(n).toLocaleString("es-UY", { maximumFractionDigits: 2 });
const periodo = (r) => r.desde || r.hasta ? `${r.desde ? DIA_CORTO(r.desde) : "el principio"} → ${r.hasta ? DIA_CORTO(r.hasta) : "hoy"}` : "todo lo registrado";
function respuestaHTML(a, n) {
  const r = a.resultado || {};
  if (r.error) return `<div class="respuesta"><p class="aviso">${esc(r.error)}</p></div>`;
  let h = "";
  if (r.tipo === "lista") {
    h = `<p><b>${esc(r.de)}</b> · ${esc(periodo(r))}</p>${r.items.length ? `<ul class="resp-lista">${r.items.map((x) => `<li><b>${esc(DIA_CORTO(x.dia))}</b> ${esc(x.hora)}${x.horaFin ? "–" + esc(x.horaFin) : ""} ${esc(x.titulo)}${x.de ? ` <small class="gris">${esc(x.de)}</small>` : ""}</li>`).join("")}</ul>` : `<p class="gris">No hay nada registrado en ese período.</p>`}`;
  } else if (r.tipo === "horas") {
    h = `<p><b>Horas registradas</b>${r.cuenta ? " · " + esc(r.cuenta) : ""} · ${esc(periodo(r))}: <b>${esc(String(r.total))} h</b> en ${r.n} registro(s)</p>
      ${Object.entries(r.porCuenta).map(([c, v]) => `<div class="barra-fila"><span>${esc(r.nombresCuenta[c] || "sin cuenta")}</span><b>${esc(String(v))} h</b></div>`).join("")}
      <p class="gris">Son las del reloj de Tiempos. Las horas de Casa Verde (honorarios) todavía no entran acá.</p>`;
  } else {
    const ms = Object.entries(r.porMoneda || {});
    h = `<p><b>${r.tipo === "balance" ? "Balance" : "Gastos y entradas"}</b>${r.cuenta ? " · " + esc(r.cuenta) : ""}${r.categorias.length ? " · " + esc(r.categorias.map((c) => CATEGORIAS[c].nombre).join(", ")) : ""} · ${esc(periodo(r))}</p>
      ${ms.length ? ms.map(([m, o]) => `<div class="resp-moneda"><b>${esc(m)}</b> · entró ${esc(plata(o.entro))} · salió ${esc(plata(o.salio))} · <b>saldo ${esc(plata(o.saldo))}</b>
        ${Object.entries(o.porCategoria).map(([c, v]) => `<div class="barra-fila"><span>${esc(CATEGORIAS[c].nombre)}</span><b>${esc(plata(v))}</b></div>`).join("")}</div>`).join("")
      : `<p class="gris">No hay registros con ese filtro.</p>`}
      ${r.tipo === "gastos" && r.lista.length ? `<details><summary>Ver los ${r.lista.length} registros</summary><ul class="resp-lista">${r.lista.slice(0, 100).map((m) => `<li>${esc(DIA_CORTO(m.fecha))} · ${esc(plata(m.monto))} ${esc(m.moneda)} · ${esc(CATEGORIAS[m.categoria].nombre)}${m.comercio ? " · " + esc(m.comercio) : ""}${m.detalle ? ` <small class="gris">${esc(m.detalle)}</small>` : ""}</li>`).join("")}</ul></details>` : ""}
      ${r.faltan.length ? `<p class="aviso">Falta: ${esc(r.faltan.join("; "))}.</p>` : ""}
      <p class="gris">Cada moneda va aparte: no se suman ni se convierten.</p>`;
  }
  return `<div class="respuesta" data-resp="${n}">❓ <small class="gris">${esc(a.pregunta || CONSULTAS[a.que])}</small>${h}
    ${a.explicacion ? `<p class="explicacion">✨ ${esc(a.explicacion)}</p>` : `<button type="button" class="mini" data-explicar="${n}">✨ Explicar</button>`}
    ${a.pedido ? `<p class="gris">📊 Pedido a Claude: el análisis te llega a Pizarra.</p>` : `<button type="button" class="mini" data-analisis="${n}">📊 Análisis de Claude</button>`}</div>`;
}

/** Pedirle a Claude el análisis de una consulta (o de una cuenta, desde Plata). */
export async function pedirAnalisis({ pregunta, que = "balance", cuenta = "", desde = "", hasta = "", categorias = [] }) {
  return mandarReporte({ texto: "Análisis: " + String(pregunta || "").slice(0, 300), tipo: "pedido", urgencia: "pronto",
    analisis: { que, cuenta: String(cuenta || "").slice(0, 60), desde, hasta, categorias: (categorias || []).slice(0, 12) } });
}

const DIA_CORTO = (iso) => { try { return new Date(iso + "T12:00").toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" }); } catch { return iso; } };
let mios = [];
let escuchando = false;

/* Lo que uno mandó, para ver que llegó y si ya lo tomaron. La consulta va por
   `uid`: la regla sólo deja leer los propios. */
function escucharMios() {
  if (escuchando || !E.yo) return;
  escuchando = true;
  F.onSnapshot(F.query(F.collection(db, "reportes"), F.where("uid", "==", E.yo.uid)), (s) => {
    mios = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => ((b.creadoEn && b.creadoEn.toMillis ? b.creadoEn.toMillis() : 0) - (a.creadoEn && a.creadoEn.toMillis ? a.creadoEn.toMillis() : 0)));
    if (abierta) pintarHoja();
  }, () => {});
}

export function montarGlobo() {
  if ($("globo")) return;
  const b = Object.assign(document.createElement("button"), { id: "globo", className: "globo", title: "Preguntar, sugerir algo o avisar una falla" });
  b.innerHTML = "❓";
  
  b.onclick = () => { abierta = true; escucharMios(); pintarHoja(); };
  document.body.append(b);
}

function pintarHoja() {
  let h = $("hoja-sugerir");
  if (!abierta) { if (h) h.remove(); return; }
  if (!h) { h = Object.assign(document.createElement("div"), { id: "hoja-sugerir", className: "hoja" }); document.body.append(h); }
  const m = MODOS[modo];
  const ia = modo === "consulta";
  const antes = h.querySelector("form") ? { t: h.querySelector("[name=texto]").value, e: (h.querySelector("[name=esperaba]") || {}).value || "" } : { t: ia ? pregunta : "", e: "" };
  const marcado = (h.querySelector(".tira button.on") || {}).dataset;
  h.innerHTML = `<div class="hoja-caja sugerir-ed">
    <div class="hoja-cab"><b>${esc(m.titulo)}</b><button class="mas" data-cerrar aria-label="Cerrar">✕</button></div>
    <nav class="solapas chicas"><button data-modo="consulta" aria-selected="${ia}">❓ Preguntar</button><button data-modo="pedido" aria-selected="${modo === "pedido"}">Sugerencia</button><button data-modo="falla" aria-selected="${modo === "falla"}">Algo anda mal</button></nav>
    <form>
      ${ia ? `<p class="gris">Escribí, o dictá con el 🎤 del teclado. La IA busca en tu agenda, la de los chicos, los gastos y las horas, y te contesta acá. <b>No cambia nada</b>: para agregar, usá el ＋ de la agenda, de la pizarra o de Plata.</p>` : ""}
      <label>${esc(m.que)} <textarea name="texto" rows="3" maxlength="2000" required placeholder="${esc(m.quePh)}">${esc(antes.t)}</textarea></label>
      ${ia ? `<button class="boton" ${preguntando ? "disabled" : ""}>${preguntando ? "Buscando…" : "Preguntar"}</button>`
      : `<label>${esc(m.esp)} <input name="esperaba" maxlength="600" placeholder="${esc(m.espPh)}" value="${esc(antes.e)}"></label>
      <div class="tira">${m.opciones.map(([v, t], i) => `<button type="button" data-v="${v}" class="mini${(marcado && m.opciones.some((o) => o[0] === marcado.v) ? marcado.v === v : i === 0) ? " on" : ""}">${esc(t)}</button>`).join("")}</div>
      <p class="gris nota-ia">Lo lee <b>una IA</b> (el agente de Claude) en la ronda de cada mañana, y lo pasa al panel de Mauro como pendiente. <b>Puede tardar hasta un día.</b> Si hace falta algo más, te va a preguntar en la app o en el chat. Va con tu nombre y la solapa en la que estás (${esc(NOMBRE_SOLAPA[E.solapa] || E.solapa)}).</p>
      <button class="boton" ${enviando ? "disabled" : ""}>${enviando ? "Mandando…" : "Mandar"}</button>`}
    </form>
    ${ia && consulta ? respuestaHTML(consulta, 0) : ""}
    ${!ia && mios.length ? `<h4>Lo que mandaste</h4>${mios.slice(0, 8).map((r) => `<div class="mandado"><small class="gris">${esc(r.tipo === "falla" ? "falla" : "sugerencia")} · ${esc(r.estado === "nuevo" ? "esperando la ronda" : r.estado || "")}</small><br>${esc(String(r.texto || "").slice(0, 140))}</div>`).join("")}` : ""}
  </div>`;
  h.onclick = (ev) => { if (ev.target === h) { abierta = false; pintarHoja(); } };
  h.querySelector("[data-cerrar]").onclick = () => { abierta = false; pintarHoja(); };
  for (const b of h.querySelectorAll("[data-modo]")) b.onclick = () => { if (ia) pregunta = h.querySelector("[name=texto]").value; modo = b.dataset.modo; pintarHoja(); };
  for (const b of h.querySelectorAll(".tira button")) b.onclick = () => {
    for (const x of h.querySelectorAll(".tira button")) x.classList.toggle("on", x === b);
  };
  const ex = h.querySelector("[data-explicar]");
  if (ex) ex.onclick = async () => {
    ex.disabled = true; ex.textContent = "Pensando…";
    try { consulta.explicacion = await explicar(consulta); } catch (e) { consulta.explicacion = "No pude explicarlo ahora (" + (e.message || e) + ")."; }
    pintarHoja();
  };
  const an = h.querySelector("[data-analisis]");
  if (an) an.onclick = async () => {
    an.disabled = true;
    try {
      await pedirAnalisis({ pregunta: consulta.pregunta || CONSULTAS[consulta.que], que: consulta.que, cuenta: (consulta.resultado || {}).cuenta || consulta.cuenta || "",
        desde: consulta.desde, hasta: consulta.hasta, categorias: consulta.categorias });
      consulta.pedido = true; aviso("Pedido. Claude lo analiza y te lo deja en Pizarra.");
    } catch (e) { fallo(e); }
    pintarHoja();
  };
  const f = h.querySelector("form");
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const texto = f.texto.value.trim();
    if (!texto) return aviso("Escribí algo.", true);
    if (ia) return hacerPregunta(texto);
    if (!E.yo || !E.yo.uid) return aviso("No hay sesión: volvé a entrar.", true);
    enviando = true; pintarHoja();
    try {
      await mandarReporte({ texto, esperaba: f.esperaba.value.trim(), tipo: modo,
        [m.campo]: (h.querySelector(".tira button.on") || {}).dataset.v || m.opciones[0][0] });
      enviando = false; abierta = false; pintarHoja();
      aviso("Mandado. Lo toma la ronda de mañana.");
    } catch (e) { enviando = false; pintarHoja(); fallo(e); }
  };
}

async function hacerPregunta(texto) {
  pregunta = texto; preguntando = true; pintarHoja();
  try { consulta = await preguntar(texto); }
  catch (e) { consulta = null; aviso("No pude contestar (" + (e.message || e) + ").", true); }
  preguntando = false; pintarHoja();
}

/* Abrir el globo con una pregunta ya escrita: la que se dictó en la app del
   teléfono (`?dictar=`) o en la Pizarra de Tiempos. Se pregunta sola. */
export function abrirConsulta(texto) {
  modo = "consulta"; consulta = null; abierta = true; escucharMios();
  pregunta = String(texto || "").slice(0, 2000);
  pintarHoja();
  if (pregunta.trim()) hacerPregunta(pregunta);
}

/* Un pedido a reportes/, con la forma de los sitios, y el aviso en vivo. Lo
   usa también la tarjeta de Claude en Ahora para devolver una respuesta. */
export async function mandarReporte(c) {
  const ref = await F.addDoc(F.collection(db, "reportes"), {
    uid: E.yo.uid, nombre: (E.miembro && E.miembro.nombre) || "", email: E.yo.email || "",
    pagina: E.solapa, texto: String(c.texto || "").slice(0, 2000), esperaba: String(c.esperaba || "").slice(0, 600),
    tipo: c.tipo || "pedido", imagen: c.imagen || "", agenda: !!c.agenda,
    ...(c.respondeA ? { respondeA: String(c.respondeA).slice(0, 60) } : {}),
    ...(c.analisis ? { analisis: c.analisis } : {}),
    ...(c.gravedad ? { gravedad: c.gravedad } : { urgencia: c.urgencia || "pronto" }),
    estado: "nuevo", creadoEn: F.serverTimestamp(),
  });
  avisarClaude(ref.id);    // sugerir-2: despierta al chat en el acto
  return ref.id;
}

/* CONSULTA EN VIVO (sugerir-2, 3-oct-2026). Pedido de Mauro: que una consulta
   despierte al chat de Claude en el momento. La misma forma que los sitios
   (CV2.avisarClaude de Casa Verde): sólo la base y el id, con el token de la
   sesión; la función avisar-claude del Netlify de Casa Verde verifica que la
   persona esté en miembros/ y dispara la rutina. Nunca bloquea: si falla, la
   ronda diaria lo levanta igual. La nota no cambia hasta que esto se vea
   andando: prometer «en minutos» antes sería prometer de más. */
const AVISAR_CLAUDE = "https://serene-scone-76bd4e.netlify.app/.netlify/functions/avisar-claude";
async function avisarClaude(reporteId) {
  try {
    const u = auth && auth.currentUser;
    if (!u || !reporteId) return;
    const t = await u.getIdToken();
    await fetch(AVISAR_CLAUDE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ base: "tiempos", reporteId }),
    });
  } catch (e) { /* silencio a propósito: el reporte ya quedó guardado */ }
}
