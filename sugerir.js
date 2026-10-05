// ─────────────────────────────────────────────────────────────────────────────
// sugerir.js — El globo flotante: una sugerencia o una falla, al chat. Sello: sugerir-7
//
// Pedido de Mauro, 29-sep-2026: «un cuadro flotante con una sugerencia que
// llegue al chat para que sea tomado en las rutinas diarias, como en los
// sitios».
//
// Es el MISMO circuito de los sitios (el molde es `REPORTES.md` de remate, y
// la forma, la de CasaYourte `nucleo-20`): va a `reportes/` de ESTA base con un
// campo `tipo` —«pedido» o «falla»—, y la ronda diaria lo cruza contra el
// panel y lo convierte en un pendiente. No escribe en el panel: el panel vive
// en otro proyecto de Firebase y un token sirve para uno solo.
//
// Una falla tiene `gravedad` («¿te deja seguir?»); un pedido, `urgencia`
// («¿es para ya?»). Nunca las dos: un pedido no tiene gravedad.
//
// La nota de abajo dice quién contesta y cuánto tarda ANTES de mandar: quien
// pide tiene derecho a saberlo.
// ─────────────────────────────────────────────────────────────────────────────

import { db, auth, F, CV } from "./firebase-init.js";
import { textoFrecuencia } from "./nucleo.js";
import { esc, leerPlanIA, agendaParaIA, CLASES_ACTIVIDAD, esISO, limpiarDictado, listasDeCompras, listaParaCompra, idNuevo } from "./nucleo.js";
import { agendarMio } from "./propone.js";
import { E, $, aviso, repintar, fallo, otro } from "./estado.js";

export const MODOS = {
  pedido: { titulo: "Una sugerencia", que: "¿Qué te gustaría?", quePh: "Que en la agenda se vea también la semana de Florencia.",
            esp: "¿Para qué te serviría?", espPh: "Para no pisarnos los horarios.", campo: "urgencia",
            opciones: [["cuando-se-pueda", "Cuando se pueda"], ["pronto", "Pronto"], ["ya", "Lo necesito ya"]] },
  falla:  { titulo: "Algo anda mal", que: "¿Qué pasó?", quePh: "Toqué Aprobar y no pasó nada.",
            esp: "¿Qué esperabas que pasara?", espPh: "Que el gasto apareciera en la lista.", campo: "gravedad",
            opciones: [["molesta", "Molesta, sigo"], ["traba", "Me traba algo"], ["no-anda", "No puedo usar la app"]] },
};
MODOS.agenda = { titulo: "Para la agenda", que: "Dictalo o escribilo", quePh: "El jueves de 3 a 6 llevo a los chicos a básquet.",
  esp: "Algo más (opcional)", espPh: "Es para toda la familia / sólo Flor / para recordar.", campo: "urgencia",
  opciones: [["pronto", "Para la agenda"]] };
export const NOMBRE_SOLAPA = { ahora: "Ahora", hoy: "Hoy", agenda: "Agenda", tareas: "Tareas", chicos: "Chicos", plata: "Plata", balance: "Balance" };

let abierta = false, modo = "agenda", enviando = false;   // sugerir-3: lo primero es dictar

/* ── sugerir-3 (5-oct-2026): DICTAR A LA AGENDA ──────────────────────────────
   Pedido de Mauro: «el pedido de agregar una tarea o actividad a la agenda se
   tiene que hacer por dictado»; que el botón «simule ser una grabación» y que
   el texto que se va a mandar se vea y se pueda corregir con el teclado; y que
   también se pueda mandar la captura de un flyer o un anuncio.
   El dictado lo hace el reconocimiento de voz del teléfono (Chrome): el audio
   no se guarda ni viaja, viaja el TEXTO, y antes de mandarlo uno lo ve. Va a
   reportes/ como un pedido más, con `agenda: true` y la imagen subida a
   Cloudinary al MANDAR (nunca al elegir), igual que las boletas. Lo interpreta
   Claude y devuelve una tarjeta en Ahora: nada entra a la agenda sin aceptar. */
const Reconocer = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
let dictando = null;          // el reconocedor activo, o null
let foto = null;              // el archivo elegido, todavía sin subir
let precarga = null;          // sugerir-4: lo que entendió Gemini, para corregir y agendar
let precargando = false;
let textoDictado = "";

/* ── sugerir-4 (5-oct-2026): PRECARGAR CON GEMINI ────────────────────────────
   Mauro: «se puede usar la misma API de Gemini para que precargue todo en la
   agenda en el momento». La app le pregunta a Gemini por claude-proxy (el de
   las boletas) y llena la tarjeta al instante. Uno la corrige y agenda en SU
   agenda; y el pedido igual le llega a Claude, que hace lo que Gemini no
   puede: cruzar con el otro y preguntarle al que queda libre.
   A Gemini no le van los nombres de los chicos (no entran al código ni a un
   tercero): sólo si la actividad es con ellos. */
async function interpretar(texto, archivo) {
  const CV2 = CV && CV.CV2;
  if (!CV2) throw new Error("sin Casa Verde no hay IA");
  const hoy = E.hoy;
  const dia = new Date(hoy + "T12:00").toLocaleDateString("es", { weekday: "long" });
  const otroN = ((E.miembros || []).find((m) => m.id !== E.yo.uid) || {}).nombre || "la otra persona";
  const yoN = (E.miembro && E.miembro.nombre) || "quien dicta";
  // sugerir-5: MI agenda de las próximas dos semanas, para que pueda colgar un
  // recordatorio de «el gimnasio de mañana». Es la mía y la manda mi sesión.
  const agenda = agendaParaIA(E.actividades, hoy);
  const listas = listasDeCompras(E.compras).map((l) => l.nombre);
  texto = limpiarDictado(texto);
  const contenido = [];
  if (archivo) {
    const blob = await CV2.comprimirImagen(archivo);
    const data = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = mal; r.readAsDataURL(blob); });
    contenido.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  }
  contenido.push({ type: "text", text: `Hoy es ${dia} ${hoy} (Uruguay/Brasil). ${yoN} vive con ${otroN} y sus hijos, y dictó algo para organizar su tiempo. ${archivo ? "Adjunta la captura de un flyer o anuncio. " : ""}Lo dictado (puede tener errores del dictado del teléfono y expresiones espontáneas): «${texto || "(nada: sólo la captura)"}».
Su agenda de las próximas dos semanas (JSON): ${JSON.stringify(agenda)}
Pensá qué necesita de verdad y devolvé un PLAN de acciones, SOLO un JSON sin texto alrededor:
{"resumen": una línea con lo que entendiste,
 "acciones": [ cada una con "tipo" y sus campos:
   {"tipo":"actividad","titulo","dia":"AAAA-MM-DD","hi":"HH:MM","hf":"HH:MM" o "","lugar","tipo_clase":"trabajo"|"tarea"|"personal"|"ninos","quien":"yo"|"otro"|"los-dos"|"familia","chicos":true|false}  — algo nuevo que ocupa tiempo;
   {"tipo":"tarea","titulo","detalle"}  — algo para hacer/preparar, va a su pizarra;
   {"tipo":"recordatorio","texto","dia","hora":"HH:MM" (temprano ese día),"sobre": id de su agenda si se refiere a algo que ya tiene}  — un aviso ese día;
   {"tipo":"alarma","texto","dia","hora","sobre"}  — una alarma sonora a una hora (p. ej. un rato antes de algo de la agenda, si tiene que salir antes);
   {"tipo":"deseo","titulo","detalle","para":"yo"|"chicos"|"familia","lugar","dias":["martes","jueves"] si se repite cada semana,"fecha":"AAAA-MM-DD" si es una sola vez,"hi":"HH:MM","hf":"HH:MM","cuando": en palabras si no hay días ni fecha}  — algo que quisiera hacer pero no está decidido (un flyer, una clase): va a la lista de deseos. Si el flyer dice que es semanal, poné los días; si es un evento con fecha, la fecha;
   {"tipo":"coordinar","texto"}  — una pregunta para ${otroN} si para hacerlo hay que acordar con él o ella;
   {"tipo":"compra","texto","lista"}  — algo para no olvidar comprar; va a la lista de compras de la casa. Listas que ya existen: ${JSON.stringify(listas)} (usá una de ésas si corresponde, o un nombre corto nuevo);
   {"tipo":"pedido","titulo","detalle","dia"}  — algo que le pide a ${otroN} que haga (va a la pizarra de ${otroN}) ],
 "dudas": [lo que no quedó claro]}.
Elegí con criterio lo que corresponde, puede ser más de una acción: algo decidido con día y hora es una actividad (si es con los chicos, "chicos": true y va también al calendario compartido de los chicos); algo que quisiera pero no está decidido es un deseo; «no olvidar comprar…» es una compra; «pedirle a ${otroN}…» o «que ${otroN} …» es un pedido; «acordarme de…» es un recordatorio (y una alarma si hay una hora en que tiene que salir); preparar algo es una tarea.
Si menciona algo que YA está en su agenda, usá su día y hora (y su id en "sobre"); no lo dupliques como actividad. Fechas relativas («mañana», «el jueves») desde hoy. Si un dato no se sabe, dejalo vacío y ponelo en dudas. No inventes.` });
  const r = await fetch(CV2.NETLIFY + "/claude-proxy", {
    method: "POST", headers: { "Content-Type": "application/json" },
    // flash-lite: el que piensa se come los tokens y corta el JSON (plata-2).
    body: JSON.stringify({ model: "gemini-2.5-flash-lite", max_tokens: 3000, messages: [{ role: "user", content: contenido }] }),
  });
  if (!r.ok) throw new Error("la IA contestó " + r.status);
  const j = await r.json();
  return leerPlanIA(((j.content || [])[0] || {}).text);
}

const DIA_CORTO = (iso) => { try { return new Date(iso + "T12:00").toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" }); } catch { return iso; } };
function renglonAccion(a, n) {
  const ch = `<input type="checkbox" data-accion="${n}" checked>`;
  const enAgenda = (id) => { const x = (E.actividades || {})[id]; return x ? ` · ${esc(x.titulo)}` : ""; };
  if (a.tipo === "actividad") return `<label class="check accion">${ch} 📅 <span><b>${esc(a.titulo)}</b> · ${esc(DIA_CORTO(a.dia))} ${esc(a.hi)}${a.hf ? "–" + esc(a.hf) : ""}${a.lugar ? " · " + esc(a.lugar) : ""}
    <small class="gris">${esc((CLASES_ACTIVIDAD[a.clase] || {}).nombre || "sin clase")} · ${esc(a.quien === "otro" ? "lo hace el otro" : a.quien === "yo" ? "vos" : a.quien)}</small></span></label>`;
  if (a.tipo === "tarea") return `<label class="check accion">${ch} 📝 <span>A tu pizarra: <b>${esc(a.titulo)}</b>${a.detalle ? ` <small class="gris">${esc(a.detalle)}</small>` : ""}</span></label>`;
  if (a.tipo === "recordatorio") return `<label class="check accion">${ch} 🔔 <span>Recordatorio ${esc(DIA_CORTO(a.dia))} ${esc(a.hora)}: <b>${esc(a.texto)}</b><small class="gris">${enAgenda(a.sobre)}</small></span></label>`;
  if (a.tipo === "alarma") return `<label class="check accion">${ch} ⏰ <span>Alarma ${esc(DIA_CORTO(a.dia))} ${esc(a.hora)}: <b>${esc(a.texto)}</b><small class="gris">${enAgenda(a.sobre)} · suena en la APK; mientras, por WhatsApp</small></span></label>`;
  if (a.tipo === "deseo") return `<label class="check accion">${ch} ⭐ <span>A deseos${a.para === "chicos" ? " de los chicos" : a.para === "familia" ? " de la familia" : ""}: <b>${esc(a.titulo)}</b>${textoFrecuencia(a) ? ` <small class="gris">${esc(textoFrecuencia(a))}</small>` : ""}</span></label>`;
  if (a.tipo === "compra") return `<label class="check accion">${ch} 🛒 <span>A la lista de compras${a.lista ? " «" + esc(a.lista) + "»" : ""}: <b>${esc(a.texto)}</b></span></label>`;
  if (a.tipo === "pedido") return `<label class="check accion">${ch} 🙋 <span>Pedido para ${esc((otro() || {}).nombre || "el otro")}, a su pizarra: <b>${esc(a.titulo)}</b>${a.dia ? ` <small class="gris">${esc(DIA_CORTO(a.dia))}</small>` : ""}</span></label>`;
  if (a.tipo === "coordinar") return `<label class="check accion">${ch} 💬 <span>Preguntarle a ${esc(((E.miembros || []).find((m) => m.id !== E.yo.uid) || {}).nombre || "el otro")}: <b>${esc(a.texto)}</b></span></label>`;
  return "";
}

function tarjetaPrecarga(p) {
  return `<div class="tarjeta ficha propone" data-precarga>
    <p class="gris">✨ ${p.resumen ? "Entendí: «" + esc(p.resumen) + "»" : "Esto propongo"} — destildá lo que no va</p>
    ${p.acciones.length ? p.acciones.map(renglonAccion).join("") : `<p class="aviso">No saqué nada claro. Volvé al texto y decilo de otra forma, o mandáselo a Claude.</p>`}
    ${p.dudas.length ? `<p class="aviso">No estoy seguro de: ${p.dudas.map(esc).join(", ")}. Las actividades se corrigen después en Agenda.</p>` : ""}
    <div class="botones"><button type="button" class="boton" data-agendar ${p.acciones.length ? "" : "disabled"}>Hacer lo marcado</button><button type="button" class="mini" data-otra-vez>Volver al texto</button></div>
    <p class="gris">Si hay que acordar con el otro, Claude le pregunta y te avisa.</p>
  </div>`;
}

/* Hacer lo marcado: cada acción, con la sesión de quien dictó. Lo que necesita
   al otro (coordinar, «lo hace el otro») va a Claude como un pedido. */
async function agendarPrecarga(tp) {
  if (enviando) return;
  const marcadas = [...tp.querySelectorAll("[data-accion]")].filter((c) => c.checked).map((c) => precarga.acciones[Number(c.dataset.accion)]);
  if (!marcadas.length) return aviso("No marcaste nada.", true);
  enviando = true;
  const hecho = [], paraClaude = [];
  try {
    let imagen = "";
    if (foto) imagen = await CV.CV2.subirImagen(foto, "tiempos");      // al aceptar, nunca al elegir
    for (const a of marcadas) {
      if (a.tipo === "actividad") {
        if (a.quien === "otro") { paraClaude.push(`Que lo agende el otro: ${a.titulo} ${a.dia} ${a.hi}`); continue; }
        const id = await agendarMio({ titulo: a.titulo, dia: a.dia, hi: a.hi, hf: a.hf, lugar: a.lugar, tipo: a.clase, modo: a.modo, imagen }, { origen: "dictado" });
        if (id) hecho.push("📅 " + a.titulo);
        if (a.chicos && esISO(a.dia)) await F.addDoc(F.collection(db, "eventos"), { titulo: a.titulo.slice(0, 120), fecha: a.dia, hora: a.hi || "",
          horaFin: a.hf || "", semanal: false, ninos: [], quienes: [E.yo.uid], nota: a.lugar ? "En " + a.lugar.slice(0, 280) : "",
          excepto: [], creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
        if (a.quien === "los-dos" || a.quien === "familia") paraClaude.push(`Agendé «${a.titulo}» ${a.dia} ${a.hi} para ${a.quien}`);
      } else if (a.tipo === "tarea") {
        await F.addDoc(F.collection(db, "tareas"), { titulo: a.titulo.slice(0, 120), tipo: "personal", alcance: "personal", duenio: E.yo.uid,
          parentId: null, hecho: false, encargados: [E.yo.uid], meta: null, detalle: a.detalle || "", pizarra: { [E.yo.uid]: true },
          origen: "dictado", creadoEn: F.serverTimestamp() });
        hecho.push("📝 " + a.titulo);
      } else if (a.tipo === "recordatorio" || a.tipo === "alarma") {
        if (!esISO(a.dia)) { aviso(`«${a.texto}» no tiene día: no lo guardé.`, true); continue; }
        await F.addDoc(F.collection(db, "alertas"), { uid: E.yo.uid, tipo: a.tipo, texto: a.texto, dia: a.dia, hora: a.hora || "08:00",
          sobre: a.sobre || "", avisada: false, creadoEn: F.serverTimestamp() });
        hecho.push((a.tipo === "alarma" ? "⏰ " : "🔔 ") + a.texto);
      } else if (a.tipo === "deseo") {
        const coordina = marcadas.some((x) => x.tipo === "coordinar");
        const ref = await F.addDoc(F.collection(db, "deseos"), { uid: E.yo.uid, titulo: a.titulo, detalle: a.detalle || "", para: a.para,
          lugar: a.lugar || "", cuando: a.cuando || "", dias: a.dias || [], fecha: a.fecha || "", hi: a.hi || "", hf: a.hf || "", imagen, estado: coordina ? "coordinando" : "deseo", creadoEn: F.serverTimestamp() });
        hecho.push("⭐ " + a.titulo);
        if (coordina) paraClaude.push(`Deseo deseos/${ref.id}: «${a.titulo}»`);
      } else if (a.tipo === "coordinar") {
        paraClaude.push("Coordinar: " + a.texto);
      } else if (a.tipo === "compra") {
        // A la lista que se llama así; si no hay, se crea (como «＋ Súper»).
        let lid = listaParaCompra(listasDeCompras(E.compras), a.lista);
        const nueva = lid ? {} : { nombre: (a.lista || "Súper").slice(0, 40), orden: Date.now() };
        if (!lid) lid = idNuevo("l");
        await F.setDoc(F.doc(db, "familia", "compras"), { listas: { [lid]: { ...nueva,
          items: { [idNuevo("i")]: { texto: a.texto.slice(0, 80), hecho: false, por: E.yo.uid, orden: Date.now() } } } },
          actualizadoEn: F.serverTimestamp() }, { merge: true });
        hecho.push("🛒 " + a.texto);
      } else if (a.tipo === "pedido") {
        // Una tarea COMÚN a cargo del otro, marcada para su pizarra. Claude
        // además le avisa por WhatsApp si el otro lo encendió.
        const o = otro();
        if (!o) { aviso(`«${a.titulo}»: no hay a quién pedírselo.`, true); continue; }
        await F.addDoc(F.collection(db, "tareas"), { titulo: a.titulo.slice(0, 120), tipo: "casa", alcance: "comun", duenio: E.yo.uid,
          parentId: null, hecho: false, encargados: [o.id], meta: null, pizarra: { [o.id]: true },
          detalle: [`Pedido de ${(E.miembro && E.miembro.nombre) || ""}`, a.dia ? "para el " + a.dia : "", a.detalle || ""].filter(Boolean).join(" · ").slice(0, 300),
          origen: "dictado", creadoEn: F.serverTimestamp() });
        hecho.push("🙋 " + a.titulo);
        paraClaude.push(`Pedido para ${o.nombre || "el otro"}: ${a.titulo}`);
      }
    }
    // A Claude siempre le llega lo dictado (lo cruza con el otro); con lo que
    // ya se hizo, para que no lo repita.
    await mandarReporte({ texto: textoDictado || (precarga.resumen || "Lo de la captura."), agenda: true, imagen,
      esperaba: [hecho.length ? "Ya hecho: " + hecho.join(" · ") : "", ...paraClaude].filter(Boolean).join(" | ").slice(0, 600),
      extra: { yaAgendado: hecho.length ? "plan" : "", quien: paraClaude.length ? "coordinar" : "yo" } });
    if (deseoAgendando && hecho.some((x) => x.startsWith("📅"))) await F.updateDoc(F.doc(db, "deseos", deseoAgendando), { estado: "agendado" }).catch(() => {});
    deseoAgendando = null;
    foto = null; precarga = null; textoDictado = ""; enviando = false; abierta = false; pintarHoja();
    aviso(hecho.length ? "Listo: " + hecho.length + " cosa(s)." + (paraClaude.length ? " Claude coordina el resto." : "") : "Mandado a Claude.");
    repintar();
  } catch (e) { enviando = false; fallo(e); }
}

function empezarDictado(area, boton) {
  if (!Reconocer) return aviso("Este navegador no dicta. Usá el micrófono del teclado o escribilo.", true);
  if (dictando) { dictando.stop(); return; }
  const r = new Reconocer();
  r.lang = "es-UY"; r.continuous = true; r.interimResults = true;
  const base = area.value ? area.value.replace(/\s*$/, " ") : "";
  // Se rearma con TODOS los resultados cada vez (no se acumula): en Android
  // cada resultado puede traer de nuevo lo anterior, y acumulando salía
  // «el el jueves el jueves llevo…». limpiarDictado saca lo repetido.
  r.onresult = (ev) => {
    let todo = "";
    for (let i = 0; i < ev.results.length; i++) todo += " " + ev.results[i][0].transcript;
    area.value = (base + limpiarDictado(todo)).trimStart();
  };
  r.onend = () => { dictando = null; boton.classList.remove("grabando"); boton.textContent = "🎙"; area.focus(); };
  r.onerror = (e) => { if (e.error === "not-allowed") aviso("El teléfono no dejó usar el micrófono: dale permiso al navegador.", true); };
  dictando = r; boton.classList.add("grabando"); boton.textContent = "■";
  r.start();
}
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
  const b = Object.assign(document.createElement("button"), { id: "globo", className: "globo", title: "Sugerir algo o avisar una falla" });
  b.innerHTML = "🎙";
  b.title = "Dictar algo para la agenda, sugerir algo o avisar una falla";
  b.onclick = () => { abierta = true; escucharMios(); pintarHoja(); };
  document.body.append(b);
}

function pintarHoja() {
  let h = $("hoja-sugerir");
  if (!abierta) { if (h) h.remove(); return; }
  if (!h) { h = Object.assign(document.createElement("div"), { id: "hoja-sugerir", className: "hoja" }); document.body.append(h); }
  const m = MODOS[modo];
  const antes = h.querySelector("form") ? { t: h.querySelector("[name=texto]").value, e: h.querySelector("[name=esperaba]").value } : { t: "", e: "" };
  const marcado = (h.querySelector(".tira button.on") || {}).dataset;
  h.innerHTML = `<div class="hoja-caja sugerir-ed${modo === "agenda" ? " modo-agenda" : ""}">
    <div class="hoja-cab"><b>${esc(m.titulo)}</b><button class="mas" data-cerrar aria-label="Cerrar">✕</button></div>
    <nav class="solapas chicas"><button data-modo="agenda" aria-selected="${modo === "agenda"}">🎙 Agenda</button><button data-modo="pedido" aria-selected="${modo === "pedido"}">Sugerencia</button><button data-modo="falla" aria-selected="${modo === "falla"}">Algo anda mal</button></nav>
    ${modo === "agenda" && precarga ? tarjetaPrecarga(precarga) : ""}
    <form ${modo === "agenda" && precarga ? "hidden" : ""}>
      ${modo === "agenda" ? `<div class="dictado"><button type="button" class="microfono${dictando ? " grabando" : ""}" data-dictar aria-label="Dictar">${dictando ? "■" : "🎙"}</button>
        <small class="gris">${Reconocer ? "Tocá, hablá, y corregí abajo lo que entendió el teléfono." : "Este navegador no dicta: usá el micrófono del teclado."}</small></div>` : ""}
      <label>${esc(m.que)} <textarea name="texto" rows="${modo === "agenda" ? 4 : 3}" maxlength="2000" ${modo === "agenda" ? "" : "required"} placeholder="${esc(m.quePh)}">${esc(antes.t)}</textarea></label>
      ${modo === "agenda" ? `<div class="boleta">${CV && CV.CV2 ? `
        <label class="mini boton-archivo">📷 Sacar foto<input type="file" accept="image/*" capture="environment" data-flyer hidden></label>
        <label class="mini boton-archivo">🖼 Elegir captura<input type="file" accept="image/*" data-flyer hidden></label>` : `<small class="gris">Sin Casa Verde no se pueden subir imágenes.</small>`}
        ${foto ? `<small>${esc(foto.name)} · se sube al mandar</small>` : ""}</div>` : ""}
      <label>${esc(m.esp)} <input name="esperaba" maxlength="600" placeholder="${esc(m.espPh)}" value="${esc(antes.e)}"></label>
      <div class="tira">${m.opciones.map(([v, t], i) => `<button type="button" data-v="${v}" class="mini${(marcado && m.opciones.some((o) => o[0] === marcado.v) ? marcado.v === v : i === 0) ? " on" : ""}">${esc(t)}</button>`).join("")}</div>
      ${modo === "agenda" ? `<p class="gris">Lo interpreta <b>una IA</b> (Claude) y te deja una propuesta en <b>Ahora</b> para aceptar o corregir: <b>nada entra a tu agenda ni a la de nadie sin que esa persona lo acepte</b>. Suele tardar unos minutos; si no, la ronda de la mañana. Va con tu nombre.</p>` : ""}
      <p class="gris nota-ia">Lo lee <b>una IA</b> (el agente de Claude) en la ronda de cada mañana, y lo pasa al panel de Mauro como pendiente. <b>Puede tardar hasta un día.</b> Si hace falta algo más, te va a preguntar en la app o en el chat. Va con tu nombre y la solapa en la que estás (${esc(NOMBRE_SOLAPA[E.solapa] || E.solapa)}).</p>
      ${modo === "agenda" ? `<div class="botones"><button type="button" class="boton" data-precargar ${precargando ? "disabled" : ""}>${precargando ? "Leyendo…" : "✨ Precargar"}</button>
        <button class="mini" ${enviando ? "disabled" : ""}>${enviando ? "Mandando…" : "Mandar a Claude sin precargar"}</button></div>`
      : `<button class="boton" ${enviando ? "disabled" : ""}>${enviando ? "Mandando…" : "Mandar"}</button>`}
    </form>
    ${mios.length ? `<h4>Lo que mandaste</h4>${mios.slice(0, 8).map((r) => `<div class="mandado"><small class="gris">${esc(r.agenda ? "agenda" : r.tipo === "falla" ? "falla" : "sugerencia")} · ${esc(r.estado === "nuevo" ? "esperando la ronda" : r.estado || "")}</small><br>${esc(String(r.texto || "").slice(0, 140))}</div>`).join("")}` : ""}
  </div>`;
  h.onclick = (ev) => { if (ev.target === h) { abierta = false; pintarHoja(); } };
  h.querySelector("[data-cerrar]").onclick = () => { abierta = false; pintarHoja(); };
  for (const b of h.querySelectorAll("[data-modo]")) b.onclick = () => { if (dictando) dictando.stop(); modo = b.dataset.modo; pintarHoja(); };
  const mic = h.querySelector("[data-dictar]");
  if (mic) mic.onclick = () => empezarDictado(h.querySelector("[name=texto]"), mic);
  for (const i of h.querySelectorAll("[data-flyer]")) i.onchange = () => { foto = i.files && i.files[0] || null; pintarHoja(); };
  const pre = h.querySelector("[data-precargar]");
  if (pre) pre.onclick = async () => {
    const texto = h.querySelector("[name=texto]").value.trim();
    if (!texto && !foto) return aviso("Dictá algo o elegí una captura.", true);
    if (dictando) dictando.stop();
    textoDictado = texto;
    precargando = true; pintarHoja();
    try { precarga = await interpretar(texto, foto); }
    catch (e) { precarga = null; aviso("No pude precargar (" + (e.message || e) + "): completalo a mano.", true); }
    if (!precarga) precarga = leerPlanIA("{}");
    precargando = false; pintarHoja();
  };
  const tp = h.querySelector("[data-precarga]");
  if (tp) {
    tp.querySelector("[data-otra-vez]").onclick = () => { precarga = null; pintarHoja(); };
    tp.querySelector("[data-agendar]").onclick = () => agendarPrecarga(tp).catch(fallo);
  }
  for (const b of h.querySelectorAll(".tira button")) b.onclick = () => {
    for (const x of h.querySelectorAll(".tira button")) x.classList.toggle("on", x === b);
  };
  const f = h.querySelector("form");
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    if (dictando) dictando.stop();
    let texto = f.texto.value.trim();
    if (!texto && !(modo === "agenda" && foto)) return aviso(modo === "agenda" ? "Dictá algo o elegí una captura." : "Escribí algo.", true);
    if (!texto) texto = "Agendar lo de la captura.";
    if (!E.yo || !E.yo.uid) return aviso("No hay sesión: volvé a entrar.", true);
    enviando = true; pintarHoja();
    try {
      // La imagen se sube al MANDAR y ANTES del documento: un corte de red no
      // deja un pedido apuntando a una imagen que no existe.
      let imagen = "";
      if (modo === "agenda" && foto) imagen = await CV.CV2.subirImagen(foto, "tiempos");
      await mandarReporte({ texto, esperaba: f.esperaba.value.trim(), tipo: modo === "agenda" ? "pedido" : modo,
        agenda: modo === "agenda", imagen, [m.campo]: (h.querySelector(".tira button.on") || {}).dataset.v || m.opciones[0][0] });
      foto = null;
      enviando = false; abierta = false; pintarHoja();
      aviso(modo === "agenda" ? "Mandado. La propuesta te aparece en Ahora." : "Mandado. Lo toma la ronda de mañana.");
    } catch (e) { enviando = false; pintarHoja(); fallo(e); }
  };
}

/* Abrir el globo en Agenda con un texto ya escrito (un deseo que se agenda). */
let deseoAgendando = null;
export function abrirDictado(texto, deseoId = null) {
  modo = "agenda"; precarga = null; deseoAgendando = deseoId; abierta = true; escucharMios(); pintarHoja();
  const t = document.querySelector("#hoja-sugerir [name=texto]");
  if (t) { t.value = texto; t.focus(); }
}

/* Un pedido a reportes/, con la forma de los sitios, y el aviso en vivo. Lo
   usa también la tarjeta de Claude en Ahora para devolver una respuesta. */
export async function mandarReporte(c) {
  const ref = await F.addDoc(F.collection(db, "reportes"), {
    uid: E.yo.uid, nombre: (E.miembro && E.miembro.nombre) || "", email: E.yo.email || "",
    pagina: E.solapa, texto: String(c.texto || "").slice(0, 2000), esperaba: String(c.esperaba || "").slice(0, 600),
    tipo: c.tipo || "pedido", imagen: c.imagen || "", agenda: !!c.agenda,
    ...(c.respondeA ? { respondeA: String(c.respondeA).slice(0, 60) } : {}),
    ...(c.extra ? { yaAgendado: String(c.extra.yaAgendado || "").slice(0, 60), quien: String(c.extra.quien || "").slice(0, 20) } : {}),
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
