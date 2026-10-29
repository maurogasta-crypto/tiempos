// ─────────────────────────────────────────────────────────────────────────────
// estado.js — Lo que comparten las vistas de «tiempos». Sello: estado-5 (general:C7: los errores con palabras, de errores.js de datos)
//
// Un solo objeto con lo que se sabe (`E`), el aviso de arriba y el gancho para
// volver a dibujar. Las vistas (`app.js`, `agenda.js`, `familia.js`) leen de
// acá y nunca guardan una copia propia: con dos copias del estado, una
// pantalla muestra lo que la otra ya cambió.
// ─────────────────────────────────────────────────────────────────────────────

import { isoDe } from "./nucleo.js";

export const E = {
  yo: null, miembro: null, miembros: [],
  tareas: [], sesionesVivas: [], enCursoFam: null, cuidado: null,
  familia: { ninos: [], patron: {} }, turnos: {}, eventos: [], agenda: {}, actividades: {}, marcas: [], compras: {}, compartidas: {}, cuentasDoc: {}, cierresDoc: {}, analisis: [], extractos: [], conceptos: {}, repartos: {},
  // Casa Verde
  cv: null, cvNombre: "", cvActs: [], enCursoCV: null, cvAgenda: {}, cvNombres: {},
  // Pantalla
  solapa: "pizarra", abierta: null, reloj: null,
  hoy: isoDe(), diaVisto: isoDe(), vistaTareas: "todas",
};

export const $ = (id) => document.getElementById(id);

export function aviso(t, mal = false) {
  const n = $("aviso");
  n.textContent = t; n.className = mal ? "aviso mal" : "aviso";
  n.hidden = !t;
  if (t && !mal) setTimeout(() => { if (n.textContent === t) n.hidden = true; }, 5000);
}

export const ganchos = { pintar: () => {} };
export const repintar = () => ganchos.pintar();

export const nombreDe = (uid) => {
  const m = E.miembros.find((x) => x.id === uid);
  return (m && m.nombre) || (E.miembro && E.miembro.id === uid && E.miembro.nombre) || "—";
};
export const otro = () => E.miembros.find((m) => m.id !== E.yo.uid) || null;
export const personas = () => (E.miembros.length ? E.miembros : [E.miembro]).filter(Boolean);
export const ninoPorId = (id) => (E.familia.ninos || []).find((n) => n.id === id);

/* Un error de la base se dice con palabras, no con un código
   (PROTOCOLO-INTERFAZ § 7.2). Desde estado-5 (29-oct-2026, `general:C7`) las
   palabras salen de `errores.js` del panel (`maurogasta-crypto/datos`), la
   tabla ÚNICA del ecosistema; hasta ese día acá se mostraba el código pelado
   («No se pudo: permission-denied»). Se pide al cargar, diferida y con catch:
   si no bajó, se ve el código como antes, nunca peor. */
let _errores = null;
import("https://maurogasta-crypto.github.io/datos/errores.js").then((m) => { _errores = m; }).catch(() => {});
export const explicar = (e) => (_errores ? _errores.explicar(e) : ((e && (e.code || e.message)) || String(e)));
export const fallo = (e) => aviso("No se pudo: " + explicar(e), true);
