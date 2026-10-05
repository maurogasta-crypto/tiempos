// ─────────────────────────────────────────────────────────────────────────────
// sugerir.js — El globo flotante: una sugerencia o una falla, al chat. Sello: sugerir-3
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
import { esc } from "./nucleo.js";
import { E, $, aviso, repintar, fallo } from "./estado.js";

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
function empezarDictado(area, boton) {
  if (!Reconocer) return aviso("Este navegador no dicta. Usá el micrófono del teclado o escribilo.", true);
  if (dictando) { dictando.stop(); return; }
  const r = new Reconocer();
  r.lang = "es-UY"; r.continuous = true; r.interimResults = true;
  const base = area.value ? area.value.replace(/\s*$/, " ") : "";
  let final = "";
  r.onresult = (ev) => {
    let parcial = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) final += ev.results[i][0].transcript + " ";
      else parcial += ev.results[i][0].transcript;
    }
    area.value = (base + final + parcial).trimStart();
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
    <form>
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
      <button class="boton" ${enviando ? "disabled" : ""}>${enviando ? "Mandando…" : "Mandar"}</button>
    </form>
    ${mios.length ? `<h4>Lo que mandaste</h4>${mios.slice(0, 8).map((r) => `<div class="mandado"><small class="gris">${esc(r.agenda ? "agenda" : r.tipo === "falla" ? "falla" : "sugerencia")} · ${esc(r.estado === "nuevo" ? "esperando la ronda" : r.estado || "")}</small><br>${esc(String(r.texto || "").slice(0, 140))}</div>`).join("")}` : ""}
  </div>`;
  h.onclick = (ev) => { if (ev.target === h) { abierta = false; pintarHoja(); } };
  h.querySelector("[data-cerrar]").onclick = () => { abierta = false; pintarHoja(); };
  for (const b of h.querySelectorAll("[data-modo]")) b.onclick = () => { if (dictando) dictando.stop(); modo = b.dataset.modo; pintarHoja(); };
  const mic = h.querySelector("[data-dictar]");
  if (mic) mic.onclick = () => empezarDictado(h.querySelector("[name=texto]"), mic);
  for (const i of h.querySelectorAll("[data-flyer]")) i.onchange = () => { foto = i.files && i.files[0] || null; pintarHoja(); };
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

/* Un pedido a reportes/, con la forma de los sitios, y el aviso en vivo. Lo
   usa también la tarjeta de Claude en Ahora para devolver una respuesta. */
export async function mandarReporte(c) {
  const ref = await F.addDoc(F.collection(db, "reportes"), {
    uid: E.yo.uid, nombre: (E.miembro && E.miembro.nombre) || "", email: E.yo.email || "",
    pagina: E.solapa, texto: String(c.texto || "").slice(0, 2000), esperaba: String(c.esperaba || "").slice(0, 600),
    tipo: c.tipo || "pedido", imagen: c.imagen || "", agenda: !!c.agenda,
    ...(c.respondeA ? { respondeA: String(c.respondeA).slice(0, 60) } : {}),
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
