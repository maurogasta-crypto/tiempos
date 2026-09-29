// ─────────────────────────────────────────────────────────────────────────────
// nucleo.js — Las cuentas de «tiempos», sin Firebase ni pantalla.
// Sello: nucleo-2
//
// Todo lo que decide algo vive acá, en funciones puras, para que el banco
// (`pruebas.mjs`) las corra con `node` a secas. La pantalla sólo las llama.
//
// ── LA REGLA, en palabras de Mauro (29-sep-2026) ─────────────────────────────
// «Hay que poder tener un control general de tiempo ocupado en producción o
// mantenimiento, eso es lo que nos involucra en el acceso al recurso. Luego un
// control del tiempo que pasamos cada uno haciéndonos cargo de los niños.
// Puede haber momentos compartidos. Todo eso tiene que registrarse para, al
// momento de repartir dinero, saber quién tiene menos tiempo liberado para
// actividades personales. Si yo paso mi tiempo trabajando y Florencia pasa
// con los niños, el costo de nuestra vida es neutro. Si quiero salir de
// vacaciones sólo tengo que haber generado un dinero extra del de
// mantenimiento para disponer personalmente; si no, obligo a la otra persona
// a generar y cuidar de la familia sin haber dejado un saldo favorable.»
//
// Traducido a cuentas:
//   carga de cada uno = producción + mantenimiento + ½ × chicos
//   (un rato con los chicos compartido cuenta para los DOS: ninguno está libre)
//
// El «½» es de nucleo-2, con sus palabras del 29-sep: «cuando digo que me
// dedico a los niños paso a estar contado en mitad de lo productivo». Está
// en `peso` de TIPOS: si se acuerda otra cosa, es cambiar ese número.
//   libre = lo que entró − gastos de mantenimiento − gastos de los chicos
//   a cada uno le toca libre × su carga / la suma de las cargas
//
// **Todavía NO se muestra en pantalla.** Está escrita y probada para que
// Mauro y Florencia la discutan con números; la pantalla del reparto viene
// después de que la acuerden.
// ─────────────────────────────────────────────────────────────────────────────

/* Los tipos de tiempo. `carga: true` es lo que cuenta para el reparto. */
export const TIPOS = {
  produccion:    { nombre: "Producción",    carga: true,  peso: 1,   color: "#d8a657" },
  mantenimiento: { nombre: "Mantenimiento", carga: true,  peso: 1,   color: "#7fb4bf" },
  ninos:         { nombre: "Chicos",        carga: true,  peso: 0.5, color: "#c89bd8" },
  casa:          { nombre: "Casa y comida", carga: false, peso: 0,   color: "#8fbf7f" },
  personal:      { nombre: "Personal",      carga: false, peso: 0,   color: "#a8a49c" },
};
export const TIPO_CASA_VERDE = "produccion";

/* «Casa y comida» no está en la carga todavía, a propósito: Mauro nombró
   producción, mantenimiento y chicos. Si deciden sumarla, es cambiar un
   `false` por `true` acá, y el banco lo dice. */

export const esTipo = (t) => Object.prototype.hasOwnProperty.call(TIPOS, t);

/* Horas de una sesión, con el reloj de ahora si sigue corriendo. Nunca
   negativas: un reloj de teléfono atrasado no puede restar trabajo. */
export function horasDe(s, ahoraMs = Date.now()) {
  if (!s) return 0;
  if (s.estado === "en_curso" && Number.isFinite(s.inicioMs))
    return Math.max(0, (ahoraMs - s.inicioMs) / 3600000);
  const h = Number(s.horas);
  return Number.isFinite(h) && h > 0 ? h : 0;
}

/* Suma horas por persona y por tipo, en un rango [desdeMs, hastaMs).
   Una sesión cuenta en el rango si EMPEZÓ adentro: partirla a medianoche
   haría que un turno de noche apareciera en dos semanas. */
export function sumarPorTipo(sesiones, { desdeMs = -Infinity, hastaMs = Infinity, ahoraMs = Date.now() } = {}) {
  const out = {};
  for (const s of sesiones || []) {
    if (!s || !s.uid || !esTipo(s.tipo)) continue;
    if (!(s.inicioMs >= desdeMs && s.inicioMs < hastaMs)) continue;
    out[s.uid] = out[s.uid] || Object.fromEntries(Object.keys(TIPOS).map((t) => [t, 0]));
    out[s.uid][s.tipo] += horasDe(s, ahoraMs);
  }
  return out;
}

export const cargaDe = (porTipo) =>
  Object.entries(porTipo || {}).reduce((t, [k, h]) => t + (TIPOS[k] && TIPOS[k].carga ? h * TIPOS[k].peso : 0), 0);

/* El reparto de la plata libre, POR MONEDA — nunca se suman entre sí.
   `montos` = { BRL: {entro, mantenimiento, chicos}, UYU: {...} }
   `cargas` = { uidA: horas, uidB: horas }
   Devuelve { BRL: { libre, partes: {uidA, uidB} } }.
   Sin carga de nadie, no hay con qué repartir: mitad y mitad, y se avisa. */
export function repartir(montos, cargas) {
  const uids = Object.keys(cargas || {});
  const total = uids.reduce((t, u) => t + Math.max(0, cargas[u] || 0), 0);
  const out = {};
  for (const [moneda, m] of Object.entries(montos || {})) {
    const libre = (m.entro || 0) - (m.mantenimiento || 0) - (m.chicos || 0);
    const partes = {};
    for (const u of uids)
      partes[u] = total > 0 ? libre * Math.max(0, cargas[u] || 0) / total : libre / (uids.length || 1);
    out[moneda] = { libre, partes, sinCarga: total === 0 };
  }
  return out;
}

/* ── Las tareas ──────────────────────────────────────────────────────────────
   Un árbol, como en Casa Verde. El TIPO lo pone la raíz y lo heredan las
   hijas: una tarea no puede ser «chicos» si cuelga de «mantenimiento». */
export function tipoHeredado(tarea, porId) {
  let t = tarea, vueltas = 0;
  while (t && t.parentId && porId[t.parentId] && vueltas++ < 30) t = porId[t.parentId];
  return t && esTipo(t.tipo) ? t.tipo : "personal";
}

export function arbol(tareas) {
  const porId = Object.fromEntries((tareas || []).map((t) => [t.id, t]));
  const hijos = {};
  for (const t of tareas || []) {
    const p = t.parentId && porId[t.parentId] ? t.parentId : "";
    (hijos[p] = hijos[p] || []).push(t);
  }
  const orden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.titulo).localeCompare(String(b.titulo));
  for (const k of Object.keys(hijos)) hijos[k].sort(orden);
  return { raices: hijos[""] || [], hijos, porId };
}

/* ── Un solo cronómetro ──────────────────────────────────────────────────────
   Pedido de Mauro: «usar sólo el cronómetro de nuestra app para actuar en
   Casa Verde». Hay dos bases y UN reloj por persona: el que esté corriendo
   —en cualquiera de las dos— bloquea arrancar otro. Casa Verde ya lo exige
   dentro de su base; esto lo extiende a las dos. */
export function quePuedoArrancar(enCursoCasaVerde, enCursoFamilia) {
  if (enCursoCasaVerde) return { puede: false, motivo: `Ya está corriendo «${enCursoCasaVerde.titulo || "una tarea"}» de Casa Verde. Frenala primero.` };
  if (enCursoFamilia) return { puede: false, motivo: `Ya está corriendo «${enCursoFamilia.titulo || "una tarea"}». Frenala primero.` };
  return { puede: true };
}

/* Semana de lunes a domingo, en hora local. */
export function semanaDe(fechaMs = Date.now()) {
  const d = new Date(fechaMs);
  const dia = (d.getDay() + 6) % 7;             // lunes = 0
  const desde = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dia).getTime();
  return { desdeMs: desde, hastaMs: desde + 7 * 86400000 };
}

export const fmtHoras = (h) => {
  const m = Math.round((h || 0) * 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

export const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ═══════════════════════════════════════════════════════════════════════════
   nucleo-2 — la agenda, los chicos, lo cotidiano y la pizarra (29-sep-2026)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Fechas como texto «AAAA-MM-DD», en hora local ───────────────────────────
   Como en la agenda de Casa Verde: un día es un texto, no un instante. Así un
   día no cambia según el huso de quien lo mire. */
const dos = (n) => String(n).padStart(2, "0");
export const isoDe = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; };
const fechaDe = (iso) => { const [a, m, d] = iso.split("-").map(Number); return new Date(a, m - 1, d, 12); };
export const sumarDias = (iso, n) => { const d = fechaDe(iso); d.setDate(d.getDate() + n); return isoDe(d.getTime()); };
export const diaSemana = (iso) => fechaDe(iso).getDay();          // 0 = domingo
export const lunesDe = (iso) => { const w = diaSemana(iso); return sumarDias(iso, w === 0 ? -6 : 1 - w); };
export const semanaISO = (lunes) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
export const esISO = (x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);

/* El mes como grilla de semanas enteras, de lunes a domingo: los días de
   afuera del mes se dibujan apagados, pero están (una semana partida no se lee). */
export function grillaDelMes(anio, mes0) {
  const primero = isoDe(new Date(anio, mes0, 1, 12).getTime());
  const ultimo = isoDe(new Date(anio, mes0 + 1, 0, 12).getTime());
  const out = [];
  for (let l = lunesDe(primero); l <= ultimo; l = sumarDias(l, 7)) out.push(semanaISO(l));
  return out;
}

export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
                      "septiembre", "octubre", "noviembre", "diciembre"];

/* ── Con quién están los chicos cada día ─────────────────────────────────────
   Dos fuentes, y la de la fecha manda sobre la de la semana:
   · `patron`  — lo acordado para cada día de la semana: { "1": { uid: ["k1"] } }
   · `turnos`  — un día puntual que se cambió: { "2026-10-02": { uid: [...] } }
   Si el día puntual nombra a una persona, esa persona se toma de ahí aunque
   la lista esté vacía («ese día no los tengo» también es un acuerdo). */
export function chicosDelDia(iso, patron, turnos) {
  const base = (patron && patron[String(diaSemana(iso))]) || {};
  const cambio = (turnos && turnos[iso]) || {};
  const out = {};
  for (const uid of new Set([...Object.keys(base), ...Object.keys(cambio)])) {
    if (uid === "nota") continue;
    const lista = Object.prototype.hasOwnProperty.call(cambio, uid) ? cambio[uid] : base[uid];
    if (Array.isArray(lista) && lista.length) out[uid] = [...new Set(lista)];
  }
  return out;
}

/* ── Las actividades con los chicos: las ven LOS DOS, siempre ────────────────
   Un evento es de una fecha, o se repite cada semana desde su fecha (básquet
   los martes). `excepto` son las fechas en que no hubo. */
export function eventosDelDia(iso, eventos) {
  return (eventos || []).filter((e) => {
    if (!e || !esISO(e.fecha)) return false;
    if (Array.isArray(e.excepto) && e.excepto.includes(iso)) return false;
    if (!e.semanal) return e.fecha === iso;
    if (iso < e.fecha || (esISO(e.hasta) && iso > e.hasta)) return false;
    return diaSemana(iso) === diaSemana(e.fecha);
  }).sort((a, b) => String(a.hora || "99").localeCompare(String(b.hora || "99")));
}

/* ── Lo cotidiano: se tilda, no se cronometra ────────────────────────────────
   La lista es la de Mauro, del 29-sep. Un tilde dice quién y cuándo, y puede
   llevar una observación. */
export const COTIDIANAS = [
  { id: "desayuno", nombre: "Desayuno", grupo: "comidas" },
  { id: "almuerzo", nombre: "Almuerzo", grupo: "comidas" },
  { id: "merienda", nombre: "Merienda", grupo: "comidas" },
  { id: "cena",     nombre: "Cena",     grupo: "comidas" },
  { id: "basura",   nombre: "Sacar la basura",    grupo: "casa" },
  { id: "cuartos",  nombre: "Limpieza de cuartos", grupo: "casa" },
  { id: "lavado",   nombre: "Lavado de ropa",      grupo: "casa" },
  { id: "doblado",  nombre: "Doblado y guardado",  grupo: "casa" },
];
export function progresoDia(hechos, lista = COTIDIANAS) {
  const h = hechos || {};
  const listos = lista.filter((c) => h[c.id] && h[c.id].hecho === true).length;
  return { listos, total: lista.length };
}

/* ── Quién se ocupa, y pedirle al otro ───────────────────────────────────────
   Una tarea común está en la lista de los dos. «Me ocupo yo» es un clic que
   pone o saca a uno de `encargados`; pedírsela al otro deja un `pedido` que el
   otro acepta (pasa a ser el encargado, y quien la pidió deja de serlo: «que
   se ocupe de algo que yo no puedo») o devuelve. Nadie queda encargado de
   algo sin haberlo dicho él. */
export function alternarEncargado(tarea, uid) {
  const ya = Array.isArray(tarea.encargados) ? tarea.encargados : [];
  return ya.includes(uid) ? ya.filter((x) => x !== uid) : [...ya, uid];
}
export function pedir(tarea, de, a, texto = "", ahoraMs = Date.now()) {
  if (!de || !a || de === a) throw new Error("Un pedido es de uno al otro.");
  if (tarea.alcance === "personal") throw new Error("Una tarea que ve sólo uno no se le puede pedir al otro.");
  return { de, a, texto: String(texto).slice(0, 200), estado: "pendiente", enMs: ahoraMs };
}
export function responderPedido(tarea, uid, acepta) {
  const p = tarea.pedido;
  if (!p || p.estado !== "pendiente") throw new Error("No hay un pedido esperando.");
  if (p.a !== uid) throw new Error("Ese pedido no es para vos.");
  const encargados = Array.isArray(tarea.encargados) ? tarea.encargados : [];
  return acepta
    ? { pedido: { ...p, estado: "aceptado" }, encargados: [...new Set([...encargados.filter((x) => x !== p.de), uid])] }
    : { pedido: { ...p, estado: "devuelto" }, encargados };
}
export const pedidosPara = (tareas, uid) =>
  (tareas || []).filter((t) => !t.hecho && t.pedido && t.pedido.estado === "pendiente" && t.pedido.a === uid);

/* ── La pizarra: las metas de la semana ──────────────────────────────────────
   Una meta es una tarea común marcada para una semana (`meta` = su lunes). Si
   no se terminó, sigue en la pizarra la semana siguiente, marcada como que
   viene de antes: una meta no se evapora al cambiar de semana. */
export function metasDeLaSemana(tareas, lunes) {
  return (tareas || []).filter((t) => esISO(t.meta) && (t.meta === lunes || (t.meta < lunes && !t.hecho)))
    .map((t) => ({ ...t, deAntes: t.meta < lunes }))
    .sort((a, b) => Number(!!a.hecho) - Number(!!b.hecho) || String(a.titulo).localeCompare(String(b.titulo)));
}

/* ── Mi agenda: cada uno ordena su semana ────────────────────────────────────
   `agenda` = { clave: { dia, franja, hora } }. Estar en el mapa es «está en
   mi agenda». Sin día FLOTA en hoy —como en Casa Verde—, hasta que se le da
   uno o se saca: no se le guarda «hoy», que en tres días sería un atraso que
   nadie eligió. Lo hecho se va de la semana. */
export const FRANJAS = ["manana", "tarde", "noche"];
export function franjaDe(m) {
  if (m && FRANJAS.includes(m.franja)) return m.franja;
  const h = m && m.hora;
  if (!h) return "manana";
  return h >= "19:00" ? "noche" : h >= "13:00" ? "tarde" : "manana";
}
export function ubicarEnSemana(items, agenda, hoy, lunes) {
  const dias = semanaISO(lunes);
  const out = Object.fromEntries(dias.map((d) => [d, { manana: [], tarde: [], noche: [] }]));
  const atrasadas = [];
  for (const it of items || []) {
    const m = (agenda || {})[it.clave];
    if (!m || it.hecho) continue;
    const flota = !esISO(m.dia);
    const dia = flota ? hoy : m.dia;
    const x = { ...it, dia, hora: m.hora || "", franja: franjaDe(m), flota };
    if (out[dia]) out[dia][x.franja].push(x);
    else if (dia < hoy && dia < lunes && lunes <= hoy) atrasadas.push(x);
  }
  for (const d of dias) for (const f of FRANJAS)
    out[d][f].sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99") || String(a.titulo).localeCompare(String(b.titulo)));
  return { dias: out, atrasadas };
}

/* ── Los relojes en curso: el de tarea es UNO, el de los chicos va aparte ────
   Estar con los chicos corre EN PARALELO a una tarea («en paralelo a eso está
   la dedicación a los niños»): no bloquea el cronómetro, ni él a ella. */
export function separarEnCurso(sesiones) {
  const vivas = (sesiones || []).filter((s) => s && s.estado === "en_curso");
  return { tarea: vivas.find((s) => s.registro !== "cuidado") || null,
           cuidado: vivas.find((s) => s.registro === "cuidado") || null };
}
