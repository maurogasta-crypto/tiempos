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
         separarEnCurso } from "./nucleo.js";

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
prueba("carga = producción + mantenimiento + ½ chicos; casa y personal no", () => {
  assert.equal(cargaDe({ produccion: 2, mantenimiento: 1, ninos: 3, casa: 5, personal: 8 }), 4.5);
});
prueba("«con los chicos paso a estar contado en mitad de lo productivo»: el peso es ½", () => {
  assert.equal(TIPOS.ninos.peso, 0.5);
  assert.equal(TIPOS.produccion.peso, 1);
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

titulo("La pantalla, el HTML y las reglas");
const html = fs.readFileSync("index.html", "utf8");
const MODULOS = ["app.js", "agenda.js", "familia.js", "estado.js"];
const app = MODULOS.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const reglas = fs.readFileSync("firestore.rules", "utf8");
prueba("cada id que buscan las vistas existe en index.html", () => {
  const ids = [...app.matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]);
  const faltan = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`) && !app.includes(`id="${id}"`));
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

console.log(`\n  ${pasadas} pasadas, ${fallidas} fallidas\n`);
process.exit(fallidas ? 1 : 0);
