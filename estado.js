// ─────────────────────────────────────────────────────────────────────────────
// estado.js — Lo que comparten las vistas de «tiempos». Sello: estado-3
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
  hoy: isoDe(), diaVisto: isoDe(), vistaTareas: "pizarra",
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

/* Un error de la base se dice con palabras, no con un código. */
export const fallo = (e) => aviso("No se pudo: " + ((e && (e.code || e.message)) || e), true);
