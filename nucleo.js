// ─────────────────────────────────────────────────────────────────────────────
// nucleo.js — Las cuentas de «tiempos», sin Firebase ni pantalla.
// Sello: nucleo-29
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
//
// nucleo-2 contaba a los chicos por la mitad; nucleo-3 lo corrige con sus
// palabras del 29-sep: «si declara estar a cargo de los chicos se cuenta
// como equiparable a producir… aunque haya estado haciendo otras cosas, ya
// estuvo produciendo». La cuenta fina del tiempo está en `balanceTiempo`,
// más abajo.
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
  ninos:         { nombre: "Chicos",        carga: true,  peso: 1,   color: "#c89bd8" },
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

/* ¿Es ésta la tarea que está corriendo? (nucleo-7, tiempos:A1). Mauro, 1-oct:
   «es difícil identificar que inició, el botón del play no cambia». La fila
   que corre muestra ■ y queda recuadrada; las demás siguen con ▶. Casa Verde
   guarda la actividad en `actividadId`, la familia la tarea en `tareaId`. */
export function estaCorriendo(enCursoCasaVerde, enCursoFamilia, origen, id) {
  if (!id) return false;
  if (origen === "cv") return !!enCursoCasaVerde && enCursoCasaVerde.actividadId === id;
  if (origen === "f") return !!enCursoFamilia && enCursoFamilia.tareaId === id;
  return false;
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
  // nucleo-4 (30-sep, pedido de Mauro): «al lado de cada comida, la lavada de
  // vajilla». Es otra tarea —la puede hacer otro— y se dibuja en el mismo
  // renglón que su comida (`junto`).
  { id: "desayuno-vajilla", nombre: "Vajilla", grupo: "comidas", junto: "desayuno" },
  { id: "almuerzo-vajilla", nombre: "Vajilla", grupo: "comidas", junto: "almuerzo" },
  { id: "merienda-vajilla", nombre: "Vajilla", grupo: "comidas", junto: "merienda" },
  { id: "cena-vajilla",     nombre: "Vajilla", grupo: "comidas", junto: "cena" },
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

/* ═══════════════════════════════════════════════════════════════════════════
   nucleo-3 — el balance del tiempo, la plata y la auditoría (29-sep-2026)
   ═══════════════════════════════════════════════════════════════════════════

   ── LA REGLA DEL TIEMPO, en palabras de Mauro ──────────────────────────────
   «Si declara estar a cargo de los chicos se cuenta como equiparable a
   producir. […] Cuando gasto el cupo es cuando figuro en una tarea personal
   sin los niños. […] El sistema tiene que marcar ese tiempo en el que pasa
   uno sólo de los dos a cargo de los dos niños: eso libera el tiempo del
   otro, siempre que el que está sin los niños no esté en una tarea
   productiva. Por ejemplo una semana de trabajo en desplazamiento: todo ese
   tiempo es repartido en partes iguales. Se genera recurso y otro se ocupa
   integralmente de los niños.»

   Traducido, minuto a minuto y para cada uno:
     · CARGA      = está con los chicos, O en algo productivo (una vez, no
                    dos: estar con los chicos mientras trabaja ya es carga).
     · LIBERADO   = no está con los chicos, no está produciendo, y además
                    (a) está en algo personal, o
                    (b) el OTRO está solo con TODOS los chicos.
                    Es el cupo que se gasta.
   El saldo es quién gastó más cupo que el otro.

   Las fuentes son los RELOJES (lo medido) y los BLOQUES de la agenda (lo
   declarado: «semana de trabajo afuera», «me quedo con los dos»). Un bloque
   cuenta recién cuando los dos confirman que se cumplió: un acuerdo a futuro
   es una promesa, no un hecho. */

export const CLASES_BLOQUE = {
  productivo: { nombre: "Trabajo / producción", color: "#d8a657" },
  chicos:     { nombre: "A cargo de los chicos", color: "#c89bd8" },
  libre:      { nombre: "Tiempo personal, sin los chicos", color: "#a8a49c" },
};

/* «2026-10-06T08:00» (hora local) → milisegundos. */
export const msDeLocal = (t) => { const d = new Date(String(t)); return Number.isFinite(d.getTime()) ? d.getTime() : NaN; };

/* En qué está un bloque. Pasado su fin, espera que lo confirmen los dos; si
   alguno dice que no se cumplió, no cuenta. */
export function estadoBloque(b, uids, ahoraMs = Date.now()) {
  const c = (b && b.confirmaciones) || {};
  if (Object.values(c).some((v) => v === false)) return "no se cumplió";
  const desde = msDeLocal(b.desde), hasta = msDeLocal(b.hasta);
  if (!(hasta > desde)) return "mal cargado";
  if (ahoraMs < desde) return "acordado";
  if (ahoraMs < hasta) return "en curso";
  return (uids || []).every((u) => c[u] === true) ? "confirmado" : "por confirmar";
}
export const bloquesPorConfirmar = (bloques, uid, uids, ahoraMs = Date.now()) =>
  (bloques || []).filter((b) => estadoBloque(b, uids, ahoraMs) === "por confirmar" && (b.confirmaciones || {})[uid] !== true);

/* Los relojes y los bloques confirmados, como intervalos de una sola forma. */
export function intervalosDe({ sesiones = [], bloques = [], uids = [], ahoraMs = Date.now() } = {}) {
  const out = [];
  for (const s of sesiones) {
    if (!s || !s.uid || !Number.isFinite(s.inicioMs)) continue;
    const fin = s.estado === "en_curso" ? ahoraMs
      : Number.isFinite(s.finMs) ? s.finMs : s.inicioMs + horasDe(s) * 3600000;
    if (!(fin > s.inicioMs)) continue;
    // nucleo-5: «todos juntos» es de los DOS, se marque desde donde se marque.
    if (s.registro === "cuidado" && s.juntos === true) {
      out.push({ uid: "*", desdeMs: s.inicioMs, hastaMs: fin, clase: "juntos", ninos: 0 });
      continue;
    }
    const clase = s.registro === "cuidado" || s.tipo === "ninos" ? "chicos"
      : s.tipo === "produccion" || s.tipo === "mantenimiento" ? "productivo"
      : s.tipo === "personal" ? "libre" : null;
    if (!clase) continue;                       // «casa y comida»: ni carga ni cupo
    out.push({ uid: s.uid, desdeMs: s.inicioMs, hastaMs: fin, clase,
               ninos: clase === "chicos" ? (Array.isArray(s.ninos) ? s.ninos.length : 1) : 0 });
  }
  for (const b of bloques) {
    if (estadoBloque(b, uids, ahoraMs) !== "confirmado" || !CLASES_BLOQUE[b.clase]) continue;
    out.push({ uid: b.uid, desdeMs: msDeLocal(b.desde), hastaMs: msDeLocal(b.hasta), clase: b.clase,
               ninos: b.clase === "chicos" ? (Array.isArray(b.ninos) ? b.ninos.length : 0) : 0 });
  }
  return out;
}

/* El barrido: se corta el tiempo en tramos donde nada cambia, y en cada
   tramo se mira qué hace cada uno. */
export function balanceTiempo({ uids = [], intervalos = [], totalNinos = 0, desdeMs = -Infinity, hastaMs = Infinity } = {}) {
  const cero = () => ({ carga: 0, productivo: 0, conChicos: 0, liberado: 0, juntos: 0 });
  const por = Object.fromEntries(uids.map((u) => [u, cero()]));
  // «*» es de los dos: «todos juntos» y «salimos juntos» (nucleo-5).
  const ivs = intervalos.filter((i) => por[i.uid] || i.uid === "*")
    .map((i) => ({ ...i, desdeMs: Math.max(i.desdeMs, desdeMs), hastaMs: Math.min(i.hastaMs, hastaMs) }))
    .filter((i) => i.hastaMs > i.desdeMs);
  const cortes = [...new Set(ivs.flatMap((i) => [i.desdeMs, i.hastaMs]))].sort((a, b) => a - b);
  for (let k = 0; k + 1 < cortes.length; k++) {
    const a = cortes[k], b = cortes[k + 1], h = (b - a) / 3600000;
    const vivos = ivs.filter((i) => i.desdeMs <= a && i.hastaMs >= b);
    if (!vivos.length) continue;
    // «Cuando cualquiera marca todos juntos, se toma como ½ y ½»: los dos
    // cargan la mitad y nadie libera. Aunque los dos lo marquen, es UN tramo.
    if (vivos.some((i) => i.clase === "juntos")) {
      for (const u of uids) { por[u].carga += h / 2; por[u].conChicos += h / 2; por[u].juntos += h; }
      continue;
    }

    const est = Object.fromEntries(uids.map((u) => {
      const mios = vivos.filter((i) => i.uid === u);
      const ninos = Math.max(0, ...mios.filter((i) => i.clase === "chicos").map((i) => i.ninos || 1));
      return [u, { chicos: mios.some((i) => i.clase === "chicos"), ninos,
                   prod: mios.some((i) => i.clase === "productivo"), libre: mios.some((i) => i.clase === "libre") }];
    }));
    for (const u of uids) {
      const e = est[u];
      const otros = uids.filter((x) => x !== u);
      // «Uno solo a cargo de los dos niños»: el otro tiene a TODOS, y yo no tengo a ninguno.
      const otroConTodos = totalNinos > 0 && otros.some((o) => est[o].chicos && est[o].ninos >= totalNinos);
      if (e.chicos) por[u].conChicos += h;
      if (e.prod) por[u].productivo += h;
      if (e.chicos || e.prod) por[u].carga += h;
      else if (e.libre || otroConTodos) por[u].liberado += h;
    }
  }
  const [x, y] = uids;
  const dif = x && y ? por[x].liberado - por[y].liberado : 0;
  return { por, masLiberado: Math.abs(dif) < 1e-9 ? null : dif > 0 ? x : y, diferencia: Math.abs(dif) };
}

/* ── La plata ────────────────────────────────────────────────────────────────
   Cada moneda es un sistema aparte: nunca se suman entre sí. La categoría
   dice a qué cuenta del reparto va: lo de mantenimiento y lo de los chicos
   se descuenta ANTES de repartir el libre (ver `repartir`). */
export const MONEDAS = ["BRL", "UYU", "USD"];
export const CATEGORIAS = {
  ingreso:       { nombre: "Ingreso",                 tipo: "entro", reparto: "entro" },
  // nucleo-19 (tiempos:V9, 8-oct): de dónde entra la plata de la familia.
  // Mauro: «mis honorarios + los de Flor + el dinero neto registrado luego
  // de pagar todos los gastos». El neto de un negocio llega YA descontados
  // sus gastos: por eso «Gastos del negocio» no resta en el reparto.
  honorarios:    { nombre: "Honorarios",              tipo: "entro", reparto: "entro" },
  negocio:       { nombre: "Neto de un negocio (Casa Verde, remate)", tipo: "entro", reparto: "entro" },
  comida:        { nombre: "Comida y supermercado",   tipo: "salio", reparto: "mantenimiento" },
  casa:          { nombre: "Casa y servicios",        tipo: "salio", reparto: "mantenimiento" },
  transporte:    { nombre: "Transporte",              tipo: "salio", reparto: "mantenimiento" },
  salud:         { nombre: "Salud",                   tipo: "salio", reparto: "mantenimiento" },
  chicos:        { nombre: "Chicos (escuela, ropa…)", tipo: "salio", reparto: "chicos" },
  actividades:   { nombre: "Actividades de los chicos", tipo: "salio", reparto: "chicos" },
  personal:      { nombre: "Personal",                tipo: "salio", reparto: "personal" },
  otros:         { nombre: "Otros",                   tipo: "salio", reparto: "mantenimiento" },
  vehiculos:     { nombre: "Vehículos (patente, seguro, arreglos)", tipo: "salio", reparto: "mantenimiento" },
  impuestos:     { nombre: "Impuestos y tasas",       tipo: "salio", reparto: "mantenimiento" },
  negocio_gasto: { nombre: "Gastos del negocio",      tipo: "salio", reparto: "negocio" },
  // nucleo-24 (10-oct-2026, tiempos:V11): lo de las obras, los lugares y los
  // vehículos. Mauro: «los costos de todas las infraestructuras tienen que
  // salir del presupuesto general», y «todos los cobros entran a la
  // administración general de la familia». Por eso son categorías comunes.
  materiales:    { nombre: "Materiales",              tipo: "salio", reparto: "mantenimiento" },
  jornales:      { nombre: "Jornales y mano de obra", tipo: "salio", reparto: "mantenimiento" },
  combustible:   { nombre: "Combustible",             tipo: "salio", reparto: "mantenimiento" },
  repuestos:     { nombre: "Repuestos y taller",      tipo: "salio", reparto: "mantenimiento" },
  herramientas:  { nombre: "Herramientas",            tipo: "salio", reparto: "mantenimiento" },
  alquileres:    { nombre: "Alquileres y subarriendos", tipo: "entro", reparto: "entro" },
  trabajos:      { nombre: "Cobro por un trabajo",    tipo: "entro", reparto: "entro" },
};

export function validarMovimiento(m) {
  const e = [];
  if (!m || !(Number(m.monto) > 0)) e.push("el monto tiene que ser un número mayor que cero");
  if (!m || !MONEDAS.includes(m.moneda)) e.push("falta la moneda");
  if (!m || !esISO(m.fecha)) e.push("falta la fecha");
  if (!m || !CATEGORIAS[m.categoria]) e.push("falta la categoría");
  else if (m.tipo && CATEGORIAS[m.categoria].tipo !== m.tipo) e.push("la categoría no corresponde a " + (m.tipo === "entro" ? "una entrada" : "un gasto"));
  return e;
}

/* Lo disponible: lo que entró menos lo que salió, por moneda. */
export function disponible(movs, { desde = "", hasta = "9999" } = {}) {
  const out = {};
  for (const m of movs || []) {
    if (!m || !MONEDAS.includes(m.moneda) || !(Number(m.monto) > 0) || !esISO(m.fecha)) continue;
    if (m.fecha < desde || m.fecha > hasta) continue;
    const c = CATEGORIAS[m.categoria]; if (!c) continue;
    const o = (out[m.moneda] = out[m.moneda] || { entro: 0, salio: 0, saldo: 0, mantenimiento: 0, chicos: 0, personal: 0, negocio: 0 });
    const v = Number(m.monto);
    if (c.tipo === "entro") { o.entro += v; o.saldo += v; }
    else { o.salio += v; o.saldo -= v; o[c.reparto] += v; }
  }
  return out;
}

/* Los pagos automáticos: cada mes, pasado su día, piden que se confirmen.
   No se registran solos: el monto de una factura cambia, y un gasto que
   nadie miró es un número inventado. */
export function automaticosPendientes(recurrentes, movs, hoy) {
  const out = [];
  const mes = hoy.slice(0, 7), dia = Number(hoy.slice(8));
  for (const r of recurrentes || []) {
    if (!r || r.activo === false || !(Number(r.dia) >= 1)) continue;
    if (esISO(r.desde) && r.desde.slice(0, 7) > mes) continue;
    if (dia < Math.min(28, Number(r.dia))) continue;
    if (Array.isArray(r.saltados) && r.saltados.includes(mes)) continue;   // «este mes no hubo»
    const ya = (movs || []).some((m) => m.automatico === r.id && String(m.fecha || "").slice(0, 7) === mes);
    if (!ya) out.push({ ...r, mes, fecha: `${mes}-${String(Math.min(28, Number(r.dia))).padStart(2, "0")}` });
  }
  return out;
}

/* Lo que devuelve la IA al leer una boleta: texto que DEBERÍA ser JSON. Se
   lee con desconfianza: lo que no se entiende queda vacío para que lo
   complete una persona, nunca inventado. */
export function leerSugerencia(texto) {
  let j = null;
  const t = String(texto || "").replace(/```(?:json)?/gi, "");
  const i = t.indexOf("{"), k = t.lastIndexOf("}");
  if (i !== -1 && k > i) { try { j = JSON.parse(t.slice(i, k + 1)); } catch { j = null; } }
  if (!j || typeof j !== "object") return null;
  const num = Number(String(j.monto ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  const moneda = String(j.moneda || "").toUpperCase().replace("R$", "BRL").replace("$U", "UYU").replace("U$S", "USD");
  return {
    monto: num > 0 ? Math.round(num * 100) / 100 : "",
    moneda: MONEDAS.includes(moneda) ? moneda : "",
    fecha: esISO(j.fecha) ? j.fecha : "",
    comercio: String(j.comercio || "").slice(0, 80),
    categoria: CATEGORIAS[j.categoria] ? j.categoria : "",
    detalle: String(j.detalle || "").slice(0, 300),
  };
}

/* ── La auditoría ────────────────────────────────────────────────────────────
   Lo que se puede revisar solo, sin opinar: relojes olvidados, huecos,
   gastos sin boleta, acuerdos sin confirmar. Cada punto dice qué pasa y qué
   hacer. Las observaciones con criterio las escribe el agente aparte. */
export function auditar({ sesiones = [], movs = [], bloques = [], dias = {}, uids = [], hoy, ahoraMs = Date.now() } = {}) {
  const out = [];
  const H = 3600000;
  for (const s of sesiones) {
    if (s.estado === "en_curso" && ahoraMs - s.inicioMs > 12 * H)
      out.push({ nivel: "ojo", tema: "relojes", texto: `Un reloj de ${s.nombre || "alguien"} lleva ${Math.round((ahoraMs - s.inicioMs) / H)} h corriendo: ¿quedó olvidado?` });
    else if (s.estado !== "en_curso" && horasDe(s) > 10)
      out.push({ nivel: "ojo", tema: "relojes", texto: `${s.nombre || "Alguien"} registró ${fmtHoras(horasDe(s))} de corrido${s.tareaTitulo ? " en «" + s.tareaTitulo + "»" : ""}: revisar si fue así.` });
  }
  const sinBoleta = movs.filter((m) => CATEGORIAS[m.categoria] && CATEGORIAS[m.categoria].tipo === "salio" && !m.comprobanteUrl && !m.automatico);
  if (sinBoleta.length) out.push({ nivel: "info", tema: "plata", texto: `${sinBoleta.length} gasto(s) sin foto de la boleta.` });
  const sinDetalle = movs.filter((m) => !String(m.detalle || m.comercio || "").trim());
  if (sinDetalle.length) out.push({ nivel: "info", tema: "plata", texto: `${sinDetalle.length} movimiento(s) sin detalle ni comercio: dentro de un mes no se va a saber qué fueron.` });
  const porConf = (bloques || []).filter((b) => estadoBloque(b, uids, ahoraMs) === "por confirmar");
  if (porConf.length) out.push({ nivel: "ojo", tema: "acuerdos", texto: `${porConf.length} acuerdo(s) de tiempo esperando confirmación: hasta que los dos confirmen, no cuentan.` });
  if (hoy) {
    let vacios = 0;
    for (let i = 1; i <= 7; i++) { const d = sumarDias(hoy, -i); if (!progresoDia((dias[d] || {}).hechos).listos) vacios++; }
    if (vacios) out.push({ nivel: "info", tema: "cotidiano", texto: `En los últimos 7 días, ${vacios} sin ninguna tarea cotidiana tildada.` });
  }
  const cuidadoSinChicos = sesiones.filter((s) => s.registro === "cuidado" && !(Array.isArray(s.ninos) && s.ninos.length));
  if (cuidadoSinChicos.length) out.push({ nivel: "ojo", tema: "chicos", texto: `${cuidadoSinChicos.length} registro(s) con los chicos sin decir con cuál.` });
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   nucleo-4 — lo que pidió Mauro desde el globo 💡 (30-sep-2026)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Cotidianas agregadas por ellos ──────────────────────────────────────────
   «De las tareas cotidianas a tildar, tiene que estar la opción de agregar una
   nueva.» Las de siempre están en el código; las agregadas viven en
   `familia/config.cotidianasExtra` como MAPA ({id: {nombre, grupo, orden}}) y
   no como lista, para que dos teléfonos que agregan a la vez no se pisen. */
export const GRUPOS_COTIDIANOS = ["comidas", "casa"];
export function cotidianasDe(extra) {
  const suma = Object.entries(extra || {})
    .filter(([id, c]) => c && typeof c.nombre === "string" && c.nombre.trim() && GRUPOS_COTIDIANOS.includes(c.grupo)
      && !COTIDIANAS.some((b) => b.id === id))
    .sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0))
    .map(([id, c]) => ({ id, nombre: c.nombre.trim().slice(0, 60), grupo: c.grupo, propia: true }));
  return [...COTIDIANAS, ...suma];
}
export const idNuevo = (prefijo, ahoraMs = Date.now()) =>
  prefijo + ahoraMs.toString(36) + Math.random().toString(36).slice(2, 6);

/* ── La lista de compras ─────────────────────────────────────────────────────
   «Falta la lista de compras. En categorías editables —súper, ferretería, o
   alimentos, materiales—; al entrar se despliega la lista con checkbox.»
   Vive en `familia/compras`: { listas: { id: { nombre, orden, items: { id:
   { texto, hecho, por, orden } } } } }. Mapas y no listas por lo mismo de
   arriba: cada tilde toca una sola clave.
   Desde nucleo-20 (9-oct-2026, «quiero que mi lista se visualice como ésta
   cuando vaya al súper») una lista puede tener PASILLOS: `secciones: { sid:
   { nombre, orden } }`, y cada cosa su `seccion` y una `nota` chica («para la
   torta»). Son opcionales: una lista sin pasillos se ve como siempre. */
export const LISTAS_DE_ENTRADA = ["Súper", "Verdulería", "Farmacia", "Ferretería"];
/* nucleo-21 (compras-4): una lista COMPARTIDA SIN CUENTA vive mientras tanto
   en `compartidas/{token}` (la única colección que se lee sin sesión, y sólo
   por su token); en `familia/compras` queda el puntero `compartida: {token}`.
   `compartidas` son esos documentos ya leídos, por token: si está, las cosas y
   los pasillos salen de ahí. Mientras no llegó, la lista se ve vacía, nunca
   con lo de antes. */
const msDe = (v) => (v && typeof v.toMillis === "function") ? v.toMillis() : Number(v) || 0;
export function listasDeCompras(doc, compartidas = {}) {
  return Object.entries((doc && doc.listas) || {})
    .filter(([, l]) => l && typeof l.nombre === "string")
    .map(([id, l0]) => {
      const token = l0.compartida && typeof l0.compartida.token === "string" ? l0.compartida.token : "";
      const fuera = token ? (compartidas[token] || null) : null;
      const l = token ? { ...l0, items: (fuera && fuera.items) || {}, secciones: (fuera && fuera.secciones) || l0.secciones } : l0;
      const items = Object.entries(l.items || {})
        .filter(([, it]) => it && typeof it.texto === "string" && it.texto.trim())
        .map(([iid, it]) => ({ id: iid, texto: it.texto, hecho: it.hecho === true, por: it.por || "", orden: it.orden || 0,
          porNombre: typeof it.porNombre === "string" ? it.porNombre.slice(0, 30) : "",
          seccion: typeof it.seccion === "string" ? it.seccion : "", nota: typeof it.nota === "string" ? it.nota : "" }))
        .sort((a, b) => Number(a.hecho) - Number(b.hecho) || a.orden - b.orden || a.texto.localeCompare(b.texto));
      const secciones = Object.entries(l.secciones || {})
        .filter(([, x]) => x && typeof x.nombre === "string" && x.nombre.trim())
        .map(([sid, x]) => ({ id: sid, nombre: x.nombre, orden: x.orden || 0 }))
        .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
      return { id, nombre: l.nombre, orden: l.orden || 0, items, secciones, faltan: items.filter((i) => !i.hecho).length,
        compartida: token ? { token, vence: msDe(fuera && fuera.vence), cargada: !!fuera } : null };
    })
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
}

/* La lista en el ORDEN DEL RECORRIDO, para el modo súper: un grupo por
   pasillo, en su orden, y lo que no tiene pasillo (o tiene uno que ya no
   existe) al final, en «Otras cosas». Acá lo tildado NO baja al final: en el
   súper uno camina la lista de arriba abajo, y si las cosas se movieran al
   tocarlas se perdería el lugar. Los pasillos vacíos no se muestran. */
export function recorridoDeCompra(lista) {
  const ids = new Set((lista.secciones || []).map((x) => x.id));
  const porOrden = (a, b) => a.orden - b.orden || a.texto.localeCompare(b.texto);
  const grupos = (lista.secciones || []).map((x) => ({ id: x.id, nombre: x.nombre,
    items: lista.items.filter((i) => i.seccion === x.id).sort(porOrden) }));
  grupos.push({ id: "", nombre: "Otras cosas", items: lista.items.filter((i) => !ids.has(i.seccion)).sort(porOrden) });
  return grupos.filter((g) => g.items.length);
}

/* El token de una lista compartida: 22 letras al azar de 64 posibles (132
   bits). ES la llave: quien no lo tiene no puede leer el documento, y la
   regla no deja LISTAR la colección sin sesión. */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function tokenNuevo(azar = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return Array.from(azar(22), (x) => B64[x & 63]).join("");
}
export const HORAS_COMPARTIDA = 48;

/* Lo que se copia al compartir: nombre, pasillos y cosas, tal cual. */
export function documentoCompartido(l0, uid, ahoraMs) {
  return { nombre: String(l0.nombre || "").slice(0, 40), lista: l0.id || "", secciones: l0.secciones || {}, items: l0.items || {},
    creadoPor: uid, venceMs: ahoraMs + HORAS_COMPARTIDA * 3600000 };
}

/* ── Colores de las tareas ───────────────────────────────────────────────────
   «Y elegirle colores.» Un proyecto lleva su color y lo que tiene adentro lo
   hereda, salvo que tenga uno propio; sin color, el de su ámbito. */
export const COLORES_TAREA = ["#e57373", "#f0a35e", "#e3c34f", "#7fbf7f", "#5fb3b3", "#6c9bd8", "#a987d8", "#d88fb5", "#8d8d8d"];
export function colorHeredado(t, porId) {
  const vistos = new Set();
  for (let x = t; x && !vistos.has(x.id); x = x.parentId ? porId[x.parentId] : null) {
    vistos.add(x.id);
    if (COLORES_TAREA.includes(x.color)) return x.color;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   nucleo-5 — las MARCAS de tiempo: la agenda y las salidas (30-sep-2026)
   ═══════════════════════════════════════════════════════════════════════════
   En palabras de Mauro: «Hay que ir descontando además las liberaciones de
   tiempo… uno de los dos puede tener salidas semanales y el otro no. Eso no
   cuenta como un día completo, pero sí como una fracción, y una salida
   nocturna cuenta más que una actividad en la agenda. No tengo por qué ver
   las actividades particulares de la agenda del otro, pero cualquiera puede
   marcar y el sistema hace el balance. La salida juntos es neutra. Yo puedo
   avisar la salida del otro aunque el otro no la haya marcado. Hay que
   controlar que no se duplique el tiempo por doble marcación.»

   Una MARCA (`marcas/{id}`) es lo único que el balance necesita saber de un
   rato: DE QUIÉN es, QUÉ clase es y DE CUÁNDO A CUÁNDO. Nunca el título: la
   actividad de la agenda sigue en la agenda de cada uno, que el otro no ve.
     · la pone la agenda al cargar una actividad (con su clase, obligatoria);
     · o la pone cualquiera en Balance: «salió Florencia», «salimos juntos».
   La doble marcación no suma: el barrido mira, en cada tramo, SI alguien
   está libre, no cuántas marcas lo dicen. Dos marcas del mismo rato valen
   una; dos que se pisan a medias valen la unión. */
export const CLASES_ACTIVIDAD = {
  trabajo:  { nombre: "Trabajo",              clase: "productivo" },
  tarea:    { nombre: "Tarea",                clase: "productivo" },
  personal: { nombre: "Personal, sin los chicos", clase: "libre" },
  ninos:    { nombre: "Con los chicos",       clase: "chicos" },
};
export const CLASES_MARCA = ["productivo", "chicos", "libre", "neutro"];

/* ── Las SALIDAS se cuentan en DÍAS (nucleo-6, 30-sep-2026) ─────────────────
   Mauro, el mismo día: «La noche es una actividad luego de las 8. Implica
   que el otro se hace cargo de la cena con los niños, de acomodar la casa y
   de acostarlos: cuenta como la mitad del día. Puede volver a la hora que
   quiera, no tiene por qué marcar retorno. […] Si salgo y el otro se queda
   con los niños, eso se tiene que acumular: aunque no sea en dinero, es en
   salidas. Si uno sale dos noches en la semana, el otro podría salir un día
   entero y tendría las salidas equiparadas.»
   Entonces una salida no se mide en horas sino en FRACCIONES DE DÍA:
     · día entero                     = 1
     · noche (desde las 20, sin vuelta) = ½
     · un rato de mañana o de tarde    = ¼
   y el balance de salidas es cuántos días salió cada uno: al que salió
   menos le queda esa diferencia a favor. */
export const UNIDADES_SALIDA = {
  dia:   { nombre: "Día entero",                 vale: 1 },
  // nucleo-19 (8-oct): «si la salida es de toda la noche se cuenta el día».
  // No reemplaza a la noche de ½ (salir a la noche y volver): es quedarse
  // afuera hasta el otro día.
  toda:  { nombre: "Toda la noche (no vuelve a dormir)", vale: 1 },
  noche: { nombre: "Noche (desde las 20)",       vale: 0.5 },
  rato:  { nombre: "Un rato de mañana o de tarde", vale: 0.25 },
};
export const HORA_NOCHE = "20:00";
/* Qué fracción es una marca libre. La trae escrita si se cargó como salida;
   si viene de la agenda, se deduce: empieza de las 20 en adelante → noche;
   dura 10 horas o más → día entero; si no, un rato. */
export function unidadDe(m) {
  if (m && UNIDADES_SALIDA[m.unidad]) return m.unidad;
  const hora = String((m && m.desde) || "").slice(11, 16);
  if (hora >= HORA_NOCHE) return "noche";
  if (msDeLocal(m.hasta) - msDeLocal(m.desde) >= 10 * 3600000) return "dia";
  return "rato";
}
/* Las horas de cada salida, para ver si dos marcas son la misma: la noche
   corre hasta las 7 del día siguiente (no se marca la vuelta). */
export function marcaDeSalida({ uid, unidad, fecha, franja = "tarde", marcadoPor, nota = "" }) {
  const man = sumarDias(fecha, 1);
  const [desde, hasta] = unidad === "dia" ? [`${fecha}T07:00`, `${man}T07:00`]
    : unidad === "toda" ? [`${fecha}T${HORA_NOCHE}`, `${man}T12:00`]
    : unidad === "noche" ? [`${fecha}T${HORA_NOCHE}`, `${man}T07:00`]
    : franja === "manana" ? [`${fecha}T07:00`, `${fecha}T13:00`] : [`${fecha}T13:00`, `${fecha}T${HORA_NOCHE}`];
  return { uid, clase: uid === "*" ? "neutro" : "libre", unidad, desde, hasta, origen: "salida", marcadoPor, nota: String(nota).slice(0, 120) };
}

/* El saldo de salidas de un período. Reglas, cada una con su por qué:
   · Dos marcas de la misma persona que se pisan son UNA salida y vale la
     mayor (una noche marcada por los dos vale ½; día entero + noche, 1).
   · Una salida pisada por una «salimos juntos» no cuenta: es neutra.
   · Sólo acumula si ese día los chicos estaban con la familia (`conChicos`
     dice si sí; sin esa función, cuenta siempre). Si no estaban, nadie se
     quedó a cargo y no hay nada que devolver. */
export function saldoSalidas(marcas, uids, { desde = "", hasta = "9999", conChicos = null } = {}) {
  const libres = (marcas || []).filter((m) => m && m.clase === "libre" && uids.includes(m.uid)
    && msDeLocal(m.hasta) > msDeLocal(m.desde) && String(m.desde).slice(0, 10) >= desde && String(m.desde).slice(0, 10) < hasta);
  const juntas = (marcas || []).filter((m) => m && m.clase === "neutro");
  const pisa = (a, b) => msDeLocal(a.desde) < msDeLocal(b.hasta) && msDeLocal(a.hasta) > msDeLocal(b.desde);
  const por = Object.fromEntries(uids.map((u) => [u, { dias: 0, salidas: [] }]));
  for (const u of uids) {
    const mias = libres.filter((m) => m.uid === u).sort((a, b) => msDeLocal(a.desde) - msDeLocal(b.desde));
    const grupos = [];
    for (const m of mias) {
      const g = grupos.find((x) => x.some((y) => pisa(y, m)));
      g ? g.push(m) : grupos.push([m]);
    }
    for (const g of grupos) {
      const fecha = String(g[0].desde).slice(0, 10);
      const unidad = g.map(unidadDe).sort((a, b) => UNIDADES_SALIDA[b].vale - UNIDADES_SALIDA[a].vale)[0];
      let vale = UNIDADES_SALIDA[unidad].vale, motivo = "";
      if (juntas.some((j) => g.some((m) => pisa(j, m)))) { vale = 0; motivo = "salieron juntos"; }
      else if (conChicos && !conChicos(fecha)) { vale = 0; motivo = "ese día no estaban los chicos"; }
      por[u].dias += vale;
      por[u].salidas.push({ fecha, unidad, vale, motivo, marcas: g.map((m) => m.id || null), marcadas: g.length });
    }
  }
  const [x, y] = uids;
  const dif = x && y ? por[x].dias - por[y].dias : 0;
  return { por, aFavor: Math.abs(dif) < 1e-9 ? null : dif > 0 ? y : x, diferencia: Math.abs(dif) };
}

/* Una marca válida, o por qué no. */
export function validarMarca(m, uids = []) {
  const e = [];
  if (!m || !CLASES_MARCA.includes(m.clase)) e.push("falta qué fue");
  if (!m || !(m.uid === "*" || uids.includes(m.uid))) e.push("falta de quién");
  if (m && m.clase === "neutro" && m.uid !== "*") e.push("una salida juntos es de los dos");
  if (m && m.unidad !== undefined && !UNIDADES_SALIDA[m.unidad]) e.push("no se sabe si fue un día, una noche o un rato");
  if (!m || !(msDeLocal(m.hasta) > msDeLocal(m.desde))) e.push("el final tiene que ser después del principio");
  else if (msDeLocal(m.hasta) - msDeLocal(m.desde) > 3 * 86400000) e.push("una marca no pasa de tres días: para más, un acuerdo");
  return e;
}

/* Las marcas como intervalos del barrido. */
export function intervalosDeMarcas(marcas) {
  // nucleo-6: las libres y las «juntos» se cuentan en DÍAS (`saldoSalidas`),
  // no en horas: al barrido van sólo el trabajo y los chicos de la agenda.
  return (marcas || []).filter((m) => m && (m.clase === "productivo" || m.clase === "chicos") && msDeLocal(m.hasta) > msDeLocal(m.desde))
    .map((m) => ({ uid: m.clase === "neutro" ? "*" : m.uid, desdeMs: msDeLocal(m.desde), hastaMs: msDeLocal(m.hasta),
                   clase: m.clase, ninos: 0, marca: m.id || null }));
}

/* ¿Ya hay una marca de esa persona que se pisa con ésta? Para avisar ANTES
   de guardar («Florencia ya la marcó»), aunque guardarla igual no duplique. */
export function marcasQueSePisan(nueva, marcas) {
  const d = msDeLocal(nueva.desde), h = msDeLocal(nueva.hasta);
  const quien = nueva.clase === "neutro" ? "*" : nueva.uid;
  return (marcas || []).filter((m) => m && m.id !== nueva.id
    && (m.clase === "neutro" ? "*" : m.uid) === quien
    && msDeLocal(m.desde) < h && msDeLocal(m.hasta) > d);
}

/* ── Lo que propone Claude para la agenda (nucleo-8, 5-oct-2026) ─────────────
   Pedido de Mauro: dictar o mandar la captura de un flyer, que Claude lo
   interprete y que a cada uno le aparezca una tarjeta para ACEPTAR. Nada entra
   a la agenda de nadie sin ese toque: la agenda es de cada uno y la escribe su
   dueño, como siempre. Esto convierte la propuesta en la misma actividad que
   se carga a mano (agenda.js, guardarActividad), con las mismas reglas:
   clase obligatoria, y sin «hasta» sólo lo que empieza de noche — salvo que
   acá, como lo dictado suele no traer hora de fin, se supone una hora y se
   dice que se supuso. */
export const MODOS_AGENDA = {
  recordar: "para recordar",
  invitar:  "invitación",
  sugerida: "sugerida",
};
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const sumarHora = (hhmm, min) => {
  const [h, m] = hhmm.split(":").map(Number); const t = h * 60 + m + min;
  return { hora: `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, pasa: t >= 1440 };
};
export const paraMi = (p, uid) => {
  const para = p && p.datos && p.datos.para;
  return Array.isArray(para) ? para.includes(uid) : para === uid;
};
export function actividadDePropuesta(d, uid) {
  const x = d || {};
  const motivos = [];
  const titulo = String(x.titulo || "").trim().slice(0, 120);
  const tipo = CLASES_ACTIVIDAD[x.tipo] ? x.tipo : null;
  if (!titulo) motivos.push("falta qué es");
  if (!tipo) motivos.push("falta si es trabajo, tarea, personal o con los chicos");
  if (!esISO(x.dia)) motivos.push("falta el día");
  if (!HORA_RE.test(String(x.hi || ""))) motivos.push("falta desde qué hora");
  if (motivos.length) return { ok: false, motivos };
  let hf = HORA_RE.test(String(x.hf || "")) ? x.hf : "";
  let supuesto = false;
  if (!hf && x.hi < HORA_NOCHE) { hf = sumarHora(x.hi, 60).hora; supuesto = true; }
  const desde = `${x.dia}T${x.hi}`;
  const hasta = !hf ? `${sumarDias(x.dia, 1)}T07:00` : `${hf <= x.hi ? sumarDias(x.dia, 1) : x.dia}T${hf}`;
  const marca = { uid, clase: CLASES_ACTIVIDAD[tipo].clase, desde, hasta, origen: "agenda", marcadoPor: uid };
  const mal = validarMarca(marca, [uid]);
  if (mal.length) return { ok: false, motivos: mal };
  const actividad = { titulo, dia: x.dia, desde, hasta, tipo, hf: hf || "",
    origen: "claude", modo: MODOS_AGENDA[x.modo] ? x.modo : "sugerida", recordar: !!x.recordar,
    lugar: String(x.lugar || "").slice(0, 120), imagen: /^https:\/\//.test(String(x.imagen || "")) ? String(x.imagen).slice(0, 400) : "" };
  return { ok: true, actividad, marca, supuesto };
}

/* ── Lo que precarga Gemini al dictar (nucleo-9, 5-oct-2026) ─────────────────
   Mauro: «se puede usar la misma API de Gemini para que precargue todo en la
   agenda en el momento». La app le pregunta a Gemini (claude-proxy de Casa
   Verde, como las boletas) y llena la tarjeta al instante; uno la corrige y
   agenda. Esto lee su respuesta con DESCONFIANZA: lo que no tiene forma
   válida va vacío y a `dudas`, nunca se inventa. */
export const QUIENES_AGENDA = ["yo", "otro", "los-dos", "familia"];
export function leerAgendaIA(texto) {
  let j = null;
  const t = String(texto || "").replace(/```(?:json)?/gi, "");
  const i = t.indexOf("{"), k = t.lastIndexOf("}");
  if (i !== -1 && k > i) { try { j = JSON.parse(t.slice(i, k + 1)); } catch { j = null; } }
  if (!j || typeof j !== "object") return null;
  const dudas = Array.isArray(j.dudas) ? j.dudas.map((x) => String(x).slice(0, 80)).slice(0, 5) : [];
  const hora = (h) => HORA_RE.test(String(h || "")) ? h : "";
  const r = {
    titulo: String(j.titulo || "").trim().slice(0, 120),
    dia: esISO(j.dia) ? j.dia : "",
    hi: hora(j.hi), hf: hora(j.hf),
    lugar: String(j.lugar || "").slice(0, 120),
    tipo: CLASES_ACTIVIDAD[j.tipo] ? j.tipo : "",
    quien: QUIENES_AGENDA.includes(j.quien) ? j.quien : "yo",
    chicos: j.chicos === true,
    modo: MODOS_AGENDA[j.modo] ? j.modo : "recordar",
    dudas,
  };
  if (!r.titulo) dudas.push("qué es");
  if (!r.dia) dudas.push("el día");
  if (!r.hi) dudas.push("la hora");
  if (!r.tipo) dudas.push("si es trabajo, tarea, personal o con los chicos");
  r.dudas = [...new Set(dudas)];
  return r;
}

/* ── Un dictado es un PLAN de acciones (nucleo-10, 5-oct-2026) ───────────────
   Mauro: «mañana tengo que recordar ir antes al gimnasio para llevar los
   títulos del auto a Pedro» tiene que hacer que la IA busque la cita del
   gimnasio en la agenda, anote en la pizarra «juntar títulos del auto para
   Pedro», deje un recordatorio temprano ese día y una alarma un rato antes del
   gimnasio. Y una foto con «me gustaría que los chicos vayan a esto» es un
   DESEO, que se coordina con el otro hasta que se agenda.
   Gemini devuelve una lista de acciones; esto la lee con desconfianza y
   descarta la que no tiene forma, sin inventar nada. Cada tipo dice qué se
   escribe al aceptar (ver sugerir.js). */
export const ACCIONES = {
  actividad:    "a tu agenda",
  tarea:        "a tu pizarra",
  recordatorio: "un recordatorio",
  alarma:       "una alarma",
  deseo:        "a la lista de deseos",
  coordinar:    "preguntarle al otro",
  // nucleo-11, 5-oct-2026: «no olvidar comprar tal cosa» va a la lista de
  // compras de la casa, y «pedile a Flor que…» es una tarea en SU pizarra.
  compra:       "a la lista de compras",
  pedido:       "un pedido para el otro",
  // nucleo-22, 10-oct-2026, Mauro: «que agregar a la agenda sea pedir a la IA,
  // y pueda hacer cualquiera de las intervenciones: un gasto, las actividades
  // de los chicos, actividades o deseos, notificaciones o alarmas… todo lo que
  // puede registrar el sistema en un solo lugar».
  gasto:        "un gasto o una entrada de plata",
  chicos:       "las actividades de los chicos",
  mover:        "cambiar algo de tu agenda",
  quitar:       "sacar algo de tu agenda",
  // nucleo-24 (tiempos:V11): no registra nada, CONTESTA.
  consulta:     "una pregunta",
};
export const ACCIONES_CHICOS = ["nueva", "cambiar", "quitar", "saltar"];
export const PARA_DESEO = ["yo", "chicos", "familia"];
/* nucleo-13, 6-oct-2026 (tiempos:A18): «recordar traer el andamio», dictado
   a las 14:23, quedó para las 08:00 de ESE día, y una alerta pasada no suena
   nunca (la Pizarra no programa lo que ya fue). Con `ahoraMs`, un aviso que
   cae en el pasado se corre y se dice en dudas: el recordatorio a la próxima
   hora en punto (o mañana 08:00 si ya es tarde), la alarma —que tiene una hora
   dicha— al día siguiente a esa hora. Sin `ahoraMs` no se toca nada. */
export function correrSiPaso(x, ahoraMs, dudas) {
  if (!Number.isFinite(ahoraMs) || !x.dia) return x;
  const d = new Date(ahoraMs), hoy = isoDe(ahoraMs), manana = isoDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12).getTime());
  const ahora = `${dos(d.getHours())}:${dos(d.getMinutes())}`;
  const hora = x.hora || "08:00";
  if (x.dia > hoy || (x.dia === hoy && hora > ahora)) return x;
  const antes = `${x.dia} ${hora}`;
  if (x.tipo === "alarma" && x.hora) { x.dia = hora > ahora ? hoy : manana; }
  else if (d.getHours() < 22) { x.dia = hoy; x.hora = `${dos(d.getHours() + 1)}:00`; }
  else { x.dia = manana; x.hora = "08:00"; }
  dudas.push(`«${x.texto.slice(0, 30)}» quedaba para ${antes}, que ya pasó: lo corrí a ${x.dia} ${x.hora}`);
  return x;
}
/* nucleo-15 (7-oct-2026, Mauro): la IA proponía «Guardar actividades en la
   agenda» y «Marcar actividades en el calendario» como tareas de la pizarra.
   Eso lo hace la app sola: no es algo que la persona tenga que hacer. */
export const esTareaDelSistema = (titulo) =>
  /^\s*(guardar|registrar|marcar|anotar|agendar|poner|cargar|asegurar(se)?( de)?( que)?|verificar que)\b[\s\S]*\b(agenda|calendario|pizarra|recordatorio|alarma)s?\b/i.test(String(titulo || ""));

const masMin = (hhmm, min) => { const [h, m] = hhmm.split(":").map(Number); const t = Math.max(0, Math.min(1439, h * 60 + m + min)); return `${dos(Math.floor(t / 60))}:${dos(t % 60)}`; };

/* nucleo-15: que el plan sea coherente consigo mismo, ANTES de mostrarlo.
   · Una actividad de hoy cuya hora ya pasó casi siempre es de mañana (se dictó
     a la noche): se corre a mañana JUNTO con sus avisos de ese día, y se dice.
     Antes (nucleo-13) se corrían sólo los avisos y la actividad quedaba en el
     pasado: el odontólogo a las 19 de hoy con la alarma a las 18:45 de mañana.
   · Un recordatorio es ANTES de lo que recuerda: si cae a la hora de la
     actividad del mismo día o después, se adelanta dos horas (no antes de las 7).
   · Lo que igual quede en el pasado, lo corre correrSiPaso. Sin `ahoraMs` no
     se mueve nada de día. */
/* nucleo-16 (7-oct-2026): «el odontólogo era para el miércoles», dictado un
   miércoles a la noche. La IA lo puso hoy y nucleo-15 lo corría a mañana:
   las dos mal. Si lo dictado nombra el día de la semana de esa actividad, y
   ese día ya pasó, es el de la SEMANA QUE VIENE (+7); si no lo nombra, mañana. */
const sinAcento = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function diasHastaSiPaso(diaIso, dictado) {
  const nombre = sinAcento(DIAS[new Date(diaIso + "T12:00").getDay()]);
  return new RegExp(`\\b${nombre}\\b`).test(sinAcento(dictado)) ? 7 : 1;
}
export function ordenarPlan(acciones, ahoraMs, dudas, dictado = "") {
  const avisos = acciones.filter((a) => a.tipo === "recordatorio" || a.tipo === "alarma");
  if (Number.isFinite(ahoraMs)) {
    const d = new Date(ahoraMs), hoy = isoDe(ahoraMs), ahora = `${dos(d.getHours())}:${dos(d.getMinutes())}`;
    const manana = isoDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12).getTime());
    for (const x of acciones) {
      if (x.tipo !== "actividad" || !x.dia || !x.hi) continue;
      if (!(x.dia < hoy || (x.dia === hoy && x.hi <= ahora))) continue;
      const antes = x.dia;
      const nuevo = x.dia < hoy && x.hi > ahora ? hoy : diasHastaSiPaso(x.dia, dictado) === 7 ? sumarDias(x.dia, 7) : manana;
      x.dia = nuevo;
      for (const a of avisos) if (a.dia === antes) a.dia = nuevo;
      dudas.push(`«${x.titulo.slice(0, 30)}» quedaba para ${antes} ${x.hi}, que ya pasó: la pasé a ${nuevo} con sus avisos`);
    }
  }
  for (const a of avisos) {
    if (a.tipo !== "recordatorio" || !a.dia) continue;
    const ese = acciones.filter((x) => x.tipo === "actividad" && x.dia === a.dia && x.hi).map((x) => x.hi).sort()[0];
    if (ese && (a.hora || "08:00") >= ese) a.hora = masMin(ese, -120) < "07:00" ? "07:00" : masMin(ese, -120);
  }
  for (const a of avisos) correrSiPaso(a, ahoraMs, dudas);
  return acciones;
}

export function leerPlanIA(texto, ahoraMs, dictado = "") {
  let j = null;
  const t = String(texto || "").replace(/```(?:json)?/gi, "");
  const i = t.indexOf("{"), k = t.lastIndexOf("}");
  if (i !== -1 && k > i) { try { j = JSON.parse(t.slice(i, k + 1)); } catch { j = null; } }
  if (!j || typeof j !== "object") return null;
  const corto = (x, n) => String(x == null ? "" : x).trim().slice(0, n);
  const hora = (h) => HORA_RE.test(String(h || "")) ? h : "";
  const dia = (d) => esISO(d) ? d : "";
  const dudas = Array.isArray(j.dudas) ? j.dudas.map((x) => corto(x, 80)).filter(Boolean).slice(0, 6) : [];
  const acciones = [];
  for (const a of Array.isArray(j.acciones) ? j.acciones.slice(0, 12) : []) {
    if (!a || !ACCIONES[a.tipo]) continue;
    if (a.tipo === "actividad") {
      // La clase viene como «tipo_clase» (o «clase»): «tipo» es el de la acción.
      const x = leerAgendaIA(JSON.stringify({ ...a, tipo: a.tipo_clase || a.clase }));
      if (!x || !x.titulo) continue;
      dudas.push(...x.dudas.map((d) => `${d} de «${x.titulo.slice(0, 30)}»`));
      // nucleo-23: de qué chicos es (vacío = todos, lo decide sugerir.js).
      acciones.push({ ...x, clase: x.tipo, tipo: "actividad", ninos: indicesDeChicos(a.ninos) });
    } else if (a.tipo === "tarea") {
      const titulo = corto(a.titulo, 120); if (!titulo) continue;
      // nucleo-15: lo que el plan YA hace (agendar, marcar, guardar) no es una
      // tarea para la persona ni ocupa lugar en su pizarra (Mauro, 7-oct).
      if (esTareaDelSistema(titulo)) continue;
      acciones.push({ tipo: "tarea", titulo, detalle: corto(a.detalle, 300) });
    } else if (a.tipo === "recordatorio" || a.tipo === "alarma") {
      const texto = corto(a.texto, 200); if (!texto) continue;
      const x = { tipo: a.tipo, texto, dia: dia(a.dia), hora: hora(a.hora), sobre: corto(a.sobre, 60) };
      // nucleo-15: la alarma de salir trae el viaje que estimó la IA: desde
      // dónde y cuántos minutos. Se muestra para corregir; no se guarda.
      if (a.tipo === "alarma") {
        const v = Math.round(Number(a.viaje));
        if (Number.isFinite(v) && v > 0 && v <= 600) { x.viaje = v; x.desde = corto(a.desde, 80); x.lugar = corto(a.lugar, 80); }
      }
      if (!x.dia) dudas.push(`el día de «${texto.slice(0, 30)}»`);
      if (a.tipo === "alarma" && !x.hora) dudas.push(`la hora de la alarma «${texto.slice(0, 30)}»`);
      acciones.push(x);
    } else if (a.tipo === "deseo") {
      const titulo = corto(a.titulo, 120); if (!titulo) continue;
      // nucleo-12: un flyer de algo SEMANAL deja los días; uno de una sola vez,
      // la fecha. Lo que no se entiende queda vacío (y se edita después).
      const x = { tipo: "deseo", titulo, detalle: corto(a.detalle, 400), para: PARA_DESEO.includes(a.para) ? a.para : "yo",
        lugar: corto(a.lugar, 120), cuando: corto(a.cuando, 120), ...frecuenciaDeseo(a) };
      acciones.push(x);
    } else if (a.tipo === "coordinar") {
      const texto = corto(a.texto, 300); if (!texto) continue;
      acciones.push({ tipo: "coordinar", texto });
    } else if (a.tipo === "compra") {
      const texto = corto(a.texto, 80); if (!texto) continue;
      acciones.push({ tipo: "compra", texto, lista: corto(a.lista, 40) });
    } else if (a.tipo === "pedido") {
      const titulo = corto(a.titulo, 120); if (!titulo) continue;
      acciones.push({ tipo: "pedido", titulo, detalle: corto(a.detalle, 300), dia: dia(a.dia) });
    } else if (a.tipo === "gasto") {
      // nucleo-22: la plata la escribe la persona al tocar «Hacer lo marcado»,
      // con su sesión, como en Plata. Lo que falta no se adivina: el renglón
      // sale sin marcar y diciendo qué falta, y así no se guarda.
      const monto = Math.round(Number(String(a.monto == null ? "" : a.monto).replace(/\s/g, "").replace(",", ".")) * 100) / 100;
      if (!(monto > 0)) { dudas.push("el monto" + (a.detalle ? ` de «${corto(a.detalle, 30)}»` : "")); continue; }
      const x = { tipo: "gasto", monto, moneda: MONEDAS.includes(a.moneda) ? a.moneda : "", fecha: dia(a.fecha),
        categoria: CATEGORIAS[a.categoria] ? a.categoria : "", comercio: corto(a.comercio, 80), detalle: corto(a.detalle, 200),
        cuenta: corto(a.cuenta, 60), para: corto(a.para, 30) };
      x.faltan = validarMovimiento({ monto: x.monto, moneda: x.moneda, fecha: x.fecha, categoria: x.categoria });
      acciones.push(x);
    } else if (a.tipo === "chicos") {
      const accion = ACCIONES_CHICOS.includes(a.accion) ? a.accion : "nueva";
      const id = corto(a.id, 40);
      if (accion !== "nueva" && !id) { dudas.push("qué actividad de los chicos" + (a.titulo ? ` («${corto(a.titulo, 30)}»)` : "")); continue; }
      const x = { tipo: "chicos", accion, id, titulo: corto(a.titulo, 120), fecha: dia(a.fecha), hora: hora(a.hora), horaFin: hora(a.horaFin),
        semanal: a.semanal === true, ninos: indicesDeChicos(a.ninos), nota: corto(a.nota, 300) };
      if (accion === "nueva" && (!x.titulo || !x.fecha)) { dudas.push(`el día de «${x.titulo || "la actividad de los chicos"}»`); continue; }
      if (accion === "saltar" && !x.fecha) { dudas.push("qué día se saltea"); continue; }
      acciones.push(x);
    } else if (a.tipo === "mover") {
      const id = corto(a.id, 40), d = dia(a.dia), hi = hora(a.hi);
      if (!id || !d || !hi) { dudas.push("qué actividad mover, o a qué día y hora"); continue; }
      acciones.push({ tipo: "mover", id, dia: d, hi, hf: hora(a.hf) });
    } else if (a.tipo === "quitar") {
      const id = corto(a.id, 40); if (!id) continue;
      acciones.push({ tipo: "quitar", id });
    } else if (a.tipo === "consulta") {
      if (!CONSULTAS[a.que]) { dudas.push("qué querías saber"); continue; }
      acciones.push({ tipo: "consulta", que: a.que, desde: dia(a.desde), hasta: dia(a.hasta), ninos: indicesDeChicos(a.ninos),
        cuenta: corto(a.cuenta, 60), categorias: (Array.isArray(a.categorias) ? a.categorias : []).filter((c) => CATEGORIAS[c]).slice(0, 12),
        persona: ["yo", "otro"].includes(a.persona) ? a.persona : "", pregunta: corto(a.pregunta, 200) });
    }
  }
  ordenarPlan(acciones, ahoraMs, dudas, dictado);
  return { resumen: corto(j.resumen, 200), acciones, dudas: [...new Set(dudas)] };
}

/* ── Las CUENTAS: lugares, vehículos y sus partes (nucleo-24, tiempos:V11) ────
   Mauro, 10-oct-2026: «hay que poder tener un control de los gastos de cada
   lugar y/o vehículo y/o persona… se hace un balance a pedido por cualquiera
   de los conceptos». Viven en `familia/cuentas` (mapa id → {nombre, clase,
   pais, padre, tareaId, orden}), como todo lo de la casa: sin regla nueva. Un
   depósito es una cuenta con `padre`: se mira sola o sumada a su lugar. Las
   PERSONAS no son cuentas: son el `uid` de quien pagó y el `para` de un
   movimiento (una persona o un chico). La plata no se separa: todo es de la
   administración de la familia; la cuenta sólo dice A QUÉ fue. */
export const CLASES_CUENTA = { lugar: "Lugar", vehiculo: "Vehículo", proyecto: "Proyecto" };
export function cuentasDe(doc) {
  const todas = Object.entries((doc && doc.cuentas) || {})
    .filter(([, c]) => c && typeof c.nombre === "string" && c.nombre.trim() && !c.baja)
    .map(([id, c]) => ({ id, nombre: c.nombre, clase: CLASES_CUENTA[c.clase] ? c.clase : "proyecto", pais: c.pais || "",
      padre: typeof c.padre === "string" ? c.padre : "", tareaId: c.tareaId || "", orden: c.orden || 0 }));
  const ids = new Set(todas.map((c) => c.id));
  for (const c of todas) if (!ids.has(c.padre) || c.padre === c.id) c.padre = "";
  const raices = todas.filter((c) => !c.padre).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
  const out = [];
  for (const r of raices) {
    out.push({ ...r, nivel: 0, ruta: r.nombre });
    for (const h of todas.filter((c) => c.padre === r.id).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)))
      out.push({ ...h, nivel: 1, ruta: `${r.nombre} › ${h.nombre}` });
  }
  return out;
}
/** Una cuenta y sus partes (el depósito suma a su lugar). */
export const idsDeCuenta = (cuentas, id) => new Set([id, ...(cuentas || []).filter((c) => c.padre === id).map((c) => c.id)]);

/* La cuenta que se nombró, sin mayúsculas ni tildes, también por la ruta
   («depósito de general flores»). Si dos se parecen igual, ninguna. */
export function cuentaPorNombre(cuentas, nombre) {
  const n = plano(nombre); if (!n) return null;
  const exacta = (cuentas || []).filter((c) => plano(c.nombre) === n || plano(c.ruta) === n);
  if (exacta.length) return exacta.length === 1 ? exacta[0].id : ((exacta.find((c) => plano(c.ruta) === n) || {}).id || null);
  // Todas las palabras de la ruta están en lo dicho: gana la más específica
  // («depósito de general flores» es el depósito, no el lugar).
  const palabras = (t) => plano(t).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 1);
  const dichas = new Set(palabras(n));
  const ok = (cuentas || []).map((c) => ({ c, w: palabras(c.ruta) })).filter((x) => x.w.length && x.w.every((w) => dichas.has(w)))
    .sort((a, b) => b.w.length - a.w.length);
  if (ok.length && (ok.length === 1 || ok[0].w.length > ok[1].w.length)) return ok[0].c.id;
  const parte = (cuentas || []).filter((c) => plano(c.ruta).includes(n));
  return parte.length === 1 ? parte[0].id : null;
}

/* ── Las CONSULTAS (nucleo-24): las cuentas las hace el código ────────────────
   La IA entiende qué se pregunta; los números salen de acá, nunca de ella. Por
   moneda, siempre: reales, pesos y dólares no se suman. */
const enRango = (iso, desde, hasta) => esISO(iso) && (!desde || iso >= desde) && (!hasta || iso <= hasta);

/** Gastos y entradas que cumplen el filtro, con los totales por moneda y categoría, y lo que falta. */
export function balanceDe(movs, { cuentas = null, desde = "", hasta = "", categorias = [], para = "", uid = "" } = {}) {
  const lista = (movs || []).filter((m) => m && Number(m.monto) > 0 && MONEDAS.includes(m.moneda) && CATEGORIAS[m.categoria]
    && enRango(m.fecha, desde, hasta)
    && (!cuentas || cuentas.has(m.cuenta))
    && (!categorias.length || categorias.includes(m.categoria))
    && (!para || m.para === para)
    && (!uid || m.uid === uid))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const porMoneda = {};
  for (const m of lista) {
    const c = CATEGORIAS[m.categoria], v = Number(m.monto);
    const o = (porMoneda[m.moneda] = porMoneda[m.moneda] || { entro: 0, salio: 0, saldo: 0, porCategoria: {} });
    if (c.tipo === "entro") { o.entro += v; o.saldo += v; } else { o.salio += v; o.saldo -= v; }
    o.porCategoria[m.categoria] = (o.porCategoria[m.categoria] || 0) + (c.tipo === "entro" ? v : -v);
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  for (const o of Object.values(porMoneda)) {
    o.entro = r2(o.entro); o.salio = r2(o.salio); o.saldo = r2(o.saldo);
    for (const k of Object.keys(o.porCategoria)) o.porCategoria[k] = r2(o.porCategoria[k]);
  }
  // Lo que falta, dicho: gastos sin boleta y meses del período sin nada.
  const faltan = [];
  const sinBoleta = lista.filter((m) => CATEGORIAS[m.categoria].tipo === "salio" && !m.comprobanteUrl).length;
  if (sinBoleta) faltan.push(`${sinBoleta} gasto(s) sin boleta`);
  if (desde && hasta && lista.length) {
    const meses = new Set(lista.map((m) => m.fecha.slice(0, 7)));
    const vacios = [];
    for (let m = desde.slice(0, 7); m <= hasta.slice(0, 7) && vacios.length < 24; m = sumarMeses(m, 1)) if (!meses.has(m)) vacios.push(m);
    if (vacios.length) faltan.push(`sin ningún registro en ${vacios.join(", ")}`);
  }
  return { lista, porMoneda, faltan };
}

/** Las actividades de los chicos en un período: las suyas (de un chico, o de
 *  los dos si no se nombró a uno) y las de MI agenda marcadas «con los chicos». */
export function actividadesDeChicos({ eventos = [], actividades = {}, ninos = [], desde, hasta, nino = "" }) {
  const out = [];
  const nombreDe = (id) => ((ninos || []).find((n) => n.id === id) || {}).nombre || "";
  for (let d = desde; d && d <= hasta && out.length < 400; d = sumarDias(d, 1)) {
    for (const e of eventosDelDia(d, eventos)) {
      const de = (e.ninos || []).length ? e.ninos : (ninos || []).map((n) => n.id);
      if (nino && !de.includes(nino)) continue;
      out.push({ dia: d, hora: e.hora || "", horaFin: e.horaFin || "", titulo: e.titulo || "", origen: "chicos",
        de: de.length >= (ninos || []).length ? "los dos" : de.map(nombreDe).filter(Boolean).join(" y ") });
    }
    for (const a of Object.values(actividades || {})) {
      if (!a || a.dia !== d || a.tipo !== "ninos") continue;
      out.push({ dia: d, hora: String(a.desde || "").slice(11, 16), horaFin: a.hf || "", titulo: a.titulo || "", origen: "agenda", de: "con vos" });
    }
  }
  return out.sort((a, b) => a.dia.localeCompare(b.dia) || a.hora.localeCompare(b.hora));
}

/** Horas registradas en el reloj, por persona y por cuenta (por la tarea de la cuenta). */
export function horasPorCuenta(sesiones, tareas, cuentas, { desde = "", hasta = "", cuenta = "", uid = "" } = {}) {
  const porId = Object.fromEntries((tareas || []).map((t) => [t.id, t]));
  const raizDe = (id) => { let t = porId[id], n = 0; while (t && t.parentId && porId[t.parentId] && n++ < 30) t = porId[t.parentId]; return t ? t.id : ""; };
  const cuentaDeTarea = {};
  for (const c of cuentas || []) if (c.tareaId) cuentaDeTarea[c.tareaId] = c.id;
  const ids = cuenta ? idsDeCuenta(cuentas, cuenta) : null;
  const out = { total: 0, porPersona: {}, porCuenta: {}, n: 0 };
  for (const s of sesiones || []) {
    const h = Number(s.horas); if (!(h > 0)) continue;
    const dia = s.inicioMs ? isoDe(s.inicioMs) : String(s.dia || "");
    if (!enRango(dia, desde, hasta) || (uid && s.uid !== uid)) continue;
    const c = cuentaDeTarea[raizDe(s.tareaId)] || "";
    if (ids && !ids.has(c)) continue;
    out.total += h; out.n++;
    out.porPersona[s.uid] = (out.porPersona[s.uid] || 0) + h;
    out.porCuenta[c] = (out.porCuenta[c] || 0) + h;
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  out.total = r2(out.total);
  for (const k of Object.keys(out.porPersona)) out.porPersona[k] = r2(out.porPersona[k]);
  for (const k of Object.keys(out.porCuenta)) out.porCuenta[k] = r2(out.porCuenta[k]);
  return out;
}

/* ── El CIERRE de cada cuenta, por mes (nucleo-25, tiempos:V11) ─────────────
   Mauro: «debe cerrar un balance económico cada proyecto». Cerrar un mes
   guarda lo que dio —por moneda— y una FIRMA de esos números; si después
   entra o sale algo de ese mes, la firma ya no coincide y el cierre pide
   volver a cerrarse. Vive en `familia/cierres` (cierres.<cuenta>.<AAAA-MM>),
   como los repartos: sin regla nueva. La cuenta suma sus partes. */
export function balanceDelMes(movs, cuentas, cuentaId, mes) {
  const c = (cuentas || []).find((x) => x.id === cuentaId);
  const ids = c && c.nivel ? new Set([cuentaId]) : idsDeCuenta(cuentas, cuentaId);
  return balanceDe(movs, { cuentas: ids, desde: mes + "-01", hasta: mes + "-31" });
}
export const firmaBalance = (b) => JSON.stringify(Object.keys(b.porMoneda || {}).sort().map((m) => {
  const o = b.porMoneda[m];
  return [m, o.entro, o.salio, Object.keys(o.porCategoria).sort().map((k) => [k, o.porCategoria[k]])];
})) + "|" + (b.lista || []).length;
/** "abierto" (sin cerrar), "cerrado" (coincide) o "cambio" (se movió después). */
export function estadoCierre(guardado, actual) {
  if (!guardado || !guardado.firma) return "abierto";
  return guardado.firma === firmaBalance(actual) ? "cerrado" : "cambio";
}

export const CONSULTAS = { chicos: "las actividades de los chicos", agenda: "tu agenda", gastos: "gastos y entradas", balance: "un balance", horas: "horas registradas" };

/* ── Los nombres de los chicos no viajan a la IA (nucleo-22) ─────────────────
   Con las actividades de los chicos, la IA necesita saber de quién es cada
   una, y lo dictado los nombra. Antes de mandar, cada nombre pasa a «Chico1»,
   «Chico2» (en el orden de familia/config), y lo que vuelve se traduce de
   vuelta. Los nombres no entran al código: salen de la base, como siempre. */
const LETRAS = { a: "aáàâä", e: "eéèêë", i: "iíìîï", o: "oóòôö", u: "uúùûü", n: "nñ" };
const patronNombre = (n) => [...sinAcento(n)].map((c) => LETRAS[c] ? `[${LETRAS[c]}]` : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
export function escudarNombres(texto, ninos) {
  let t = String(texto || "");
  (ninos || []).forEach((n, i) => {
    const nom = String((n && n.nombre) || "").trim();
    if (nom.length < 2) return;
    t = t.replace(new RegExp(`(^|[^\\p{L}])${patronNombre(nom)}(?![\\p{L}])`, "giu"), `$1Chico${i + 1}`);
  });
  return t;
}
export function devolverNombres(texto, ninos) {
  return String(texto || "").replace(/\bChico(\d{1,2})\b/g, (m, k) => ((ninos || [])[Number(k) - 1] || {}).nombre || m);
}
export function indicesDeChicos(lista) {
  const out = [];
  for (const x of Array.isArray(lista) ? lista : []) {
    const m = /^\s*chico\s*(\d{1,2})\s*$/i.exec(String(x));
    if (m && !out.includes(Number(m[1]) - 1)) out.push(Number(m[1]) - 1);
  }
  return out;
}
/** Las actividades de los chicos de las próximas semanas, para la IA: sin nombres. */
export function chicosParaIA(eventos, ninos, hoy, dias = 21) {
  const hasta = sumarDias(hoy, dias);
  return (eventos || []).filter((e) => e && esISO(e.fecha) && (e.semanal ? !(esISO(e.hasta) && e.hasta < hoy) : e.fecha >= hoy && e.fecha <= hasta))
    .slice(0, 40)
    .map((e) => ({ id: e.id, titulo: escudarNombres(String(e.titulo || "").slice(0, 80), ninos), fecha: e.fecha, hora: e.hora || "", horaFin: e.horaFin || "",
      semanal: !!e.semanal, ninos: (e.ninos || []).map((id) => (ninos || []).findIndex((n) => n.id === id)).filter((i) => i >= 0).map((i) => `Chico${i + 1}`) }));
}

/* ── Los deseos con frecuencia (nucleo-12, 5-oct-2026) ──────────────────────
   «Cuando lo que se guarda es un flyer de una actividad semanal, que quede
   registrado que es algo con frecuencia, y cuando yo quiera saber qué se
   puede hacer hoy ya tenga esa información, además de las especiales con una
   fecha exclusiva» (Mauro). Un deseo lleva `dias` (0 = domingo … 6 = sábado,
   como Date.getDay) si se repite cada semana, o `fecha` si es una vez; las
   dos cosas no: si vienen las dos, gana la fecha, que es más precisa. */
const NOMBRES_DIA = { domingo: 0, dom: 0, lunes: 1, lun: 1, martes: 2, mar: 2, miercoles: 3, mie: 3, jueves: 4, jue: 4,
  viernes: 5, vie: 5, sabado: 6, sab: 6 };
export function leerDias(x) {
  const out = new Set();
  for (const d of Array.isArray(x) ? x : String(x || "").split(/[,\sy]+/)) {
    if (Number.isInteger(d) && d >= 0 && d <= 6) { out.add(d); continue; }
    // «sábados» → «sabado»; «lunes» ya termina en s y está tal cual.
    const t = String(d).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const m = t in NOMBRES_DIA ? NOMBRES_DIA[t] : NOMBRES_DIA[t.replace(/s$/, "")];
    if (m !== undefined) out.add(m);
  }
  return [...out].sort((a, b) => a - b);
}
export function frecuenciaDeseo(a) {
  const hora = (h) => HORA_RE.test(String(h || "")) ? h : "";
  const fecha = esISO(a && a.fecha) ? a.fecha : "";
  return { dias: fecha ? [] : leerDias(a && a.dias), fecha, hi: hora(a && a.hi), hf: hora(a && a.hf) };
}
/* Lo que se puede hacer ese día: los deseos que caen ese día de la semana o
   en esa fecha, de los dos, salvo los descartados; por hora. */
export function posiblesDelDia(deseos, iso) {
  const w = diaSemana(iso);
  return (deseos || [])
    .filter((d) => d && d.estado !== "descartado" && (d.fecha ? d.fecha === iso : Array.isArray(d.dias) && d.dias.includes(w)))
    .sort((a, b) => String(a.hi || "99").localeCompare(String(b.hi || "99")) || String(a.titulo).localeCompare(String(b.titulo)));
}
/* «martes y jueves · 18:00–19:00», «sáb 12/10 · 15:00», o lo que dijo `cuando`. */
export function textoFrecuencia(d) {
  const h = d.hi ? d.hi + (d.hf ? "–" + d.hf : "") : "";
  let q = "";
  if (d.fecha) q = d.fecha.slice(8) + "/" + d.fecha.slice(5, 7);
  else if (Array.isArray(d.dias) && d.dias.length) {
    const ns = d.dias.map((i) => DIAS[i]);
    q = d.dias.length === 7 ? "todos los días" : "cada " + (ns.length > 1 ? ns.slice(0, -1).join(", ") + " y " + ns[ns.length - 1] : ns[0]);
  }
  return [q, h].filter(Boolean).join(" · ") || d.cuando || "";
}

/* La lista de compras donde va una cosa: la que se llama como dijo la IA
   (sin mayúsculas ni tildes), o null si no hay ninguna así. */
const plano = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function listaParaCompra(listas, nombre) {
  const n = plano(nombre);
  if (!n) return null;
  const l = (listas || []).find((x) => plano(x.nombre) === n)
    || (listas || []).find((x) => plano(x.nombre).includes(n) || n.includes(plano(x.nombre)));
  return l ? l.id : null;
}

/* El dictado del teléfono, en Android, a veces repite lo que va entendiendo:
   «el el jueves el jueves llevo el jueves llevo los niños…» (captura de
   Mauro, 5-oct-2026). Se parte en tramos que empiezan con la misma palabra y
   se tira cada tramo que es el comienzo del siguiente. Un texto sin
   repeticiones queda igual. */
export function limpiarDictado(texto) {
  const pal = String(texto || "").trim().split(/\s+/).filter(Boolean);
  if (pal.length < 3) return pal.join(" ");
  const tramos = [];
  for (const w of pal) {
    const ult = tramos[tramos.length - 1];
    if (!ult || plano(w) === plano(ult[0])) tramos.push([w]); else ult.push(w);
  }
  const esComienzo = (x, y) => x.length <= y.length && x.every((w, i) => plano(w) === plano(y[i]));
  const quedan = tramos.filter((t, i) => !(i + 1 < tramos.length && esComienzo(t, tramos[i + 1])));
  return quedan.flat().join(" ");
}

/* Lo que se le manda a la IA de MI agenda: lo de las próximas dos semanas, con
   su id, para que pueda decir «el gimnasio de mañana» y colgarle algo. Es MI
   agenda, la manda MI sesión: la del otro nunca viaja. */
export function agendaParaIA(actividades, hoy, dias = 14) {
  const hasta = sumarDias(hoy, dias);
  return Object.entries(actividades || {})
    .filter(([, a]) => a && esISO(a.dia) && a.dia >= hoy && a.dia <= hasta)
    .sort((x, y) => String(x[1].desde).localeCompare(String(y[1].desde)))
    .slice(0, 40)
    .map(([id, a]) => ({ id, titulo: String(a.titulo || "").slice(0, 80), dia: a.dia,
      desde: String(a.desde || "").slice(11, 16), hasta: String(a.hasta || "").slice(11, 16), lugar: a.lugar || "" }));
}

/* ── La pizarra del teléfono y el mes de la agenda (nucleo-14, app-16) ──────
   tiempos:V7, 7-oct-2026. Lo usan pizarra.js y agenda.js; vive acá para que
   el banco lo pruebe sin pantalla. */
/** Lo que está en MI pizarra (la del widget), pendiente primero. */
export const enMiPizarra = (tareas, uid) => (tareas || [])
  .filter((t) => t && t.pizarra && t.pizarra[uid] === true)
  .sort((a, b) => Number(!!a.hecho) - Number(!!b.hecho) || String(a.titulo).localeCompare(String(b.titulo)));

/** Lo que se puede poner: lo que veo, sin hacer, agrupado por ámbito (el tipo heredado). */
export function paraElegirPorCategoria(tareas, uid) {
  const { porId } = arbol(tareas || []);
  const grupos = {};
  for (const t of tareas || []) {
    if (!t || t.hecho) continue;
    if (t.alcance === "personal" && t.duenio !== uid) continue;
    const k = tipoHeredado(t, porId);
    (grupos[k] = grupos[k] || []).push({ ...t, ruta: rutaDe(t, porId) });
  }
  for (const k of Object.keys(grupos)) grupos[k].sort((a, b) => a.ruta.localeCompare(b.ruta));
  return grupos;
}
export const rutaDe = (t, porId) => { const r = []; let x = t, n = 0; while (x && n++ < 8) { r.unshift(x.titulo || ""); x = x.parentId ? porId[x.parentId] : null; } return r.join(" › "); };


/** Cuántas cosas tiene un día de MI agenda: actividades, lo agendado con día
 *  y las actividades de los chicos. Para el mes, que sólo cuenta. */
export function cuentaDelDia(d, agenda, actividades, eventos) {
  const acts = Object.values(actividades || {}).filter((a) => a && a.dia === d).length;
  const ag = Object.values(agenda || {}).filter((m) => m && m.dia === d).length;
  return { acts, ag, chicos: eventos.length };
}


/* ── Mis lugares (nucleo-17, 7-oct-2026, tiempos:V7) ───────────────────────
   Mauro: «la app debería tener acceso a mi ubicación: si estoy en Uruguay mi
   casa es una, si estoy en Florianópolis es otra; y que se guarde una lista de
   direcciones de los lugares de las actividades». Las direcciones viven en
   `agendas/{uid}` (sólo su dueño: ni el otro ni el agente las leen) y NUNCA en
   el código, que es público. Para el viaje se le pasan a la IA del plan. */

/** En qué país está, con la ubicación aproximada: Uruguay por su recuadro; si no, Brasil. */
export function paisDe(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return lat >= -35.1 && lat <= -30.08 && lon >= -58.5 && lon <= -53.08 ? "UY" : "BR";
}
export const PAISES_CASA = { UY: "Uruguay", BR: "Brasil" };

/** La clave de un lugar: su nombre sin acentos ni mayúsculas, para no anotarlo dos veces. */
export const claveLugar = (nombre) => String(nombre || "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** Si el lugar no está en la lista, la entrada nueva (sin dirección todavía); si está, null. */
export function lugarNuevo(lugares, nombre) {
  const n = String(nombre || "").trim().slice(0, 80), k = claveLugar(n);
  if (!k || (lugares || {})[k]) return null;
  return [k, { nombre: n, direccion: "" }];
}

/** Lo que va a la IA para estimar el viaje: la casa del país donde está y los lugares con dirección. */
export function lugaresParaIA(lugares, casas, pais) {
  const out = { lugares: Object.values(lugares || {}).filter((l) => l && l.nombre && l.direccion)
    .map((l) => ({ nombre: String(l.nombre).slice(0, 80), direccion: String(l.direccion).slice(0, 160) })).slice(0, 40) };
  const casa = pais && (casas || {})[pais];
  if (casa) out.casa = { pais: PAISES_CASA[pais] || pais, direccion: String(casa).slice(0, 160) };
  return out;
}

/* ── ¿Ya existe? (nucleo-18, 8-oct-2026, tiempos:V7) ───────────────────────
   Mauro: «cuando le doy a agregar, revisar que esa tarea no existe ya en mi
   lista; si existe, me pregunta si es la misma o si agrega una nueva». Se
   compara por palabras con sentido (sin acentos, sin «el», «de», «para»…):
   las que comparten la mayoría de las palabras de la más corta se ofrecen. */
const VACIAS = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "a", "al", "en", "y", "o", "para", "por", "con", "que", "se", "mi", "mis", "su", "sus", "lo"]);
export const palabrasDe = (t) => sinAcentoN(t).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 1 && !VACIAS.has(w))
  .map((w) => w.length > 4 ? w.replace(/(es|s)$/, "") : w);
function sinAcentoN(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
/** Las candidatas parecidas a `titulo`, la más parecida primero (hasta 4). */
export function parecidas(titulo, candidatas) {
  const a = new Set(palabrasDe(titulo));
  if (!a.size) return [];
  return (candidatas || []).map((c) => {
    const b = new Set(palabrasDe(c.titulo));
    if (!b.size) return null;
    let comunes = 0; for (const w of a) if (b.has(w)) comunes++;
    const p = comunes / Math.min(a.size, b.size);
    return p >= 0.6 ? { ...c, p } : null;
  }).filter(Boolean).sort((x, y) => y.p - x.p).slice(0, 4);
}

/* ── Las finanzas de la familia (nucleo-19, 8-oct-2026, tiempos:V9) ──────────
   Mauro: «un control de gastos, para identificar el dinero que se ocupa en el
   mantenimiento y en gastos personales… cruzando los tiempos de cada uno se
   divide el sobrante… si uno produce y el otro se ocupa de los niños ese día,
   el dinero es mitad y mitad del neto. Si uno sale y el otro no, la salida a
   favor… si a fin de mes no se regulan las salidas, se resuelve en la división
   de dinero». Y: «hay que establecer un estimativo de gastos anuales para
   saber el prorrateo de la temporada y lo que sería dinero libre».

   EL AÑO (presupuesto): cada gasto que se repite —la luz, la patente, la
   cuota de la escuela— es un CONCEPTO con su monto por vez y cada cuántos
   meses vence. Vive en `familia/presupuesto` (un mapa, para que dos teléfonos
   no se pisen). Lo que cuesta el año, dividido 12, es la RESERVA del mes: lo
   que hay que apartar todos los meses aunque ese mes no venza nada. Así un
   negocio de temporada no parece rico en enero y pobre en junio.

   EL REPARTO del mes, por moneda (nunca se suman monedas):
     libre    = lo que entró − la reserva del mes
     a cada uno, la mitad (producir y estar con los chicos pesan igual)
     el valor de un día = libre ÷ los días del mes
     las salidas no equiparadas: quien salió de más le pasa al otro
       (días de diferencia × valor del día), nunca más que su mitad
     y lo que cada uno gastó en lo PERSONAL ya lo retiró: se descuenta de su parte. */
export const CADAS = { 1: "todos los meses", 2: "cada dos meses", 3: "cada tres meses", 6: "cada seis meses", 12: "una vez al año" };
export const PAISES = { UY: "Uruguay", BR: "Brasil" };
const mesNum = (mes) => Number(String(mes).slice(0, 4)) * 12 + Number(String(mes).slice(5, 7)) - 1;
export const esMes = (x) => typeof x === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
export const sumarMeses = (mes, n) => { const t = mesNum(mes) + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, "0")}`; };
export const diasDelMes = (mes) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();

/* Un concepto bien formado, o por qué no. El monto 0 vale: «todavía sin estimar». */
export function validarConcepto(c) {
  const e = [];
  if (!c || !String(c.nombre || "").trim()) e.push("falta el nombre");
  if (!c || !(Number(c.monto) >= 0) || c.monto === "" || c.monto === null) e.push("el monto va en números (0 si todavía no sabés)");
  if (!c || !MONEDAS.includes(c.moneda)) e.push("falta la moneda");
  if (!c || !CATEGORIAS[c.categoria] || CATEGORIAS[c.categoria].tipo !== "salio") e.push("falta de qué es el gasto");
  if (!c || !CADAS[c.cada]) e.push("falta cada cuánto vence");
  if (!c || !(Number(c.mes) >= 1 && Number(c.mes) <= 12)) e.push("falta en qué mes vence");
  if (c && c.total != null && c.total !== "" && !(Number(c.total) > 0)) e.push("el total de una deuda va en números");
  return e;
}

/* ¿Vence este concepto en ese mes? `mes` (1-12) es un mes en que vence;
   desde ahí, cada `cada` meses. `desde`/`hasta` (AAAA-MM) lo acotan. */
export function vence(c, mes) {
  if (!c || c.activo === false || !CADAS[c.cada] || !esMes(mes)) return false;
  if (esMes(c.desde) && mes < c.desde) return false;
  if (esMes(c.hasta) && mes > c.hasta) return false;
  const m = Number(mes.slice(5, 7));
  return (((m - Number(c.mes)) % c.cada) + c.cada) % c.cada === 0;
}

/* Lo que cuesta un concepto en un año. */
export const anualDe = (c) => (c && c.activo !== false && CADAS[c.cada] ? Number(c.monto || 0) * 12 / c.cada : 0);

/* El presupuesto del año, por moneda: total, lo que cuenta para el libre
   (todo menos los gastos del negocio, que ya vienen descontados de su neto),
   por categoría, y cuántos conceptos faltan estimar. */
export function presupuestoAnual(conceptos) {
  const out = {};
  for (const [, c] of Object.entries(conceptos || {})) {
    if (!c || c.activo === false || !MONEDAS.includes(c.moneda) || !CATEGORIAS[c.categoria]) continue;
    const o = (out[c.moneda] = out[c.moneda] || { total: 0, enLibre: 0, porCategoria: {}, sinEstimar: 0 });
    const a = anualDe(c);
    o.total += a;
    if (CATEGORIAS[c.categoria].reparto !== "negocio") o.enLibre += a;
    o.porCategoria[c.categoria] = (o.porCategoria[c.categoria] || 0) + a;
    if (!(Number(c.monto) > 0)) o.sinEstimar++;
  }
  for (const o of Object.values(out)) { o.total = redondo(o.total); o.enLibre = redondo(o.enLibre); o.reservaMes = redondo(o.enLibre / 12); }
  return out;
}
const redondo = (n) => Math.round(n * 100) / 100;

/* La grilla de la planilla: cada concepto, qué pasa en cada mes. */
export function fijosDeMeses(conceptos, movs, meses) {
  return Object.entries(conceptos || {}).filter(([, c]) => c && c.activo !== false)
    .sort((a, b) => String(a[1].pais || "").localeCompare(String(b[1].pais || "")) || String(a[1].nombre).localeCompare(String(b[1].nombre)))
    .map(([id, c]) => {
      const pagos = (movs || []).filter((m) => m && m.fijo === id && Number(m.monto) > 0);
      const celdas = meses.map((mes) => {
        const pagado = redondo(pagos.filter((m) => String(m.fecha || "").slice(0, 7) === mes).reduce((t, m) => t + Number(m.monto), 0));
        return { mes, toca: vence(c, mes), pagado };
      });
      const deuda = Number(c.total) > 0 ? { total: Number(c.total), queda: redondo(Math.max(0, Number(c.total) - pagos.reduce((t, m) => t + Number(m.monto), 0))) } : null;
      return { id, ...c, celdas, deuda };
    });
}

/* ── El AJUSTE TRIMESTRAL (nucleo-26, 10-oct-2026, tiempos:V11) ────────────
   Mauro: «resumir un neto de todos los ingresos descontando todos los gastos
   fijos que se declaren… haciendo ajustes trimestrales además de los balances,
   identificando los gastos que son fijos para tener un costo estimado de
   funcionamiento». Por trimestre y por moneda: lo que entró, lo que salió en
   fijos (pagos de un concepto del Año) y en lo demás, y el neto; el COSTO DE
   FUNCIONAMIENTO estimado (lo del Año ÷ 4) contra lo que entró; y, concepto
   por concepto, lo estimado contra lo pagado, para corregir el monto. Además,
   los gastos que se repiten mes a mes y todavía no son un concepto. */
export const trimestreDe = (mes) => `${String(mes).slice(0, 4)}-T${Math.floor((Number(String(mes).slice(5, 7)) - 1) / 3) + 1}`;
export const esTrimestre = (t) => typeof t === "string" && /^\d{4}-T[1-4]$/.test(t);
export const mesesDelTrimestre = (t) => {
  const y = t.slice(0, 4), q = Number(t.slice(-1));
  return [1, 2, 3].map((i) => `${y}-${String((q - 1) * 3 + i).padStart(2, "0")}`);
};
export const sumarTrimestres = (t, n) => {
  const k = Number(t.slice(0, 4)) * 4 + Number(t.slice(-1)) - 1 + n;
  return `${Math.floor(k / 4)}-T${(k % 4) + 1}`;
};

export function ajusteTrimestral({ conceptos = {}, movs = [], trimestre, hoyMes = "9999-12" }) {
  const meses = mesesDelTrimestre(trimestre), desde = meses[0] + "-01", hasta = meses[2] + "-31";
  const delTrim = (movs || []).filter((m) => m && Number(m.monto) > 0 && MONEDAS.includes(m.moneda) && CATEGORIAS[m.categoria]
    && String(m.fecha || "") >= desde && String(m.fecha || "") <= hasta);
  const pres = presupuestoAnual(conceptos);
  const porMoneda = {};
  const o = (mon) => (porMoneda[mon] = porMoneda[mon] || { entro: 0, fijos: 0, variables: 0, salio: 0, neto: 0, costoEstimado: 0, netoContraCosto: 0 });
  for (const m of delTrim) {
    const x = o(m.moneda), v = Number(m.monto);
    if (CATEGORIAS[m.categoria].tipo === "entro") x.entro += v;
    else { x.salio += v; if (m.fijo && conceptos[m.fijo]) x.fijos += v; else x.variables += v; }
  }
  for (const [mon, p] of Object.entries(pres)) o(mon).costoEstimado = p.enLibre / 4;
  for (const x of Object.values(porMoneda)) {
    for (const k of Object.keys(x)) x[k] = redondo(x[k]);
    x.neto = redondo(x.entro - x.salio);
    x.netoContraCosto = redondo(x.entro - x.costoEstimado);
  }
  // Concepto por concepto: lo estimado y lo pagado en el trimestre.
  const conceptosT = [];
  const faltan = [];
  for (const [id, c] of Object.entries(conceptos || {})) {
    if (!c || c.activo === false || !MONEDAS.includes(c.moneda)) continue;
    const vencen = meses.filter((mes) => vence(c, mes));
    const pagos = delTrim.filter((m) => m.fijo === id);
    if (!vencen.length && !pagos.length) continue;
    const estimado = redondo(Number(c.monto || 0) * vencen.length);
    const real = redondo(pagos.reduce((t, m) => t + Number(m.monto), 0));
    const porVez = pagos.length ? redondo(real / pagos.length) : 0;
    const sinPagar = vencen.filter((mes) => mes <= hoyMes && !pagos.some((m) => String(m.fecha).slice(0, 7) === mes));
    if (sinPagar.length) faltan.push(`«${c.nombre}» sin pago registrado en ${sinPagar.join(", ")}`);
    conceptosT.push({ id, nombre: c.nombre, moneda: c.moneda, categoria: c.categoria, cada: c.cada, monto: Number(c.monto || 0),
      vencen: vencen.length, pagos: pagos.length, estimado, real, diferencia: redondo(real - estimado), porVez,
      sugerido: pagos.length && Math.abs(porVez - Number(c.monto || 0)) >= 0.01 ? porVez : null });
  }
  conceptosT.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia) || a.nombre.localeCompare(b.nombre));
  for (const [mon, p] of Object.entries(pres)) if (p.sinEstimar) faltan.push(`${p.sinEstimar} gasto(s) del Año en ${mon} sin monto estimado`);
  if (!Object.keys(pres).length) faltan.push("todavía no hay gastos del Año: sin ellos no hay costo de funcionamiento");
  return { trimestre, meses, porMoneda, conceptos: conceptosT, faltan };
}

/* Los gastos que se repiten (en 3 meses distintos o más de los últimos 6) y
   no son pagos de un concepto: candidatos a sumar al Año. Se agrupan por
   moneda, categoría y comercio (o detalle). */
export function posiblesFijos(movs, conceptos, hastaMes, meses = 6) {
  const desdeMes = sumarMeses(hastaMes, -(meses - 1));
  const yaHay = new Set(Object.values(conceptos || {}).filter(Boolean).map((c) => plano(c.nombre)));
  const g = {};
  for (const m of movs || []) {
    if (!m || m.fijo || !(Number(m.monto) > 0) || !MONEDAS.includes(m.moneda) || (CATEGORIAS[m.categoria] || {}).tipo !== "salio") continue;
    const mes = String(m.fecha || "").slice(0, 7);
    if (!esMes(mes) || mes < desdeMes || mes > hastaMes) continue;
    const quien = plano(m.comercio || m.detalle || "");
    if (!quien) continue;
    const k = [m.moneda, m.categoria, quien].join("|");
    const x = (g[k] = g[k] || { nombre: m.comercio || m.detalle, moneda: m.moneda, categoria: m.categoria, meses: new Set(), total: 0, n: 0 });
    x.meses.add(mes); x.total += Number(m.monto); x.n++;
  }
  return Object.values(g).filter((x) => x.meses.size >= 3 && !yaHay.has(plano(x.nombre)))
    .map((x) => ({ nombre: x.nombre, moneda: x.moneda, categoria: x.categoria, meses: x.meses.size, porMes: redondo(x.total / x.meses.size) }))
    .sort((a, b) => b.meses - a.meses || b.porMes - a.porMes);
}
/* La firma del trimestre, para confirmarlo los dos (como el reparto). */
export const firmaTrimestre = (aj) => JSON.stringify(Object.keys(aj.porMoneda).sort().map((m) => [m, aj.porMoneda[m]]))
  + "|" + aj.conceptos.map((c) => c.id + ":" + c.monto + ":" + c.real).join(",");

/* El reparto de UN mes. `salidas` es lo que devuelve `saldoSalidas` para ese
   mes; `uids`, los dos. Devuelve, por moneda, todos los pasos de la cuenta:
   la pantalla los muestra, porque un número sin su cuenta no se discute. */
export function repartoDelMes({ movs = [], conceptos = {}, mes, uids = [], salidas = null } = {}) {
  const desde = mes + "-01", hasta = mes + "-31";
  const real = disponible(movs, { desde, hasta });
  const pres = presupuestoAnual(conceptos);
  const dias = diasDelMes(mes);
  const personal = {};
  for (const m of movs || []) {
    if (!m || String(m.fecha || "").slice(0, 7) !== mes || (CATEGORIAS[m.categoria] || {}).reparto !== "personal" || !(Number(m.monto) > 0)) continue;
    const k = m.moneda + "|" + m.uid;
    personal[k] = (personal[k] || 0) + Number(m.monto);
  }
  const out = {};
  for (const mon of new Set([...Object.keys(real), ...Object.keys(pres)])) {
    const r = real[mon] || { entro: 0, mantenimiento: 0, chicos: 0, personal: 0 };
    const p = pres[mon];
    const sinPresupuesto = !p || !(p.reservaMes > 0);
    // Sin presupuesto, la reserva es lo que de verdad se gastó en la casa y
    // los chicos ese mes: es lo único que se sabe.
    const reserva = sinPresupuesto ? redondo(r.mantenimiento + r.chicos) : p.reservaMes;
    const libre = redondo(r.entro - reserva);
    const valorDia = libre > 0 ? redondo(libre / dias) : 0;
    const mitad = libre / (uids.length || 1);
    const partes = Object.fromEntries(uids.map((u) => [u, mitad]));
    let compensa = 0, deQuien = null, aQuien = null;
    if (libre > 0 && salidas && salidas.aFavor && salidas.diferencia > 0 && uids.length === 2) {
      aQuien = salidas.aFavor; deQuien = uids.find((u) => u !== aQuien);
      compensa = redondo(Math.min(salidas.diferencia * valorDia, mitad));
      partes[aQuien] += compensa; partes[deQuien] -= compensa;
    }
    const porPersona = {};
    for (const u of uids) {
      const gastoPersonal = redondo(personal[mon + "|" + u] || 0);
      porPersona[u] = { parte: redondo(partes[u]), gastoPersonal, queda: redondo(partes[u] - gastoPersonal) };
    }
    out[mon] = { entro: redondo(r.entro), reserva, sinPresupuesto, gastoReal: redondo(r.mantenimiento + r.chicos),
                 libre, dias, valorDia, compensa, deQuien, aQuien, diferenciaDias: salidas ? salidas.diferencia || 0 : 0, porPersona };
  }
  return out;
}

/* ── Los EXTRACTOS de las cuentas (nucleo-27, 10-oct-2026, tiempos:V12) ───────
   Mauro: «vamos integrando esta información para tener datos estadísticos…
   dejar un registro vivo y unificado. Cuando se haga un análisis de gastos
   habrá que incluir esta información».

   Un extracto es lo que dice el BANCO (Prex de Mauro, BTG de cada uno…), línea
   por línea, tal como vino: `extractos/{id}`. No es todavía un movimiento: el
   agente lo carga y lo clasifica, y una persona lo REGISTRA —de a muchos—, que
   es lo que escribe el movimiento con su sesión. El agente sigue sin escribir
   plata.

   El id sale de la línea misma (`idExtracto`): cargar dos veces el mismo
   extracto, o dos capturas que se pisan, no duplica nada.

   Cada línea tiene una CLASE, porque no todo lo que sale de una cuenta es un
   gasto de la familia:
   · gasto / entrada — lo que se registra;
   · interno — plata propia que se mueve: cargas, cambios de moneda,
     transferencias entre cuentas de uno;
   · negocio — ya está en el libro de Casa Verde (una seña que entró a Prex):
     contarla acá sería contarla dos veces;
   · devuelto — una compra que el comercio devolvió: neto cero;
   · revisar — no se sabe todavía; se cuenta aparte y se pregunta. */
export const CLASES_EXTRACTO = {
  gasto:    { nombre: "Gasto",               cuenta: true },
  entrada:  { nombre: "Entrada",             cuenta: true },
  revisar:  { nombre: "A revisar",           cuenta: false },
  interno:  { nombre: "Movimiento propio",   cuenta: false },
  negocio:  { nombre: "Ya en Casa Verde",    cuenta: false },
  devuelto: { nombre: "Compra devuelta",     cuenta: false },
};

/** El nombre del documento: medio, día, monto en centavos, sentido y orden. */
export function idExtracto(medio, fecha, moneda, monto, sentido, n = 1) {
  const med = String(medio || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${med}-${String(fecha).replace(/-/g, "")}-${String(moneda).toLowerCase()}-${Math.round(Number(monto) * 100)}-${sentido === "entro" ? "e" : "s"}${n > 1 ? "-" + n : ""}`;
}

/** ¿Esta línea está lista para registrarse? Devuelve lo que le falta. */
export function faltaParaRegistrar(l) {
  const e = [];
  if (!l || l.estado !== "pendiente") return ["ya se decidió"];
  if (l.clase !== "gasto" && l.clase !== "entrada") return ["no es un gasto ni una entrada"];
  const c = CATEGORIAS[l.categoria];
  if (!c) e.push("la categoría");
  else if (c.tipo !== (l.clase === "entrada" ? "entro" : "salio")) e.push("una categoría de " + (l.clase === "entrada" ? "entrada" : "gasto"));
  if (!(Number(l.monto) > 0) || !MONEDAS.includes(l.moneda) || !esISO(l.fecha)) e.push("monto, moneda o fecha");
  return e;
}

/** El movimiento que escribe la persona al registrar una línea. */
export function movimientoDeExtracto(l, quien) {
  const m = {
    tipo: l.clase === "entrada" ? "entro" : "salio",
    monto: Number(l.monto), moneda: l.moneda, fecha: l.fecha, categoria: l.categoria,
    comercio: String(l.desc || "").slice(0, 80),
    detalle: String(l.nota || "").slice(0, 300),
    uid: l.uid || quien, origen: "extracto", extracto: l.id, medio: l.medio || "",
  };
  if (l.cuenta) m.cuenta = l.cuenta;
  if (l.para) m.para = l.para;
  return m;
}

/** Los números de los extractos, por medio, clase, categoría y moneda. Sin
    convertir. `soloPendientes` deja afuera lo ya registrado: eso ya está en
    los movimientos, y el análisis lo contaría dos veces. */
export function resumenExtractos(lineas, { desde = "", hasta = "", medio = "", soloPendientes = false } = {}) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const out = { lineas: 0, porMedio: {}, porClase: {}, porCategoria: {}, porMes: {}, revisar: [], meses: [] };
  const sum = (o, k, mon, v) => { o[k] = o[k] || {}; o[k][mon] = r2((o[k][mon] || 0) + v); };
  const meses = new Set();
  for (const l of lineas || []) {
    if (!l || !(Number(l.monto) > 0) || !esISO(l.fecha) || !enRango(l.fecha, desde, hasta)) continue;
    if (medio && l.medio !== medio) continue;
    if (l.estado === "excluido" || (soloPendientes && l.estado === "registrado")) continue;
    const v = Number(l.monto), clase = CLASES_EXTRACTO[l.clase] ? l.clase : "revisar";
    out.lineas++; meses.add(l.fecha.slice(0, 7));
    sum(out.porClase, clase, l.moneda, v);
    if (clase === "revisar") { if (out.revisar.length < 60) out.revisar.push({ fecha: l.fecha, desc: l.desc, monto: v, moneda: l.moneda, sentido: l.sentido, duda: (l.dudas || [])[0] || "" }); continue; }
    if (!CLASES_EXTRACTO[clase].cuenta) continue;
    const signo = clase === "entrada" ? 1 : -1;
    sum(out.porMedio, l.medio || "?", l.moneda, signo * v);
    sum(out.porCategoria, CATEGORIAS[l.categoria] ? l.categoria : "sin categoría", l.moneda, signo * v);
    sum(out.porMes, l.fecha.slice(0, 7), l.moneda, signo * v);
  }
  out.meses = [...meses].sort();
  return out;
}

/* ── La ECONOMÍA CENTRALIZADA (nucleo-28, 10-oct-2026, tiempos:V13) ──────────
   Mauro: «quiero que la economía esté centralizada para poder, de un solo
   lugar, saber cómo se están derivando los gastos… diferenciar si ese gasto
   es en el mantenimiento de Casa Verde, del auto, del triciclo, de la
   actividad de los niños, en salidas para uno o para el otro… como la plata
   es toda una y viene a un solo lugar, que es la familia… analizar el
   funcionamiento de cada proyecto y su viabilidad: cuántos recursos se le
   dedican y si es rentable».

   Toda la plata es UNA. Cada movimiento va a UN destino, y se decide así:
   · tiene `cuenta` → el proyecto raíz de esa cuenta (el depósito de General
     Flores es General Flores; la Hilux es la Hilux);
   · si no, es de un chico (`para` = un chico, o categoría de chicos) → ese
     chico, o «los chicos» si no dice cuál;
   · si no, es personal de alguien (`para` = una persona, o categoría
     personal con quien pagó) → esa persona;
   · si no → «la casa», el funcionamiento de la familia.
   De cada destino: lo que se le dedicó (salió), lo que dejó (entró), el neto
   y su PARTE de todo lo que salió de la familia — por moneda, sin convertir.
   Lo que dice un extracto y todavía no se registró también cuenta (si ya
   tiene categoría), marcado, para que la vista esté viva desde el día uno. */
export function pendientesComoMovs(extractos) {
  return (extractos || []).filter((l) => !faltaParaRegistrar(l).length)
    .map((l) => ({ ...movimientoDeExtracto(l, l.uid), id: "x-" + l.id, sinRegistrar: true }));
}

export function economiaFamiliar({ movs = [], cuentas = [], ninos = [], personas = [], desde = "", hasta = "" } = {}) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const raiz = {};
  for (const c of cuentas) raiz[c.id] = c.nivel ? c.padre : c.id;
  const nombreCuenta = Object.fromEntries(cuentas.map((c) => [c.id, c.nombre]));
  const esNino = new Set(ninos.map((n) => n.id)), esPersona = new Set(personas.map((p) => p.id));
  const DE_CHICOS = new Set(["chicos", "actividades"]);
  const destinos = {};
  const de = (id, nombre, clase) => (destinos[id] = destinos[id] || { id, nombre, clase, porMoneda: {}, porCategoria: {}, n: 0, sinRegistrar: 0 });
  const total = {};
  let sinRegistrar = 0;
  for (const m of movs) {
    const c = m && CATEGORIAS[m.categoria];
    if (!c || !(Number(m.monto) > 0) || !MONEDAS.includes(m.moneda) || !enRango(m.fecha, desde, hasta)) continue;
    let d;
    if (m.cuenta && raiz[m.cuenta]) { const id = raiz[m.cuenta], cu = cuentas.find((x) => x.id === id); d = de("c:" + id, nombreCuenta[id], cu ? cu.clase : "proyecto"); }
    else if (esNino.has(m.para)) d = de("n:" + m.para, (ninos.find((n) => n.id === m.para) || {}).nombre || "un chico", "chico");
    else if (DE_CHICOS.has(m.categoria)) d = de("n:*", "Los chicos", "chico");
    else if (esPersona.has(m.para) || (m.categoria === "personal" && esPersona.has(m.uid))) {
      const u = esPersona.has(m.para) ? m.para : m.uid; d = de("p:" + u, (personas.find((p) => p.id === u) || {}).nombre || "alguien", "persona");
    } else d = de("casa", "La casa (funcionamiento)", "casa");
    const v = Number(m.monto), lado = c.tipo === "entro" ? "entro" : "salio";
    const o = (d.porMoneda[m.moneda] = d.porMoneda[m.moneda] || { entro: 0, salio: 0 });
    o[lado] = r2(o[lado] + v);
    const t = (total[m.moneda] = total[m.moneda] || { entro: 0, salio: 0 });
    t[lado] = r2(t[lado] + v);
    d.porCategoria[m.categoria] = d.porCategoria[m.categoria] || {};
    d.porCategoria[m.categoria][m.moneda] = r2((d.porCategoria[m.categoria][m.moneda] || 0) + (lado === "entro" ? v : -v));
    d.n++; if (m.sinRegistrar) { d.sinRegistrar++; sinRegistrar++; }
  }
  const lista = Object.values(destinos);
  for (const d of lista) for (const [mon, o] of Object.entries(d.porMoneda)) {
    o.neto = r2(o.entro - o.salio);
    o.parte = total[mon].salio > 0 ? Math.round((o.salio / total[mon].salio) * 1000) / 10 : 0;
  }
  // Primero lo que más se lleva (en la moneda donde más se gastó), después el resto.
  const monMayor = Object.entries(total).sort((a, b) => b[1].salio - a[1].salio).map(([m]) => m)[0];
  lista.sort((a, b) => ((b.porMoneda[monMayor] || {}).salio || 0) - ((a.porMoneda[monMayor] || {}).salio || 0) || a.nombre.localeCompare(b.nombre));
  return { total, destinos: lista, sinRegistrar };
}

/** El libro propio de un negocio (Casa Verde): lo que entró y salió, por moneda.
    Va aparte del de la familia: su plata se mueve en su base y su neto llega
    a la familia como «neto de un negocio». Sirve para ver si es rentable. */
export function libroDeNegocio(movs, { desde = "", hasta = "" } = {}) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const out = {};
  for (const m of movs || []) {
    if (!m || !(Number(m.monto) > 0) || !MONEDAS.includes(m.moneda) || !esISO(m.fecha) || !enRango(m.fecha, desde, hasta)) continue;
    if (m.tipo !== "entro" && m.tipo !== "salio") continue;
    const o = (out[m.moneda] = out[m.moneda] || { entro: 0, salio: 0, neto: 0, porCategoria: {} });
    o[m.tipo] = r2(o[m.tipo] + Number(m.monto));
    o.neto = r2(o.entro - o.salio);
    const k = String(m.categoria || "otros");
    o.porCategoria[k] = r2((o.porCategoria[k] || 0) + (m.tipo === "entro" ? 1 : -1) * Number(m.monto));
  }
  return out;
}

/* ── La BASE DE COSTO ANUAL (nucleo-29, 11-oct-2026, tiempos:V12) ────────────
   Mauro: «todos esos gastos son nuestros… aunque no estén bien diferenciados
   sirven para cifrar nuestro presupuesto anual… una base de costo anual…
   no quiero hacer un trabajo manual».

   Lo que de verdad costó vivir un año, sacado de lo que hay —movimientos y
   líneas de extractos, registradas o no—, por moneda y categoría, sin
   convertir. Como cada cuenta cubre meses distintos (Prex un año, BTG cinco
   meses), cada moneda se lleva a 12 meses con SUS meses: los que tienen al
   menos `minLineas` gastos en esa moneda. Un mes con dos movimientos sueltos
   no es un mes medido, y contarlo bajaría el promedio. */
export function baseAnual(movs, { hasta = "", meses = 12, minLineas = 3 } = {}) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const fin = esISO(hasta) ? hasta.slice(0, 7) : "9999-12";
  const ini = fin === "9999-12" ? "0000-01" : sumarMeses(fin, -(meses - 1));
  const porMes = {}, out = {};
  const dentro = (movs || []).filter((m) => m && CATEGORIAS[m.categoria] && Number(m.monto) > 0 && MONEDAS.includes(m.moneda)
    && esISO(m.fecha) && m.fecha.slice(0, 7) >= ini && m.fecha.slice(0, 7) <= fin);
  for (const m of dentro) if (CATEGORIAS[m.categoria].tipo === "salio") {
    const k = m.moneda + "|" + m.fecha.slice(0, 7); porMes[k] = (porMes[k] || 0) + 1;
  }
  for (const m of dentro) {
    const o = (out[m.moneda] = out[m.moneda] || { meses: 0, desde: "", hasta: "", gastado: 0, entro: 0, porCategoria: {} });
    if (CATEGORIAS[m.categoria].tipo === "entro") { o.entro = r2(o.entro + Number(m.monto)); continue; }
    if ((porMes[m.moneda + "|" + m.fecha.slice(0, 7)] || 0) < minLineas) continue;
    o.gastado = r2(o.gastado + Number(m.monto));
    o.porCategoria[m.categoria] = r2((o.porCategoria[m.categoria] || 0) + Number(m.monto));
  }
  for (const [mon, o] of Object.entries(out)) {
    const ms = Object.entries(porMes).filter(([k, n]) => k.startsWith(mon + "|") && n >= minLineas).map(([k]) => k.slice(4)).sort();
    o.meses = ms.length; o.desde = ms[0] || ""; o.hasta = ms[ms.length - 1] || "";
    o.porMes = o.meses ? r2(o.gastado / o.meses) : 0;
    o.anual = r2(o.porMes * 12);
    o.categorias = Object.entries(o.porCategoria).map(([k, v]) => ({ categoria: k, total: v, porMes: r2(v / (o.meses || 1)), anual: r2((v / (o.meses || 1)) * 12) }))
      .sort((a, b) => b.total - a.total);
    if (!o.meses && !o.entro) delete out[mon];
  }
  return out;
}
