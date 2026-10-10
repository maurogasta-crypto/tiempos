// ─────────────────────────────────────────────────────────────────────────────
// sugerir.js — El globo flotante: una sugerencia o una falla, al chat. Sello: sugerir-18
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
//
// sugerir-16 (10-oct-2026, Mauro: «que agregar a la agenda sea pedir a la IA,
// y pueda hacer cualquiera de las intervenciones… todo lo que puede registrar
// el sistema en un solo lugar; más neutro el cuadro»). La primera solapa es
// «✨ Pedile a la IA», y el plan suma: un GASTO (lo escribe la persona al
// tocar «Hacer lo marcado», con su sesión, como en Plata), las ACTIVIDADES DE
// LOS CHICOS (nueva, cambiar, sacar, saltear un día) y CAMBIAR o SACAR algo
// de la propia agenda. Los nombres de los chicos no viajan: pasan a «Chico1»
// antes de mandar y vuelven a la vuelta (`escudarNombres`).
//
// sugerir-18 (10-oct-2026, tiempos:V11): el cuadro también CONTESTA. «¿Qué
// tienen los chicos esta semana?», «gastos de General Flores en materiales de
// septiembre», «balance de la Hilux», «horas de octubre». La IA entiende la
// pregunta (`consulta`); los números los saca la app (`balanceDe`,
// `actividadesDeChicos`, `horasPorCuenta` de nucleo.js) y la IA, si se le
// pide («✨ Explicar»), sólo los comenta. Y un gasto puede decir a qué CUENTA
// fue (un lugar, un vehículo, su depósito) y para quién.
// ─────────────────────────────────────────────────────────────────────────────

import { db, auth, F, CV } from "./firebase-init.js";
import { textoFrecuencia } from "./nucleo.js";
import { dondeEstoy } from "./lugares.js";
import { esc, leerPlanIA, agendaParaIA, lugaresParaIA, CLASES_ACTIVIDAD, esISO, limpiarDictado, listasDeCompras, listaParaCompra, idNuevo,
  escudarNombres, devolverNombres, chicosParaIA, CATEGORIAS, MONEDAS, cuentasDe, cuentaPorNombre, idsDeCuenta, balanceDe,
  actividadesDeChicos, horasPorCuenta, CONSULTAS, sumarDias } from "./nucleo.js";
import { agendarMio } from "./propone.js";
import { reprogramarActividad, sacarActividad } from "./agenda.js";
import { E, $, aviso, repintar, fallo, otro } from "./estado.js";

export const MODOS = {
  pedido: { titulo: "Una sugerencia", que: "¿Qué te gustaría?", quePh: "Que en la agenda se vea también la semana de Florencia.",
            esp: "¿Para qué te serviría?", espPh: "Para no pisarnos los horarios.", campo: "urgencia",
            opciones: [["cuando-se-pueda", "Cuando se pueda"], ["pronto", "Pronto"], ["ya", "Lo necesito ya"]] },
  falla:  { titulo: "Algo anda mal", que: "¿Qué pasó?", quePh: "Toqué Aprobar y no pasó nada.",
            esp: "¿Qué esperabas que pasara?", espPh: "Que el gasto apareciera en la lista.", campo: "gravedad",
            opciones: [["molesta", "Molesta, sigo"], ["traba", "Me traba algo"], ["no-anda", "No puedo usar la app"]] },
};
MODOS.agenda = { titulo: "Pedile a la IA", que: "Lo que sea, dictado o escrito", quePh: "Gasté 850 en la farmacia · el básquet pasa a las 18 · mañana alarma 7:30 · comprar yerba",
  esp: "Algo más (opcional)", espPh: "Es para toda la familia / sólo Flor / para recordar.", campo: "urgencia",
  opciones: [["pronto", "Para la IA"]] };
export const NOMBRE_SOLAPA = { pizarra: "Pizarra", ahora: "Ahora", hoy: "Hoy", agenda: "Agenda", tareas: "Tareas", chicos: "Chicos", plata: "Plata", balance: "Balance" };

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
   Claude y devuelve una tarjeta en Pizarra: nada entra a la agenda sin aceptar. */
/* sugerir-12 (7-oct-2026, app-16): sin botón de dictado propio. Mauro: «sacar
   el dictado y dejar para introducir texto a partir del dictado del propio
   teclado» — el reconocedor del navegador fallaba y el del teclado no. Se
   escribe (o se dicta con el micrófono del teclado) y se corrige ahí mismo. */
let foto = null;              // el archivo elegido, todavía sin subir
let fotoSubida = "";          // sugerir-10: la URL si ya la subió la app del teléfono
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
/* Los chicos de la casa, de la base. Se usan SÓLO para escudar los nombres
   antes de que algo salga hacia la IA, y para traducirlos a la vuelta. */
const chicosDeLaCasa = () => (E.familia && E.familia.ninos) || [];
/* sugerir-17 (10-oct-2026, Mauro): una actividad «de los chicos» es de TODOS;
   si nombra a uno, es de ése. Sin chicos marcados, van todos. */
/* sugerir-18: para quién fue un gasto: «yo», «otro» o un chico. */
const paraDe = (p) => {
  if (p === "yo") return E.yo.uid;
  if (p === "otro") return (otro() || {}).id || "";
  const i = /^chico\s*(\d{1,2})$/i.exec(String(p || "").trim());
  if (i) return (chicosDeLaCasa()[Number(i[1]) - 1] || {}).id || "";
  const n = (chicosDeLaCasa().find((x) => String(x.nombre).toLowerCase() === String(p || "").toLowerCase()) || {}).id;
  return n || "";
};
const ninosDe = (indices) => {
  const ids = (indices || []).map((i) => (chicosDeLaCasa()[i] || {}).id).filter(Boolean);
  return ids.length ? ids : chicosDeLaCasa().map((n) => n.id).filter(Boolean);
};

async function interpretar(texto, archivo) {
  const CV2 = CV && CV.CV2;
  if (!CV2) throw new Error("sin Casa Verde no hay IA");
  const hoy = E.hoy;
  const dia = new Date(hoy + "T12:00").toLocaleDateString("es", { weekday: "long" });
  // sugerir-9: la HORA también. A las 00:37 «mañana» es el día que empieza al
  // despertarse, o sea HOY por fecha: sin la hora, la IA lo corría un día.
  const ahoraHM = new Date().toTimeString().slice(0, 5);
  const otroN = ((E.miembros || []).find((m) => m.id !== E.yo.uid) || {}).nombre || "la otra persona";
  const yoN = (E.miembro && E.miembro.nombre) || "quien dicta";
  // sugerir-5: MI agenda de las próximas dos semanas, para que pueda colgar un
  // recordatorio de «el gimnasio de mañana». Es la mía y la manda mi sesión.
  const ninos = chicosDeLaCasa();
  const agenda = agendaParaIA(E.actividades, hoy).map((a) => ({ ...a, titulo: escudarNombres(a.titulo, ninos) }));
  // sugerir-16: las actividades de los chicos, para poder cambiarlas.
  const chicos = chicosParaIA(E.eventos, ninos, hoy);
  // sugerir-15: de dónde sale. La casa del país donde está ahora (ubicación
  // aproximada, no se guarda) y sus lugares con dirección (lugares.js).
  const pais = await dondeEstoy();
  const lugares = lugaresParaIA(E.lugares, E.casas, pais);
  const listas = listasDeCompras(E.compras).map((l) => l.nombre);
  texto = limpiarDictado(texto);
  const dictadoReal = texto;
  texto = escudarNombres(texto, ninos);
  const contenido = [];
  if (archivo) {
    const blob = await CV2.comprimirImagen(archivo);
    const data = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = mal; r.readAsDataURL(blob); });
    contenido.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  }
  contenido.push({ type: "text", text: `Hoy es ${dia} ${hoy} y son las ${ahoraHM} (Uruguay/Brasil). ${yoN} vive con ${otroN} y sus hijos, y dictó algo para organizar su tiempo. ${archivo ? "Adjunta la captura de un flyer o anuncio. " : ""}Lo dictado (puede tener errores del dictado del teléfono y expresiones espontáneas): «${texto || "(nada: sólo la captura)"}».
Su agenda de las próximas dos semanas (JSON): ${JSON.stringify(agenda)}
Las actividades de los chicos (JSON; los chicos se llaman Chico1, Chico2…: usá esos nombres, nunca otros): ${JSON.stringify(chicos)}
Las cuentas (lugares, vehículos y sus depósitos) para los gastos: ${JSON.stringify(cuentasDe(E.cuentasDoc).map((c) => c.ruta))}.
Hay ${ninos.length} chicos: ${ninos.map((n, i) => "Chico" + (i + 1)).join(", ") || "ninguno cargado"}. «Los chicos» son TODOS ellos: en "ninos" van todos. Si nombra a uno solo, va sólo ése.
Dónde está y sus lugares conocidos (JSON; "casa" es de donde sale si no hay otra actividad antes ese día): ${JSON.stringify(lugares)}. Para el viaje usá esas direcciones; si un lugar no está, estimalo y decilo en dudas.
Pensá qué necesita de verdad y devolvé un PLAN de acciones, SOLO un JSON sin texto alrededor:
{"resumen": una línea con lo que entendiste,
 "acciones": [ cada una con "tipo" y sus campos:
   {"tipo":"actividad","titulo","dia":"AAAA-MM-DD","hi":"HH:MM","hf":"HH:MM" o "","lugar","tipo_clase":"trabajo"|"tarea"|"personal"|"ninos","quien":"yo"|"otro"|"los-dos"|"familia","chicos":true|false,"ninos":["Chico1"]}  — algo nuevo que ocupa tiempo;
   {"tipo":"tarea","titulo","detalle"}  — algo CONCRETO que la persona tiene que hacer o preparar con sus manos (llevar algo, comprar, llamar, juntar papeles); va a su pizarra. NUNCA una tarea para guardar, agendar, marcar, anotar o registrar lo que este mismo plan ya hace: eso lo hace la app sola y no ocupa lugar en la pizarra;
   {"tipo":"recordatorio","texto","dia","hora":"HH:MM" (temprano ese día, SIEMPRE antes de lo que recuerda),"sobre": id de su agenda si se refiere a algo que ya tiene}  — un aviso ese día;
   {"tipo":"alarma","texto","dia","hora","sobre","lugar": adónde va,"desde": de dónde sale,"viaje": minutos}  — la alarma de SALIR: si una actividad tiene lugar, la hora es la de la actividad menos el viaje menos 10 minutos de margen. "desde" es el lugar de la actividad anterior de ese mismo día (de la agenda o de este plan) o "casa" si no hay ninguna; "viaje" son los minutos en auto entre "desde" y "lugar", estimados con lo que sabés de las distancias reales (en Uruguay, por ejemplo, entre localidades de la Costa de Oro de Canelones). Si no sabés dónde queda alguno de los dos lugares, decilo en dudas;
   {"tipo":"deseo","titulo","detalle","para":"yo"|"chicos"|"familia","lugar","dias":["martes","jueves"] si se repite cada semana,"fecha":"AAAA-MM-DD" si es una sola vez,"hi":"HH:MM","hf":"HH:MM","cuando": en palabras si no hay días ni fecha}  — algo que quisiera hacer pero no está decidido (un flyer, una clase): va a la lista de deseos. Si el flyer dice que es semanal, poné los días; si es un evento con fecha, la fecha;
   {"tipo":"coordinar","texto"}  — una pregunta para ${otroN} si para hacerlo hay que acordar con él o ella;
   {"tipo":"compra","texto","lista"}  — algo para no olvidar comprar; va a la lista de compras de la casa. Listas que ya existen: ${JSON.stringify(listas)} (usá una de ésas si corresponde, o un nombre corto nuevo);
   {"tipo":"pedido","titulo","detalle","dia"}  — algo que le pide a ${otroN} que haga (va a la pizarra de ${otroN});
   {"tipo":"gasto","monto": número,"moneda":"BRL"|"UYU"|"USD","fecha":"AAAA-MM-DD","categoria": una de ${JSON.stringify(Object.keys(CATEGORIAS))},"comercio","detalle","cuenta": una de las cuentas si es de un lugar o vehículo,"para":"yo"|"otro"|"Chico1" si es para alguien en particular}  — plata que se gastó o que entró («gasté 850 en la farmacia», «cobré los honorarios»). La moneda sólo si la dijo o es obvia (pesos en Uruguay = UYU, reales en Brasil = BRL); si no, vacía y en dudas. Nunca inventes un monto;
   {"tipo":"chicos","accion":"nueva"|"cambiar"|"quitar"|"saltar","id": el de la lista si no es nueva,"titulo","fecha":"AAAA-MM-DD","hora","horaFin","semanal": true|false,"ninos":["Chico1"],"nota"}  — las actividades de los chicos, que ven los dos: una nueva; cambiar una que ya está (sólo los campos que cambian); quitarla del todo; o «saltar» para que no cuente UN día (en "fecha");
   {"tipo":"mover","id": el de su agenda,"dia","hi","hf"}  — cambiar de día u hora algo que YA está en su agenda;
   {"tipo":"quitar","id": el de su agenda}  — sacar algo de su agenda, sólo si lo pide;
   {"tipo":"consulta","que":"chicos"|"agenda"|"gastos"|"balance"|"horas","desde":"AAAA-MM-DD","hasta":"AAAA-MM-DD","ninos":["Chico1"] si pregunta por uno,"cuenta": una de las cuentas,"categorias":[de la lista de arriba],"persona":"yo"|"otro"|"","pregunta": lo que quiere saber en una línea}  — si PREGUNTA algo en vez de pedir que se registre: actividades de los chicos de un día o una semana, su agenda, los gastos o entradas de una cuenta o categoría, el balance de una cuenta, las horas trabajadas. «Esta semana» es de lunes a domingo; «septiembre» es del 1 al 30; si no dice período, «desde» y «hasta» vacíos (todo). Una pregunta no se registra: sólo se contesta ],
 "dudas": [lo que no quedó claro]}.
Elegí con criterio lo que corresponde, puede ser más de una acción: algo decidido con día y hora es una actividad (si es con los chicos, "chicos": true y va también al calendario compartido de los chicos); algo que quisiera pero no está decidido es un deseo; «no olvidar comprar…» es una compra; «pedirle a ${otroN}…» o «que ${otroN} …» es un pedido; «acordarme de…» es un recordatorio (y una alarma si hay una hora en que tiene que salir); preparar algo es una tarea.
Entre las 00:00 y las 05:00, «mañana» quiere decir HOY por fecha (${hoy}): la persona todavía no se fue a dormir.
Nada va en el pasado. «El jueves», «el miércoles»: es el PRÓXIMO día con ese nombre; si hoy es ese día y la hora ya pasó (son las ${ahoraHM}), es el de la semana que viene, nunca hoy ni mañana. Si una actividad de hoy tiene una hora que ya pasó y no se nombró el día, casi seguro es mañana: decilo en dudas.
Si el texto trae un «Link (Instagram/Facebook/…)», es de una publicación que no podés abrir: sacá los datos de la captura y del texto, y poné el link en "detalle" de lo que propongas (actividad o deseo) para que se pueda volver a verlo.
«Anotar/marcar/poner en la pizarra X» es UNA tarea cuyo título es X; la palabra «pizarra» nunca es el título. Si la frase no dice qué anotar, el título es lo que pidió hacer (por ejemplo «Preguntarle a ${otroN} la hora del dentista»).
Si menciona algo que YA está en su agenda, usá su día y hora (y su id en "sobre"); no lo dupliques como actividad. Fechas relativas («mañana», «el jueves») desde hoy. Si un dato no se sabe, dejalo vacío y ponelo en dudas. No inventes.` });
  const r = await fetch(CV2.NETLIFY + "/claude-proxy", {
    method: "POST", headers: { "Content-Type": "application/json" },
    // flash-lite: el que piensa se come los tokens y corta el JSON (plata-2).
    body: JSON.stringify({ model: "gemini-2.5-flash-lite", max_tokens: 3000, messages: [{ role: "user", content: contenido }] }),
  });
  if (!r.ok) throw new Error("la IA contestó " + r.status);
  const j = await r.json();
  const plan = leerPlanIA(((j.content || [])[0] || {}).text, Date.now(), dictadoReal);
  if (!plan) return plan;
  // A la vuelta, «Chico1» vuelve a ser su nombre, en todo lo que se muestra o se guarda.
  const nombres = (x) => typeof x === "string" ? devolverNombres(x, ninos) : x;
  plan.resumen = nombres(plan.resumen);
  plan.dudas = plan.dudas.map(nombres);
  plan.acciones = plan.acciones.map((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, k === "id" || k === "sobre" ? v : nombres(v)])));
  for (const a of plan.acciones) if (a.tipo === "consulta") a.resultado = await contestar(a);
  return plan;
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
    const items = Object.values(E.actividades || {}).filter((x) => x && x.dia >= d0 && x.dia <= d1)
      .map((x) => ({ dia: x.dia, hora: String(x.desde || "").slice(11, 16), horaFin: x.hf || "", titulo: x.titulo || "", de: "" }))
      .sort((p, q) => p.dia.localeCompare(q.dia) || p.hora.localeCompare(q.hora));
    return { tipo: "lista", desde: d0, hasta: d1, de: "tu agenda", items };
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
    ${a.explicacion ? `<p class="explicacion">✨ ${esc(a.explicacion)}</p>` : `<button type="button" class="mini" data-explicar="${n}">✨ Explicar</button>`}</div>`;
}

const DIA_CORTO = (iso) => { try { return new Date(iso + "T12:00").toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" }); } catch { return iso; } };
function renglonAccion(a, n) {
  const ch = `<input type="checkbox" data-accion="${n}" checked>`;
  const enAgenda = (id) => { const x = (E.actividades || {})[id]; return x ? ` · ${esc(x.titulo)}` : ""; };
  if (a.tipo === "actividad") return `<label class="check accion">${ch} 📅 <span><b>${esc(a.titulo)}</b> · ${esc(DIA_CORTO(a.dia))} ${esc(a.hi)}${a.hf ? "–" + esc(a.hf) : ""}${a.lugar ? " · " + esc(a.lugar) : ""}
    <small class="gris">${esc((CLASES_ACTIVIDAD[a.clase] || {}).nombre || "sin clase")} · ${esc(a.quien === "otro" ? "lo hace el otro" : a.quien === "yo" ? "vos" : a.quien)}</small></span></label>`;
  if (a.tipo === "tarea") return `<label class="check accion">${ch} 📝 <span>A tu pizarra: <b>${esc(a.titulo)}</b>${a.detalle ? ` <small class="gris">${esc(a.detalle)}</small>` : ""}</span></label>`;
  if (a.tipo === "recordatorio") return `<label class="check accion">${ch} 🔔 <span>Recordatorio ${esc(DIA_CORTO(a.dia))} ${esc(a.hora)}: <b>${esc(a.texto)}</b><small class="gris">${enAgenda(a.sobre)}</small></span></label>`;
  if (a.tipo === "alarma") return `<label class="check accion">${ch} ⏰ <span>Alarma ${esc(DIA_CORTO(a.dia))} ${esc(a.hora)}: <b>${esc(a.texto)}</b><small class="gris">${enAgenda(a.sobre)}${a.viaje ? ` · 🚗 ≈${esc(String(a.viaje))} min${a.desde ? " desde " + esc(a.desde) : ""}${a.lugar ? " a " + esc(a.lugar) : ""}, + 10 de margen` : ""} · suena en la app</small></span></label>`;
  if (a.tipo === "deseo") return `<label class="check accion">${ch} ⭐ <span>A deseos${a.para === "chicos" ? " de los chicos" : a.para === "familia" ? " de la familia" : ""}: <b>${esc(a.titulo)}</b>${textoFrecuencia(a) ? ` <small class="gris">${esc(textoFrecuencia(a))}</small>` : ""}</span></label>`;
  if (a.tipo === "compra") return `<label class="check accion">${ch} 🛒 <span>A la lista de compras${a.lista ? " «" + esc(a.lista) + "»" : ""}: <b>${esc(a.texto)}</b></span></label>`;
  if (a.tipo === "pedido") return `<label class="check accion">${ch} 🙋 <span>Pedido para ${esc((otro() || {}).nombre || "el otro")}, a su pizarra: <b>${esc(a.titulo)}</b>${a.dia ? ` <small class="gris">${esc(DIA_CORTO(a.dia))}</small>` : ""}</span></label>`;
  if (a.tipo === "gasto") {
    const c = CATEGORIAS[a.categoria];
    return `<label class="check accion">${a.faltan.length ? `<input type="checkbox" data-accion="${n}" disabled>` : ch} 💸 <span>${c && c.tipo === "entro" ? "Entró" : "Gasto"}: <b>${esc(a.monto)} ${esc(a.moneda || "¿moneda?")}</b>${a.comercio ? " · " + esc(a.comercio) : ""}${a.detalle ? " · " + esc(a.detalle) : ""}
      <small class="gris">${esc(c ? c.nombre : "¿categoría?")} · ${esc(a.fecha ? DIA_CORTO(a.fecha) : "¿fecha?")}${a.cuenta ? " · " + esc(((cuentasDe(E.cuentasDoc).find((x) => x.id === cuentaPorNombre(cuentasDe(E.cuentasDoc), a.cuenta))) || {}).ruta || a.cuenta + " (no existe: queda sin cuenta)") : ""}${a.faltan.length ? ` · ⚠ ${esc(a.faltan.join(", "))}: cargalo en Plata` : " · a Plata, con tu nombre"}</small></span></label>`;
  }
  if (a.tipo === "chicos") {
    const ev = (E.eventos || []).find((e) => e.id === a.id);
    const nombres = (a.ninos || []).map((i) => chicosDeLaCasa()[i]).filter(Boolean).map((x) => x.nombre).join(" y ");
    const cuando = [a.fecha && DIA_CORTO(a.fecha), a.hora && a.hora + (a.horaFin ? "–" + a.horaFin : ""), a.semanal && "cada semana"].filter(Boolean).join(" ");
    if (a.accion !== "nueva" && !ev) return `<label class="check accion"><input type="checkbox" data-accion="${n}" disabled> 👦 <span>No encontré esa actividad de los chicos <small class="gris">cambiala en Chicos</small></span></label>`;
    const que = { nueva: "Nueva", cambiar: "Cambiar", quitar: "Sacar", saltar: "Saltear" }[a.accion];
    return `<label class="check accion">${ch} 👦 <span>${que}${a.accion === "nueva" ? "" : " «" + esc(ev.titulo) + "»"}: <b>${esc(a.accion === "nueva" || a.titulo ? a.titulo || "" : "")}</b> ${esc(a.accion === "saltar" ? "el " + DIA_CORTO(a.fecha) : a.accion === "quitar" ? "del todo" : cuando)}${nombres ? ` <small class="gris">${esc(nombres)}</small>` : ""}<small class="gris"> · la ven los dos</small></span></label>`;
  }
  if (a.tipo === "mover" || a.tipo === "quitar") {
    const x = (E.actividades || {})[a.id];
    if (!x) return `<label class="check accion"><input type="checkbox" data-accion="${n}" disabled> 📅 <span>No encontré eso en tu agenda <small class="gris">cambialo en Agenda</small></span></label>`;
    return a.tipo === "mover"
      ? `<label class="check accion">${ch} 📅 <span>Pasar <b>${esc(x.titulo)}</b> a ${esc(DIA_CORTO(a.dia))} ${esc(a.hi)}${a.hf ? "–" + esc(a.hf) : ""} <small class="gris">estaba ${esc(DIA_CORTO(x.dia))} ${esc(String(x.desde || "").slice(11, 16))}</small></span></label>`
      : `<label class="check accion">${ch} 🗑 <span>Sacar de tu agenda: <b>${esc(x.titulo)}</b> <small class="gris">${esc(DIA_CORTO(x.dia))}</small></span></label>`;
  }
  if (a.tipo === "consulta") return respuestaHTML(a, n);
  if (a.tipo === "coordinar") return `<label class="check accion">${ch} 💬 <span>Preguntarle a ${esc(((E.miembros || []).find((m) => m.id !== E.yo.uid) || {}).nombre || "el otro")}: <b>${esc(a.texto)}</b></span></label>`;
  return "";
}

function tarjetaPrecarga(p) {
  return `<div class="tarjeta ficha propone" data-precarga>
    <p class="gris">✨ ${p.resumen ? "Entendí: «" + esc(p.resumen) + "»" : "Esto propongo"} — destildá lo que no va</p>
    ${p.acciones.length ? p.acciones.map(renglonAccion).join("") : `<p class="aviso">No saqué nada claro. Volvé al texto y decilo de otra forma, o mandáselo a Claude.</p>`}
    ${p.dudas.length ? `<p class="aviso">No estoy seguro de: ${p.dudas.map(esc).join(", ")}. Las actividades se corrigen después en Agenda.</p>` : ""}
    <div class="botones">${p.acciones.some((a) => a.tipo !== "consulta") ? `<button type="button" class="boton" data-agendar>Hacer lo marcado</button>` : ""}<button type="button" class="mini" data-otra-vez>Volver al texto</button></div>
    <p class="gris">Si hay que acordar con el otro, Claude le pregunta y te avisa.</p>
  </div>`;
}

/* Hacer lo marcado: cada acción, con la sesión de quien dictó. Lo que necesita
   al otro (coordinar, «lo hace el otro») va a Claude como un pedido. */
async function agendarPrecarga(tp) {
  if (enviando) return;
  const marcadas = [...tp.querySelectorAll("[data-accion]")].filter((c) => c.checked).map((c) => precarga.acciones[Number(c.dataset.accion)])
    .filter((a) => a && a.tipo !== "consulta");
  if (!marcadas.length) return aviso("No marcaste nada.", true);
  enviando = true;
  const hecho = [], paraClaude = [];
  try {
    let imagen = "";
    if (foto) imagen = fotoSubida || await CV.CV2.subirImagen(foto, "tiempos");      // al aceptar, nunca al elegir
    for (const a of marcadas) {
      if (a.tipo === "actividad") {
        if (a.quien === "otro") { paraClaude.push(`Que lo agende el otro: ${a.titulo} ${a.dia} ${a.hi}`); continue; }
        const id = await agendarMio({ titulo: a.titulo, dia: a.dia, hi: a.hi, hf: a.hf, lugar: a.lugar, tipo: a.clase, modo: a.modo, imagen }, { origen: "dictado" });
        if (id) hecho.push("📅 " + a.titulo);
        if (a.chicos && esISO(a.dia)) await F.addDoc(F.collection(db, "eventos"), { titulo: a.titulo.slice(0, 120), fecha: a.dia, hora: a.hi || "",
          horaFin: a.hf || "", semanal: false, ninos: ninosDe(a.ninos), quienes: [E.yo.uid], nota: a.lugar ? "En " + a.lugar.slice(0, 280) : "",
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
      } else if (a.tipo === "gasto") {
        if (a.faltan && a.faltan.length) { aviso(`El gasto de ${a.monto}: ${a.faltan.join(", ")}. Cargalo en Plata.`, true); continue; }
        const c = CATEGORIAS[a.categoria];
        await F.addDoc(F.collection(db, "movimientos"), { monto: a.monto, moneda: a.moneda, fecha: a.fecha, categoria: a.categoria,
          comercio: a.comercio || "", detalle: a.detalle || "", uid: E.yo.uid, comprobanteUrl: imagen || null, automatico: null,
          cuenta: a.cuenta ? cuentaPorNombre(cuentasDe(E.cuentasDoc), a.cuenta) || "" : "", para: paraDe(a.para),
          origen: "dictado", creadoPor: E.yo.uid, creadoEn: F.serverTimestamp(), actualizadoEn: F.serverTimestamp() });
        hecho.push(`💸 ${a.monto} ${a.moneda}${c ? " " + c.nombre : ""}`);
      } else if (a.tipo === "chicos") {
        // sugerir-17 (Mauro): «los chicos» son los dos; si nombra a uno, sólo ése.
        const ninosIds = ninosDe(a.ninos);
        if (a.accion === "nueva") {
          await F.addDoc(F.collection(db, "eventos"), { titulo: a.titulo.slice(0, 120), fecha: a.fecha, hora: a.hora || "", horaFin: a.horaFin || "",
            semanal: !!a.semanal, ninos: ninosIds, quienes: [E.yo.uid], nota: a.nota || "", excepto: [], creadoPor: E.yo.uid, creadoEn: F.serverTimestamp() });
          hecho.push("👦 " + a.titulo);
        } else {
          const ev = (E.eventos || []).find((e) => e.id === a.id);
          if (!ev) { aviso("No encontré esa actividad de los chicos: cambiala en Chicos.", true); continue; }
          const ref = F.doc(db, "eventos", a.id);
          if (a.accion === "quitar") await F.deleteDoc(ref);
          else if (a.accion === "saltar") await F.updateDoc(ref, { excepto: F.arrayUnion(a.fecha), titulo: ev.titulo || "" });
          else {
            // Cambiar: sólo lo que la IA trajo; lo demás queda como estaba.
            const c = { titulo: (a.titulo || ev.titulo || "").slice(0, 120), actualizadoEn: F.serverTimestamp() };
            if (a.fecha) c.fecha = a.fecha;
            if (a.hora) c.hora = a.hora;
            if (a.horaFin) c.horaFin = a.horaFin;
            if (ninosIds.length) c.ninos = ninosIds;
            if (a.nota) c.nota = a.nota;
            await F.updateDoc(ref, c);
          }
          hecho.push(`👦 ${{ cambiar: "cambiada", quitar: "sacada", saltar: "salteada" }[a.accion]}: ${ev.titulo}`);
        }
      } else if (a.tipo === "mover") {
        const mal = await reprogramarActividad(a.id, { dia: a.dia, hi: a.hi, hf: a.hf });
        if (mal) { aviso("No la cambié: " + mal + ".", true); continue; }
        hecho.push("📅 cambiada: " + ((E.actividades || {})[a.id] || {}).titulo);
      } else if (a.tipo === "quitar") {
        const t = ((E.actividades || {})[a.id] || {}).titulo || "";
        await sacarActividad(a.id);
        hecho.push("🗑 " + t);
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
    foto = null; fotoSubida = ""; precarga = null; textoDictado = ""; enviando = false; abierta = false; pintarHoja();
    aviso(hecho.length ? "Listo: " + hecho.length + " cosa(s)." + (paraClaude.length ? " Claude coordina el resto." : "") : "Mandado a Claude.");
    repintar();
  } catch (e) { enviando = false; fallo(e); }
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
  b.innerHTML = "✏️";
  b.title = "Pedirle algo a la IA, sugerir algo o avisar una falla";
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
    <nav class="solapas chicas"><button data-modo="agenda" aria-selected="${modo === "agenda"}">✨ Pedile a la IA</button><button data-modo="pedido" aria-selected="${modo === "pedido"}">Sugerencia</button><button data-modo="falla" aria-selected="${modo === "falla"}">Algo anda mal</button></nav>
    ${modo === "agenda" && precarga ? tarjetaPrecarga(precarga) : ""}
    <form ${modo === "agenda" && precarga ? "hidden" : ""}>
      ${modo === "agenda" ? `<p class="gris">Escribí, o dictá con el 🎤 del teclado, y corregí ahí mismo.</p>` : ""}
      <label>${esc(m.que)} <textarea name="texto" rows="${modo === "agenda" ? 4 : 3}" maxlength="2000" ${modo === "agenda" ? "" : "required"} placeholder="${esc(m.quePh)}">${esc(antes.t)}</textarea></label>
      ${modo === "agenda" ? `<div class="boleta">${CV && CV.CV2 ? `
        <label class="mini boton-archivo">📷 Sacar foto<input type="file" accept="image/*" capture="environment" data-flyer hidden></label>
        <label class="mini boton-archivo">🖼 Elegir captura<input type="file" accept="image/*" data-flyer hidden></label>` : `<small class="gris">Sin Casa Verde no se pueden subir imágenes.</small>`}
        ${foto ? `<small>${esc(foto.name)} · se sube al mandar</small>` : ""}</div>` : ""}
      <label>${esc(m.esp)} <input name="esperaba" maxlength="600" placeholder="${esc(m.espPh)}" value="${esc(antes.e)}"></label>
      <div class="tira">${m.opciones.map(([v, t], i) => `<button type="button" data-v="${v}" class="mini${(marcado && m.opciones.some((o) => o[0] === marcado.v) ? marcado.v === v : i === 0) ? " on" : ""}">${esc(t)}</button>`).join("")}</div>
      ${modo === "agenda" ? `<p class="gris">Lo interpreta <b>una IA</b> (Claude) y te deja una propuesta en <b>Pizarra</b> para aceptar o corregir: <b>nada entra a tu agenda ni a la de nadie sin que esa persona lo acepte</b>. Suele tardar unos minutos; si no, la ronda de la mañana. Va con tu nombre.</p>` : ""}
      <p class="gris nota-ia">Lo lee <b>una IA</b> (el agente de Claude) en la ronda de cada mañana, y lo pasa al panel de Mauro como pendiente. <b>Puede tardar hasta un día.</b> Si hace falta algo más, te va a preguntar en la app o en el chat. Va con tu nombre y la solapa en la que estás (${esc(NOMBRE_SOLAPA[E.solapa] || E.solapa)}).</p>
      ${modo === "agenda" ? `<div class="botones"><button type="button" class="boton" data-precargar ${precargando ? "disabled" : ""}>${precargando ? "Leyendo…" : "✨ Precargar"}</button>
        <button class="mini" ${enviando ? "disabled" : ""}>${enviando ? "Mandando…" : "Mandar a Claude sin precargar"}</button></div>`
      : `<button class="boton" ${enviando ? "disabled" : ""}>${enviando ? "Mandando…" : "Mandar"}</button>`}
    </form>
    ${mios.length ? `<h4>Lo que mandaste</h4>${mios.slice(0, 8).map((r) => `<div class="mandado"><small class="gris">${esc(r.agenda ? "agenda" : r.tipo === "falla" ? "falla" : "sugerencia")} · ${esc(r.estado === "nuevo" ? "esperando la ronda" : r.estado || "")}</small><br>${esc(String(r.texto || "").slice(0, 140))}</div>`).join("")}` : ""}
  </div>`;
  h.onclick = (ev) => { if (ev.target === h) { abierta = false; pintarHoja(); } };
  h.querySelector("[data-cerrar]").onclick = () => { abierta = false; pintarHoja(); };
  for (const b of h.querySelectorAll("[data-modo]")) b.onclick = () => { modo = b.dataset.modo; pintarHoja(); };
  for (const i of h.querySelectorAll("[data-flyer]")) i.onchange = () => { foto = i.files && i.files[0] || null; fotoSubida = ""; pintarHoja(); };
  const pre = h.querySelector("[data-precargar]");
  if (pre) pre.onclick = async () => {
    const texto = h.querySelector("[name=texto]").value.trim();
    if (!texto && !foto) return aviso("Escribí algo o elegí una captura.", true);
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
    const ag = tp.querySelector("[data-agendar]");
    if (ag) ag.onclick = () => agendarPrecarga(tp).catch(fallo);
    for (const b of tp.querySelectorAll("[data-explicar]")) b.onclick = async () => {
      const a = precarga.acciones[Number(b.dataset.explicar)]; if (!a) return;
      b.disabled = true; b.textContent = "Pensando…";
      try { a.explicacion = await explicar(a); } catch (e) { a.explicacion = "No pude explicarlo ahora (" + (e.message || e) + ")."; }
      pintarHoja();
    };
  }
  for (const b of h.querySelectorAll(".tira button")) b.onclick = () => {
    for (const x of h.querySelectorAll(".tira button")) x.classList.toggle("on", x === b);
  };
  const f = h.querySelector("form");
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    let texto = f.texto.value.trim();
    if (!texto && !(modo === "agenda" && foto)) return aviso(modo === "agenda" ? "Escribí algo o elegí una captura." : "Escribí algo.", true);
    if (!texto) texto = "Agendar lo de la captura.";
    if (!E.yo || !E.yo.uid) return aviso("No hay sesión: volvé a entrar.", true);
    enviando = true; pintarHoja();
    try {
      // La imagen se sube al MANDAR y ANTES del documento: un corte de red no
      // deja un pedido apuntando a una imagen que no existe.
      let imagen = "";
      if (modo === "agenda" && foto) imagen = fotoSubida || await CV.CV2.subirImagen(foto, "tiempos");
      await mandarReporte({ texto, esperaba: f.esperaba.value.trim(), tipo: modo === "agenda" ? "pedido" : modo,
        agenda: modo === "agenda", imagen, [m.campo]: (h.querySelector(".tira button.on") || {}).dataset.v || m.opciones[0][0] });
      foto = null;
      enviando = false; abierta = false; pintarHoja();
      aviso(modo === "agenda" ? "Mandado. La propuesta te aparece en Pizarra." : "Mandado. Lo toma la ronda de mañana.");
    } catch (e) { enviando = false; pintarHoja(); fallo(e); }
  };
}

/* Abrir el globo en Agenda con un texto ya escrito (un deseo que se agenda). */
let deseoAgendando = null;
export async function abrirDictado(texto, deseoId = null, { precargar = false, imagen = "" } = {}) {
  // sugerir-10: la captura de un reel o un flyer que compartió la app del
  // teléfono ya está en Cloudinary; se baja para que la lea la IA y NO se
  // vuelve a subir. Sólo de nuestra cuenta: otra dirección no se toca.
  if (imagenNuestra(imagen)) {
    try {
      const b = await (await fetch(imagen)).blob();
      foto = new File([b], "captura.jpg", { type: b.type || "image/jpeg" }); fotoSubida = imagen;
    } catch (e) { aviso("No pude traer la captura: mandala de nuevo desde la app.", true); }
  }
  modo = "agenda"; precarga = null; deseoAgendando = deseoId; abierta = true; escucharMios(); pintarHoja();
  const t = document.querySelector("#hoja-sugerir [name=texto]");
  if (t) { t.value = texto; t.focus(); }
  // sugerir-8: lo que llega dictado desde la app del teléfono ya está
  // corregido allá; se precarga solo y uno ve la tarjeta para marcar.
  if (precargar && texto) { const b = document.querySelector("#hoja-sugerir [data-precargar]"); if (b) b.click(); }
}

export const imagenNuestra = (u) => typeof u === "string" && u.startsWith("https://res.cloudinary.com/dnwfu8ffn/");

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
