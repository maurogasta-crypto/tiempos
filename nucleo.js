// ─────────────────────────────────────────────────────────────────────────────
// nucleo.js — Las cuentas de «tiempos», sin Firebase ni pantalla.
// Sello: nucleo-11
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
  comida:        { nombre: "Comida y supermercado",   tipo: "salio", reparto: "mantenimiento" },
  casa:          { nombre: "Casa y servicios",        tipo: "salio", reparto: "mantenimiento" },
  transporte:    { nombre: "Transporte",              tipo: "salio", reparto: "mantenimiento" },
  salud:         { nombre: "Salud",                   tipo: "salio", reparto: "mantenimiento" },
  chicos:        { nombre: "Chicos (escuela, ropa…)", tipo: "salio", reparto: "chicos" },
  actividades:   { nombre: "Actividades de los chicos", tipo: "salio", reparto: "chicos" },
  personal:      { nombre: "Personal",                tipo: "salio", reparto: "personal" },
  otros:         { nombre: "Otros",                   tipo: "salio", reparto: "mantenimiento" },
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
    const o = (out[m.moneda] = out[m.moneda] || { entro: 0, salio: 0, saldo: 0, mantenimiento: 0, chicos: 0, personal: 0 });
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
   arriba: cada tilde toca una sola clave. */
export const LISTAS_DE_ENTRADA = ["Súper", "Verdulería", "Farmacia", "Ferretería"];
export function listasDeCompras(doc) {
  return Object.entries((doc && doc.listas) || {})
    .filter(([, l]) => l && typeof l.nombre === "string")
    .map(([id, l]) => {
      const items = Object.entries(l.items || {})
        .filter(([, it]) => it && typeof it.texto === "string" && it.texto.trim())
        .map(([iid, it]) => ({ id: iid, texto: it.texto, hecho: it.hecho === true, por: it.por || "", orden: it.orden || 0 }))
        .sort((a, b) => Number(a.hecho) - Number(b.hecho) || a.orden - b.orden || a.texto.localeCompare(b.texto));
      return { id, nombre: l.nombre, orden: l.orden || 0, items, faltan: items.filter((i) => !i.hecho).length };
    })
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
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
};
export const PARA_DESEO = ["yo", "chicos", "familia"];
export function leerPlanIA(texto) {
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
  for (const a of Array.isArray(j.acciones) ? j.acciones.slice(0, 8) : []) {
    if (!a || !ACCIONES[a.tipo]) continue;
    if (a.tipo === "actividad") {
      // La clase viene como «tipo_clase» (o «clase»): «tipo» es el de la acción.
      const x = leerAgendaIA(JSON.stringify({ ...a, tipo: a.tipo_clase || a.clase }));
      if (!x || !x.titulo) continue;
      dudas.push(...x.dudas.map((d) => `${d} de «${x.titulo.slice(0, 30)}»`));
      acciones.push({ ...x, clase: x.tipo, tipo: "actividad" });
    } else if (a.tipo === "tarea") {
      const titulo = corto(a.titulo, 120); if (!titulo) continue;
      acciones.push({ tipo: "tarea", titulo, detalle: corto(a.detalle, 300) });
    } else if (a.tipo === "recordatorio" || a.tipo === "alarma") {
      const texto = corto(a.texto, 200); if (!texto) continue;
      const x = { tipo: a.tipo, texto, dia: dia(a.dia), hora: hora(a.hora), sobre: corto(a.sobre, 60) };
      if (!x.dia) dudas.push(`el día de «${texto.slice(0, 30)}»`);
      if (a.tipo === "alarma" && !x.hora) dudas.push(`la hora de la alarma «${texto.slice(0, 30)}»`);
      acciones.push(x);
    } else if (a.tipo === "deseo") {
      const titulo = corto(a.titulo, 120); if (!titulo) continue;
      acciones.push({ tipo: "deseo", titulo, detalle: corto(a.detalle, 400), para: PARA_DESEO.includes(a.para) ? a.para : "yo",
        lugar: corto(a.lugar, 120), cuando: corto(a.cuando, 120) });
    } else if (a.tipo === "coordinar") {
      const texto = corto(a.texto, 300); if (!texto) continue;
      acciones.push({ tipo: "coordinar", texto });
    } else if (a.tipo === "compra") {
      const texto = corto(a.texto, 80); if (!texto) continue;
      acciones.push({ tipo: "compra", texto, lista: corto(a.lista, 40) });
    } else if (a.tipo === "pedido") {
      const titulo = corto(a.titulo, 120); if (!titulo) continue;
      acciones.push({ tipo: "pedido", titulo, detalle: corto(a.detalle, 300), dia: dia(a.dia) });
    }
  }
  return { resumen: corto(j.resumen, 200), acciones, dudas: [...new Set(dudas)] };
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
