// ─────────────────────────────────────────────────────────────────────────────
// sugerir.js — El globo flotante: una sugerencia o una falla, al chat. Sello: sugerir-2
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

import { db, auth, F } from "./firebase-init.js";
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
export const NOMBRE_SOLAPA = { ahora: "Ahora", hoy: "Hoy", agenda: "Agenda", tareas: "Tareas", chicos: "Chicos", plata: "Plata", balance: "Balance" };

let abierta = false, modo = "pedido", enviando = false;
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
  b.innerHTML = "💡";
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
  h.innerHTML = `<div class="hoja-caja sugerir-ed">
    <div class="hoja-cab"><b>${esc(m.titulo)}</b><button class="mas" data-cerrar aria-label="Cerrar">✕</button></div>
    <nav class="solapas chicas"><button data-modo="pedido" aria-selected="${modo === "pedido"}">Sugerencia</button><button data-modo="falla" aria-selected="${modo === "falla"}">Algo anda mal</button></nav>
    <form>
      <label>${esc(m.que)} <textarea name="texto" rows="3" maxlength="2000" required placeholder="${esc(m.quePh)}">${esc(antes.t)}</textarea></label>
      <label>${esc(m.esp)} <input name="esperaba" maxlength="600" placeholder="${esc(m.espPh)}" value="${esc(antes.e)}"></label>
      <div class="tira">${m.opciones.map(([v, t], i) => `<button type="button" data-v="${v}" class="mini${(marcado && m.opciones.some((o) => o[0] === marcado.v) ? marcado.v === v : i === 0) ? " on" : ""}">${esc(t)}</button>`).join("")}</div>
      <p class="gris nota-ia">Lo lee <b>una IA</b> (el agente de Claude) en la ronda de cada mañana, y lo pasa al panel de Mauro como pendiente. <b>Puede tardar hasta un día.</b> Si hace falta algo más, te va a preguntar en la app o en el chat. Va con tu nombre y la solapa en la que estás (${esc(NOMBRE_SOLAPA[E.solapa] || E.solapa)}).</p>
      <button class="boton" ${enviando ? "disabled" : ""}>${enviando ? "Mandando…" : "Mandar"}</button>
    </form>
    ${mios.length ? `<h4>Lo que mandaste</h4>${mios.slice(0, 8).map((r) => `<div class="mandado"><small class="gris">${esc(r.tipo === "falla" ? "falla" : "sugerencia")} · ${esc(r.estado === "nuevo" ? "esperando la ronda" : r.estado || "")}</small><br>${esc(String(r.texto || "").slice(0, 140))}</div>`).join("")}` : ""}
  </div>`;
  h.onclick = (ev) => { if (ev.target === h) { abierta = false; pintarHoja(); } };
  h.querySelector("[data-cerrar]").onclick = () => { abierta = false; pintarHoja(); };
  for (const b of h.querySelectorAll("[data-modo]")) b.onclick = () => { modo = b.dataset.modo; pintarHoja(); };
  for (const b of h.querySelectorAll(".tira button")) b.onclick = () => {
    for (const x of h.querySelectorAll(".tira button")) x.classList.toggle("on", x === b);
  };
  const f = h.querySelector("form");
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const texto = f.texto.value.trim();
    if (!texto) return;
    if (!E.yo || !E.yo.uid) return aviso("No hay sesión: volvé a entrar.", true);
    enviando = true; pintarHoja();
    try {
      const ref = await F.addDoc(F.collection(db, "reportes"), {
        uid: E.yo.uid, nombre: (E.miembro && E.miembro.nombre) || "", email: E.yo.email || "",
        pagina: E.solapa, texto: texto.slice(0, 2000), esperaba: f.esperaba.value.trim().slice(0, 600),
        tipo: modo, imagen: "", [m.campo]: (h.querySelector(".tira button.on") || {}).dataset.v || m.opciones[0][0],
        estado: "nuevo", creadoEn: F.serverTimestamp(),
      });
      avisarClaude(ref.id);    // sugerir-2: despierta al chat en el acto
      enviando = false; abierta = false; pintarHoja();
      aviso("Mandado. Lo toma la ronda de mañana.");
    } catch (e) { enviando = false; pintarHoja(); fallo(e); }
  };
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
