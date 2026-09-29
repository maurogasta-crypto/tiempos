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
         quePuedoArrancar, semanaDe, fmtHoras, esc } from "./nucleo.js";

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

titulo("La pantalla, el HTML y las reglas");
const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const reglas = fs.readFileSync("firestore.rules", "utf8");
prueba("cada id que busca app.js existe en index.html", () => {
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
prueba("la app no escribe nada de Casa Verde por su cuenta: sólo por su núcleo", () => {
  assert.ok(!/CV\.mod\.(addDoc|setDoc|updateDoc|deleteDoc)/.test(app));
  assert.ok(!/M\.(addDoc|setDoc|updateDoc|deleteDoc)/.test(app));
});

console.log(`\n  ${pasadas} pasadas, ${fallidas} fallidas\n`);
process.exit(fallidas ? 1 : 0);
