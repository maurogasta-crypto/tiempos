// ─────────────────────────────────────────────────────────────────────────────
// balance.js — El balance del tiempo, los acuerdos y la auditoría. Sello: balance-3
//
// BALANCE    cuánta carga tuvo cada uno y cuánto tiempo liberado gastó, con la
//            regla del 29-sep (`balanceTiempo` en nucleo.js). Lo que cuenta es
//            lo MEDIDO (los relojes) y lo ACORDADO que los dos confirmaron.
// ACUERDOS   «semana de trabajo afuera», «me quedo con los dos el finde».
//            Se cargan antes, y cuando pasan se pide confirmación a los dos.
// SALIDAS    (balance-3, 30-sep) se cuentan en DÍAS: noche ½, día entero 1,
//            un rato ¼. Las marca cualquiera, a nombre de cualquiera («salió
//            Florencia»), sin título, y la noche no marca la vuelta. Salir
//            juntos es neutro y una doble marcación no suma (nucleo-6).
// HORAS      las horas por tipo, como antes.
// AUDITORÍA  lo que se revisa solo (`auditar`) y las observaciones del
//            agente sobre cómo se vienen haciendo los registros, con lugar
//            para contestarle.
// ─────────────────────────────────────────────────────────────────────────────

import { db, F, CV } from "./firebase-init.js";
import { esc, TIPOS, TIPO_CASA_VERDE, sumarPorTipo, fmtHoras, semanaDe, lunesDe, sumarDias, isoDe,
         CLASES_BLOQUE, estadoBloque, bloquesPorConfirmar, intervalosDe, balanceTiempo, msDeLocal,
         auditar, intervalosDeMarcas, validarMarca, marcasQueSePisan, idNuevo,
         UNIDADES_SALIDA, unidadDe, marcaDeSalida, saldoSalidas, chicosDelDia } from "./nucleo.js";
import { E, $, aviso, repintar, nombreDe, personas, ninoPorId, fallo } from "./estado.js";

let periodo = "semana";           // "semana" | "mes"
let formBloque = false;
let formSalida = false;
let pedido = 0;                   // para descartar una suma vieja que llega tarde

const uids = () => personas().map((p) => p.id);
const fmtLocal = (t) => { const d = new Date(msDeLocal(t)); return Number.isFinite(d.getTime())
  ? d.toLocaleString("es", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "?"; };

export function pintarBalance() {
  const v = $("v-balance");
  const esta = ++pedido;
  const ahora = Date.now();
  const { desdeMs, hastaMs } = periodo === "semana" ? semanaDe(ahora)
    : { desdeMs: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), hastaMs: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime() };
  const mias = bloquesPorConfirmar(E.bloques, E.yo.uid, uids(), ahora);

  let h = `<nav class="solapas chicas"><button data-per="semana" aria-selected="${periodo === "semana"}">Esta semana</button>
    <button data-per="mes" aria-selected="${periodo === "mes"}">Este mes</button></nav>`;
  if (mias.length) h += `<h2>¿Se cumplió? (${mias.length})</h2>` + mias.map((b) => bloqueHTML(b, true)).join("");
  h += `<div id="bal-cuerpo"><p class="gris">Sumando…</p></div>`;
  h += `<h2>Salidas</h2>${saldoHTML()}
    <p class="gris">Se cuentan en días: una noche (desde las 20, sin marcar la vuelta) es ½, un día entero 1, un rato de mañana o de tarde ¼. Cualquiera marca la suya o la del otro. Salir juntos es neutro, y si los dos marcan la misma salida cuenta una vez. Sólo acumula si ese día estaban los chicos.</p>`;
  h += formSalida ? formSalidaHTML() : `<button class="mini" data-nueva-salida>＋ Salida</button>`;
  const salidas = (E.marcas || []).filter((m) => m.origen !== "agenda" || m.uid === E.yo.uid)
    .sort((a, b) => String(b.desde).localeCompare(String(a.desde))).slice(0, 15);
  h += salidas.map(marcaHTML).join("");
  h += `<h2>Acuerdos de tiempo</h2><p class="gris">Lo que se planea de antemano: «semana de trabajo afuera», «me quedo con los dos». Cuenta en el balance cuando pasa y los dos confirman que se cumplió.</p>`;
  h += formBloque ? formBloqueHTML() : `<button class="mini" data-nuevo-bloque>＋ Acuerdo</button>`;
  const lista = (E.bloques || []).slice().sort((a, b) => String(b.desde).localeCompare(String(a.desde))).slice(0, 20);
  h += lista.length ? lista.map((b) => bloqueHTML(b, false)).join("") : `<p class="gris">Todavía no hay acuerdos.</p>`;
  h += `<h2>Auditoría</h2><div id="bal-audit"><p class="gris">Revisando…</p></div>`;
  v.innerHTML = h;
  enganchar(v);
  calcular(esta, desdeMs, hastaMs, ahora).catch((e) => { if (esta === pedido && $("bal-cuerpo")) $("bal-cuerpo").innerHTML = `<p class="mal">No se pudo sumar: ${esc(e.message)}</p>`; });
}

async function calcular(esta, desdeMs, hastaMs, ahora) {
  // Los relojes del período: los de la familia y los de Casa Verde de cada uno.
  const fam = await F.getDocs(F.query(F.collection(db, "sesiones"), F.where("inicio", ">=", F.Timestamp.fromMillis(desdeMs - 86400000))));
  const ms = (x) => x && x.toMillis ? x.toMillis() : undefined;
  const sesiones = fam.docs.map((d) => ({ ...d.data(), inicioMs: ms(d.data().inicio), finMs: ms(d.data().fin) }));
  const cvUids = Object.fromEntries(E.miembros.filter((m) => m.cvUid).map((m) => [m.cvUid, m.id]));
  if (CV && E.cv && Object.keys(cvUids).length) {
    const M = CV.mod;
    for (const cvUid of Object.keys(cvUids)) {
      const s = await M.getDocs(M.query(M.collection(M.db, "sesiones"), M.where("uid", "==", cvUid)));
      for (const d of s.docs) sesiones.push({ ...d.data(), uid: cvUids[cvUid], tipo: TIPO_CASA_VERDE, registro: "casaverde",
        inicioMs: ms(d.data().inicio), finMs: ms(d.data().fin) });
    }
  }
  // Los últimos siete días de lo cotidiano, para la auditoría.
  const dias = {};
  await Promise.all(Array.from({ length: 7 }, (_, i) => sumarDias(E.hoy, -1 - i)).map(async (d) => {
    const x = await F.getDoc(F.doc(db, "dias", d)).catch(() => null);
    if (x && x.exists()) dias[d] = x.data();
  }));
  if (esta !== pedido || !$("bal-cuerpo")) return;           // ya se pidió otra cosa

  const totalNinos = (E.familia.ninos || []).length;
  const ivs = [...intervalosDe({ sesiones, bloques: E.bloques, uids: uids(), ahoraMs: ahora }), ...intervalosDeMarcas(E.marcas)];
  const b = balanceTiempo({ uids: uids(), intervalos: ivs, totalNinos, desdeMs, hastaMs: Math.min(hastaMs, ahora) });
  const tot = sumarPorTipo(sesiones, { desdeMs, hastaMs, ahoraMs: ahora });

  let h = `<div class="tarjeta">` + personas().map((p) => {
    const x = b.por[p.id] || {};
    return `<div class="persona-bal"><h3>${esc(p.nombre)}</h3>
      <div class="barra-fila"><span>Carga</span><b class="num">${fmtHoras(x.carga)}</b><small class="gris">produciendo ${fmtHoras(x.productivo)} · con los chicos ${fmtHoras(x.conChicos)}</small></div>
      ${x.juntos ? `<div class="barra-fila"><span>Todos juntos</span><b class="num">${fmtHoras(x.juntos)}</b><small class="gris">la mitad a cada uno</small></div>` : ""}</div>`;
  }).join("") + `<p class="gris">Carga: con los chicos (aunque se haga otra cosa) o produciendo, sin contar dos veces; estar con los chicos vale lo mismo que producir, porque es lo que deja producir al otro. «Todos juntos» es mitad y mitad. Las salidas se cuentan aparte, en días (abajo).</p></div>`;
  h += `<details class="tarjeta"><summary><b>Horas por tipo</b></summary>` + personas().map((p) => {
    const t = tot[p.id] || {};
    const max = Math.max(1, ...Object.values(t));
    return `<div class="persona"><h3>${esc(p.nombre || "—")}</h3>` + Object.entries(TIPOS).map(([k, x]) => `<div class="barra-fila"><span>${esc(x.nombre)}</span>
      <span class="barra"><i style="width:${Math.round(100 * (t[k] || 0) / max)}%;background:${x.color}"></i></span>
      <span class="num">${fmtHoras(t[k] || 0)}</span></div>`).join("") + `</div>`;
  }).join("") + `<p class="gris">Casa Verde cuenta como producción.</p></details>`;
  $("bal-cuerpo").innerHTML = h;

  // La auditoría: lo automático y lo que escribió el agente.
  const auto = auditar({ sesiones: sesiones.filter((s) => s.registro !== "casaverde"), movs: E.movs || [], bloques: E.bloques, dias, uids: uids(), hoy: E.hoy, ahoraMs: ahora });
  const notas = (E.auditoria || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 15);
  $("bal-audit").innerHTML = (auto.length ? auto.map((x) => `<div class="audit ${x.nivel}"><span>${x.nivel === "ojo" ? "⚠" : "·"}</span> ${esc(x.texto)}</div>`).join("")
      : `<p class="gris">Nada raro en lo que se revisa solo.</p>`)
    + `<h3>Observaciones del agente</h3>` + (notas.length ? notas.map((n) => {
      const resp = n.respuestas || {};
      const visto = (n.vistoPor || []).includes(E.yo.uid);
      return `<div class="tarjeta chica nota-audit${visto ? " vista" : ""}"><small class="gris">${esc(n.fecha || "")}${n.tema ? " · " + esc(n.tema) : ""}</small>
        <p class="detalle">${esc(n.texto || "")}</p>
        ${Object.entries(resp).map(([u, t]) => `<p><b>${esc(nombreDe(u))}:</b> ${esc(t)}</p>`).join("")}
        <form class="dos ficha-resp" data-resp="${esc(n.id)}"><input name="r" maxlength="600" placeholder="Contestarle" value="${esc(resp[E.yo.uid] || "")}"><button class="mini">Enviar</button></form>
        ${visto ? "" : `<button class="mini" data-visto="${esc(n.id)}">Visto</button>`}</div>`;
    }).join("") : `<p class="gris">El agente todavía no dejó observaciones. Las escribe en la ronda diaria.</p>`);
  for (const f of document.querySelectorAll("[data-resp]")) f.onsubmit = (ev) => {
    ev.preventDefault();
    F.updateDoc(F.doc(db, "auditoria", f.dataset.resp), { [`respuestas.${E.yo.uid}`]: f.r.value.slice(0, 600) })
      .then(() => aviso("Contestado. El agente lo lee en la próxima ronda.")).catch(fallo);
  };
  for (const btn of document.querySelectorAll("[data-visto]")) btn.onclick = () =>
    F.updateDoc(F.doc(db, "auditoria", btn.dataset.visto), { vistoPor: F.arrayUnion(E.yo.uid) }).catch(fallo);
}

function bloqueHTML(b, preguntar) {
  const est = estadoBloque(b, uids(), Date.now());
  const c = CLASES_BLOQUE[b.clase] || {};
  const conf = b.confirmaciones || {};
  return `<div class="bloque" style="--c:${c.color || "#888"}">
    <div><b>${esc(nombreDe(b.uid))}</b> · ${esc(c.nombre || b.clase)}${b.clase === "chicos" && (b.ninos || []).length ? " (" + b.ninos.map((id) => esc((ninoPorId(id) || {}).nombre || "?")).join(" y ") + ")" : ""}
      ${b.titulo ? `<br><span>${esc(b.titulo)}</span>` : ""}</div>
    <small class="gris">${esc(fmtLocal(b.desde))} → ${esc(fmtLocal(b.hasta))} · <b>${esc(est)}</b>
      ${Object.keys(conf).length ? " · " + Object.entries(conf).map(([u, v]) => `${esc(nombreDe(u))} ${v ? "✓" : "✗"}`).join(", ") : ""}</small>
    ${preguntar ? `<div class="botones"><button class="mini ok" data-conf="${esc(b.id)}|1">Sí, se cumplió</button><button class="mini" data-conf="${esc(b.id)}|0">No se cumplió</button></div>`
      : b.creadoPor === E.yo.uid && est !== "confirmado" ? `<button class="mini" data-borrar-bloque="${esc(b.id)}">Borrar</button>` : ""}</div>`;
}

/* El saldo de salidas del período, en días. */
function rango() {
  if (periodo === "semana") { const l = lunesDe(E.hoy); return { desde: l, hasta: sumarDias(l, 7) }; }
  const d = E.hoy.slice(0, 8) + "01"; const [a, m] = d.split("-").map(Number);
  return { desde: d, hasta: `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01` };
}
const fmtDias = (x) => { const n = Math.round(x * 4) / 4; return (n === 1 ? "1 día" : String(n).replace(".", ",") + " días"); };
function saldoHTML() {
  // Si nunca se cargó con quién están los chicos, no se descuenta nada por
  // «no estaban»: sin el dato, se supone que estaban.
  const hayDato = Object.keys(E.familia.patron || {}).length || Object.keys(E.turnos || {}).length;
  const conChicos = hayDato ? (d) => Object.keys(chicosDelDia(d, E.familia.patron, E.turnos)).length > 0 : null;
  const r = saldoSalidas(E.marcas, uids(), { ...rango(), conChicos });
  const filas = personas().map((p) => {
    const x = r.por[p.id] || { dias: 0, salidas: [] };
    return `<div class="barra-fila"><span>${esc(p.nombre)}</span><b class="num">${fmtDias(x.dias)}</b>
      <small class="gris">${x.salidas.filter((s) => s.vale).map((s) => `${esc(s.fecha.slice(8))}/${esc(s.fecha.slice(5, 7))} ${esc(UNIDADES_SALIDA[s.unidad].nombre.toLowerCase())}`).join(" · ")}</small></div>`;
  }).join("");
  const frase = r.aFavor ? `<b>${esc(nombreDe(r.aFavor))}</b> tiene <b>${fmtDias(r.diferencia)}</b> de salida a favor${r.diferencia >= 1 ? ` (un día entero${r.diferencia >= 1 ? " o dos noches" : ""})` : r.diferencia >= 0.5 ? " (una noche)" : ""}.`
    : "Las salidas están parejas.";
  return `<div class="tarjeta">${filas}<p>${frase}</p></div>`;
}
function marcaHTML(m) {
  const quien = m.clase === "neutro" ? "Salieron juntos" : esc(nombreDe(m.uid));
  const unidad = UNIDADES_SALIDA[unidadDe(m)] || {};
  const que = m.origen === "agenda" ? `actividad de la agenda (${esc(({ libre: "personal · " + (unidad.nombre || "").toLowerCase(), productivo: "trabajo o tarea", chicos: "con los chicos" })[m.clase] || m.clase)})`
    : `${esc((unidad.nombre || "salida").toLowerCase())}${m.clase === "neutro" ? " · neutro" : ""}`;
  const puedo = m.marcadoPor === E.yo.uid || m.uid === E.yo.uid;
  return `<div class="bloque" style="--c:${m.clase === "neutro" ? "#8fbf7f" : "#a8a49c"}">
    <div><b>${quien}</b> · ${que}${m.nota ? `<br><span>${esc(m.nota)}</span>` : ""}</div>
    <small class="gris">${esc(fmtLocal(m.desde))}${m.origen === "agenda" ? " → " + esc(fmtLocal(m.hasta)) : ""}${m.marcadoPor && m.marcadoPor !== m.uid ? " · la marcó " + esc(nombreDe(m.marcadoPor)) : ""}</small>
    ${puedo && m.origen !== "agenda" ? `<button class="mini" data-borrar-marca="${esc(m.id)}">${m.uid === E.yo.uid && m.marcadoPor !== E.yo.uid ? "No salí" : "Borrar"}</button>` : ""}</div>`;
}
function formSalidaHTML() {
  const hoy = E.hoy;
  return `<form class="tarjeta ficha" id="form-salida">
    <label>Quién salió <select name="uid">${personas().map((p) => `<option value="${esc(p.id)}"${p.id === E.yo.uid ? " selected" : ""}>${esc(p.nombre)}</option>`).join("")}
      <option value="*">Salimos juntos (neutro)</option></select></label>
    <fieldset class="clases"><legend>Qué fue</legend>
      ${Object.entries(UNIDADES_SALIDA).map(([k, u]) => `<label class="check"><input type="radio" name="unidad" value="${k}"${k === "noche" ? " checked" : ""}> ${esc(u.nombre)} <small class="gris">· ${String(u.vale).replace(".", ",")}</small></label>`).join("")}</fieldset>
    <div class="dos"><label>Día <input type="date" name="fecha" required value="${hoy}"></label>
      <label data-solo-rato hidden>Cuándo <select name="franja"><option value="manana">a la mañana</option><option value="tarde" selected>a la tarde</option></select></label></div>
    <label>Nota <input name="nota" maxlength="120" placeholder="opcional"></label>
    <div class="botones"><button class="boton">Guardar</button><button type="button" class="mini" data-cerrar-salida>Cancelar</button></div></form>`;
}
function formBloqueHTML() {
  const hoy = E.hoy;
  return `<form class="tarjeta ficha" id="form-bloque">
    <label>Quién <select name="uid">${personas().map((p) => `<option value="${esc(p.id)}"${p.id === E.yo.uid ? " selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></label>
    <label>Qué <select name="clase">${Object.entries(CLASES_BLOQUE).map(([k, c]) => `<option value="${k}">${esc(c.nombre)}</option>`).join("")}</select></label>
    <div class="fila-persona" data-solo-chicos><span>Chicos</span>${(E.familia.ninos || []).map((n) => `<label class="check"><input type="checkbox" name="nino" value="${esc(n.id)}" checked> ${esc(n.nombre)}</label>`).join("")}</div>
    <div class="dos"><label>Desde <input type="datetime-local" name="desde" required value="${hoy}T08:00"></label>
      <label>Hasta <input type="datetime-local" name="hasta" required value="${hoy}T20:00"></label></div>
    <label>Nota <input name="titulo" maxlength="120" placeholder="Ej.: trabajo en Florianópolis"></label>
    <div class="botones"><button class="boton">Guardar</button><button type="button" class="mini" data-cerrar-bloque>Cancelar</button></div></form>`;
}

function enganchar(v) {
  const todos = (sel, fn) => { for (const el of v.querySelectorAll(sel)) fn(el); };
  todos("[data-per]", (b) => b.onclick = () => { periodo = b.dataset.per; repintar(); });
  todos("[data-nuevo-bloque]", (b) => b.onclick = () => { formBloque = true; repintar(); });
  todos("[data-nueva-salida]", (b) => b.onclick = () => { formSalida = true; repintar(); });
  todos("[data-cerrar-salida]", (b) => b.onclick = () => { formSalida = false; repintar(); });
  todos("[data-borrar-marca]", (b) => b.onclick = () => {
    if (confirm("¿Sacar esta salida del balance?")) F.deleteDoc(F.doc(db, "marcas", b.dataset.borrarMarca)).catch(fallo);
  });
  const fs = $("form-salida");
  if (fs) {
    const unidadSel = () => (fs.querySelector('[name="unidad"]:checked') || {}).value;
    const sr = () => { fs.querySelector("[data-solo-rato]").hidden = unidadSel() !== "rato"; };
    for (const r of fs.querySelectorAll('[name="unidad"]')) r.onchange = sr;
    sr();
  }
  if (fs) fs.onsubmit = async (ev) => {
    ev.preventDefault();
    const q = (n) => fs.querySelector(`[name="${n}"]`);
    if (!fs.querySelector('[name="unidad"]:checked')) return aviso("Elegí si fue una noche, un día entero o un rato.", true);
    const m = marcaDeSalida({ uid: q("uid").value, unidad: (fs.querySelector('[name="unidad"]:checked') || {}).value,
      fecha: q("fecha").value, franja: q("franja").value, marcadoPor: E.yo.uid, nota: q("nota").value.trim() });
    const mal = validarMarca(m, uids());
    if (mal.length) return aviso("No se pudo: " + mal.join(", ") + ".", true);
    const ya = marcasQueSePisan(m, E.marcas);
    if (ya.length && !confirm(`Esa salida ya está marcada (${ya.map((x) => "por " + nombreDe(x.marcadoPor)).join(", ")}). Aunque la guardes, el rato cuenta una sola vez. ¿Guardar igual?`)) return;
    try {
      await F.setDoc(F.doc(db, "marcas", idNuevo("s")), { ...m, creadoEn: F.serverTimestamp() });
      formSalida = false; aviso("Anotada."); repintar();
    } catch (e) { fallo(e); }
  };
  todos("[data-cerrar-bloque]", (b) => b.onclick = () => { formBloque = false; repintar(); });
  todos("[data-conf]", (b) => b.onclick = () => {
    const [id, si] = b.dataset.conf.split("|");
    F.updateDoc(F.doc(db, "bloques", id), { [`confirmaciones.${E.yo.uid}`]: si === "1", actualizadoEn: F.serverTimestamp() })
      .then(() => aviso(si === "1" ? "Confirmado." : "Anotado: no se cumplió, no cuenta.")).catch(fallo);
  });
  todos("[data-borrar-bloque]", (b) => b.onclick = () => {
    if (confirm("¿Borrar este acuerdo?")) F.deleteDoc(F.doc(db, "bloques", b.dataset.borrarBloque)).catch(fallo);
  });
  const f = $("form-bloque");
  if (f) {
    const sc = () => { f.querySelector("[data-solo-chicos]").hidden = f.clase.value !== "chicos"; };
    f.clase.onchange = sc; sc();
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      if (!(msDeLocal(f.hasta.value) > msDeLocal(f.desde.value))) return aviso("El final tiene que ser después del principio.", true);
      try {
        await F.addDoc(F.collection(db, "bloques"), { uid: f.uid.value, clase: f.clase.value, desde: f.desde.value, hasta: f.hasta.value,
          ninos: f.clase.value === "chicos" ? [...f.querySelectorAll('[name="nino"]:checked')].map((x) => x.value) : [],
          titulo: f.titulo.value.trim().slice(0, 120), confirmaciones: {}, creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
        formBloque = false; aviso("Acuerdo guardado. Cuando pase, se les pide a los dos que confirmen."); repintar();
      } catch (e) { fallo(e); }
    };
  }
}

/* Los acuerdos que tocan un día, para la agenda: los ven los dos. */
export function bloquesDelDia(iso) {
  return (E.bloques || []).filter((b) => {
    const d0 = String(b.desde || "").slice(0, 10), d1 = String(b.hasta || "").slice(0, 10);
    return d0 <= iso && iso <= d1 && estadoBloque(b, uids(), Date.now()) !== "no se cumplió";
  });
}
