// ─────────────────────────────────────────────────────────────────────────────
// nucleo.js — Las cuentas de «tiempos», sin Firebase ni pantalla.
// Sello: nucleo-1
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
//   carga de cada uno = producción + mantenimiento + chicos
//   (un rato con los chicos compartido cuenta para los DOS: ninguno está libre)
//   libre = lo que entró − gastos de mantenimiento − gastos de los chicos
//   a cada uno le toca libre × su carga / la suma de las cargas
//
// **Todavía NO se muestra en pantalla.** Está escrita y probada para que
// Mauro y Florencia la discutan con números; la pantalla del reparto viene
// después de que la acuerden.
// ─────────────────────────────────────────────────────────────────────────────

/* Los tipos de tiempo. `carga: true` es lo que cuenta para el reparto. */
export const TIPOS = {
  produccion:    { nombre: "Producción",    carga: true,  color: "#d8a657" },
  mantenimiento: { nombre: "Mantenimiento", carga: true,  color: "#7fb4bf" },
  ninos:         { nombre: "Chicos",        carga: true,  color: "#c89bd8" },
  casa:          { nombre: "Casa y comida", carga: false, color: "#8fbf7f" },
  personal:      { nombre: "Personal",      carga: false, color: "#a8a49c" },
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
  Object.entries(porTipo || {}).reduce((t, [k, h]) => t + (TIPOS[k] && TIPOS[k].carga ? h : 0), 0);

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
