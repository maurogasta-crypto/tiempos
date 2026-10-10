// ─────────────────────────────────────────────────────────────────────────────
// pruebas.mjs — El banco de Tiempos. Sin npm y sin red:
//
//   node pruebas.mjs
//
// Cubre las cuentas (`nucleo.js`), que la pantalla y el HTML se entiendan
// (cada id que busca app.js existe), que las reglas no tengan un mail ni un
// UID real, y que el SDK sea la MISMA versión que el de Casa Verde.
// ─────────────────────────────────────────────────────────────────────────────
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TIPOS, horasDe, sumarPorTipo, cargaDe, repartir, tipoHeredado, arbol,
         quePuedoArrancar, semanaDe, fmtHoras, esc, isoDe, sumarDias, lunesDe, semanaISO,
         grillaDelMes, chicosDelDia, eventosDelDia, COTIDIANAS, progresoDia, alternarEncargado,
         pedir, responderPedido, pedidosPara, metasDeLaSemana, ubicarEnSemana, franjaDe,
         separarEnCurso, estadoBloque, bloquesPorConfirmar, intervalosDe, balanceTiempo, msDeLocal,
         validarMovimiento, disponible, automaticosPendientes, leerSugerencia, auditar, CATEGORIAS,
         cotidianasDe, listasDeCompras, recorridoDeCompra, ajusteTrimestral, posiblesFijos, trimestreDe, mesesDelTrimestre, sumarTrimestres, firmaTrimestre, balanceDelMes, firmaBalance, estadoCierre, cuentasDe, cuentaPorNombre, idsDeCuenta, balanceDe, actividadesDeChicos, horasPorCuenta, escudarNombres, devolverNombres, indicesDeChicos, chicosParaIA, tokenNuevo, documentoCompartido, HORAS_COMPARTIDA, colorHeredado, COLORES_TAREA, idNuevo,
         intervalosDeMarcas, validarMarca, marcasQueSePisan, CLASES_ACTIVIDAD,
         UNIDADES_SALIDA, unidadDe, marcaDeSalida, saldoSalidas, estaCorriendo,
         actividadDePropuesta, paraMi, MODOS_AGENDA, leerAgendaIA, leerPlanIA, correrSiPaso, agendaParaIA, ACCIONES, limpiarDictado, listaParaCompra, leerDias, posiblesDelDia, textoFrecuencia, frecuenciaDeseo,
         enMiPizarra, paraElegirPorCategoria, cuentaDelDia, esTareaDelSistema, diasHastaSiPaso,
         paisDe, lugarNuevo, lugaresParaIA, claveLugar, parecidas,
         CADAS, validarConcepto, vence, anualDe, presupuestoAnual, fijosDeMeses, repartoDelMes, sumarMeses, diasDelMes } from "./nucleo.js";

let pasadas = 0, fallidas = 0;
const prueba = (n, f) => { try { f(); pasadas++; console.log("  ✓ " + n); }
  catch (e) { fallidas++; console.log("  ✗ " + n + "\n      " + e.message); } };
const titulo = (t) => console.log("\n" + t);
const H = 3600000;

titulo("Las horas");
prueba("una sesión en curso cuenta hasta ahora; una cerrada, lo que dice", () => {
  assert.equal(horasDe({ estado: "en_curso", inicioMs: 0 }, 2 * H), 2);
  assert.equal(horasDe({ estado: "finalizada", horas: 1.5 }), 1.5);
});
prueba("un reloj atrasado no resta trabajo, y basura cuenta cero", () => {
  assert.equal(horasDe({ estado: "en_curso", inicioMs: 5 * H }, 2 * H), 0);
  assert.equal(horasDe({ estado: "finalizada", horas: -3 }), 0);
  assert.equal(horasDe({ horas: "x" }), 0);
});
prueba("se suma por persona y por tipo, y un tipo inventado no entra", () => {
  const t = sumarPorTipo([
    { uid: "m", tipo: "produccion", horas: 3, inicioMs: 1 }, { uid: "m", tipo: "ninos", horas: 1, inicioMs: 1 },
    { uid: "f", tipo: "ninos", horas: 4, inicioMs: 1 }, { uid: "f", tipo: "vacaciones", horas: 9, inicioMs: 1 }]);
  assert.equal(t.m.produccion, 3); assert.equal(t.m.ninos, 1); assert.equal(t.f.ninos, 4);
  assert.equal(Object.values(t.f).reduce((a, b) => a + b), 4);
});
prueba("cuenta en la semana en que EMPEZÓ, aunque termine después", () => {
  const t = sumarPorTipo([{ uid: "m", tipo: "casa", horas: 2, inicioMs: 10 }, { uid: "m", tipo: "casa", horas: 5, inicioMs: 100 }],
    { desdeMs: 0, hastaMs: 50 });
  assert.equal(t.m.casa, 2);
});

titulo("La carga y el reparto (la regla de Mauro)");
prueba("carga = producción + mantenimiento + chicos; casa y personal no", () => {
  assert.equal(cargaDe({ produccion: 2, mantenimiento: 1, ninos: 3, casa: 5, personal: 8 }), 6);
});
prueba("«a cargo de los chicos es equiparable a producir»: el peso es 1", () => {
  assert.equal(TIPOS.ninos.peso, 1);
});
prueba("«yo trabajo y Flor está con los chicos»: costo neutro, mitad y mitad", () => {
  const r = repartir({ BRL: { entro: 1000, mantenimiento: 300, chicos: 100 } }, { m: 40, f: 40 });
  assert.equal(r.BRL.libre, 600); assert.equal(r.BRL.partes.m, 300); assert.equal(r.BRL.partes.f, 300);
});
prueba("quien se va de vacaciones tiene menos carga y le toca menos", () => {
  const r = repartir({ BRL: { entro: 1000, mantenimiento: 400 } }, { m: 10, f: 50 });
  assert.equal(r.BRL.partes.m, 100); assert.equal(r.BRL.partes.f, 500);
});
prueba("cada moneda por separado, nunca sumadas", () => {
  const r = repartir({ BRL: { entro: 100 }, UYU: { entro: 3000 } }, { m: 1, f: 1 });
  assert.deepEqual(Object.keys(r).sort(), ["BRL", "UYU"]);
  assert.equal(r.UYU.partes.m, 1500);
});
prueba("sin carga de nadie, mitad y mitad y se avisa", () => {
  const r = repartir({ BRL: { entro: 100 } }, { m: 0, f: 0 });
  assert.equal(r.BRL.partes.m, 50); assert.equal(r.BRL.sinCarga, true);
});
prueba("si los gastos superan lo que entró, el «libre» es negativo y se reparte igual (se debe)", () => {
  const r = repartir({ BRL: { entro: 100, mantenimiento: 300 } }, { m: 1, f: 3 });
  assert.equal(r.BRL.libre, -200); assert.equal(r.BRL.partes.f, -150);
});

titulo("Las tareas");
const T = [{ id: "a", titulo: "Chicos", tipo: "ninos" }, { id: "b", titulo: "Escuela", parentId: "a", tipo: "produccion" },
           { id: "c", titulo: "Ida", parentId: "b" }, { id: "x", titulo: "huérfana", parentId: "nadie", tipo: "casa" }];
prueba("el tipo lo pone la raíz, aunque la hija diga otra cosa", () => {
  const { porId } = arbol(T);
  assert.equal(tipoHeredado(porId.c, porId), "ninos");
  assert.equal(tipoHeredado(porId.b, porId), "ninos");
});
prueba("una tarea cuyo padre no existe queda como raíz, no desaparece", () => {
  assert.ok(arbol(T).raices.some((r) => r.id === "x"));
});
prueba("un ciclo en el árbol no cuelga la app", () => {
  const { porId } = arbol([{ id: "p", parentId: "q" }, { id: "q", parentId: "p", tipo: "casa" }]);
  tipoHeredado(porId.p, porId);
});

titulo("Un solo cronómetro para las dos bases");
prueba("con algo corriendo en Casa Verde no arranca nada de la familia, y al revés", () => {
  assert.equal(quePuedoArrancar({ titulo: "Limpieza" }, null).puede, false);
  assert.equal(quePuedoArrancar(null, { titulo: "Cena" }).puede, false);
  assert.equal(quePuedoArrancar(null, null).puede, true);
});
prueba("la tarea que corre se reconoce en su fila (■ y recuadro, tiempos:A1)", () => {
  assert.equal(estaCorriendo({ actividadId: "a1" }, null, "cv", "a1"), true);
  assert.equal(estaCorriendo({ actividadId: "a1" }, null, "cv", "a2"), false);
  assert.equal(estaCorriendo(null, { tareaId: "t1" }, "f", "t1"), true);
  assert.equal(estaCorriendo(null, { tareaId: "t1" }, "cv", "t1"), false, "una tarea de la familia no marca una de Casa Verde con el mismo id");
  assert.equal(estaCorriendo(null, { tareaId: undefined }, "f", undefined), false, "sin id no corre nada");
  assert.equal(estaCorriendo(null, null, "f", "t1"), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.equal((app.match(/estaCorriendo\(E\.enCursoCV, E\.enCursoFam/g) || []).length, 2, "las dos filas (familia y Casa Verde) lo usan");
});
prueba("las boletas se leen con flash-lite y tokens de sobra (tiempos:A10)", () => {
  const plata = fs.readFileSync("plata.js", "utf8");
  assert.match(plata, /const MODELO_BOLETA = "gemini-2\.5-flash-lite";/);
  assert.ok(Number((/const TOKENS_BOLETA = (\d+)/.exec(plata) || [])[1]) >= 1500);
  assert.ok(!/model: "gemini-2\.5-flash"/.test(plata), "el modelo que piensa y corta el JSON no vuelve");
});

titulo("Lo que propone Claude para la agenda (app-12)");
prueba("una propuesta completa se vuelve la misma actividad que se carga a mano", () => {
  const r = actividadDePropuesta({ titulo: "Básquet", dia: "2026-10-08", hi: "15:00", hf: "18:00", tipo: "ninos", modo: "recordar", recordar: true, lugar: "Club" }, "u1");
  assert.equal(r.ok, true);
  assert.equal(r.marca.clase, "chicos"); assert.equal(r.marca.uid, "u1");
  assert.equal(r.marca.desde, "2026-10-08T15:00"); assert.equal(r.marca.hasta, "2026-10-08T18:00");
  assert.equal(r.actividad.origen, "claude"); assert.equal(r.actividad.recordar, true); assert.equal(r.supuesto, false);
});
prueba("lo dictado sin hora de fin: se supone una hora y se dice que se supuso", () => {
  const r = actividadDePropuesta({ titulo: "Dentista", dia: "2026-10-09", hi: "10:30", tipo: "personal" }, "u1");
  assert.equal(r.ok, true); assert.equal(r.supuesto, true); assert.equal(r.marca.hasta, "2026-10-09T11:30");
});
prueba("de noche sin vuelta vale, como a mano", () => {
  const r = actividadDePropuesta({ titulo: "Cena", dia: "2026-10-10", hi: "21:00", tipo: "personal" }, "u1");
  assert.equal(r.ok, true); assert.equal(r.supuesto, false); assert.equal(r.marca.hasta, "2026-10-11T07:00");
});
prueba("lo que falta se dice, y no se inventa", () => {
  const r = actividadDePropuesta({ titulo: "", dia: "jueves", hi: "3 de la tarde", tipo: "otra" }, "u1");
  assert.equal(r.ok, false);
  for (const x of ["qué es", "trabajo, tarea", "el día", "desde qué hora"]) assert.ok(r.motivos.some((m) => m.includes(x)), x);
});
prueba("una imagen que no es https no viaja, y un modo raro cae en «sugerida»", () => {
  const r = actividadDePropuesta({ titulo: "Feria", dia: "2026-10-11", hi: "10:00", hf: "12:00", tipo: "ninos", imagen: "javascript:alert(1)", modo: "otro" }, "u1");
  assert.equal(r.actividad.imagen, ""); assert.equal(r.actividad.modo, "sugerida");
});
prueba("cada tarjeta es de una persona: para = uid o lista", () => {
  assert.equal(paraMi({ datos: { para: "u1" } }, "u1"), true);
  assert.equal(paraMi({ datos: { para: ["u2", "u1"] } }, "u1"), true);
  assert.equal(paraMi({ datos: { para: "u2" } }, "u1"), false);
  assert.equal(paraMi({}, "u1"), false);
});
prueba("aceptar escribe la agenda del que acepta y nada más (propone.js)", () => {
  const src = fs.readFileSync("propone.js", "utf8");
  assert.ok(/F\.doc\(db, "agendas", E\.yo\.uid\)/.test(src));
  assert.ok(!/F\.doc\(db, "agendas", (?!E\.yo\.uid)/.test(src), "nunca la agenda de otro");
  assert.ok(Object.keys(MODOS_AGENDA).includes("recordar") && Object.keys(MODOS_AGENDA).includes("invitar"));
});
prueba("el dictado: el audio no viaja, la imagen se sube al mandar y antes del documento", () => {
  const src = fs.readFileSync("sugerir.js", "utf8");
  // sugerir-12: sin reconocedor propio; se dicta con el micrófono del teclado.
  assert.ok(!/SpeechRecognition/.test(src), "el dictado es el del teclado");
  assert.ok(src.indexOf("CV.CV2.subirImagen(foto") < src.indexOf("await mandarReporte({ texto, esperaba"), "primero la imagen");
  assert.ok(!/MediaRecorder|getUserMedia/.test(src), "no se graba audio");
});

prueba("lo que precarga Gemini se lee con desconfianza (sugerir-4)", () => {
  const r = leerAgendaIA('```json\n{"titulo":"Básquet","dia":"2026-10-08","hi":"15:00","hf":"18:00","tipo":"ninos","quien":"yo","chicos":true,"modo":"recordar","dudas":[]}\n```');
  assert.equal(r.titulo, "Básquet"); assert.equal(r.dia, "2026-10-08"); assert.equal(r.tipo, "ninos"); assert.equal(r.chicos, true);
  assert.deepEqual(r.dudas, []);
  const mal = leerAgendaIA('{"titulo":"","dia":"el jueves","hi":"3pm","tipo":"deporte","quien":"cualquiera","chicos":"sí"}');
  assert.equal(mal.dia, ""); assert.equal(mal.hi, ""); assert.equal(mal.tipo, ""); assert.equal(mal.quien, "yo"); assert.equal(mal.chicos, false);
  for (const x of ["qué es", "el día", "la hora"]) assert.ok(mal.dudas.includes(x), x);
  assert.equal(leerAgendaIA("no entendí nada"), null);
});
prueba("a Gemini no le van los nombres de los chicos", () => {
  const src = fs.readFileSync("sugerir.js", "utf8");
  const i = src.indexOf("async function interpretar"), k = src.indexOf("function tarjetaPrecarga");
  assert.ok(i > 0 && k > i);
  const cuerpo = src.slice(i, k);
  assert.ok(!/familia\.ninos|ninoPorId|E\.familia/.test(cuerpo));
  // sugerir-16: lo dictado, los títulos de la agenda y los de los chicos salen escudados.
  assert.match(cuerpo, /texto = escudarNombres\(texto, ninos\)/);
  assert.match(cuerpo, /titulo: escudarNombres\(a\.titulo, ninos\)/);
  assert.match(cuerpo, /chicosParaIA\(E\.eventos, ninos, hoy\)/);
  assert.match(cuerpo, /devolverNombres\(x, ninos\)/);
});

titulo("Un dictado es un plan (app-13)");
prueba("«recordar ir antes al gimnasio para llevar los títulos a Pedro» → tarea, recordatorio y alarma colgados del gimnasio", () => {
  const plan = leerPlanIA(JSON.stringify({ resumen: "Mañana salir antes al gimnasio para llevarle los títulos del auto a Pedro",
    acciones: [
      { tipo: "tarea", titulo: "Juntar los títulos del auto para Pedro" },
      { tipo: "recordatorio", texto: "Llevar los títulos del auto a Pedro", dia: "2026-10-06", hora: "08:00", sobre: "a123" },
      { tipo: "alarma", texto: "Salir para el gimnasio (con los títulos)", dia: "2026-10-06", hora: "17:30", sobre: "a123" },
      { tipo: "actividad", titulo: "Gimnasio", dia: "2026-10-06", hi: "18:00" } ], dudas: [] }));
  assert.deepEqual(plan.acciones.map((a) => a.tipo), ["tarea", "recordatorio", "alarma", "actividad"]);
  assert.equal(plan.acciones[2].sobre, "a123");
  const act = plan.acciones[3];
  assert.equal(act.clase, "", "una actividad sin clase no se inventa la clase");
  assert.ok(plan.dudas.some((d) => d.includes("Gimnasio")));
});
prueba("tiempos:A18 — un aviso que cae en el pasado se corre y se dice; sin «ahora» no se toca", () => {
  const plan = (acc, ahora) => leerPlanIA(JSON.stringify({ acciones: acc }), ahora);
  const a1423 = new Date(2026, 9, 5, 14, 23).getTime();
  // el caso real: «recordar traer andamio», dictado a las 14:23, para las 08:00 de ese día
  const p = plan([{ tipo: "recordatorio", texto: "Traer andamio dos cuerpos", dia: "2026-10-05", hora: "08:00" }], a1423);
  assert.equal(p.acciones[0].dia, "2026-10-05"); assert.equal(p.acciones[0].hora, "15:00");
  assert.ok(p.dudas.some((d) => d.includes("ya pasó")));
  // sin hora también (al guardar sería 08:00)
  assert.equal(plan([{ tipo: "recordatorio", texto: "x", dia: "2026-10-05" }], a1423).acciones[0].hora, "15:00");
  // de un día anterior
  assert.equal(plan([{ tipo: "recordatorio", texto: "x", dia: "2026-10-01", hora: "20:00" }], a1423).acciones[0].dia, "2026-10-05");
  // tarde a la noche: mañana a las 8
  const n = plan([{ tipo: "recordatorio", texto: "x", dia: "2026-10-05", hora: "08:00" }], new Date(2026, 9, 5, 22, 40).getTime()).acciones[0];
  assert.deepEqual([n.dia, n.hora], ["2026-10-06", "08:00"]);
  // la alarma conserva su hora: hoy si todavía no llegó, si no mañana (fin de mes incluido)
  assert.equal(plan([{ tipo: "alarma", texto: "Salir", dia: "2026-10-04", hora: "17:30" }], a1423).acciones[0].dia, "2026-10-05");
  const al = plan([{ tipo: "alarma", texto: "Salir", dia: "2026-10-31", hora: "07:00" }], new Date(2026, 9, 31, 9, 0).getTime()).acciones[0];
  assert.deepEqual([al.dia, al.hora], ["2026-11-01", "07:00"]);
  // lo que está por venir no se toca, ni lo que llega sin día, ni nada sin «ahora»
  const ok = plan([{ tipo: "recordatorio", texto: "x", dia: "2026-10-05", hora: "16:00" }, { tipo: "alarma", texto: "y", dia: "", hora: "09:00" }], a1423);
  assert.equal(ok.acciones[0].hora, "16:00"); assert.equal(ok.acciones[1].dia, ""); assert.ok(!ok.dudas.some((d) => d.includes("ya pasó")));
  assert.equal(plan([{ tipo: "recordatorio", texto: "x", dia: "2020-01-01", hora: "08:00" }]).acciones[0].dia, "2020-01-01");
  assert.equal(typeof correrSiPaso, "function");
});
prueba("una foto con «me gustaría que los chicos vayan»: deseo; «coordinar con Flor»: deseo + pregunta", () => {
  const p = leerPlanIA('{"acciones":[{"tipo":"deseo","titulo":"Taller de cerámica","para":"chicos","cuando":"sábados 10 h"},{"tipo":"coordinar","texto":"¿Podés quedarte con los chicos los martes de 19 a 21 para que tome la clase?"}]}');
  assert.equal(p.acciones[0].para, "chicos"); assert.equal(p.acciones[1].tipo, "coordinar");
});
prueba("lo que no tiene forma se descarta o va a dudas, nunca se inventa", () => {
  const p = leerPlanIA('{"acciones":[{"tipo":"borrar-todo"},{"tipo":"tarea","titulo":""},{"tipo":"alarma","texto":"Salir","dia":"mañana","hora":"5pm"},{"tipo":"actividad","titulo":"Básquet","dia":"2026-10-08","hi":"15:00","tipo_clase":"ninos"}]}');
  assert.deepEqual(p.acciones.map((a) => a.tipo), ["alarma", "actividad"]);
  assert.equal(p.acciones[0].dia, ""); assert.equal(p.acciones[0].hora, "");
  assert.equal(p.acciones[1].clase, "ninos");
  assert.ok(p.dudas.length >= 2);
  assert.equal(leerPlanIA("nada"), null);
  assert.ok(Object.keys(ACCIONES).length === 13);
});
prueba("«no olvidar comprar» va a compras; «pedile a Flor» es un pedido; sin texto, nada", () => {
  const p = leerPlanIA('{"acciones":[{"tipo":"compra","texto":"Pilas AA","lista":"Ferretería"},{"tipo":"pedido","titulo":"Pasar a buscar el pan","dia":"2026-10-07"},{"tipo":"compra","texto":""},{"tipo":"pedido","titulo":"x","dia":"el jueves"}]}');
  assert.deepEqual(p.acciones.map((a) => a.tipo), ["compra", "pedido", "pedido"]);
  assert.equal(p.acciones[0].lista, "Ferretería"); assert.equal(p.acciones[1].dia, "2026-10-07"); assert.equal(p.acciones[2].dia, "");
});
prueba("la compra cae en la lista que se llama así, sin tildes ni mayúsculas; si no hay, null", () => {
  const ls = [{ id: "a", nombre: "Súper" }, { id: "b", nombre: "Ferretería" }];
  assert.equal(listaParaCompra(ls, "super"), "a"); assert.equal(listaParaCompra(ls, "ferreteria"), "b");
  assert.equal(listaParaCompra(ls, "Farmacia"), null); assert.equal(listaParaCompra(ls, ""), null);
});
prueba("el dictado repetido de Android se limpia; un texto normal queda igual", () => {
  assert.equal(limpiarDictado("el el jueves el jueves el jueves llevo el jueves llevo los el jueves llevo los niños a el jueves llevo los niños a básquetbol"),
    "el jueves llevo los niños a básquetbol");
  assert.equal(limpiarDictado("el jueves llevo los niños a el club y el viernes compro pan"), "el jueves llevo los niños a el club y el viernes compro pan");
  assert.equal(limpiarDictado("comprar comprar leche comprar leche y pan"), "comprar leche y pan");
  assert.equal(limpiarDictado(""), "");
});
prueba("un pedido va a la pizarra del OTRO como tarea común; una compra, a familia/compras", () => {
  const s = fs.readFileSync("sugerir.js", "utf8");
  assert.match(s, /alcance: "comun", duenio: E\.yo\.uid,[\s\S]{0,120}encargados: \[o\.id\][\s\S]{0,40}pizarra: \{ \[o\.id\]: true \}/);
  assert.match(s, /F\.doc\(db, "familia", "compras"\)/);
});
prueba("un flyer semanal deja los días; uno de fecha, la fecha; las dos no", () => {
  const p = leerPlanIA('{"acciones":[{"tipo":"deseo","titulo":"Básquet","para":"chicos","dias":["martes","jueves"],"hi":"18:00","hf":"19:30"},{"tipo":"deseo","titulo":"Feria","fecha":"2026-10-11","dias":["sábado"]},{"tipo":"deseo","titulo":"Yoga","cuando":"cuando abra"}]}');
  assert.deepEqual(p.acciones[0].dias, [2, 4]); assert.equal(p.acciones[0].hi, "18:00");
  assert.equal(p.acciones[1].fecha, "2026-10-11"); assert.deepEqual(p.acciones[1].dias, []);
  assert.deepEqual(p.acciones[2].dias, []); assert.equal(p.acciones[2].fecha, ""); assert.equal(p.acciones[2].cuando, "cuando abra");
  assert.deepEqual(leerDias(["Sábados", "domingo", 3, 9, "feriado"]), [0, 3, 6]); assert.deepEqual(leerDias("lunes y miércoles"), [1, 3]);
  assert.deepEqual(frecuenciaDeseo({ hi: "5pm" }), { dias: [], fecha: "", hi: "", hf: "" });
});
prueba("«qué se puede hacer hoy»: lo semanal de ese día y lo de esa fecha, por hora, sin descartados", () => {
  const ds = [{ titulo: "Básquet", dias: [2, 4], hi: "18:00" }, { titulo: "Feria", fecha: "2026-10-06", hi: "10:00" },
    { titulo: "Natación", dias: [2], estado: "descartado" }, { titulo: "Teatro", dias: [2], estado: "agendado" }, { titulo: "Yoga", cuando: "algún día" }];
  assert.deepEqual(posiblesDelDia(ds, "2026-10-06").map((d) => d.titulo), ["Feria", "Básquet", "Teatro"]);   // martes
  assert.deepEqual(posiblesDelDia(ds, "2026-10-07").map((d) => d.titulo), []);
  assert.equal(textoFrecuencia(ds[0]), "cada martes y jueves · 18:00"); assert.equal(textoFrecuencia(ds[1]), "06/10 · 10:00");
  assert.equal(textoFrecuencia(ds[4]), "algún día");
});
prueba("deseos-1: está en el SHELL, sube el flyer al guardar, y las reglas v10 dejan editarlo a los dos sin cambiar el dueño", () => {
  const sw = fs.readFileSync("sw.js", "utf8"), d = fs.readFileSync("deseos.js", "utf8"), r = fs.readFileSync("firestore.rules", "utf8");
  assert.match(sw, /"deseos\.js"/);
  assert.match(d, /async function guardar[\s\S]*subirImagen/); assert.ok(!/onchange[^\n]*subirImagen/.test(d));
  const bloque = r.slice(r.indexOf("match /deseos/"));
  assert.match(bloque, /allow update: if esPersona\(\)\s*&& request\.resource\.data\.uid == resource\.data\.uid/);
  assert.match(bloque, /dias\.size\(\) <= 7/); assert.match(r, /v10: un deseo puede repetirse/);
});
prueba("app-14: ?dictar= abre el dictado precargado, se borra de la dirección y no queda en la caché", () => {
  const a = fs.readFileSync("app.js", "utf8"), w = fs.readFileSync("sw.js", "utf8"), g = fs.readFileSync("sugerir.js", "utf8");
  assert.match(a, /get\("dictar"\)[\s\S]{0,120}history\.replaceState[\s\S]{0,300}abrirDictado\([\s\S]{0,60}precargar: true/);
  assert.match(w, /searchParams\.has\("dictar"\)\) return;/);
  assert.match(g, /if \(precargar && texto\)/);
});
prueba("sugerir-9: la IA sabe la HORA (a la madrugada «mañana» es hoy) y que «pizarra» no es el título de una tarea", () => {
  const g = fs.readFileSync("sugerir.js", "utf8");
  assert.match(g, /y son las \$\{ahoraHM\}/);
  assert.match(g, /Entre las 00:00 y las 05:00, «mañana» quiere decir HOY/);
  assert.match(g, /la palabra «pizarra» nunca es el título/);
});
prueba("app-15: la captura que sube la app viaja como &imagen=, sólo de nuestra cuenta, y no se vuelve a subir", async () => {
  const g = fs.readFileSync("sugerir.js", "utf8"), a = fs.readFileSync("app.js", "utf8");
  const { imagenNuestra } = await import("./sugerir.js").catch(() => ({}));
  assert.match(g, /export const imagenNuestra = \(u\) => typeof u === "string" && u\.startsWith\("https:\/\/res\.cloudinary\.com\/dnwfu8ffn\/"\)/);
  assert.match(g, /if \(imagenNuestra\(imagen\)\)/);
  assert.match(g, /imagen = fotoSubida \|\| await CV\.CV2\.subirImagen\(foto, "tiempos"\)/);
  assert.match(a, /params\.get\("imagen"\)[\s\S]{0,120}abrirDictado\([\s\S]{0,60}imagen \}/);
  assert.match(g, /pon[eé] el link en "detalle"/);
});
prueba("a la IA va MI agenda de dos semanas, con ids, y nada más", () => {
  const a = agendaParaIA({ x: { titulo: "Gimnasio", dia: "2026-10-06", desde: "2026-10-06T18:00", hasta: "2026-10-06T19:00" },
    y: { titulo: "Viejo", dia: "2026-09-01", desde: "2026-09-01T10:00", hasta: "2026-09-01T11:00" },
    z: { titulo: "Lejos", dia: "2026-12-01", desde: "2026-12-01T10:00", hasta: "2026-12-01T11:00" } }, "2026-10-05");
  assert.deepEqual(a, [{ id: "x", titulo: "Gimnasio", dia: "2026-10-06", desde: "18:00", hasta: "19:00", lugar: "" }]);
});
prueba("las reglas v9: alertas de su dueño (el agente lee; escribe sólo con permiso, v11), deseos de los dos", () => {
  const r = fs.readFileSync("firestore.rules", "utf8");
  const al = /match \/alertas\/\{id\} \{([\s\S]*?)\n    \}/.exec(r)[1];
  assert.ok(/allow read: if esAgente\(\) \|\| \(esPersona\(\) && resource\.data\.uid == request\.auth\.uid\)/.test(al));
  // v11: el agente escribe alertas SÓLO con el permiso de su dueño.
  for (const m of al.matchAll(/allow (create|update|delete): if esAgente\(\)([^;]*);/g))
    assert.match(m[2], /agenteEn\(/, "una escritura del agente sin el permiso del dueño: " + m[1]);
  const de = /match \/deseos\/\{id\} \{([\s\S]*?)\n    \}/.exec(r)[1];
  assert.ok(/allow read: if esPersona\(\) \|\| esAgente\(\)/.test(de));
});
prueba("hacer lo marcado: la tarea va a MI pizarra y las alertas a mi nombre", () => {
  const src = fs.readFileSync("sugerir.js", "utf8");
  assert.ok(/pizarra: \{ \[E\.yo\.uid\]: true \}/.test(src));
  assert.ok(/F\.collection\(db, "alertas"\), \{ uid: E\.yo\.uid/.test(src));
});

titulo("app-16: la solapa Pizarra y el mes de la agenda (tiempos:V7)");
prueba("mi pizarra es la del teléfono: pizarra.<uid> === true, lo pendiente primero", () => {
  const ts = [{ id: "a", titulo: "Zeta", pizarra: { yo: true } }, { id: "b", titulo: "Alfa", pizarra: { yo: true }, hecho: true },
    { id: "c", titulo: "Beta", pizarra: { otro: true } }, { id: "d", titulo: "Gama", pizarra: { yo: "sí" } }, { id: "e", titulo: "Delta" }];
  assert.deepEqual(enMiPizarra(ts, "yo").map((t) => t.id), ["a", "b"]);
  assert.deepEqual(enMiPizarra(null, "yo"), []);
});
prueba("para elegir: por ámbito heredado, sin lo hecho ni lo personal ajeno, con la ruta", () => {
  const ts = [{ id: "p", titulo: "Casa", tipo: "casa", alcance: "comun" }, { id: "h", titulo: "Pintar", parentId: "p", alcance: "comun" },
    { id: "x", titulo: "Hecha", tipo: "casa", alcance: "comun", hecho: true },
    { id: "m", titulo: "Mía", tipo: "personal", alcance: "personal", duenio: "yo" }, { id: "o", titulo: "De otro", tipo: "personal", alcance: "personal", duenio: "otro" }];
  const g = paraElegirPorCategoria(ts, "yo");
  assert.deepEqual(g.casa.map((t) => t.ruta), ["Casa", "Casa › Pintar"]);
  assert.deepEqual(g.personal.map((t) => t.id), ["m"]);
  assert.ok(!Object.values(g).flat().some((t) => t.id === "x" || t.id === "o"));
});
prueba("el mes de la agenda cuenta actividades, lo agendado con día y lo de los chicos", () => {
  const c = cuentaDelDia("2026-10-08", { "f:1": { dia: "2026-10-08" }, "f:2": { dia: null }, "cv:3": { dia: "2026-10-08" } },
    { a: { dia: "2026-10-08" }, b: { dia: "2026-10-09" } }, [{ titulo: "Básquet" }]);
  assert.deepEqual(c, { acts: 1, ag: 2, chicos: 1 });
});
prueba("la pizarra se escribe con la MISMA forma que la app del teléfono, y tachar es «✔ Hecha»", () => {
  const p = fs.readFileSync("pizarra.js", "utf8");
  assert.match(p, /\["pizarra\." \+ E\.yo\.uid\]: si \? true : F\.deleteField\(\)/);
  assert.match(p, /hecho: true, hechoPor: E\.yo\.uid/);
  const h = fs.readFileSync("index.html", "utf8");
  assert.ok(h.indexOf('data-solapa="pizarra"') < h.indexOf('data-solapa="tareas"') && h.indexOf('data-solapa="tareas"') < h.indexOf('data-solapa="hoy"'), "Pizarra primero, Tareas segunda");
  assert.ok(!/data-solapa="ahora"/.test(h));
});

titulo("nucleo-15: un plan coherente y sin tareas de más (7-oct)");
prueba("lo que el plan ya hace no va a la pizarra: «Guardar actividades en la agenda» se descarta", () => {
  for (const t of ["Guardar actividades en la agenda", "Marcar actividades en el calendario", "Asegurarse de que la cita quede en la agenda", "Marcar la pizarra"]) assert.ok(esTareaDelSistema(t), t);
  for (const t of ["Llevar la pelota", "Comprar pintura", "Agendar turno con el dentista", "Juntar los títulos del auto"]) assert.ok(!esTareaDelSistema(t), t);
  const p = leerPlanIA(JSON.stringify({ acciones: [{ tipo: "tarea", titulo: "Guardar actividades en la agenda" }, { tipo: "tarea", titulo: "Llevar la denuncia impresa" }] }));
  assert.deepEqual(p.acciones.map((a) => a.titulo), ["Llevar la denuncia impresa"]);
});
prueba("el caso real: dictado a las 19:23, la cita de las 19 pasa a mañana CON sus avisos, y el recordatorio queda antes", () => {
  const ahora = new Date(2026, 9, 7, 19, 23).getTime();
  const p = leerPlanIA(JSON.stringify({ acciones: [
    { tipo: "actividad", titulo: "Odontólogo", dia: "2026-10-07", hi: "19:00", lugar: "Marindia", tipo_clase: "personal" },
    { tipo: "recordatorio", texto: "Ir al odontólogo", dia: "2026-10-07", hora: "20:00" },
    { tipo: "alarma", texto: "Salir hacia Marindia", dia: "2026-10-07", hora: "18:25", lugar: "Marindia", desde: "Atlántida", viaje: 25 } ] }), ahora);
  const [act, rec, al] = p.acciones;
  assert.equal(act.dia, "2026-10-08"); assert.equal(rec.dia, "2026-10-08"); assert.equal(al.dia, "2026-10-08");
  assert.equal(rec.hora, "17:00", "el recordatorio va antes de la cita");
  assert.equal(al.hora, "18:25"); assert.equal(al.viaje, 25); assert.equal(al.desde, "Atlántida");
  assert.ok(p.dudas.some((d) => d.includes("Odontólogo") && d.includes("2026-10-08")));
});
prueba("un viaje que no es un número de minutos razonable no se muestra; sin «ahora» nada cambia de día", () => {
  const p = leerPlanIA(JSON.stringify({ acciones: [{ tipo: "alarma", texto: "Salir", dia: "2026-10-08", hora: "10:00", viaje: "mucho" },
    { tipo: "actividad", titulo: "Cita", dia: "2020-01-01", hi: "10:00", tipo_clase: "personal" }] }));
  assert.equal(p.acciones[0].viaje, undefined); assert.equal(p.acciones[1].dia, "2020-01-01");
});
prueba("sugerir-13: el prompt pide la alarma de salir con el viaje, y nunca tareas de agendar", () => {
  const g = fs.readFileSync("sugerir.js", "utf8");
  assert.match(g, /"viaje": minutos/); assert.match(g, /menos el viaje menos 10 minutos de margen/);
  assert.match(g, /NUNCA una tarea para guardar, agendar, marcar/);
  assert.match(g, /Nada va en el pasado/);
});

titulo("nucleo-16 · agenda-6 · propone-6: «el miércoles» y reprogramar (7-oct)");
prueba("dictado un miércoles a la noche: «el miércoles» es el de la semana que viene, con sus avisos", () => {
  const ahora = new Date(2026, 9, 7, 19, 23).getTime();   // miércoles 7-oct
  const p = leerPlanIA(JSON.stringify({ acciones: [
    { tipo: "actividad", titulo: "Odontólogo", dia: "2026-10-07", hi: "19:00", lugar: "Marindia", tipo_clase: "personal" },
    { tipo: "alarma", texto: "Salir hacia Marindia", dia: "2026-10-07", hora: "18:25" } ] }), ahora, "el odontólogo es el miércoles a las 7 de la tarde en Marindia");
  assert.equal(p.acciones[0].dia, "2026-10-14"); assert.equal(p.acciones[1].dia, "2026-10-14");
  assert.equal(diasHastaSiPaso("2026-10-07", "MIERCOLES"), 7); assert.equal(diasHastaSiPaso("2026-10-07", "mañana"), 1);
});
prueba("una actividad se cambia de día borrando y volviendo a crear su marca (la regla no deja editarla)", () => {
  const a = fs.readFileSync("agenda.js", "utf8");
  const f = a.slice(a.indexOf("export async function reprogramarActividad"), a.indexOf("const formMover"));
  assert.ok(f.indexOf("deleteDoc(F.doc(db, \"marcas\", id))") < f.indexOf("setDoc(F.doc(db, \"marcas\", id)"));
  assert.match(f, /F\.doc\(db, "agendas", E\.yo\.uid\)/);
});
prueba("las alertas que vienen se ven todas y se editan (día y hora), con avisada en false", () => {
  const p = fs.readFileSync("propone.js", "utf8");
  assert.match(p, /sumarDias\(E\.hoy, 14\)/);
  assert.match(p, /updateDoc\(F\.doc\(db, "alertas", f\.dataset\.alertaForm\), \{ dia: f\.dia\.value, hora: f\.hora\.value, avisada: false \}/);
});

titulo("nucleo-17 · lugares-1: mis lugares y dónde estoy (7-oct)");
prueba("el país sale de la ubicación aproximada: Uruguay por su recuadro, si no Brasil", () => {
  assert.equal(paisDe(-34.78, -55.76), "UY");      // Costa de Oro
  assert.equal(paisDe(-34.9, -56.16), "UY");       // Montevideo
  assert.equal(paisDe(-27.43, -48.46), "BR");      // Florianópolis
  assert.equal(paisDe(NaN, 1), "");
});
prueba("un lugar se anota una vez, sin dirección, y a la IA van sólo los que la tienen y la casa del país", () => {
  assert.deepEqual(lugarNuevo({}, "Intendencia de Atlántida"), ["intendencia-de-atlantida", { nombre: "Intendencia de Atlántida", direccion: "" }]);
  assert.equal(lugarNuevo({ "intendencia-de-atlantida": {} }, "INTENDENCIA de atlantida"), null);
  assert.equal(lugarNuevo({}, "  "), null);
  const ia = lugaresParaIA({ a: { nombre: "A", direccion: "calle 1" }, b: { nombre: "B", direccion: "" } }, { UY: "casa uy", BR: "casa br" }, "BR");
  assert.deepEqual(ia, { lugares: [{ nombre: "A", direccion: "calle 1" }], casa: { pais: "Brasil", direccion: "casa br" } });
  assert.deepEqual(lugaresParaIA({}, {}, ""), { lugares: [] });
  assert.equal(claveLugar("Marindía"), "marindia");
});
prueba("las direcciones viven en agendas/{uid} (sólo su dueño), y la ubicación no se guarda", () => {
  const l = fs.readFileSync("lugares.js", "utf8");
  assert.match(l, /F\.doc\(db, "agendas", E\.yo\.uid\)/);
  assert.ok(!/F\.(collection|doc)\(db, "(?!agendas)/.test(l), "ninguna otra colección");
  assert.ok(!/latitude[^\n]*(setDoc|guardar)/.test(l), "la ubicación no se guarda");
  assert.match(fs.readFileSync("firestore.rules", "utf8"), /match \/agendas\/\{uid\} \{\s*allow read, write: if esPersona\(\) && request\.auth\.uid == uid;/);
});

titulo("v11 · app-18: Claude organiza la agenda de quien lo enciende (8-oct)");
prueba("el permiso es de cada uno, está en SU agenda y lo apaga cuando quiere", () => {
  const l = fs.readFileSync("lugares.js", "utf8");
  assert.match(l, /guardar\(\{ agente: i\.checked \}\)/);
  assert.match(fs.readFileSync("app.js", "utf8"), /E\.agenteAgenda = d\.exists\(\) && d\.data\(\)\.agente === true/);
  assert.match(fs.readFileSync("agenda.js", "utf8"), /pintarAgente\(v\)/);
});
{ const reglas = fs.readFileSync("firestore.rules", "utf8");
prueba("reglas v11: el agente lee y edita una agenda SÓLO si su dueño lo encendió, y no toca el permiso ni los lugares", () => {
  const ag = /match \/agendas\/\{uid\} \{([\s\S]*?)\n    \}/.exec(reglas)[1];
  assert.match(ag, /allow get: if esAgente\(\) && resource\.data\.get\('agente', false\) == true;/);
  assert.ok(!/allow (read|list)[^;]*esAgente/.test(ag.split("match /copias")[0]), "el agente no lista agendas");
  const up = /allow update: if esAgente\(\)([^;]*);/.exec(ag)[1];
  assert.match(up, /request\.resource\.data\.get\('agente', false\) == true/);
  assert.match(up, /affectedKeys\(\)\.hasOnly\(\['actividades', 'items', 'actualizadoEn'\]\)/);
  assert.ok(!/allow (create|delete)[^;]*esAgente/.test(ag.split("match /copias")[0]), "el agente no crea ni borra agendas");
});
prueba("reglas v11: la copia de «antes» de lo privado va a agendas/{uid}/copias, que lee su dueño, y nadie la edita", () => {
  const co = /match \/copias\/\{id\} \{([\s\S]*?)\n      \}/.exec(reglas)[1];
  assert.match(co, /allow read: if \(esPersona\(\) && request\.auth\.uid == uid\) \|\| \(esAgente\(\) && agenteEn\(uid\)\);/);
  assert.match(co, /allow create: if esAgente\(\) && agenteEn\(uid\);/);
  assert.ok(!/allow (update|delete|write)/.test(co));
});
prueba("reglas v11: Claude mueve marcas de la agenda firmando como él, nunca una salida ni una de otro", () => {
  const ma = /match \/marcas\/\{id\} \{([\s\S]*?)\n    \}/.exec(reglas)[1];
  const cr = /allow create: if esAgente\(\)([^;]*);/.exec(ma)[1];
  for (const x of [/marcadoPor == request\.auth\.uid/, /origen == 'agenda'/, /agenteEn\(request\.resource\.data\.uid\)/, /hasOnly/])
    assert.match(cr, x);
  assert.ok(!/neutro/.test(cr), "«salimos juntos» no la pone Claude");
  assert.match(ma, /allow delete: if esAgente\(\) && resource\.data\.origen == 'agenda' && agenteEn\(resource\.data\.uid\);/);
});
}
prueba("lo que movió Claude dice ✨ y por qué; si la persona lo vuelve a mover, el ✨ se va", () => {
  const ag = fs.readFileSync("agenda.js", "utf8");
  assert.match(ag, /a\.claude && a\.claude\.porque/);
  assert.match(ag, /claude: F\.deleteField\(\)/);
});

titulo("nucleo-18 · agenda-8: el ＋ de cada día y «¿ya existe?» (8-oct)");
prueba("«¿ya existe?»: por palabras con sentido, sin acentos ni plurales; lo distinto no aparece", () => {
  const c = [{ titulo: "Dentista Flor" }, { titulo: "Odontólogo" }, { titulo: "Baja del auto" }, { titulo: "Tornillos 5x50" }];
  assert.deepEqual(parecidas("odontologo", c).map((x) => x.titulo), ["Odontólogo"]);
  assert.deepEqual(parecidas("dar de baja el auto", c).map((x) => x.titulo), ["Baja del auto"]);
  assert.deepEqual(parecidas("comprar tornillo 5x50", c).map((x) => x.titulo), ["Tornillos 5x50"]);
  assert.deepEqual(parecidas("pintar la casa", c), []);
  assert.deepEqual(parecidas("de la", c), []);
});
prueba("el ＋ de un día: escribir primero, preguntar si ya existe, y agendar en ESE día", () => {
  const a = fs.readFileSync("agenda.js", "utf8");
  const h = a.slice(a.indexOf("function pintarHoja"), a.indexOf("function pintarMesAgenda"));
  assert.ok(h.indexOf("Escribí la actividad") < h.indexOf("O elegí de lo que ya tenés"), "escribir va primero");
  assert.match(h, /parecidas\(hoja\.texto, candidatas\(\)\)/);
  assert.match(h, /No, agregar una nueva/);
  assert.match(h, /guardarEnAgenda\("f:" \+ r\.id, \{ dia \}\)/);
  assert.match(a, /data-agregar-dia="\$\{d\}"/);
  assert.ok(!/<h2>Para agendar<\/h2>/.test(a), "ya no hay lista fija");
});

titulo("Lo demás");
prueba("la semana empieza el lunes", () => {
  const { desdeMs } = semanaDe(new Date(2026, 8, 30, 15).getTime());   // miércoles 30-sep
  assert.equal(new Date(desdeMs).getDay(), 1);
  assert.equal(new Date(desdeMs).getDate(), 28);
});
prueba("fmtHoras y esc", () => {
  assert.equal(fmtHoras(1.5), "1 h 30");
  assert.equal(esc("<b>"), "&lt;b&gt;");
});

titulo("Las fechas (un día es un texto)");
prueba("sumar días cruza meses y años, y no se corre con el cambio de hora", () => {
  assert.equal(sumarDias("2026-09-30", 1), "2026-10-01");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  let d = "2026-01-01"; for (let i = 0; i < 365; i++) d = sumarDias(d, 1);
  assert.equal(d, "2027-01-01");
});
prueba("el lunes de un domingo es el de SEIS días antes, no el siguiente", () => {
  assert.equal(lunesDe("2026-10-04"), "2026-09-28");   // domingo
  assert.equal(lunesDe("2026-09-28"), "2026-09-28");   // lunes
  assert.equal(semanaISO("2026-09-28")[6], "2026-10-04");
});
prueba("la grilla del mes son semanas enteras de lunes a domingo", () => {
  const g = grillaDelMes(2026, 9);                        // octubre 2026
  assert.equal(g[0][0], "2026-09-28");
  assert.ok(g.every((s) => s.length === 7));
  assert.ok(g.flat().includes("2026-10-31"));
  assert.equal(isoDe(new Date(2026, 9, 5, 23, 59).getTime()), "2026-10-05");
});

titulo("Con quién están los chicos");
const PATRON = { "1": { m: ["k1"], f: ["k2"] }, "3": { f: ["k1", "k2"] } };
prueba("lo acordado para ese día de la semana", () => {
  assert.deepEqual(chicosDelDia("2026-09-28", PATRON, {}), { m: ["k1"], f: ["k2"] });   // lunes
  assert.deepEqual(chicosDelDia("2026-09-29", PATRON, {}), {});                          // martes: nada
});
prueba("un cambio puntual manda sobre lo acordado, y sólo para quien nombra", () => {
  const r = chicosDelDia("2026-09-28", PATRON, { "2026-09-28": { m: ["k1", "k2"] } });
  assert.deepEqual(r, { m: ["k1", "k2"], f: ["k2"] });
});
prueba("«ese día no los tengo» también es un acuerdo: lista vacía borra a esa persona", () => {
  const r = chicosDelDia("2026-09-28", PATRON, { "2026-09-28": { f: [] } });
  assert.deepEqual(r, { m: ["k1"] });
});
prueba("un campo que no es una persona (la nota) no aparece como persona", () => {
  assert.deepEqual(chicosDelDia("2026-09-29", {}, { "2026-09-29": { nota: "x", m: ["k1"] } }), { m: ["k1"] });
});

titulo("Las actividades de los chicos");
const EVS = [
  { id: "b", titulo: "Básquet", fecha: "2026-09-29", hora: "18:00", semanal: true, excepto: ["2026-10-13"] },
  { id: "p", titulo: "Psicóloga", fecha: "2026-10-01", hora: "10:00" },
  { id: "k", titulo: "Kung fu", fecha: "2026-09-29", hora: "09:00", semanal: true, hasta: "2026-10-06" },
  { id: "roto", titulo: "sin fecha" },
];
prueba("una semanal aparece el mismo día de cada semana desde su fecha", () => {
  assert.deepEqual(eventosDelDia("2026-10-06", EVS).map((e) => e.id), ["k", "b"]);
  assert.deepEqual(eventosDelDia("2026-09-22", EVS), []);            // antes de empezar
  assert.deepEqual(eventosDelDia("2026-10-07", EVS), []);            // otro día de la semana
});
prueba("se ordenan por hora, «este día no» la saca y «hasta» la termina", () => {
  assert.deepEqual(eventosDelDia("2026-10-13", EVS), []);
  assert.deepEqual(eventosDelDia("2026-10-20", EVS).map((e) => e.id), ["b"]);
});
prueba("una de una sola vez, sólo su día; y una sin fecha no rompe nada", () => {
  assert.deepEqual(eventosDelDia("2026-10-01", EVS).map((e) => e.id), ["p"]);
  assert.deepEqual(eventosDelDia("2026-10-08", EVS), []);
});

titulo("Lo cotidiano");
prueba("la lista de Mauro está entera", () => {
  const ids = COTIDIANAS.map((c) => c.id);
  for (const x of ["desayuno", "almuerzo", "merienda", "cena", "basura", "cuartos", "lavado", "doblado"]) assert.ok(ids.includes(x), x);
});
prueba("una observación sin tilde no cuenta como hecha", () => {
  assert.deepEqual(progresoDia({ desayuno: { hecho: true }, cena: { nota: "sólo fruta" }, almuerzo: { hecho: false, nota: "x" } }),
    { listos: 1, total: COTIDIANAS.length });
  assert.equal(progresoDia(undefined).listos, 0);
});

titulo("Quién se ocupa, y pedirle al otro");
prueba("«me ocupo yo» es un clic que pone o saca, sin tocar al otro", () => {
  assert.deepEqual(alternarEncargado({ encargados: ["f"] }, "m"), ["f", "m"]);
  assert.deepEqual(alternarEncargado({ encargados: ["f", "m"] }, "m"), ["f"]);
  assert.deepEqual(alternarEncargado({}, "m"), ["m"]);
});
prueba("un pedido es de uno al otro, y una tarea personal no se pide", () => {
  assert.throws(() => pedir({ alcance: "comun" }, "m", "m"));
  assert.throws(() => pedir({ alcance: "personal" }, "m", "f"));
  const p = pedir({ alcance: "comun" }, "m", "f", "¿podés?", 5);
  assert.deepEqual(p, { de: "m", a: "f", texto: "¿podés?", estado: "pendiente", enMs: 5 });
});
prueba("aceptar pasa la tarea: queda quien acepta y sale quien la pidió; devolver no cambia nada", () => {
  const t = { encargados: ["m", "x"], pedido: { de: "m", a: "f", estado: "pendiente" } };
  assert.deepEqual(responderPedido(t, "f", true).encargados, ["x", "f"]);
  assert.equal(responderPedido(t, "f", false).pedido.estado, "devuelto");
  assert.deepEqual(responderPedido(t, "f", false).encargados, ["m", "x"]);
});
prueba("sólo contesta el pedido aquel a quien se lo pidieron, y una sola vez", () => {
  const t = { pedido: { de: "m", a: "f", estado: "pendiente" } };
  assert.throws(() => responderPedido(t, "m", true));
  assert.throws(() => responderPedido({ pedido: { ...t.pedido, estado: "aceptado" } }, "f", true));
});
prueba("los pedidos para mí son los pendientes y sin hacer", () => {
  const ts = [{ id: 1, pedido: { a: "f", estado: "pendiente" } }, { id: 2, hecho: true, pedido: { a: "f", estado: "pendiente" } },
              { id: 3, pedido: { a: "f", estado: "aceptado" } }, { id: 4, pedido: { a: "m", estado: "pendiente" } }];
  assert.deepEqual(pedidosPara(ts, "f").map((t) => t.id), [1]);
});

titulo("La pizarra de la semana");
prueba("una meta sin terminar sigue la semana siguiente, marcada como de antes", () => {
  const ts = [{ id: "a", titulo: "A", meta: "2026-09-21" }, { id: "b", titulo: "B", meta: "2026-09-21", hecho: true },
              { id: "c", titulo: "C", meta: "2026-09-28" }, { id: "d", titulo: "D", meta: "2026-10-05" }, { id: "e", titulo: "E" }];
  const m = metasDeLaSemana(ts, "2026-09-28");
  assert.deepEqual(m.map((t) => t.id), ["a", "c"]);
  assert.equal(m[0].deAntes, true); assert.equal(m[1].deAntes, false);
});
prueba("las hechas de la semana quedan, abajo", () => {
  const m = metasDeLaSemana([{ id: "x", titulo: "A", meta: "2026-09-28", hecho: true }, { id: "y", titulo: "Z", meta: "2026-09-28" }], "2026-09-28");
  assert.deepEqual(m.map((t) => t.id), ["y", "x"]);
});

titulo("Mi agenda");
const IT = [{ clave: "f:1", titulo: "Uno" }, { clave: "f:2", titulo: "Dos" }, { clave: "cv:3", titulo: "Tres" },
            { clave: "f:4", titulo: "Hecha", hecho: true }, { clave: "f:5", titulo: "Fuera" }, { clave: "f:6", titulo: "Vieja" }];
prueba("sin día flota en hoy; con día va a su día y franja; lo hecho no aparece", () => {
  const ag = { "f:1": {}, "f:2": { dia: "2026-10-01", franja: "tarde" }, "cv:3": { dia: "2026-09-30", hora: "20:30" }, "f:4": { dia: "2026-09-29" } };
  const { dias } = ubicarEnSemana(IT, ag, "2026-09-29", "2026-09-28");
  assert.equal(dias["2026-09-29"].manana[0].clave, "f:1"); assert.equal(dias["2026-09-29"].manana[0].flota, true);
  assert.equal(dias["2026-10-01"].tarde[0].clave, "f:2");
  assert.equal(dias["2026-09-30"].noche[0].clave, "cv:3");
  assert.equal(Object.values(dias).flatMap((d) => [...d.manana, ...d.tarde, ...d.noche]).length, 3);
});
prueba("lo agendado para una semana anterior no se pierde: aparece como «de antes»", () => {
  const { atrasadas } = ubicarEnSemana(IT, { "f:6": { dia: "2026-09-20" } }, "2026-09-29", "2026-09-28");
  assert.deepEqual(atrasadas.map((x) => x.clave), ["f:6"]);
  const otra = ubicarEnSemana(IT, { "f:6": { dia: "2026-09-20" } }, "2026-09-29", "2026-10-05");
  assert.deepEqual(otra.atrasadas, []);
});
prueba("la franja sale de la hora si no se eligió", () => {
  assert.equal(franjaDe({ hora: "09:00" }), "manana"); assert.equal(franjaDe({ hora: "15:00" }), "tarde");
  assert.equal(franjaDe({ hora: "19:30" }), "noche"); assert.equal(franjaDe({ franja: "noche", hora: "09:00" }), "noche");
  assert.equal(franjaDe({}), "manana"); assert.equal(franjaDe({ franja: "cualquiera" }), "manana");
});

titulo("Los relojes: la tarea es una, los chicos van en paralelo");
prueba("estar con los chicos no ocupa el lugar del reloj de tarea", () => {
  const r = separarEnCurso([{ id: "c", estado: "en_curso", registro: "cuidado" }, { id: "t", estado: "en_curso", registro: "cronometro" },
                            { id: "v", estado: "finalizada" }]);
  assert.equal(r.tarea.id, "t"); assert.equal(r.cuidado.id, "c");
  assert.deepEqual(separarEnCurso([]), { tarea: null, cuidado: null });
});

titulo("El balance del tiempo (la regla del 29-sep)");
const h = (n) => n * 3600000;
const I = (uid, a, b, clase, ninos = 0) => ({ uid, desdeMs: h(a), hastaMs: h(b), clase, ninos });
prueba("semana de trabajo afuera: uno produce, el otro con los dos chicos → neutro, nadie gasta cupo", () => {
  const r = balanceTiempo({ uids: ["m", "f"], totalNinos: 2, intervalos: [I("m", 0, 100, "productivo"), I("f", 0, 100, "chicos", 2)] });
  assert.equal(r.por.m.carga, 100); assert.equal(r.por.f.carga, 100);
  assert.equal(r.por.m.liberado, 0); assert.equal(r.por.f.liberado, 0);
  assert.equal(r.masLiberado, null);
});
prueba("uno con los dos chicos y el otro SIN tarea productiva: al otro se le cuenta tiempo liberado", () => {
  const r = balanceTiempo({ uids: ["m", "f"], totalNinos: 2, intervalos: [I("f", 0, 5, "chicos", 2), I("m", 3, 5, "productivo")] });
  assert.equal(r.por.m.liberado, 3); assert.equal(r.por.m.carga, 2);
  assert.equal(r.masLiberado, "m"); assert.equal(r.diferencia, 3);
});
prueba("con UNO solo de los chicos no libera al otro: tiene que ser con los dos", () => {
  const r = balanceTiempo({ uids: ["m", "f"], totalNinos: 2, intervalos: [I("f", 0, 5, "chicos", 1)] });
  assert.equal(r.por.m.liberado, 0);
});
prueba("estar con los chicos mientras se hace otra cosa ya es carga, y no cuenta doble", () => {
  const r = balanceTiempo({ uids: ["m", "f"], totalNinos: 2, intervalos: [I("m", 0, 4, "chicos", 2), I("m", 1, 3, "productivo")] });
  assert.equal(r.por.m.carga, 4); assert.equal(r.por.m.productivo, 2); assert.equal(r.por.m.conChicos, 4);
});
prueba("el cupo se gasta en algo personal SIN los chicos; con los chicos no se gasta", () => {
  const r = balanceTiempo({ uids: ["m", "f"], totalNinos: 2, intervalos: [I("m", 0, 2, "libre"), I("f", 0, 2, "libre"), I("f", 0, 2, "chicos", 1)] });
  assert.equal(r.por.m.liberado, 2); assert.equal(r.por.f.liberado, 0); assert.equal(r.por.f.carga, 2);
});
prueba("sólo cuenta lo que cae en el rango pedido", () => {
  const r = balanceTiempo({ uids: ["m"], totalNinos: 2, intervalos: [I("m", 0, 10, "productivo")], desdeMs: h(8), hastaMs: h(20) });
  assert.equal(r.por.m.carga, 2);
});
prueba("sin chicos cargados, nadie libera a nadie por estar «con todos»", () => {
  const r = balanceTiempo({ uids: ["m", "f"], totalNinos: 0, intervalos: [I("f", 0, 5, "chicos", 0)] });
  assert.equal(r.por.m.liberado, 0);
});

titulo("Los acuerdos de tiempo (bloques)");
const B = { uid: "m", clase: "productivo", desde: "2026-10-06T08:00", hasta: "2026-10-10T20:00" };
prueba("antes es un acuerdo, durante está en curso, después espera a los dos", () => {
  assert.equal(estadoBloque(B, ["m", "f"], msDeLocal("2026-10-01T10:00")), "acordado");
  assert.equal(estadoBloque(B, ["m", "f"], msDeLocal("2026-10-07T10:00")), "en curso");
  assert.equal(estadoBloque(B, ["m", "f"], msDeLocal("2026-10-11T10:00")), "por confirmar");
  assert.equal(estadoBloque({ ...B, confirmaciones: { m: true } }, ["m", "f"], msDeLocal("2026-10-11T10:00")), "por confirmar");
  assert.equal(estadoBloque({ ...B, confirmaciones: { m: true, f: true } }, ["m", "f"], msDeLocal("2026-10-11T10:00")), "confirmado");
  assert.equal(estadoBloque({ ...B, confirmaciones: { m: true, f: false } }, ["m", "f"], msDeLocal("2026-10-11T10:00")), "no se cumplió");
  assert.equal(estadoBloque({ ...B, hasta: "2026-10-01T00:00" }, ["m"], 0), "mal cargado");
});
prueba("sólo un bloque confirmado entra al balance; a cada uno se le pide el suyo", () => {
  const ahora = msDeLocal("2026-10-11T10:00");
  const ivs = intervalosDe({ bloques: [B, { ...B, uid: "f", clase: "chicos", ninos: ["a", "b"], confirmaciones: { m: true, f: true } }], uids: ["m", "f"], ahoraMs: ahora });
  assert.equal(ivs.length, 1); assert.equal(ivs[0].uid, "f"); assert.equal(ivs[0].ninos, 2);
  assert.equal(bloquesPorConfirmar([B], "f", ["m", "f"], ahora).length, 1);
  assert.equal(bloquesPorConfirmar([{ ...B, confirmaciones: { f: true } }], "f", ["m", "f"], ahora).length, 0);
});
prueba("los relojes se traducen: cuidado → chicos, producción → productivo, personal → libre, casa → nada", () => {
  const ivs = intervalosDe({ ahoraMs: h(10), sesiones: [
    { uid: "m", registro: "cuidado", ninos: ["a", "b"], estado: "en_curso", inicioMs: h(8) },
    { uid: "m", tipo: "produccion", estado: "finalizada", inicioMs: h(1), finMs: h(3) },
    { uid: "m", tipo: "personal", estado: "finalizada", inicioMs: h(4), horas: 1 },
    { uid: "m", tipo: "casa", estado: "finalizada", inicioMs: h(5), horas: 1 }] });
  assert.deepEqual(ivs.map((i) => i.clase), ["chicos", "productivo", "libre"]);
  assert.equal(ivs[0].hastaMs, h(10)); assert.equal(ivs[0].ninos, 2); assert.equal(ivs[2].hastaMs, h(5));
});

titulo("La plata");
prueba("un movimiento sin monto, moneda, fecha o categoría no pasa, y la categoría tiene que ir con el tipo", () => {
  assert.deepEqual(validarMovimiento({ monto: 10, moneda: "BRL", fecha: "2026-09-29", categoria: "comida", tipo: "salio" }), []);
  assert.equal(validarMovimiento({ monto: 0, moneda: "EUR", fecha: "ayer", categoria: "x" }).length, 4);
  assert.equal(validarMovimiento({ monto: 5, moneda: "BRL", fecha: "2026-09-29", categoria: "ingreso", tipo: "salio" }).length, 1);
});
prueba("lo disponible es por moneda, y separa lo de mantenimiento, chicos y personal", () => {
  const d = disponible([
    { monto: 1000, moneda: "BRL", fecha: "2026-09-01", categoria: "ingreso" },
    { monto: 200, moneda: "BRL", fecha: "2026-09-02", categoria: "comida" },
    { monto: 50, moneda: "BRL", fecha: "2026-09-03", categoria: "actividades" },
    { monto: 30, moneda: "BRL", fecha: "2026-09-04", categoria: "personal" },
    { monto: 3000, moneda: "UYU", fecha: "2026-09-04", categoria: "ingreso" },
    { monto: 99, moneda: "EUR", fecha: "2026-09-04", categoria: "comida" },
    { monto: 10, moneda: "BRL", fecha: "2026-08-31", categoria: "comida" }], { desde: "2026-09-01" });
  assert.equal(d.BRL.saldo, 720); assert.equal(d.BRL.mantenimiento, 200); assert.equal(d.BRL.chicos, 50); assert.equal(d.BRL.personal, 30);
  assert.equal(d.UYU.saldo, 3000); assert.equal(d.EUR, undefined);
});
prueba("un pago automático pide confirmación pasado su día, una vez por mes", () => {
  const R = [{ id: "luz", titulo: "Luz", monto: 150, moneda: "BRL", dia: 10, categoria: "casa" }, { id: "net", dia: 30, monto: 1, moneda: "BRL" }];
  assert.deepEqual(automaticosPendientes(R, [], "2026-09-09").map((x) => x.id), []);
  assert.deepEqual(automaticosPendientes(R, [], "2026-09-10").map((x) => x.id), ["luz"]);
  assert.deepEqual(automaticosPendientes(R, [], "2026-09-28").map((x) => x.id), ["luz", "net"]);   // el 30 se pide el 28
  assert.deepEqual(automaticosPendientes(R, [{ automatico: "luz", fecha: "2026-09-10" }], "2026-09-12").map((x) => x.id), []);
  assert.deepEqual(automaticosPendientes([{ ...R[0], activo: false }], [], "2026-09-12"), []);
  assert.deepEqual(automaticosPendientes([{ ...R[0], saltados: ["2026-09"] }], [], "2026-09-12"), []);
});
prueba("lo que lee la IA se toma con desconfianza: lo que no entiende queda vacío", () => {
  const a = leerSugerencia('```json\n{"monto":"R$ 1.234,50","moneda":"brl","fecha":"2026-09-28","comercio":"Mercado","categoria":"comida"}\n```');
  assert.equal(a.monto, 1234.5); assert.equal(a.moneda, "BRL"); assert.equal(a.categoria, "comida");
  const b = leerSugerencia('{"monto":"doce","moneda":"EUR","fecha":"ayer","categoria":"vicios"}');
  assert.deepEqual([b.monto, b.moneda, b.fecha, b.categoria], ["", "", "", ""]);
  assert.equal(leerSugerencia("no pude leer la boleta"), null);
  assert.equal(leerSugerencia('{"monto":"12.50"}').monto, 12.5);
});
prueba("las categorías cubren el reparto: entro, mantenimiento, chicos y personal", () => {
  const r = new Set(Object.values(CATEGORIAS).map((c) => c.reparto));
  for (const x of ["entro", "mantenimiento", "chicos", "personal"]) assert.ok(r.has(x), x);
});

titulo("La auditoría");
prueba("encuentra relojes olvidados, gastos sin boleta, acuerdos sin confirmar y días vacíos", () => {
  const out = auditar({ hoy: "2026-09-29", uids: ["m", "f"], ahoraMs: msDeLocal("2026-10-11T10:00"),
    sesiones: [{ estado: "en_curso", inicioMs: msDeLocal("2026-10-10T08:00"), nombre: "Mauro" }, { estado: "finalizada", horas: 14, nombre: "Flor" },
               { registro: "cuidado", ninos: [], estado: "finalizada", horas: 1 }],
    movs: [{ categoria: "comida", monto: 5, detalle: "" }], bloques: [B], dias: { "2026-09-28": { hechos: { cena: { hecho: true } } } } });
  const temas = out.map((x) => x.tema);
  for (const t of ["relojes", "plata", "acuerdos", "cotidiano", "chicos"]) assert.ok(temas.includes(t), t);
  assert.ok(out.some((x) => /6 sin ninguna/.test(x.texto)));
});
prueba("con todo en orden no inventa nada", () => {
  const dias = {}; for (let i = 1; i <= 7; i++) dias[sumarDias("2026-09-29", -i)] = { hechos: { cena: { hecho: true } } };
  assert.deepEqual(auditar({ hoy: "2026-09-29", dias, movs: [{ categoria: "comida", comprobanteUrl: "x", detalle: "pan" }] }), []);
});

titulo("El globo de sugerencias");
prueba("va al mismo circuito de los sitios: reportes/, en estado nuevo, con tipo", () => {
  const src = fs.readFileSync("sugerir.js", "utf8");
  assert.ok(/F\.collection\(db, "reportes"\)/.test(src));
  assert.ok(/estado: "nuevo"/.test(src));
  assert.ok(/tipo: modo/.test(src));
});
prueba("la nota dice ANTES de mandar que contesta una IA, cuándo y qué viaja", () => {
  const src = fs.readFileSync("sugerir.js", "utf8");
  const nota = /class="gris nota-ia">([\s\S]*?)<\/p>/.exec(src)[1];
  for (const x of ["una IA", "cada mañana", "panel", "hasta un día", "tu nombre"]) assert.ok(nota.includes(x), x);
});
prueba("un pedido tiene urgencia y una falla gravedad, nunca al revés", () => {
  const src = fs.readFileSync("sugerir.js", "utf8");
  assert.ok(/pedido: \{[^}]*campo: "urgencia"/.test(src));
  assert.ok(/falla:  \{[^}]*campo: "gravedad"/.test(src));
});
prueba("el agente puede leer una tarea que no existe: su historial la lee antes de crearla", () => {
  const r = fs.readFileSync("firestore.rules", "utf8");
  assert.ok(/esAgente\(\) && \(resource == null \|\| resource\.data\.alcance == 'comun'\)/.test(r));
});
prueba("un hijo de algo borrado en Casa Verde no aparece: se mira la rama entera", () => {
  assert.ok(/const borrada = \(a\) =>/.test(fs.readFileSync("app.js", "utf8")));
});
prueba("la regla de reportes exige que el uid sea el de quien escribe", () => {
  const b = /match \/reportes\/\{id\} \{([\s\S]*?)\n    \}/.exec(fs.readFileSync("firestore.rules", "utf8"))[1];
  assert.ok(/request\.resource\.data\.uid == request\.auth\.uid/.test(b));
  assert.ok(/estado == 'nuevo'/.test(b));
  assert.ok(!/allow (update|delete)/.test(b));
});

titulo("La pantalla, el HTML y las reglas");
const html = fs.readFileSync("index.html", "utf8");
const MODULOS = ["app.js", "agenda.js", "familia.js", "estado.js", "plata.js", "balance.js", "sugerir.js", "compras.js", "propone.js", "pizarra.js", "deseos.js", "lugares.js"];
const app = MODULOS.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const reglas = fs.readFileSync("firestore.rules", "utf8");
prueba("cada id que buscan las vistas existe en index.html", () => {
  const ids = [...app.matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]);
  // Un id puede nacer en el HTML, en una plantilla (id="x") o en un
  // createElement con Object.assign ({ id: "x" }).
  const faltan = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`) && !app.includes(`id="${id}"`) && !app.includes(`id: "${id}"`));
  assert.deepEqual(faltan, []);
});
prueba("los tipos del HTML, de las reglas y de nucleo.js son los mismos", () => {
  const delHtml = [...html.matchAll(/<option value="(\w+)">/g)].map((m) => m[1]).sort();
  const deReglas = /t in \[([^\]]+)\]/.exec(reglas)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1)).sort();
  assert.deepEqual(delHtml, Object.keys(TIPOS).sort());
  assert.deepEqual(deReglas, Object.keys(TIPOS).sort());
});
prueba("las reglas no traen un mail ni un UID real: el repositorio es público", () => {
  assert.ok(!/@[\w-]+\.\w/.test(reglas.replace(/\/\/.*$/gm, "")), "hay un mail");
  assert.ok(!/uid == '[A-Za-z0-9]{20,}'/.test(reglas), "hay un UID real");
});
prueba("el SDK es la misma versión que el de Casa Verde (si está al lado)", () => {
  const mio = /firebasejs\/([\d.]+)\//.exec(fs.readFileSync("firebase-init.js", "utf8"))[1];
  const cv = path.join("..", "casaverdecanas", "interno", "firebase-init.js");
  if (!fs.existsSync(cv)) { console.log("      (no está casaverdecanas al lado: no se compara)"); return; }
  assert.equal(mio, /firebasejs\/([\d.]+)\//.exec(fs.readFileSync(cv, "utf8"))[1]);
});
prueba("todo lo del SHELL del service worker existe", () => {
  const sw = fs.readFileSync("sw.js", "utf8");
  const shell = JSON.parse(/SHELL = (\[[^\]]+\])/.exec(sw)[1].replace(/'/g, '"'));
  for (const f of shell) if (f !== "./") assert.ok(fs.existsSync(f.split("?")[0]), f);
});
prueba("la app no escribe nada de Casa Verde por su cuenta: sólo por su núcleo, y la agenda de cada uno", () => {
  assert.ok(!/CV\.mod\.(addDoc|setDoc|updateDoc|deleteDoc)/.test(app));
  // La única escritura propia es la agenda (`estado_usuario/{uid}.agenda`),
  // la misma que ordena la agenda de Casa Verde. Nada más.
  const escrituras = [...app.matchAll(/M\.(addDoc|setDoc|updateDoc|deleteDoc)\(([^;]*)/g)];
  assert.equal(escrituras.length, 1, "hay otra escritura directa a Casa Verde");
  assert.ok(/estado_usuario/.test(escrituras[0][2]) && /agenda:/.test(escrituras[0][2]));
});
prueba("cada colección que usa la app tiene su regla (deny por defecto)", () => {
  const usadas = new Set([...app.matchAll(/F\.(?:doc|collection)\(db, "(\w+)"/g)].map((m) => m[1]));
  for (const c of usadas) assert.ok(new RegExp(`match /${c}/`).test(reglas), c);
});
prueba("la lista de los chicos no está escrita en el código: vive en la base", () => {
  // Sin nombrarlos acá: este archivo también es público. Lo que se busca es
  // una lista de chicos escrita a mano, con nombre, en cualquier archivo.
  const todo = app + html + fs.readFileSync("nucleo.js", "utf8");
  assert.ok(!/ninos\s*[:=]\s*\[\s*\{[^\]]*nombre\s*:\s*["'`]/.test(todo));
});
prueba("todos los módulos que carga la app están en el SHELL del service worker", () => {
  const sw = fs.readFileSync("sw.js", "utf8");
  for (const f of MODULOS.concat(["nucleo.js", "firebase-init.js"])) assert.ok(sw.includes(`"${f}`), f);
});

titulo("Lo que pidió Mauro el 30-sep (nucleo-4 · app-8)");
prueba("cada comida tiene su vajilla al lado, y cuenta en el día", () => {
  for (const c of ["desayuno", "almuerzo", "merienda", "cena"]) {
    const v = COTIDIANAS.find((x) => x.junto === c);
    assert.ok(v && v.grupo === "comidas", c);
  }
  assert.equal(progresoDia({ "cena-vajilla": { hecho: true } }).listos, 1);
});
prueba("las cotidianas propias se suman en orden; las rotas o las que pisan una de siempre, no", () => {
  const l = cotidianasDe({ b: { nombre: "Regar", grupo: "casa", orden: 2 }, a: { nombre: "Perro", grupo: "casa", orden: 1 },
    x: { nombre: "", grupo: "casa" }, y: { nombre: "Otra", grupo: "cualquiera" }, cena: { nombre: "Pisada", grupo: "comidas" } });
  assert.deepEqual(l.filter((c) => c.propia).map((c) => c.id), ["a", "b"]);
  assert.equal(l.find((c) => c.id === "cena").nombre, "Cena");
  assert.equal(cotidianasDe(undefined).length, COTIDIANAS.length);
  assert.deepEqual(progresoDia({ a: { hecho: true } }, l), { listos: 1, total: COTIDIANAS.length + 2 });
});
prueba("la lista de compras: lo que falta primero, cuenta lo que falta, ignora lo roto", () => {
  const ls = listasDeCompras({ listas: {
    f: { nombre: "Ferretería", orden: 2, items: { t: { texto: "tornillos", hecho: true }, c: { texto: "cinta", orden: 5 } } },
    s: { nombre: "Súper", orden: 1, items: { v: { texto: "  " }, l: { texto: "leche", orden: 1 }, p: { texto: "pan", orden: 2 } } },
    roto: { items: {} } } });
  assert.deepEqual(ls.map((l) => l.id), ["s", "f"]);
  assert.deepEqual(ls[0].items.map((i) => i.texto), ["leche", "pan"]);
  assert.deepEqual(ls[1].items.map((i) => i.texto), ["cinta", "tornillos"]);
  assert.equal(ls[1].faltan, 1);
  assert.deepEqual(listasDeCompras(undefined), []);
});
prueba("el color del proyecto lo heredan las de adentro, salvo que tengan el suyo; sin ciclos", () => {
  const [rojo, azul] = [COLORES_TAREA[0], COLORES_TAREA[5]];
  const porId = { p: { id: "p", color: rojo }, h: { id: "h", parentId: "p" }, n: { id: "n", parentId: "h", color: azul },
    raro: { id: "raro", color: "javascript:alert(1)" }, c1: { id: "c1", parentId: "c2" }, c2: { id: "c2", parentId: "c1" } };
  assert.equal(colorHeredado(porId.h, porId), rojo);
  assert.equal(colorHeredado(porId.n, porId), azul);
  assert.equal(colorHeredado(porId.raro, porId), null);
  assert.equal(colorHeredado(porId.c1, porId), null);
});
prueba("dos ids nuevos en el mismo milisegundo no chocan", () => {
  assert.notEqual(idNuevo("c", 5), idNuevo("c", 5));
});
prueba("no se pueden agregar chicos desde la app, y el reloj ofrece ambos y todos juntos", () => {
  const fam = fs.readFileSync("familia.js", "utf8");
  assert.ok(!/data-form-nino/.test(fam));
  assert.ok(/Todos juntos/.test(app) && /Ambos/.test(app) && /juntos/.test(app));
});
prueba("modo súper: pasillos en su orden, lo tildado NO se mueve, sin pasillo al final", () => {
  const [l] = listasDeCompras({ listas: { m: { nombre: "Macro", orden: 1,
    secciones: { s2: { nombre: "Almacén", orden: 2 }, s1: { nombre: "Lácteos", orden: 1 }, vacia: { nombre: "Bebidas", orden: 3 }, rota: { orden: 4 } },
    items: { a: { texto: "Leche", seccion: "s1", orden: 1, hecho: true }, b: { texto: "Huevo", seccion: "s1", orden: 2 },
      c: { texto: "Yerba", seccion: "s2", orden: 1, nota: "la de siempre" }, d: { texto: "Pilas", orden: 9 }, e: { texto: "Té", seccion: "borrada", orden: 3 } } } } });
  assert.deepEqual(l.secciones.map((x) => x.nombre), ["Lácteos", "Almacén", "Bebidas"]);
  const r = recorridoDeCompra(l);
  assert.deepEqual(r.map((g) => g.nombre), ["Lácteos", "Almacén", "Otras cosas"]);
  assert.deepEqual(r[0].items.map((i) => i.texto), ["Leche", "Huevo"]);
  assert.equal(r[1].items[0].nota, "la de siempre");
  assert.deepEqual(r[2].items.map((i) => i.texto), ["Té", "Pilas"]);
  assert.equal(l.faltan, 4);
  const [sin] = listasDeCompras({ listas: { x: { nombre: "Ferretería", items: { a: { texto: "cinta" } } } } });
  assert.deepEqual(sin.secciones, []);
  assert.deepEqual(recorridoDeCompra(sin).map((g) => g.items.length), [1]);
});
prueba("el modo súper destilda sin borrar y pide la pantalla encendida sin depender de ella", () => {
  const c = fs.readFileSync("compras.js", "utf8");
  assert.ok(/\[i\.id, \{ hecho: false \}\]/.test(c));
  assert.ok(/wakeLock/.test(c) && /catch \{ despierta = null; \}/.test(c));
});
prueba("de a dos (compras-3): el enlace abre la lista en modo súper y dice quién tildó", async () => {
  const c = fs.readFileSync("compras.js", "utf8");
  assert.ok(/\?super=\$\{encodeURIComponent\(id\)\}/.test(c));
  assert.ok(/nombreDe\(it\.por\)/.test(c) && /it\.por !== E\.yo\.uid/.test(c));
  assert.ok(/params\.get\("super"\)/.test(app) && /abrirSuper\(/.test(app));
  assert.ok(/history\.replaceState\(null, "", location\.pathname\)/.test(app));
});
prueba("la lista de compras vive en familia/, que ya tiene su regla", () => {
  assert.ok(/F\.doc\(db, "familia", "compras"\)/.test(app));
  assert.ok(/match \/familia\//.test(reglas));
});

titulo("Todos juntos y las salidas en días (nucleo-6)");
const L = (t) => msDeLocal("2026-10-06T" + t);
const M = (uid, clase, d, h, extra = {}) => ({ uid, clase, desde: "2026-10-06T" + d, hasta: "2026-10-06T" + h, ...extra });
const bal = (marcas, sesiones = [], opc = {}) => balanceTiempo({ uids: ["m", "f"], totalNinos: 2,
  intervalos: [...intervalosDe({ sesiones }), ...intervalosDeMarcas(marcas)], ...opc });
const S = (uid, unidad, fecha, extra = {}) => ({ id: uid + unidad + fecha + (extra.franja || ""), ...marcaDeSalida({ uid, unidad, fecha, marcadoPor: uid, ...extra }) });
const U = ["m", "f"];
prueba("«todos juntos» lo marque quien lo marque es ½ y ½, y nadie libera", () => {
  const s = [{ uid: "m", registro: "cuidado", juntos: true, tipo: "ninos", ninos: ["a", "b"], estado: "finalizada", inicioMs: L("10:00"), finMs: L("14:00") }];
  const r = bal([], s);
  assert.equal(r.por.m.carga, 2); assert.equal(r.por.f.carga, 2);
  assert.equal(r.por.m.liberado + r.por.f.liberado, 0);
});
prueba("si los dos marcan «todos juntos» a la vez, no se cuenta dos veces", () => {
  const x = (uid) => ({ uid, registro: "cuidado", juntos: true, estado: "finalizada", inicioMs: L("10:00"), finMs: L("14:00") });
  const r = bal([], [x("m"), x("f")]);
  assert.equal(r.por.m.carga, 2); assert.equal(r.por.f.carga, 2);
});
prueba("una noche vale ½ día, un día entero 1, un rato ¼", () => {
  assert.equal(UNIDADES_SALIDA.noche.vale, 0.5); assert.equal(UNIDADES_SALIDA.dia.vale, 1); assert.equal(UNIDADES_SALIDA.rato.vale, 0.25);
  const n = S("m", "noche", "2026-10-06");
  assert.equal(n.desde, "2026-10-06T20:00"); assert.equal(n.hasta, "2026-10-07T07:00", "la noche no marca la vuelta");
});
prueba("dos noches de uno equiparan un día entero del otro", () => {
  const r = saldoSalidas([S("m", "noche", "2026-10-06"), S("m", "noche", "2026-10-08"), S("f", "dia", "2026-10-10")], U);
  assert.equal(r.por.m.dias, 1); assert.equal(r.por.f.dias, 1); assert.equal(r.aFavor, null);
});
prueba("al que salió menos le queda la diferencia a favor", () => {
  const r = saldoSalidas([S("m", "noche", "2026-10-06"), S("m", "noche", "2026-10-08")], U);
  assert.equal(r.aFavor, "f"); assert.equal(r.diferencia, 1);
});
prueba("la misma noche marcada por los dos vale una vez; día entero y noche del mismo día, 1", () => {
  const a = { ...S("f", "noche", "2026-10-06"), id: "a", marcadoPor: "f" };
  const b = { ...S("f", "noche", "2026-10-06"), id: "b", marcadoPor: "m" };
  const r = saldoSalidas([a, b], U);
  assert.equal(r.por.f.dias, 0.5); assert.equal(r.por.f.salidas[0].marcadas, 2);
  assert.equal(saldoSalidas([S("f", "dia", "2026-10-06"), S("f", "noche", "2026-10-06")], U).por.f.dias, 1);
  assert.equal(saldoSalidas([S("f", "rato", "2026-10-06", { franja: "manana" }), S("f", "noche", "2026-10-06")], U).por.f.dias, 0.75, "un rato a la mañana y la noche son dos cosas");
});
prueba("salir juntos es neutro, aunque uno la haya marcado como propia", () => {
  const r = saldoSalidas([S("*", "noche", "2026-10-06"), S("m", "noche", "2026-10-06")], U);
  assert.equal(r.por.m.dias, 0); assert.equal(r.por.m.salidas[0].motivo, "salieron juntos");
});
prueba("si ese día los chicos no estaban, la salida no acumula", () => {
  const r = saldoSalidas([S("m", "noche", "2026-10-06"), S("m", "noche", "2026-10-07")], U, { conChicos: (d) => d !== "2026-10-06" });
  assert.equal(r.por.m.dias, 0.5);
});
prueba("sólo cuenta lo del período", () => {
  const r = saldoSalidas([S("m", "noche", "2026-09-30"), S("m", "noche", "2026-10-06")], U, { desde: "2026-10-01", hasta: "2026-11-01" });
  assert.equal(r.por.m.dias, 0.5);
});
prueba("de la agenda se deduce: desde las 20 es noche, 10 horas o más es un día, si no un rato", () => {
  assert.equal(unidadDe(M("m", "libre", "21:00", "23:00")), "noche");
  assert.equal(unidadDe({ desde: "2026-10-06T09:00", hasta: "2026-10-06T20:00" }), "dia");
  assert.equal(unidadDe(M("m", "libre", "10:00", "12:00")), "rato");
  assert.equal(unidadDe({ unidad: "dia", desde: "2026-10-06T10:00", hasta: "2026-10-06T11:00" }), "dia", "si vino escrita, manda");
});
prueba("al barrido de horas van el trabajo y los chicos de la agenda; lo libre se cuenta en días", () => {
  const r = bal([M("m", "productivo", "09:00", "17:00"), M("f", "libre", "09:00", "12:00")]);
  assert.equal(r.por.m.carga, 8); assert.equal(r.por.f.liberado, 0);
});
prueba("una marca rota no entra, y se dice por qué", () => {
  assert.deepEqual(validarMarca(M("m", "libre", "10:00", "12:00"), U), []);
  assert.ok(validarMarca(M("x", "libre", "10:00", "12:00"), U).length);
  assert.ok(validarMarca(M("m", "neutro", "10:00", "12:00"), U).length, "neutro es de los dos");
  assert.ok(validarMarca(M("m", "libre", "12:00", "10:00"), U).length);
  assert.ok(validarMarca({ ...M("m", "libre", "10:00", "12:00"), unidad: "semana" }, U).length);
  assert.deepEqual(validarMarca(S("*", "noche", "2026-10-06"), U), []);
});
prueba("avisa antes de guardar si esa persona ya tiene una marca que se pisa", () => {
  const ya = [{ id: "a", ...M("f", "libre", "20:00", "23:00") }, { id: "b", ...M("m", "libre", "20:00", "23:00") }];
  assert.deepEqual(marcasQueSePisan(M("f", "libre", "22:00", "23:30"), ya).map((x) => x.id), ["a"]);
  assert.deepEqual(marcasQueSePisan(M("f", "libre", "23:00", "23:30"), ya), []);
});
prueba("en la agenda la clase es obligatoria y cada una dice qué es para el balance", () => {
  assert.deepEqual(Object.keys(CLASES_ACTIVIDAD).sort(), ["ninos", "personal", "tarea", "trabajo"]);
  for (const c of Object.values(CLASES_ACTIVIDAD)) assert.ok(["productivo", "chicos", "libre"].includes(c.clase));
});
prueba("una marca nunca lleva el título de la actividad: lo garantiza la regla y no lo manda la agenda", () => {
  const bloque = /match \/marcas\/\{id\} \{[\s\S]*?\n    \}/.exec(reglas)[0];
  assert.ok(/hasOnly\(\[[^\]]*\]\)/.test(bloque));
  assert.ok(!/titulo/.test(/hasOnly\(\[[^\]]*\]\)/.exec(bloque)[0]));
  const ag = fs.readFileSync("agenda.js", "utf8");
  const marca = /const marca = \{[^}]*\}/.exec(ag)[0];
  assert.ok(!/titulo/.test(marca), "la marca de la agenda no lleva el título");
});
prueba("en la agenda no se guarda una actividad sin clase", () => {
  const ag = fs.readFileSync("agenda.js", "utf8");
  assert.ok(/if \(!CLASES_ACTIVIDAD\[tipo\]\) return aviso/.test(ag));
  assert.ok(/type="radio" name="tipo"[^>]*required/.test(ag));
});

titulo("nucleo-19 · app-19: las finanzas de la familia (tiempos:V9, 8-oct)");
const LUZ = { nombre: "Luz", categoria: "casa", monto: 3000, moneda: "UYU", cada: 1, mes: 1, pais: "UY" };
const PATENTE = { nombre: "Patente", categoria: "vehiculos", monto: 6000, moneda: "UYU", cada: 3, mes: 1, pais: "UY" };
const SEGURO = { nombre: "Seguro", categoria: "vehiculos", monto: 24000, moneda: "UYU", cada: 12, mes: 3 };
const LOCAL = { nombre: "Alquiler del local", categoria: "negocio_gasto", monto: 1000, moneda: "UYU", cada: 1, mes: 1 };
prueba("un concepto: nombre, de qué gasto, monto (0 = sin estimar), moneda, cada cuánto y desde qué mes", () => {
  assert.deepEqual(validarConcepto(LUZ), []);
  assert.deepEqual(validarConcepto({ ...LUZ, monto: 0 }), []);
  assert.ok(validarConcepto({ ...LUZ, monto: "" }).length);
  assert.ok(validarConcepto({ ...LUZ, categoria: "honorarios" }).length, "un ingreso no es un gasto del año");
  assert.ok(validarConcepto({ ...LUZ, cada: 5 }).length);
  assert.ok(validarConcepto({ ...LUZ, mes: 13 }).length);
  assert.ok(validarConcepto({ ...LUZ, moneda: "EUR" }).length);
  assert.ok(validarConcepto({ ...LUZ, total: -1 }).length);
});
prueba("vence: todos los meses, cada tres desde enero, una vez al año en marzo; y respeta desde/hasta y pausado", () => {
  assert.ok(vence(LUZ, "2026-10"));
  assert.deepEqual(["2026-01", "2026-02", "2026-04", "2026-10", "2026-11"].map((m) => vence(PATENTE, m)), [true, false, true, true, false]);
  assert.deepEqual(["2026-03", "2027-03", "2026-04"].map((m) => vence(SEGURO, m)), [true, true, false]);
  assert.ok(!vence({ ...LUZ, hasta: "2026-09" }, "2026-10"));
  assert.ok(!vence({ ...LUZ, desde: "2026-11" }, "2026-10"));
  assert.ok(!vence({ ...LUZ, activo: false }, "2026-10"));
});
prueba("el año: cada concepto cuesta monto × 12 / cada, y la reserva del mes es el año ÷ 12 SIN el negocio", () => {
  assert.equal(anualDe(LUZ), 36000); assert.equal(anualDe(PATENTE), 24000); assert.equal(anualDe(SEGURO), 24000);
  const p = presupuestoAnual({ a: LUZ, b: PATENTE, c: SEGURO, d: LOCAL, e: { ...LUZ, monto: 0 }, f: { ...LUZ, moneda: "BRL", monto: 100 } });
  assert.equal(p.UYU.total, 96000);
  assert.equal(p.UYU.enLibre, 84000, "los gastos del negocio ya salen de su neto");
  assert.equal(p.UYU.reservaMes, 7000);
  assert.equal(p.UYU.sinEstimar, 1);
  assert.equal(p.BRL.total, 1200, "cada moneda es un sistema aparte");
});
prueba("la planilla: qué se pagó cada mes, qué toca, y cuánto queda de una deuda", () => {
  const ESC = { nombre: "Deuda escuela", categoria: "chicos", monto: 5000, moneda: "UYU", cada: 1, mes: 1, total: 20000 };
  const movs = [{ fijo: "luz", monto: 2900, fecha: "2026-10-05" }, { fijo: "esc", monto: 5000, fecha: "2026-09-10" }, { fijo: "esc", monto: 5000, fecha: "2026-10-10" }];
  const f = fijosDeMeses({ luz: LUZ, esc: ESC, pat: PATENTE }, movs, ["2026-09", "2026-10", "2026-11"]);
  const luz = f.find((x) => x.id === "luz"), esc_ = f.find((x) => x.id === "esc"), pat = f.find((x) => x.id === "pat");
  assert.deepEqual(luz.celdas.map((c) => [c.toca, c.pagado]), [[true, 0], [true, 2900], [true, 0]]);
  assert.deepEqual(pat.celdas.map((c) => c.toca), [false, true, false]);
  assert.deepEqual(esc_.deuda, { total: 20000, queda: 10000 });
});
prueba("sumarMeses y diasDelMes cruzan el año y saben de febrero", () => {
  assert.equal(sumarMeses("2026-12", 1), "2027-01"); assert.equal(sumarMeses("2026-01", -1), "2025-12");
  assert.equal(diasDelMes("2026-02"), 28); assert.equal(diasDelMes("2028-02"), 29); assert.equal(diasDelMes("2026-10"), 31);
});
const MOVS_OCT = [
  { categoria: "honorarios", monto: 50000, moneda: "UYU", fecha: "2026-10-05", uid: "m" },
  { categoria: "honorarios", monto: 30000, moneda: "UYU", fecha: "2026-10-06", uid: "f" },
  { categoria: "negocio", monto: 13000, moneda: "UYU", fecha: "2026-10-30", uid: "m" },
  { categoria: "casa", monto: 2900, moneda: "UYU", fecha: "2026-10-05", uid: "m" },
  { categoria: "personal", monto: 4000, moneda: "UYU", fecha: "2026-10-12", uid: "f" },
  { categoria: "honorarios", monto: 99999, moneda: "UYU", fecha: "2026-09-30", uid: "m" },     // otro mes
];
prueba("el reparto: libre = entró − la reserva del año; mitad y mitad si las salidas están parejas", () => {
  const r = repartoDelMes({ movs: MOVS_OCT, conceptos: { a: LUZ, b: PATENTE, c: SEGURO, d: LOCAL }, mes: "2026-10", uids: ["m", "f"], salidas: { aFavor: null, diferencia: 0 } }).UYU;
  assert.equal(r.entro, 93000); assert.equal(r.reserva, 7000); assert.equal(r.libre, 86000);
  assert.equal(r.porPersona.m.parte, 43000); assert.equal(r.porPersona.f.parte, 43000);
  assert.equal(r.gastoReal, 2900, "lo gastado de verdad se muestra al lado, como control");
});
prueba("lo personal ya lo retiró: se descuenta de SU parte y no de la del otro", () => {
  const r = repartoDelMes({ movs: MOVS_OCT, conceptos: { a: LUZ }, mes: "2026-10", uids: ["m", "f"] }).UYU;
  assert.equal(r.porPersona.f.gastoPersonal, 4000); assert.equal(r.porPersona.f.queda, r.porPersona.f.parte - 4000);
  assert.equal(r.porPersona.m.gastoPersonal, 0);
});
prueba("salidas no equiparadas: quien salió de más le pasa al otro días × (libre ÷ días del mes)", () => {
  const r = repartoDelMes({ movs: MOVS_OCT, conceptos: { a: LUZ, b: PATENTE, c: SEGURO, d: LOCAL }, mes: "2026-10", uids: ["m", "f"], salidas: { aFavor: "f", diferencia: 1.5 } }).UYU;
  assert.equal(r.valorDia, Math.round(86000 / 31 * 100) / 100);
  assert.equal(r.compensa, Math.round(1.5 * r.valorDia * 100) / 100);
  assert.equal(r.aQuien, "f"); assert.equal(r.deQuien, "m");
  assert.equal(Math.round((r.porPersona.f.parte - r.porPersona.m.parte) * 100) / 100, Math.round(2 * r.compensa * 100) / 100);
  assert.equal(Math.round((r.porPersona.f.parte + r.porPersona.m.parte) * 100) / 100, 86000, "no se inventa ni se pierde plata");
});
prueba("la compensación nunca pasa la mitad de quien paga, y sin libre no hay nada que compensar", () => {
  const r = repartoDelMes({ movs: MOVS_OCT, conceptos: {}, mes: "2026-10", uids: ["m", "f"], salidas: { aFavor: "f", diferencia: 40 } }).UYU;
  assert.equal(r.porPersona.m.parte, 0);
  const s = repartoDelMes({ movs: [{ categoria: "casa", monto: 500, moneda: "UYU", fecha: "2026-10-01", uid: "m" }], conceptos: {}, mes: "2026-10", uids: ["m", "f"], salidas: { aFavor: "f", diferencia: 2 } }).UYU;
  assert.ok(s.libre < 0); assert.equal(s.compensa, 0); assert.equal(s.valorDia, 0);
});
prueba("sin gastos del año cargados, la reserva es lo gastado en la casa y los chicos, y se dice", () => {
  const r = repartoDelMes({ movs: MOVS_OCT, conceptos: {}, mes: "2026-10", uids: ["m", "f"] }).UYU;
  assert.equal(r.sinPresupuesto, true); assert.equal(r.reserva, 2900);
});
prueba("las monedas no se mezclan en el reparto", () => {
  const r = repartoDelMes({ movs: [...MOVS_OCT, { categoria: "ingreso", monto: 100, moneda: "BRL", fecha: "2026-10-02", uid: "m" }], conceptos: { a: LUZ }, mes: "2026-10", uids: ["m", "f"] });
  assert.equal(r.BRL.entro, 100); assert.equal(r.UYU.entro, 93000);
});
prueba("toda la noche afuera vale un día; la noche que vuelve sigue valiendo ½", () => {
  assert.equal(UNIDADES_SALIDA.toda.vale, 1); assert.equal(UNIDADES_SALIDA.noche.vale, 0.5);
  const t = marcaDeSalida({ uid: "m", unidad: "toda", fecha: "2026-10-10", marcadoPor: "m" });
  assert.equal(t.desde, "2026-10-10T20:00"); assert.equal(t.hasta, "2026-10-11T12:00"); assert.deepEqual(validarMarca(t, ["m"]), []);
  const r = saldoSalidas([{ ...t, id: "x" }], ["m", "f"]);
  assert.equal(r.por.m.dias, 1);
});
prueba("las categorías nuevas: honorarios y neto del negocio entran; vehículos e impuestos son mantenimiento; el negocio no resta", () => {
  assert.equal(CATEGORIAS.honorarios.tipo, "entro"); assert.equal(CATEGORIAS.negocio.tipo, "entro");
  assert.equal(CATEGORIAS.vehiculos.reparto, "mantenimiento"); assert.equal(CATEGORIAS.impuestos.reparto, "mantenimiento");
  assert.equal(CATEGORIAS.negocio_gasto.reparto, "negocio");
  const d = disponible([{ categoria: "negocio_gasto", monto: 10, moneda: "UYU", fecha: "2026-10-01" }]);
  assert.equal(d.UYU.negocio, 10); assert.equal(d.UYU.mantenimiento, 0);
});
prueba("la pantalla: el presupuesto y los repartos van en familia/ (mapas), el pago de un fijo es un movimiento con `fijo`", () => {
  const fz = fs.readFileSync("finanzas.js", "utf8"), app = fs.readFileSync("app.js", "utf8"), sw = fs.readFileSync("sw.js", "utf8");
  assert.match(fz, /F\.doc\(db, "familia", "presupuesto"\),\s*\{ conceptos: \{ \[id\]: datos \}/);
  assert.match(fz, /F\.doc\(db, "familia", "repartos"\)/);
  assert.match(fz, /fijo: id, automatico: null, comprobanteUrl: null,\s*origen: "fijo"/);
  assert.ok(!/F\.(collection|doc)\(db, "(?!familia|movimientos)/.test(fz), "finanzas.js no escribe en otra colección");
  assert.match(app, /F\.doc\(db, "familia", "presupuesto"\)/); assert.match(sw, /"finanzas\.js"/);
});
prueba("las reglas de movimientos ya aceptan el pago de un fijo (monto > 0, moneda, categoría, fecha)", () => {
  const r = fs.readFileSync("firestore.rules", "utf8");
  const mv = /match \/movimientos\/\{id\} \{([\s\S]*?)\n    \}/.exec(r)[1];
  assert.ok(!/hasOnly/.test(mv), "un campo nuevo (`fijo`) no lo rechaza la regla");
  assert.match(r, /match \/familia\/\{doc\} \{\s*allow read, create, update: if esPersona\(\) \|\| esAgente\(\);/);
});

prueba("reglas v12: el buzón de avisos es de su dueño, lo crea sólo el agente con forma fija, y sólo se marca leído", () => {
  const r = fs.readFileSync("firestore.rules", "utf8");
  const b = /match \/avisos\/\{id\} \{([\s\S]*?)\n    \}/.exec(r)[1];
  assert.match(b, /allow read, delete: if esPersona\(\) && resource\.data\.uid == request\.auth\.uid;/);
  assert.match(b, /affectedKeys\(\)\.hasOnly\(\['leido'\]\)/);
  assert.match(b, /allow create: if esAgente\(\)\s*&& request\.resource\.data\.keys\(\)\.hasOnly\(\['uid', 'sitio', 'tema', 'texto', 'creadoEn', 'leido'\]\)/);
  assert.ok(!/allow create: if esPersona/.test(b), "una persona no se crea avisos");
});

titulo("compras-4: la lista compartida sin cuenta (reglas v13)");
prueba("el token: 22 letras url-seguras, al azar, nunca dos iguales", () => {
  const ts = new Set(Array.from({ length: 200 }, () => tokenNuevo()));
  assert.equal(ts.size, 200);
  for (const t of ts) assert.match(t, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(tokenNuevo(() => new Uint8Array(22)), "A".repeat(22));
});
prueba("una lista compartida se lee de su documento, y mientras no llegó se ve vacía (nunca lo viejo)", () => {
  const doc = { listas: { m: { nombre: "Macro", orden: 1, secciones: { s1: { nombre: "Lácteos", orden: 1 } },
    compartida: { token: "T".repeat(22) }, items: { viejo: { texto: "no debería verse" } } } } };
  const [sin] = listasDeCompras(doc);
  assert.deepEqual(sin.items, []);
  assert.deepEqual(sin.compartida, { token: "T".repeat(22), vence: 0, cargada: false });
  const [con] = listasDeCompras(doc, { ["T".repeat(22)]: { vence: { toMillis: () => 1234 },
    items: { a: { texto: "Leche", seccion: "s1", hecho: true, porNombre: "Ana" } } } });
  assert.deepEqual(con.items.map((i) => [i.texto, i.porNombre]), [["Leche", "Ana"]]);
  assert.equal(con.compartida.vence, 1234);
  assert.deepEqual(con.secciones.map((x) => x.nombre), ["Lácteos"]);
  assert.equal(listasDeCompras({ listas: { x: { nombre: "Común", items: {} } } })[0].compartida, null);
});
prueba("al compartir se copia nombre, pasillos y cosas, y vence en 48 h", () => {
  const d = documentoCompartido({ id: "m", nombre: "Macro", secciones: { s: {} }, items: { a: { texto: "x" } } }, "u1", 1000);
  assert.deepEqual(Object.keys(d).sort(), ["creadoPor", "items", "lista", "nombre", "secciones", "venceMs"]);
  assert.equal(d.venceMs, 1000 + 48 * 3600000);
  assert.equal(HORAS_COMPARTIDA, 48);
});
prueba("reglas v13: sin sesión, sólo con el token y antes de que venza; nunca listar; sólo cambiar las cosas", () => {
  const b = /match \/compartidas\/\{token\} \{([\s\S]*?)\n    \}/.exec(reglas)[1];
  assert.match(b, /allow get: if token\.size\(\) >= 20\s*&& \(esPersona\(\) \|\| esAgente\(\) \|\| request\.time < resource\.data\.vence\);/);
  assert.match(b, /allow list: if esPersona\(\) \|\| esAgente\(\);/);
  assert.match(b, /allow update: if request\.time < resource\.data\.vence\s*&& request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['items', 'actualizadoEn'\]\)/);
  assert.match(b, /duration\.value\(8, 'd'\)/);
  assert.match(b, /allow delete: if esPersona\(\);/);
  assert.ok(!/allow (read|write)/.test(b), "nada de read o write en bloque: get y list van separados");
});
prueba("la página pública escribe sólo items y actualizadoEn, y no baja Casa Verde", () => {
  const l = fs.readFileSync("lista.js", "utf8");
  for (const m of l.matchAll(/updateDoc\(ref, \{([^}]*)\}/g))
    for (const k of m[1].match(/\[[^\]]+\]|\b\w+(?=:)/g)) assert.ok(/items|actualizadoEn|^\[k \+/.test(k), "escribe " + k);
  assert.match(l, /const k = "items\." \+ c\.dataset\.item;/);
  assert.match(l, /cargar\(\{ casaVerde: false \}\)/);
  assert.ok(!/setDoc|deleteDoc/.test(l));
  assert.match(fs.readFileSync("lista.html", "utf8"), /<meta name="robots" content="noindex">/);
  assert.ok(!/"lista\.(html|js)/.test(fs.readFileSync("sw.js", "utf8").split("\n").find((x) => x.startsWith("const SHELL"))));
  assert.match(fs.readFileSync("sw.js", "utf8"), /searchParams\.has\("c"\)\) return;/);
});
prueba("Tiempos: mientras está compartida, las cosas se escriben en el documento compartido", () => {
  const c = fs.readFileSync("compras.js", "utf8");
  assert.match(c, /if \(!l\.compartida\) return guardar/);
  assert.ok(!/guardar\(\{ \[lid\]/.test(c), "tildar/sacar no van directo a familia");
  // primero se crea el compartido, después se muda: si falla, no se pierde nada
  assert.ok(c.indexOf("await F.setDoc(refC(token)") < c.indexOf("items: F.deleteField() } }"));
});

titulo("nucleo-22 · sugerir-16: pedirle a la IA cualquier cosa (10-oct)");
const CH = [{ id: "n1", nombre: "Ána" }, { id: "n2", nombre: "Bruno" }];
prueba("los nombres de los chicos se escudan antes de salir y vuelven a la vuelta; una palabra que los contiene no", () => {
  const t = escudarNombres("llevo a ana y a BRUNO al básquet; la banana y Brunoso no", CH);
  assert.equal(t, "llevo a Chico1 y a Chico2 al básquet; la banana y Brunoso no");
  assert.equal(devolverNombres(t, CH), "llevo a Ána y a Bruno al básquet; la banana y Brunoso no");
  assert.equal(devolverNombres("Chico9 sigue", CH), "Chico9 sigue");
  assert.deepEqual(indicesDeChicos(["Chico2", "nadie", "chico 1", "Chico2"]), [1, 0]);
  const ev = chicosParaIA([{ id: "e", titulo: "Básquet de Bruno", fecha: "2026-10-12", semanal: true, ninos: ["n2"] },
    { id: "v", titulo: "Viejo", fecha: "2026-01-01" }], CH, "2026-10-10");
  assert.deepEqual(ev.map((x) => [x.id, x.titulo, x.ninos]), [["e", "Básquet de Chico2", ["Chico2"]]]);
});
prueba("un gasto: el monto no se inventa, y lo que falta lo deja sin guardar y dicho", () => {
  const p = leerPlanIA(JSON.stringify({ acciones: [
    { tipo: "gasto", monto: "850,5", moneda: "UYU", fecha: "2026-10-10", categoria: "salud", comercio: "Farmacia" },
    { tipo: "gasto", monto: 100 }, { tipo: "gasto", detalle: "sin monto" }, { tipo: "gasto", monto: 50, moneda: "EUR", fecha: "2026-10-10", categoria: "inventada" }] }));
  assert.deepEqual(p.acciones.map((a) => [a.monto, a.faltan.length]), [[850.5, 0], [100, 3], [50, 2]]);
  assert.ok(p.dudas.some((d) => /monto/.test(d)));
});
prueba("los chicos: nueva necesita qué y día; cambiar/sacar/saltear necesitan cuál", () => {
  const p = leerPlanIA(JSON.stringify({ acciones: [
    { tipo: "chicos", accion: "nueva", titulo: "Natación", fecha: "2026-10-14", hora: "17:00", semanal: true, ninos: ["Chico1"] },
    { tipo: "chicos", accion: "cambiar", id: "e1", hora: "18:00" }, { tipo: "chicos", accion: "quitar" },
    { tipo: "chicos", accion: "saltar", id: "e1" }, { tipo: "chicos", titulo: "sin día" }, { tipo: "chicos", accion: "borrar-todo", titulo: "X", fecha: "2026-10-14" }] }));
  assert.deepEqual(p.acciones.map((a) => [a.accion, a.id]), [["nueva", ""], ["cambiar", "e1"], ["nueva", ""]]);
  assert.deepEqual(p.acciones[0].ninos, [0]);
  assert.equal(p.acciones[0].semanal, true);
});
prueba("«los chicos» son todos; si nombra a uno, sólo ése (sugerir-17)", () => {
  const sg = fs.readFileSync("sugerir.js", "utf8");
  assert.match(sg, /return ids\.length \? ids : chicosDeLaCasa\(\)\.map\(\(n\) => n\.id\)/);
  assert.match(sg, /semanal: false, ninos: ninosDe\(a\.ninos\)/);
  assert.match(sg, /const ninosIds = ninosDe\(a\.ninos\)/);
  const p = leerPlanIA(JSON.stringify({ acciones: [{ tipo: "actividad", titulo: "Natación", dia: "2026-10-14", hi: "17:00", hf: "18:00", tipo_clase: "ninos", chicos: true, ninos: ["Chico2"] }] }));
  assert.deepEqual(p.acciones[0].ninos, [1]);
});
prueba("mover y sacar de la agenda: con id; mover además con día y hora", () => {
  const p = leerPlanIA(JSON.stringify({ acciones: [{ tipo: "mover", id: "a1", dia: "2026-10-12", hi: "09:00", hf: "10:00" },
    { tipo: "mover", id: "a1", dia: "el lunes" }, { tipo: "quitar", id: "a2" }, { tipo: "quitar" }] }));
  assert.deepEqual(p.acciones.map((a) => a.tipo), ["mover", "quitar"]);
});
prueba("Hacer lo marcado: el gasto va a movimientos SÓLO si no le falta nada, con la sesión de quien dicta", () => {
  const sg = fs.readFileSync("sugerir.js", "utf8");
  const g = sg.slice(sg.indexOf('a.tipo === "gasto") {\n        if'), sg.indexOf('a.tipo === "chicos") {\n        const ninosIds'));
  assert.ok(g.indexOf("a.faltan.length") < g.indexOf('F.collection(db, "movimientos")'));
  assert.match(g, /creadoPor: E\.yo\.uid/);
  // el renglón de un gasto incompleto sale sin poder marcarse
  assert.match(sg, /a\.faltan\.length \? `<input type="checkbox" data-accion="\$\{n\}" disabled>`/);
  // mover y sacar usan lo mismo que la pantalla de Agenda
  assert.match(sg, /reprogramarActividad\(a\.id/);
  assert.match(sg, /await sacarActividad\(a\.id\)/);
  assert.match(fs.readFileSync("agenda.js", "utf8"), /export async function sacarActividad/);
});
prueba("el cuadro es neutro: «Pedile a la IA», en el globo y en la Pizarra", () => {
  const sg = fs.readFileSync("sugerir.js", "utf8"), pz = fs.readFileSync("pizarra.js", "utf8");
  assert.match(sg, /titulo: "Pedile a la IA"/);
  assert.ok(!/titulo: "Para la agenda"/.test(sg));
  assert.match(pz, /✨ Pedile a la IA/);
});
prueba("lo acordado cada semana es una tabla con una columna por persona (familia-4)", () => {
  const fa = fs.readFileSync("familia.js", "utf8");
  const f = fa.slice(fa.indexOf("function acordado()"), fa.indexOf("function listaNinos()"));
  assert.match(f, /<table class="acordado"><thead><tr><th><\/th>\$\{ps\.map\(\(p\) => `<th>\$\{esc\(p\.nombre\)\}<\/th>`/);
  assert.match(f, /data-patron="\$\{w\}\|\$\{esc\(p\.id\)\}\|\$\{esc\(n\.id\)\}"/);
});

titulo("nucleo-24 · plata-7 · sugerir-18: cuentas y consultas (tiempos:V11, 10-oct)");
const CTAS = cuentasDe({ cuentas: { gf: { nombre: "General Flores", clase: "lugar", orden: 1 }, dgf: { nombre: "Depósito", padre: "gf" },
  sf: { nombre: "Santa Fe", clase: "lugar", orden: 2, tareaId: "tSF" }, dsf: { nombre: "Depósito", padre: "sf" }, hx: { nombre: "Hilux", clase: "vehiculo", orden: 3 },
  rota: { nombre: "Huérfana", padre: "nada" }, vieja: { nombre: "Vieja", baja: true }, raro: { nombre: "X", clase: "nave" } } });
prueba("las cuentas: cada lugar con sus partes abajo; la de baja no se ofrece; padre roto = cuenta propia", () => {
  assert.deepEqual(CTAS.filter((c) => ["gf", "dgf", "sf", "dsf", "hx"].includes(c.id)).map((c) => c.ruta),
    ["General Flores", "General Flores › Depósito", "Santa Fe", "Santa Fe › Depósito", "Hilux"]);
  assert.ok(!CTAS.some((c) => c.id === "vieja"));
  assert.equal(CTAS.find((c) => c.id === "rota").nivel, 0);
  assert.equal(CTAS.find((c) => c.id === "raro").clase, "proyecto");
  assert.deepEqual([...idsDeCuenta(CTAS, "gf")].sort(), ["dgf", "gf"]);
});
prueba("una cuenta se encuentra por lo dicho; si es ambigua, ninguna", () => {
  assert.equal(cuentaPorNombre(CTAS, "general flores"), "gf");
  assert.equal(cuentaPorNombre(CTAS, "el depósito de General Flores"), "dgf");
  assert.equal(cuentaPorNombre(CTAS, "santa fe deposito"), "dsf");
  assert.equal(cuentaPorNombre(CTAS, "la Hilux"), "hx");
  assert.equal(cuentaPorNombre(CTAS, "depósito"), null);
  assert.equal(cuentaPorNombre(CTAS, "pisquito"), null);
});
prueba("el balance: por moneda y categoría, nunca mezcla monedas, y dice lo que falta", () => {
  const movs = [{ monto: 1000, moneda: "UYU", fecha: "2026-09-03", categoria: "materiales", cuenta: "dgf" },
    { monto: 500, moneda: "USD", fecha: "2026-09-10", categoria: "alquileres", cuenta: "gf", comprobanteUrl: "x" },
    { monto: 200, moneda: "UYU", fecha: "2026-11-01", categoria: "jornales", cuenta: "gf" },
    { monto: 9, moneda: "UYU", fecha: "2026-09-01", categoria: "comida" }, { monto: 7, moneda: "ARS", fecha: "2026-09-01", categoria: "materiales", cuenta: "gf" }];
  const b = balanceDe(movs, { cuentas: idsDeCuenta(CTAS, "gf"), desde: "2026-09-01", hasta: "2026-11-30" });
  assert.deepEqual(b.porMoneda.UYU, { entro: 0, salio: 1200, saldo: -1200, porCategoria: { materiales: -1000, jornales: -200 } });
  assert.deepEqual(b.porMoneda.USD, { entro: 500, salio: 0, saldo: 500, porCategoria: { alquileres: 500 } });
  assert.ok(!b.porMoneda.ARS, "una moneda que no está no entra");
  assert.deepEqual(b.faltan, ["2 gasto(s) sin boleta", "sin ningún registro en 2026-10"]);
  assert.equal(balanceDe(movs, { cuentas: new Set(["dgf"]) }).lista.length, 1);
  assert.equal(balanceDe(movs, { categorias: ["comida"] }).lista.length, 1);
});
prueba("las actividades de un chico: las suyas y las de los dos; las de mi agenda con los chicos", () => {
  const n = [{ id: "a", nombre: "A" }, { id: "b", nombre: "B" }];
  const ev = [{ titulo: "Natación", fecha: "2026-10-12", semanal: true, ninos: ["a"] }, { titulo: "Cumple", fecha: "2026-10-13", ninos: [] },
    { titulo: "Fútbol", fecha: "2026-10-14", ninos: ["b"] }, { titulo: "Plaza", fecha: "2026-10-15", ninos: ["a", "b"] }];
  const r = actividadesDeChicos({ eventos: ev, actividades: { x: { dia: "2026-10-13", tipo: "ninos", titulo: "Parque", desde: "2026-10-13T17:00" } },
    ninos: n, desde: "2026-10-12", hasta: "2026-10-19", nino: "a" });
  assert.deepEqual(r.map((x) => [x.dia, x.titulo, x.de]), [["2026-10-12", "Natación", "A"], ["2026-10-13", "Cumple", "los dos"],
    ["2026-10-13", "Parque", "con vos"], ["2026-10-15", "Plaza", "los dos"], ["2026-10-19", "Natación", "A"]]);
});
prueba("las horas por cuenta salen de la tarea raíz de la cuenta", () => {
  const tareas = [{ id: "tSF" }, { id: "t1", parentId: "tSF" }, { id: "t2" }];
  const ses = [{ uid: "u", horas: 2, tareaId: "t1", inicioMs: Date.parse("2026-10-02T12:00") }, { uid: "u", horas: 1, tareaId: "t2", inicioMs: Date.parse("2026-10-02T12:00") },
    { uid: "v", horas: 3, tareaId: "tSF", inicioMs: Date.parse("2026-09-02T12:00") }];
  const h = horasPorCuenta(ses, tareas, CTAS, { desde: "2026-10-01", hasta: "2026-10-31" });
  assert.equal(h.total, 3); assert.deepEqual(h.porCuenta, { sf: 2, "": 1 });
  assert.equal(horasPorCuenta(ses, tareas, CTAS, { cuenta: "sf" }).total, 5);
});
prueba("una consulta no se registra: no tiene casilla y «Hacer lo marcado» la saltea", () => {
  const p = leerPlanIA(JSON.stringify({ acciones: [{ tipo: "consulta", que: "balance", cuenta: "General Flores", desde: "2026-09-01", hasta: "2026-09-30", categorias: ["materiales", "inventada"] }, { tipo: "consulta", que: "nada" }] }));
  assert.equal(p.acciones.length, 1);
  assert.deepEqual(p.acciones[0].categorias, ["materiales"]);
  const sg = fs.readFileSync("sugerir.js", "utf8");
  assert.match(sg, /\.filter\(\(a\) => a && a\.tipo !== "consulta"\)/);
  assert.match(sg, /if \(a\.tipo === "consulta"\) return respuestaHTML\(a, n\)/);
  // los números los calcula la app; la IA sólo explica, sin sumar monedas
  assert.match(sg, /balanceDe\(E\.movs/);
  assert.match(sg, /nunca sumes reales, pesos y dólares/);
  assert.match(sg, /escudarNombres\(`Pregunta:/);
});
prueba("un gasto lleva su cuenta y para quién; el formulario de Plata también", () => {
  const p = leerPlanIA(JSON.stringify({ acciones: [{ tipo: "gasto", monto: 3000, moneda: "UYU", fecha: "2026-10-10", categoria: "jornales", cuenta: "General Flores", para: "yo" }] }));
  assert.equal(p.acciones[0].cuenta, "General Flores");
  const sg = fs.readFileSync("sugerir.js", "utf8"), pl = fs.readFileSync("plata.js", "utf8");
  assert.match(sg, /cuenta: a\.cuenta \? cuentaPorNombre\(cuentasDe\(E\.cuentasDoc\), a\.cuenta\) \|\| "" : "", para: paraDe\(a\.para\)/);
  assert.match(pl, /cuenta: f\.cuenta \? f\.cuenta\.value : "", para: f\.para \? f\.para\.value : ""/);
  assert.match(pl, /F\.doc\(db, "familia", "cuentas"\)/);
  assert.ok(/match \/familia\//.test(reglas), "familia ya tiene su regla: no hizo falta otra");
});

titulo("nucleo-25 · plata-8 · sugerir-19: el cierre del mes y el análisis de Claude");
prueba("el cierre: cerrado si los números son los mismos, «cambio» si algo entró o salió después", () => {
  const movs = [{ monto: 1000, moneda: "UYU", fecha: "2026-09-03", categoria: "materiales", cuenta: "dgf" },
    { monto: 500, moneda: "USD", fecha: "2026-09-10", categoria: "alquileres", cuenta: "gf" }, { monto: 9, moneda: "UYU", fecha: "2026-10-01", categoria: "materiales", cuenta: "gf" }];
  const b = balanceDelMes(movs, CTAS, "gf", "2026-09");
  assert.equal(b.lista.length, 2, "el lugar suma su depósito, sólo ese mes");
  assert.equal(balanceDelMes(movs, CTAS, "dgf", "2026-09").lista.length, 1, "el depósito, solo");
  const g = { firma: firmaBalance(b) };
  assert.equal(estadoCierre(null, b), "abierto");
  assert.equal(estadoCierre(g, b), "cerrado");
  assert.equal(estadoCierre(g, balanceDelMes([...movs, { monto: 1, moneda: "UYU", fecha: "2026-09-20", categoria: "jornales", cuenta: "gf" }], CTAS, "gf", "2026-09")), "cambio");
  assert.equal(estadoCierre(g, balanceDelMes([...movs, { monto: 1, moneda: "UYU", fecha: "2026-11-20", categoria: "jornales", cuenta: "gf" }], CTAS, "gf", "2026-09")), "cerrado", "otro mes no lo toca");
});
prueba("cerrar escribe familia/cierres con la firma; el análisis va a reportes con `analisis` y vuelve como propuesta «analisis»", () => {
  const pl = fs.readFileSync("plata.js", "utf8"), sg = fs.readFileSync("sugerir.js", "utf8"), pr = fs.readFileSync("propone.js", "utf8");
  assert.match(pl, /F\.doc\(db, "familia", "cierres"\), \{ cierres: \{ \[id\]: \{ \[mes\]: \{ firma: firmaBalance\(bal\)/);
  assert.match(sg, /\.\.\.\(c\.analisis \? \{ analisis: c\.analisis \} : \{\}\)/);
  assert.match(pr, /CLASES_PROPONE = \["agenda", "consulta", "analisis"\]/);
  assert.match(pr, /decidir\(b\.dataset\.propLeido, "aprobada"\)/);
  assert.match(app, /F\.where\("clase", "==", "analisis"\)/);
  // la regla de propuestas deja leído = aprobada, y la de reportes no limita los campos
  assert.match(reglas, /request\.resource\.data\.estado in \['aprobada', 'descartada'\]/);
});

titulo("nucleo-26 · finanzas-2: el ajuste trimestral (tiempos:V11, 10-oct)");
const CONC = { luz: { nombre: "UTE", monto: 3000, moneda: "UYU", categoria: "casa", cada: 1, mes: 1 },
  pat: { nombre: "Patente Hilux", monto: 9000, moneda: "UYU", categoria: "vehiculos", cada: 6, mes: 11 },
  neg: { nombre: "Contador CV", monto: 400, moneda: "USD", categoria: "negocio_gasto", cada: 1, mes: 1 },
  seg: { nombre: "Seguro", monto: 0, moneda: "USD", categoria: "vehiculos", cada: 12, mes: 3 }, off: { nombre: "Viejo", monto: 99, moneda: "UYU", categoria: "casa", cada: 1, mes: 1, activo: false } };
const MV = [{ monto: 3200, moneda: "UYU", fecha: "2026-10-05", categoria: "casa", fijo: "luz" }, { monto: 3400, moneda: "UYU", fecha: "2026-11-05", categoria: "casa", fijo: "luz" },
  { monto: 50000, moneda: "UYU", fecha: "2026-10-10", categoria: "trabajos" }, { monto: 1500, moneda: "UYU", fecha: "2026-10-12", categoria: "comida", comercio: "Macro" },
  { monto: 1600, moneda: "UYU", fecha: "2026-09-12", categoria: "comida", comercio: "macro" }, { monto: 1700, moneda: "UYU", fecha: "2026-08-12", categoria: "comida", comercio: "Macro " },
  { monto: 7, moneda: "UYU", fecha: "2027-01-02", categoria: "comida", comercio: "Macro" }];
prueba("los trimestres: cuál es, sus meses, y el de antes y el de después", () => {
  assert.equal(trimestreDe("2026-10"), "2026-T4"); assert.equal(trimestreDe("2026-03"), "2026-T1");
  assert.deepEqual(mesesDelTrimestre("2026-T2"), ["2026-04", "2026-05", "2026-06"]);
  assert.equal(sumarTrimestres("2026-T4", 1), "2027-T1"); assert.equal(sumarTrimestres("2026-T1", -1), "2025-T4");
});
prueba("el ajuste: neto, fijos y otros por moneda; costo de funcionamiento = el Año ÷ 4, sin los gastos del negocio", () => {
  const a = ajusteTrimestral({ conceptos: CONC, movs: MV, trimestre: "2026-T4", hoyMes: "2026-12" });
  assert.deepEqual(a.porMoneda.UYU, { entro: 50000, fijos: 6600, variables: 1500, salio: 8100, neto: 41900, costoEstimado: 13500, netoContraCosto: 36500 });
  assert.equal(a.porMoneda.USD.costoEstimado, 0, "el contador del negocio ya sale del neto de Casa Verde");
  const ute = a.conceptos.find((c) => c.id === "luz");
  assert.deepEqual([ute.vencen, ute.pagos, ute.estimado, ute.real, ute.porVez, ute.sugerido], [3, 2, 9000, 6600, 3300, 3300]);
  assert.ok(!a.conceptos.some((c) => c.id === "off"), "lo pausado no cuenta");
  assert.ok(a.faltan.some((f) => /UTE.*2026-12/.test(f)) && a.faltan.some((f) => /Patente Hilux.*2026-11/.test(f)));
  assert.ok(a.faltan.some((f) => /sin monto estimado/.test(f)));
  // lo que todavía no venció no falta
  assert.ok(!ajusteTrimestral({ conceptos: CONC, movs: MV, trimestre: "2026-T4", hoyMes: "2026-11" }).faltan.some((f) => /2026-12/.test(f)));
});
prueba("se repite y no es fijo: 3 meses de los últimos 6, sin mayúsculas ni espacios; lo que ya es concepto no", () => {
  assert.deepEqual(posiblesFijos(MV, CONC, "2026-12").map((x) => [x.nombre, x.meses, x.porMes]), [["Macro", 3, 1600]]);
  assert.deepEqual(posiblesFijos(MV, { ...CONC, m: { nombre: "MACRO" } }, "2026-12"), []);
  assert.deepEqual(posiblesFijos(MV, CONC, "2026-09"), [], "antes de octubre son sólo 2 meses");
});
prueba("la firma del trimestre cambia si cambia un pago o el monto de un fijo", () => {
  const f = (c, m) => firmaTrimestre(ajusteTrimestral({ conceptos: c, movs: m, trimestre: "2026-T4" }));
  const base = f(CONC, MV);
  assert.equal(base, f(CONC, MV));
  assert.notEqual(base, f({ ...CONC, luz: { ...CONC.luz, monto: 3300 } }, MV));
  assert.notEqual(base, f(CONC, [...MV, { monto: 1, moneda: "UYU", fecha: "2026-12-01", categoria: "comida" }]));
});
prueba("la pantalla del trimestre ajusta el Año con la sesión de quien toca, y confirma en familia/cierres", () => {
  const fi = fs.readFileSync("finanzas.js", "utf8"), pl = fs.readFileSync("plata.js", "utf8");
  assert.match(fi, /guardarConcepto\(id, \{ \.\.\.c, monto: Number\(b\.dataset\.monto\)/);
  assert.match(fi, /trimestres: \{ \[trimestre\]: \{ confirmado: \{ \[E\.yo\.uid\]: \{ firma/);
  assert.match(fi, /que: "trimestre"/);
  assert.match(pl, /trimestre: "Trimestre"/);
});

console.log(`\n  ${pasadas} pasadas, ${fallidas} fallidas\n`);
process.exit(fallidas ? 1 : 0);
