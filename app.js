// ─────────────────────────────────────────────────────────────────────────────
// app.js — La pantalla de «tiempos».
// Sello: app-36
//
// app-26 (10-oct-2026, tiempos:V11): escucha `familia/cierres` y los análisis de Claude.
// app-30 (12-oct-2026, Mauro: «una edición de proyectos y tareas más
//   intuitiva y dinámica, con arrastrar y soltar… cada usuario organiza como le
//   resulta más cómodo»). En «Por categoría» cada tarea, proyecto o grupo tiene
//   su ⠿ y se suelta ADENTRO de otro; los grupos 📂 son propios. El orden es de
//   CADA UNO (`agendas/{uid}.organizar` y `.grupos`, arbolOrganizado de
//   nucleo.js): las tareas son las mismas para los dos. Agregar es un botón que
//   se despliega, y «Adentro de» va agrupado por categoría, con sangría.
// app-29 (11-oct-2026, sugerencias de Florencia desde el globo 💡):
//   · tiempos:A26 — «No hay ninguna tarea corriendo» ya no ocupa todas las
//     pestañas: el reloj aparece sólo cuando algo corre. Y «Estoy con…» vive
//     en Chicos; en las otras pestañas se ve sólo mientras su reloj corre.
//   · tiempos:A25 — al pasar de un campo al botón Guardar del MISMO formulario
//     la pantalla espera: antes se redibujaba en el medio del toque y el
//     Guardar caía sobre un botón que ya no existía.
//   · tiempos:A27 — Tareas: arriba el cuadro para agregar (a la semana o a un
//     día de la agenda), y abajo todo por categoría —Casa Verde adentro de
//     Producción— en árboles que se pliegan; la ficha edita también el título
//     y agenda en un día sin salir de la tarea.
// app-28 (11-oct-2026): el ojo 👁 en las dos contraseñas (la de Tiempos y la de
// Casa Verde), para verlas mientras se tipean. Mismo código que en los otros sitios.
// app-27 (10-oct-2026, tiempos:V12): escucha `extractos` (Plata → Extractos).
// app-25 (10-oct-2026, tiempos:V11): escucha `familia/cuentas` (E.cuentasDoc).
// app-24 (10-oct-2026): sin cambios acá; nucleo-23 y sugerir-17 («los chicos» son todos).
// app-23 (10-oct-2026): sin cambios acá; suben nucleo-22, sugerir-16, agenda-10,
// familia-4, pizarra-web-2 y estilos-17 (pedirle a la IA, lo acordado en columnas).
// app-22 (9-oct-2026): con la lista escucha las compartidas sin cuenta
// (compras-4, `compartidas/{token}`).
// app-21 (9-oct-2026): ?super=<lista> abre Tareas → Compras en modo súper
// (compras-3, el enlace para hacer las compras de a dos).
// app-20 (9-oct-2026): sin cambios acá; sube el sello porque cambian
// compras.js (el modo súper) y estilos.css, que pide index.html.
//
// app-16 (7-oct-2026, tiempos:V7): la primera solapa es PIZARRA (pizarra.js):
// anotar rápido, lo que espera una decisión, la pizarra del teléfono con una
// ventana para elegir por categoría, lo que Claude propone, recordatorios,
// alarmas y deseos. La segunda es TAREAS: el reloj y lo que tomaste (lo que
// era AHORA) arriba, y las listas abajo. AHORA ya no es una solapa.
//
// Antes eran siete solapas (app-4 suma PLATA y cambia HORAS por BALANCE):
//   AHORA   el cronómetro único, los chicos en paralelo, lo que te pidieron, y
//           qué arrancar (familia y Casa Verde, con sus detalles y registros)
//   HOY     lo cotidiano: se tilda, no se cronometra (familia.js)
//   AGENDA  mi semana, ordenada arrastrando (agenda.js)
//   TAREAS  la pizarra de la semana de los dos, y la lista entera
//   CHICOS  con quién están cada día, lo acordado, y sus actividades (familia.js)
//   PLATA   lo disponible, los gastos con su boleta, los pagos automáticos y
//           lo que propone el agente, para aprobar (plata.js)
//   BALANCE la carga y el tiempo liberado de cada uno, los acuerdos de
//           tiempo con su confirmación, las horas por tipo y la auditoría
//           (balance.js)
//
// Las cuentas no viven acá: están en `nucleo.js`, probadas. Esto dibuja y llama.
// Casa Verde entra por su propio código (`CV.Core`), nunca copiado: arrancar
// es `Core.iniciar`, frenar es `Core.finalizar`, tildar es `Core.tildar`.
// Lo ÚNICO que esta app escribe de Casa Verde por su cuenta es la agenda de
// cada uno (`estado_usuario/{uid}.agenda`), con la misma forma que la agenda
// de Casa Verde: así es UNA agenda, se mire desde donde se mire.
// ─────────────────────────────────────────────────────────────────────────────

import { cargar, db, auth, F, CV, errorCasaVerde } from "./firebase-init.js";
import { TIPOS, TIPO_CASA_VERDE, arbolOrganizado, puedeSoltar, tipoHeredado, arbol, fmtHoras, quePuedoArrancar, esc, isoDe, lunesDe, sumarDias,
         alternarEncargado, pedir, responderPedido, pedidosPara, metasDeLaSemana,
         separarEnCurso, chicosDelDia, eventosDelDia,
         COLORES_TAREA, colorHeredado, estaCorriendo, idNuevo, conReloj } from "./nucleo.js";
import { E, $, aviso, ganchos, nombreDe, otro, personas, ninoPorId, fallo } from "./estado.js";
import { pintarAgenda, irAPieza, alternarEnAgenda, estaEnAgenda, guardarEnAgenda, agendaUnida } from "./agenda.js";
import { pintarHoy, pintarChicos, escucharDia } from "./familia.js";
import { pintarPlata, abrirGasto } from "./plata.js";
import { pintarBalance } from "./balance.js";
import { pintarCompras, abrirSuper, escucharCompartidas } from "./compras.js";
import { montarGlobo, abrirConsulta } from "./sugerir.js";
import { pintarPizarra } from "./pizarra.js";

const SOLAPAS = ["pizarra", "tareas", "hoy", "agenda", "chicos", "plata", "balance"];
const mostrar = (id) => { for (const s of ["cargando", "entrar", "acceso", "app"]) $(s).hidden = s !== id; };

/* ── Arranque ─────────────────────────────────────────────────────────────── */
async function arrancar() {
  mostrar("cargando");
  try { await cargar(); }
  catch (e) { $("cargando").innerHTML = `<p class="mal">${esc(e.message)}</p><button onclick="location.reload()">Reintentar</button>`; return; }
  F.onAuthStateChanged(auth, (u) => { E.yo = u; u ? entrarAlaApp() : mostrar("entrar"); });
}

$("form-entrar").onsubmit = async (ev) => {
  ev.preventDefault();
  const mail = $("mail").value.trim(), clave = $("clave").value;
  $("btn-entrar").disabled = true; aviso("");
  try {
    // Casa Verde PRIMERO: entrar a Tiempos dispara el armado de la pantalla,
    // y hasta app-1 eso pasaba antes de que Casa Verde terminara de entrar.
    let cvMal = false;
    if (CV && !CV.mod.auth.currentUser) {
      try { await CV.mod.signInWithEmailAndPassword(CV.mod.auth, mail, clave); }
      catch { cvMal = true; }
    }
    await F.signInWithEmailAndPassword(auth, mail, clave);
    if (cvMal) aviso("Entraste, pero Casa Verde no aceptó esa contraseña: abajo podés probar con la de Casa Verde.", true);
  } catch (e) {
    aviso(e.code === "auth/invalid-credential" ? "Mail o contraseña incorrectos." : "No se pudo entrar: " + e.message, true);
  } finally { $("btn-entrar").disabled = false; $("clave").value = ""; }
};

$("form-cv").onsubmit = async (ev) => {
  ev.preventDefault();
  try {
    await CV.mod.signInWithEmailAndPassword(CV.mod.auth, E.yo.email, $("cv-clave").value);
    $("cv-clave").value = "";
    await conectarCasaVerde();
    aviso("Listo: Casa Verde conectada.");
    pintar();
  } catch (e) {
    aviso(e.code === "auth/invalid-credential" ? `Casa Verde no aceptó esa contraseña para ${E.yo.email}.` : "No se pudo: " + e.message, true);
  }
};

$("olvide").onclick = async () => {
  const mail = $("mail").value.trim();
  if (!mail) return aviso("Escribí tu mail arriba y tocá de nuevo.", true);
  try { await F.sendPasswordResetEmail(auth, mail); aviso("Te mandamos un mail para elegir la contraseña."); }
  catch (e) { aviso("No se pudo: " + e.message, true); }
};

async function entrarAlaApp() {
  const m = await F.getDoc(F.doc(db, "miembros", E.yo.uid)).catch(() => null);
  if (!m || !m.exists()) return pantallaAcceso();
  E.miembro = { id: m.id, ...m.data() };
  mostrar("app");
  $("quien").textContent = E.miembro.nombre || E.yo.email;
  // app-5: el globo 💡 para sugerir algo o avisar una falla (sugerir.js).
  montarGlobo();
  escucharFamilia();
  await conectarCasaVerde();
  pintar();
  // app-14: la app del teléfono (la Pizarra) dicta con el reconocedor de
  // Android —el mismo del micrófono del teclado, que sí anda— y abre Tiempos
  // con ?dictar=<texto>. Se saca de la dirección para que recargar no lo repita.
  const params = new URLSearchParams(location.search);
  const superId = params.get("super");
  if (superId) {
    history.replaceState(null, "", location.pathname);
    E.solapa = "tareas"; E.vistaTareas = "compras";
    for (const x of document.querySelectorAll("[data-solapa]")) x.setAttribute("aria-selected", String(x.dataset.solapa === "tareas"));
    for (const x of document.querySelectorAll("[data-vt]")) x.setAttribute("aria-selected", String(x.dataset.vt === "compras"));
    abrirSuper(superId.slice(0, 60));
    pintar();
  }
  // app-32: el widget de la agenda de la Pizarra abre Tiempos en la Agenda
  // (?solapa=agenda). Sólo una solapa que exista; se saca de la dirección.
  const solapaPedida = params.get("solapa");
  if (solapaPedida && SOLAPAS.includes(solapaPedida)) {
    history.replaceState(null, "", location.pathname);
    E.solapa = solapaPedida;
    // app-33: y desde el widget, la pieza tocada (una alarma lleva a la suya).
    if (solapaPedida === "agenda") irAPieza(params.get("abrir"), params.get("dia"));
    // app-34: y desde el widget de la pizarra, la tarea tocada con su ficha abierta.
    if (solapaPedida === "tareas") irATarea(params.get("abrir"));
    for (const x of document.querySelectorAll("[data-solapa]")) x.setAttribute("aria-selected", String(x.dataset.solapa === solapaPedida));
    pintar();
  }
  // app-36: ?gasto=1 (el $ del widget de la Pizarra) abre la ficha del gasto.
  if (params.get("gasto")) { history.replaceState(null, "", location.pathname); abrirGasto(); }
  const dictado = params.get("dictar");
  if (dictado) {
    history.replaceState(null, "", location.pathname);
    // app-35: lo dictado en la app del teléfono es una PREGUNTA (sugerir-22).
    abrirConsulta(dictado.slice(0, 2000));
  }
  clearInterval(E.reloj);
  E.reloj = setInterval(() => {
    pintarReloj();
    // Pasada la medianoche, «hoy» es otro día: sin esto, la app abierta
    // desde anoche tildaría el desayuno de ayer.
    const h = isoDe();
    if (h !== E.hoy) { if (E.diaVisto === E.hoy) { E.diaVisto = h; escucharDia(); } E.hoy = h; pintar(); }
  }, 1000);
}

/* ── Pedir acceso ─────────────────────────────────────────────────────────────
   Entrar no alcanza: hay que ser MIEMBRO. El primer ingreso deja una
   solicitud y el agente la aprueba creando `miembros/{uid}`. Así ningún mail
   ni UID queda escrito en este repositorio, que es público. */
async function pantallaAcceso() {
  mostrar("acceso");
  const s = await F.getDoc(F.doc(db, "solicitudes", E.yo.uid)).catch(() => null);
  $("acceso-estado").textContent = s && s.exists()
    ? "Tu pedido de acceso ya está hecho. Avisale a Mauro para que lo aprueben."
    : "Todavía no pediste acceso.";
  $("form-acceso").hidden = !!(s && s.exists());
}
$("form-acceso").onsubmit = async (ev) => {
  ev.preventDefault();
  try {
    await F.setDoc(F.doc(db, "solicitudes", E.yo.uid), {
      email: E.yo.email, nombre: $("acceso-nombre").value.trim().slice(0, 40),
      creadoEn: F.serverTimestamp() });
    pantallaAcceso();
  } catch (e) { aviso("No se pudo: " + e.message, true); }
};
for (const b of document.querySelectorAll("[data-salir]")) b.onclick = async () => {
  if (CV && CV.mod.auth.currentUser) await CV.mod.signOut(CV.mod.auth).catch(() => {});
  await F.signOut(auth);
};

/* ── La familia ───────────────────────────────────────────────────────────── */
function escucharFamilia() {
  const c = F.collection(db, "tareas");
  let comunes = [], mias = [];
  const unir = () => { E.tareas = [...comunes, ...mias]; pintar(); };
  const mal = (que) => (e) => aviso(`No se pudo leer ${que}: ${e.code || e.message}`, true);
  // Dos consultas y no una: cada una tiene que poder probarse contra la regla.
  F.onSnapshot(F.query(c, F.where("alcance", "==", "comun")),
    (s) => { comunes = s.docs.map((d) => ({ id: d.id, ...d.data() })); unir(); }, mal("las tareas"));
  F.onSnapshot(F.query(c, F.where("alcance", "==", "personal"), F.where("duenio", "==", E.yo.uid)),
    (s) => { mias = s.docs.map((d) => ({ id: d.id, ...d.data() })); unir(); }, mal("tus tareas"));
  // Mis relojes: el de TAREA (uno solo) y el de los CHICOS, que corre en
  // paralelo. Sin `limit(1)`: con dos relojes posibles, uno taparía al otro.
  F.onSnapshot(F.query(F.collection(db, "sesiones"), F.where("uid", "==", E.yo.uid),
    F.where("estado", "==", "en_curso")), (s) => {
    const vivas = s.docs.map((d) => ({ id: d.id, ...d.data(), inicioMs: d.data().inicio && d.data().inicio.toMillis() }));
    const { tarea, cuidado } = separarEnCurso(vivas);
    E.enCursoFam = tarea ? { ...tarea, titulo: tarea.tareaTitulo || "una tarea personal" } : null;
    E.cuidado = cuidado;
    pintar();
  }, mal("tus relojes"));
  F.onSnapshot(F.collection(db, "miembros"), (s) => { E.miembros = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar(); });
  F.onSnapshot(F.doc(db, "familia", "config"), (d) => {
    const x = d.exists() ? d.data() : {};
    E.familia = { ninos: Array.isArray(x.ninos) ? x.ninos : [], patron: x.patron || {}, cotidianasExtra: x.cotidianasExtra || {} };
    pintar();
  }, mal("los datos de los chicos"));
  // app-8: la lista de compras, en el mismo documento para los dos.
  F.onSnapshot(F.doc(db, "familia", "compras"), (d) => {
    E.compras = d.exists() ? d.data() : {}; escucharCompartidas(); pintar();
  }, mal("la lista de compras"));
  // app-25 (tiempos:V11): las cuentas —lugares, vehículos y sus depósitos—.
  F.onSnapshot(F.doc(db, "familia", "cuentas"), (d) => {
    E.cuentasDoc = d.exists() ? d.data() : {}; pintar();
  }, mal("las cuentas"));
  F.onSnapshot(F.doc(db, "familia", "cierres"), (d) => {
    E.cierresDoc = d.exists() ? d.data() : {}; pintar();
  }, mal("los cierres"));
  F.onSnapshot(F.query(F.collection(db, "propuestas"), F.where("clase", "==", "analisis")), (s) => {
    E.analisis = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar();
  }, mal("los análisis"));
  // app-19 (tiempos:V9): los gastos del año y los repartos de cada mes.
  F.onSnapshot(F.doc(db, "familia", "presupuesto"), (d) => {
    E.conceptos = (d.exists() && d.data().conceptos) || {}; pintar();
  }, mal("los gastos del año"));
  F.onSnapshot(F.doc(db, "familia", "repartos"), (d) => {
    E.repartos = d.exists() ? d.data() : {}; pintar();
  }, mal("los repartos"));
  F.onSnapshot(F.collection(db, "turnos"), (s) => {
    E.turnos = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); pintar();
  }, mal("los turnos"));
  F.onSnapshot(F.collection(db, "eventos"), (s) => {
    E.eventos = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar();
  }, mal("las actividades de los chicos"));
  F.onSnapshot(F.doc(db, "agendas", E.yo.uid), (d) => {
    E.agenda = (d.exists() && d.data().items) || {};
    E.actividades = (d.exists() && d.data().actividades) || {};     // app-9: las propias, con su clase
    E.lugares = (d.exists() && d.data().lugares) || {};             // app-17: mis lugares (lugares.js)
    E.casas = (d.exists() && d.data().casas) || {};
    E.agenteAgenda = d.exists() && d.data().agente === true;         // app-18: «Claude organiza mi agenda»
    E.organizar = (d.exists() && d.data().organizar) || {};          // app-30: dónde cuelga cada cosa, para mí
    E.grupos = (d.exists() && d.data().grupos) || {};                // app-30: mis grupos 📂
    pintar();
  }, mal("tu agenda"));
  // app-13: mis alertas (recordatorios y alarmas) y la lista de deseos de los dos.
  F.onSnapshot(F.query(F.collection(db, "alertas"), F.where("uid", "==", E.yo.uid)), (s) => {
    E.alertas = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar();
  }, mal("tus alertas"));
  F.onSnapshot(F.collection(db, "deseos"), (s) => {
    E.deseos = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar();
  }, mal("los deseos"));
  // app-9: las marcas de tiempo de los dos meses últimos (el balance mira el
  // mes). Son de los dos y sin título: ver nucleo-5.
  F.onSnapshot(F.query(F.collection(db, "marcas"), F.where("desde", ">=", sumarDias(E.hoy, -62))), (s) => {
    E.marcas = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar();
  }, mal("las marcas de tiempo"));
  // app-4: la plata, los acuerdos de tiempo, lo que propone el agente y sus
  // observaciones. Son de los dos y son pocos documentos: se escuchan enteros.
  const todo = (col, campo) => F.onSnapshot(F.collection(db, col), (s) => {
    E[campo] = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar();
  }, mal(col));
  todo("movimientos", "movs");
  todo("extractos", "extractos");   // app-27 (tiempos:V12): lo que dice el banco, línea por línea
  todo("recurrentes", "recurrentes");
  todo("bloques", "bloques");
  todo("auditoria", "auditoria");
  F.onSnapshot(F.query(F.collection(db, "propuestas"), F.where("estado", "==", "pendiente")), (s) => {
    E.propuestas = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar();
  }, mal("las propuestas"));
  escucharDia();
}

async function arrancarFamilia(t) {
  const ok = quePuedoArrancar(E.enCursoCV, E.enCursoFam);
  if (!ok.puede) return aviso(ok.motivo, true);
  const { porId } = arbol(E.tareas);
  await F.addDoc(F.collection(db, "sesiones"), {
    tareaId: t.id,
    // El título de una tarea PERSONAL no viaja en la sesión: la sesión la
    // lee el otro, para los totales, y lo personal es de cada uno.
    tareaTitulo: t.alcance === "comun" ? t.titulo : "",
    tipo: tipoHeredado(t, porId), uid: E.yo.uid, nombre: E.miembro.nombre || "",
    inicio: F.Timestamp.now(), fin: null, horas: 0, estado: "en_curso",
    registro: "cronometro", creadoEn: F.serverTimestamp(),
  });
}

async function cerrarSesion(s, extra = {}) {
  const ahora = F.Timestamp.now();
  const horas = Math.round(Math.max(0, (ahora.toMillis() - s.inicioMs) / 3600000) * 100) / 100;
  await F.updateDoc(F.doc(db, "sesiones", s.id), { fin: ahora, horas, estado: "finalizada", ...extra });
  return horas;
}

async function frenarFamilia(terminada) {
  const s = E.enCursoFam; if (!s) return;
  const h = await cerrarSesion(s);
  // «Dar por terminada o dejar en pendiente»: terminada cierra la tarea.
  if (terminada && s.tareaId)
    await F.updateDoc(F.doc(db, "tareas", s.tareaId), { hecho: true, hechoPor: E.yo.uid, actualizadoEn: F.serverTimestamp() }).catch(fallo);
  aviso(`Registrado: ${fmtHoras(h)}${terminada ? " · tarea terminada" : " · queda pendiente"}.`);
}

/* ── Los chicos: del CALENDARIO, no de un reloj ───────────────────────────────
   app-31 (12-oct-2026, Mauro: «el tiempo que cada uno pasa con los chicos se
   calcula en función de lo que se marca en el calendario de los chicos, no
   poniendo un reloj»). Ya no se arranca un reloj «Estoy con…»: lo cuenta
   `diasConChicos` desde el calendario de Chicos. Si quedó uno corriendo de
   antes, se ve y se puede terminar, para que no quede colgado. */
async function terminarCuidado() {
  if (!E.cuidado) return;
  const h = await cerrarSesion(E.cuidado);
  aviso(`Con los chicos: ${fmtHoras(h)}.`);
}

/* ── Casa Verde, por su propio código ─────────────────────────────────────── */
async function conectarCasaVerde() {
  if (!CV) { E.cv = null; return; }
  if (CV.mod.auth.authStateReady) await CV.mod.auth.authStateReady();
  const u = CV.mod.auth.currentUser;
  if (!u) { E.cv = null; return; }
  if (E.cv && E.cv.uid === u.uid) return;          // ya conectado: no escuchar dos veces
  const M = CV.mod;
  const p = await M.getDoc(M.doc(M.db, "usuarios", u.uid)).catch(() => null);
  E.cvNombre = (p && p.exists() && p.data().nombre) || "";
  E.cv = { uid: u.uid, nombre: E.cvNombre };
  if (E.miembro.cvUid !== u.uid)
    await F.updateDoc(F.doc(db, "miembros", E.yo.uid), { cvUid: u.uid, actualizadoEn: F.serverTimestamp() }).catch(() => {});
  M.getDocs(M.collection(M.db, "usuarios")).then((s) => {
    E.cvNombres = Object.fromEntries(s.docs.map((d) => [d.id, d.data().nombre || ""]));
  }).catch(() => {});
  M.onSnapshot(CV.Core.consultaActividades(E.cv, false), (s) => {
    const todas = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Casa Verde borra marcando SÓLO la raíz: la rama entera se va con ella.
    // Hasta app-5 acá se miraba cada una por separado, y los hijos de un
    // proyecto borrado aparecían sueltos (pasó con el cumple).
    const porId = Object.fromEntries(todas.map((a) => [a.id, a]));
    const borrada = (a) => { for (let x = a, n = 0; x && n < 30; x = porId[x.parentId], n++) if (x.eliminado) return true; return false; };
    E.cvActs = todas.filter((a) => !a.hecho && !borrada(a) && !CV.Core.limpiezaLatente(a));
    pintar();
  }, (e) => aviso("Casa Verde no deja leer sus tareas: " + e.message, true));
  M.onSnapshot(M.query(M.collection(M.db, "sesiones"), M.where("uid", "==", u.uid),
    M.where("estado", "==", "en_curso"), M.limit(1)), (s) => {
    const d = s.docs[0];
    E.enCursoCV = d ? { id: d.id, ...d.data(), titulo: d.data().actividadTitulo,
                        inicioMs: d.data().inicio && d.data().inicio.toMillis() } : null;
    pintar();
  });
  // La agenda de Casa Verde es la MISMA que se ordena acá (ver agenda.js).
  M.onSnapshot(M.doc(M.db, "estado_usuario", u.uid), (d) => {
    E.cvAgenda = (d.exists() && d.data().agenda) || {}; pintar();
  }, () => {});
}

async function arrancarCV(a) {
  const ok = quePuedoArrancar(E.enCursoCV, E.enCursoFam);
  if (!ok.puede) return aviso(ok.motivo, true);
  try { await CV.Core.iniciar(a.id, E.cv); }
  catch (e) { aviso(e.message, true); }
}

async function frenarCV(terminada) {
  const s = E.enCursoCV; if (!s) return;
  if (terminada && !confirm(`¿Terminaste «${s.titulo}»? Se cierra la tarea en Casa Verde y, si tiene monto, se reparten los honorarios.`)) return;
  try {
    const r = await CV.Core.finalizar(s.actividadId, E.cv, terminada);
    aviso(`Registrado en Casa Verde: ${fmtHoras(r.horas)}${terminada ? " · tarea terminada" : " · queda pendiente"}.`);
  } catch (e) { aviso(e.message, true); }
}

/* Los registros de una actividad de Casa Verde: quién le dedicó tiempo,
   cuándo y cuánto. Se piden al abrir la ficha, no antes: son lecturas. */
const registrosCV = {};
async function cargarRegistrosCV(id) {
  const M = CV.mod;
  registrosCV[id] = { cargando: true };
  try {
    const s = await M.getDocs(M.query(M.collection(M.db, "sesiones"), M.where("actividadId", "==", id)));
    const lista = s.docs.map((d) => d.data())
      .map((x) => ({ ...x, ms: x.inicio && x.inicio.toMillis ? x.inicio.toMillis() : 0 }))
      .sort((a, b) => b.ms - a.ms);
    registrosCV[id] = { lista, total: lista.reduce((t, x) => t + (Number(x.horas) || 0), 0) };
  } catch (e) { registrosCV[id] = { error: e.code || e.message }; }
  pintar();
}

/* ── Dibujar ──────────────────────────────────────────────────────────────── */
for (const b of document.querySelectorAll("[data-solapa]")) b.onclick = () => {
  E.solapa = b.dataset.solapa; E.abierta = null;
  for (const x of document.querySelectorAll("[data-solapa]")) x.setAttribute("aria-selected", String(x === b));
  pintar();
  scrollTo(0, 0);
};

const hms = (ms) => {
  const seg = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return `${Math.floor(seg / 3600)}:${String(Math.floor(seg / 60) % 60).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
};
function pintarReloj() {
  const s = E.enCursoCV || E.enCursoFam;
  if (s && $("reloj-tiempo")) $("reloj-tiempo").textContent = hms(s.inicioMs);
  if (E.cuidado && $("reloj-chicos")) $("reloj-chicos").textContent = hms(E.cuidado.inicioMs);
}

/* Mientras alguien escribe, no se redibuja: un cambio que llega de la base
   (el otro tildó algo) borraría lo que se está tecleando. Se redibuja al
   soltar el campo. */
let esperandoFoco = false;
const ZONAS_EDICION = ".ficha, .dia-notas, .evento-form, .pas-ed, .chicos-ed";
/* app-29 (tiempos:A25): si el foco pasa a otro elemento del MISMO formulario
   —el botón Guardar, otro campo— no se redibuja todavía: se espera a que salga
   del formulario. Redibujar en el medio del toque hacía que el Guardar cayera
   sobre un botón que ya no existía, y se perdía lo escrito. */
function esperarSalida(el) {
  el.addEventListener("blur", (ev) => {
    const sig = ev.relatedTarget, zona = el.closest(ZONAS_EDICION);
    if (sig && zona && zona.contains(sig)) return esperarSalida(sig);
    // Sin a dónde ir (un toque que no enfoca, como en el iPhone), un respiro
    // para que el clic llegue antes de redibujar.
    setTimeout(() => { esperandoFoco = false; pintar(); }, sig ? 0 : 350);
  }, { once: true });
}
function pintar() {
  if ($("app").hidden) return;
  const foco = document.activeElement;
  if (foco && foco.closest && foco.closest(ZONAS_EDICION) && foco.matches("textarea, input:not([type=checkbox]):not([type=radio])")) {
    if (!esperandoFoco) { esperandoFoco = true; esperarSalida(foco); }
    return;
  }
  esperandoFoco = false;
  for (const s of SOLAPAS) $("v-" + s).hidden = s !== E.solapa;
  $("v-ahora").hidden = E.solapa !== "tareas";   // app-16: el reloj y lo tomado van arriba de Tareas
  $("t-arriba").hidden = E.solapa !== "tareas";  // app-29: el cuadro para agregar, lo primero de Tareas
  // app-29 (tiempos:A26, Florencia): el reloj se ve sólo si algo corre, en
  // todas las pestañas; «Estoy con…» vive en Chicos, y afuera sólo si corre.
  $("crono").hidden = !(E.enCursoCV || E.enCursoFam);
  $("cuidado").hidden = !E.cuidado;            // app-31: sólo uno viejo que quedó corriendo
  pintarCrono();
  pintarCuidado();
  if (E.solapa === "pizarra") pintarPizarra(irA);
  if (E.solapa === "hoy") pintarHoy();
  if (E.solapa === "agenda") pintarAgenda();
  if (E.solapa === "tareas") { pintarAhora(); pintarTareas(); }
  if (E.solapa === "chicos") pintarChicos();
  if (E.solapa === "plata") pintarPlata();
  if (E.solapa === "balance") pintarBalance();
  $("cv-estado").textContent = !CV ? errorCasaVerde
    : !E.cv ? `Casa Verde: sin sesión para ${E.yo.email}.` : "";
  $("form-cv").hidden = !CV || !!E.cv;
}
ganchos.pintar = pintar;

function pintarCrono() {
  const s = E.enCursoCV || E.enCursoFam;
  const c = $("crono");
  if (!s) { c.innerHTML = `<p class="gris">No hay ninguna tarea corriendo.</p>`; return; }
  const deCV = !!E.enCursoCV;
  c.innerHTML = `<div class="crono-vivo">
      <span class="chip" style="--c:${deCV ? TIPOS.produccion.color : (TIPOS[s.tipo] || TIPOS.personal).color}">${deCV ? "Casa Verde" : esc((TIPOS[s.tipo] || {}).nombre)}</span>
      <b>${esc(s.titulo)}</b>
      <div id="reloj-tiempo" class="reloj">0:00:00</div>
      <div class="botones">
        <button class="boton" id="parar">Parar · queda pendiente</button>
        ${deCV || s.tareaId ? `<button class="boton sec" id="parar-terminar">Parar y terminé</button>` : ""}
      </div></div>`;
  $("parar").onclick = () => (deCV ? frenarCV(false) : frenarFamilia(false)).catch(fallo);
  if ($("parar-terminar")) $("parar-terminar").onclick = () => (deCV ? frenarCV(true) : frenarFamilia(true)).catch(fallo);
  pintarReloj();
}

function pintarCuidado() {
  const c = $("cuidado");
  if (E.cuidado) {
    const quienes = E.cuidado.juntos ? "todos juntos"
      : (E.cuidado.ninos || []).map((id) => (ninoPorId(id) || {}).nombre || "?").join(" y ");
    c.innerHTML = `<div class="cuidado-vivo"><span>Con <b>${esc(quienes || "los chicos")}</b></span>
      <span id="reloj-chicos" class="reloj-chico">0:00:00</span>
      <button class="mini" id="fin-cuidado">Terminé</button></div>`;
    $("fin-cuidado").onclick = () => terminarCuidado().catch(fallo);
    pintarReloj();
    return;
  }
  c.innerHTML = "";
}

/* ── Plegar un grupo (app-7) ──────────────────────────────────────────────────
   La flechita de Casa Verde: un grupo se cierra y queda una sola fila con
   cuántas tiene adentro. Abierto es lo normal; se recuerda sólo lo cerrado a
   propósito, en ESTE teléfono: es cómo uno mira la lista, no un dato de los
   dos, y no vale una escritura en la base por cada toque. */
const plegado = new Set((() => { try { return JSON.parse(localStorage.getItem("tiempos:plegado") || "[]"); } catch { return []; } })());
function alternarPlegado(clave) {
  plegado.has(clave) ? plegado.delete(clave) : plegado.add(clave);
  try { localStorage.setItem("tiempos:plegado", JSON.stringify([...plegado])); } catch { /* sin memoria: igual anda */ }
  pintar();
}
const contarRama = (id, hijos) => (hijos[id] || []).reduce((n, h) => n + 1 + contarRama(h.id, hijos), 0);
function flecha(clave, cuantos) {
  if (!cuantos) return `<span class="flecha vacia"></span>`;
  const cerrada = plegado.has(clave);
  return `<button class="flecha" data-plegar="${esc(clave)}" aria-label="${cerrada ? "Abrir" : "Cerrar"} el grupo" aria-expanded="${!cerrada}">${cerrada ? "▸" : "▾"}</button>`;
}
const engancharFlecha = (f) => { const b = f.querySelector("[data-plegar]"); if (b) b.onclick = () => alternarPlegado(b.dataset.plegar); };

/* ── Una fila de tarea de la familia, con su ficha desplegable ─────────────── */
function chipsDe(t, porId) {
  const tipo = TIPOS[tipoHeredado(t, porId)];
  const enc = (t.encargados || []).map((u) => `<span class="enc${u === E.yo.uid ? " yo" : ""}">${esc(u === E.yo.uid ? "vos" : nombreDe(u))}</span>`).join("");
  const ped = t.pedido && t.pedido.estado === "pendiente"
    ? `<span class="ped">${t.pedido.a === E.yo.uid ? "te la pidieron" : "pedida a " + esc(nombreDe(t.pedido.a))}</span>` : "";
  return ` <small class="tipo" style="--c:${tipo.color}">${esc(tipo.nombre)}${t.alcance === "personal" ? " · sólo vos" : ""}</small>`
    + (t.meta ? ` <span class="meta" title="Meta de la semana">★</span>` : "") + enc + ped
    + (estaEnAgenda("f:" + t.id) ? ` <span class="ag" title="En tu agenda">📅</span>` : "");
}

function filaTarea(t, nivel, porId, hijos, cuantos = 0) {
  const f = document.createElement("div");
  f.className = "fila-tarea" + (t.hecho ? " hecha" : "");
  f.style.paddingLeft = (nivel * 16) + "px";
  // app-8: el color del proyecto, heredado por lo que tiene adentro.
  const col = colorHeredado(t, porId);
  if (col) { f.classList.add("con-color"); f.style.setProperty("--col", col); }
  const abierta = E.abierta === "f:" + t.id;
  // app-11: la que corre muestra ■ (parar) y queda recuadrada.
  const corre = estaCorriendo(E.enCursoCV, E.enCursoFam, "f", t.id);
  if (corre) f.classList.add("corriendo");
  // app-31: el reloj, sólo en lo que se cobra (`conReloj`); lo demás se tilda.
  const reloj = conReloj(t, porId);
  f.innerHTML = `<div class="fila">${flecha("f:" + t.id, cuantos)}
      ${t.hecho ? `<span class="play apagado">✓</span>` : corre ? `<button class="play parar" aria-label="Parar">■</button>`
        : reloj ? `<button class="play" aria-label="Empezar">▶</button>` : `<button class="tilde" aria-label="Marcar hecha" title="Marcar hecha">○</button>`}
      <span class="txt">${esc(t.titulo)}${chipsDe(t, porId)}${cuantos && plegado.has("f:" + t.id) ? ` <small class="gris">· ${cuantos} adentro</small>` : ""}</span>
      <button class="mas" aria-label="Más">${abierta ? "▴" : "⋯"}</button></div>`;
  engancharFlecha(f);
  const p = f.querySelector("button.play");
  if (p) p.onclick = () => (corre ? frenarFamilia(false) : arrancarFamilia(t)).catch(fallo);
  const tl = f.querySelector("button.tilde");
  if (tl) tl.onclick = () => F.updateDoc(F.doc(db, "tareas", t.id), { hecho: true, hechoPor: E.yo.uid, actualizadoEn: F.serverTimestamp() })
    .then(() => aviso(`Hecha: «${t.titulo}». Si fue sin querer, en «Hechas» está «Volver a pendiente».`)).catch(fallo);
  f.querySelector(".mas").onclick = () => { E.abierta = abierta ? null : "f:" + t.id; pintar(); };
  if (abierta) f.append(fichaTarea(t, hijos));
  return f;
}

/* app-29 (tiempos:A27, Florencia: «incluirla en la agenda semanal funciona
   desde la semana pero no desde la tarea»): la tarea se agenda en un DÍA sin
   salir de su ficha. Antes el botón la ponía flotando en hoy y saltaba a la
   agenda, donde había que arrastrarla. */
function filaAgendar(clave) {
  const m = agendaUnida()[clave];
  const en = !!m;
  return `<div class="agendar"><label>📅 A mi agenda el <input type="date" data-agendar-dia value="${esc(m && m.dia ? m.dia : "")}"></label>
    <button type="button" class="mini ok" data-agendar="${esc(clave)}">${en ? "Cambiar el día" : "Agendar"}</button>
    ${en ? `<button type="button" class="mini" data-desagendar="${esc(clave)}">Sacar de mi agenda</button>
      <small class="gris">${m.dia ? "Está en tu agenda el " + esc(fecha(m.dia)) : "Está en tu agenda, sin día: flota en hoy"}.</small>` : ""}</div>`;
}
function engancharAgendar(d) {
  const b = d.querySelector("[data-agendar]");
  if (b) b.onclick = () => {
    const dia = d.querySelector("[data-agendar-dia]").value || null;
    guardarEnAgenda(b.dataset.agendar, { dia }).then(() => aviso(dia ? `Agendada el ${fecha(dia)}.` : "Está en tu agenda: flota en hoy hasta que le des un día.")).catch(fallo);
  };
  const s = d.querySelector("[data-desagendar]");
  if (s) s.onclick = () => guardarEnAgenda(s.dataset.desagendar, null).then(() => aviso("Salió de tu agenda.")).catch(fallo);
}

function fichaTarea(t, hijos) {
  const d = document.createElement("div");
  d.className = "ficha";
  const o = otro();
  const mia = (t.encargados || []).includes(E.yo.uid);
  const comun = t.alcance === "comun";
  const lunes = lunesDe(E.hoy);
  const pedAMi = t.pedido && t.pedido.estado === "pendiente" && t.pedido.a === E.yo.uid;
  const relojPropio = t.reloj === true;
  const relojHeredado = !relojPropio && conReloj(t, arbol(E.tareas).porId);
  d.innerHTML = `
    ${t.pedido && t.pedido.texto ? `<p class="gris">Pedido de ${esc(nombreDe(t.pedido.de))}: «${esc(t.pedido.texto)}»</p>` : ""}
    ${pedAMi ? `<div class="botones"><button class="mini ok" data-a="aceptar">Me ocupo</button><button class="mini" data-a="devolver">No puedo</button></div>` : ""}
    <div class="botones">
      ${t.hecho ? `<button class="mini" data-a="reabrir">Volver a pendiente</button>` : `
      <button class="mini${mia ? " on" : ""}" data-a="yo">${mia ? "✓ Me ocupo yo" : "Me ocupo yo"}</button>
      ${comun && o ? `<button class="mini" data-a="pedir">Pedírsela a ${esc(o.nombre || "el otro")}</button>` : ""}
      ${comun ? `<button class="mini${t.meta ? " on" : ""}" data-a="meta">${t.meta ? "★ Meta de la semana" : "☆ Meta de la semana"}</button>` : ""}
      <button class="mini" data-a="adentro">＋ Tarea adentro</button>
      <button class="mini" data-a="hecha">✔ Hecha</button>
      ${relojPropio || !relojHeredado ? `<button class="mini${relojPropio ? " on" : ""}" data-a="reloj" title="Para lo que se cobra: el reloj reparte la plata por horas">${relojPropio ? "⏱ Con reloj (se cobra)" : "⏱ Lleva reloj: se cobra"}</button>`
        : `<small class="gris">⏱ con reloj: lo pide el proyecto</small>`}`}
      ${t.duenio === E.yo.uid ? `<button class="mini" data-a="borrar">Borrar</button>` : ""}
    </div>
    ${!t.hecho ? filaAgendar("f:" + t.id) : ""}
    <label>Título <input data-a="titulo" maxlength="120" value="${esc(t.titulo || "")}"></label>
    ${!t.parentId ? `<label>Ámbito <select data-a="tipo">${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}"${t.tipo === k ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></label>` : ""}
    <div class="colores"><span class="gris">Color</span>${COLORES_TAREA.map((c) => `<button class="color${t.color === c ? " on" : ""}" data-color="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join("")}
      <button class="mini${t.color ? "" : " on"}" data-color="">${t.parentId ? "el del proyecto" : "sin color"}</button></div>
    <label>Detalle <textarea data-a="detalle" rows="3" maxlength="2000" placeholder="Lo que haga falta saber para hacerla">${esc(t.detalle || "")}</textarea></label>
    <label>Para cuándo <input type="date" data-a="limite" value="${esc(t.limite || "")}"></label>`;
  const up = (x) => F.updateDoc(F.doc(db, "tareas", t.id), { ...x, actualizadoEn: F.serverTimestamp() }).catch(fallo);
  const on = (a, fn) => { const b = d.querySelector(`[data-a="${a}"]`); if (b) b.onclick = fn; };
  on("yo", () => up({ encargados: alternarEncargado(t, E.yo.uid) }));
  on("meta", () => up({ meta: t.meta ? null : lunes }));
  on("hecha", () => up({ hecho: true, hechoPor: E.yo.uid }));
  on("reabrir", () => up({ hecho: false }));
  on("reloj", () => up({ reloj: relojPropio ? null : true }));
  engancharAgendar(d);
  d.querySelector('[data-a="titulo"]').onchange = (ev) => {
    const titulo = ev.target.value.trim().slice(0, 120);
    if (!titulo) { ev.target.value = t.titulo; return aviso("El título no puede quedar vacío.", true); }
    up({ titulo });
  };
  // «Dentro del proyecto agregar una tarea, y dentro de ella puede haber
  // otra»: sin límite de niveles. Hereda el ámbito y a quién se ve.
  on("adentro", async () => {
    const titulo = (prompt(`Tarea adentro de «${t.titulo}»`, "") || "").trim();
    if (!titulo) return;
    const { porId } = arbol(E.tareas);
    try {
      await F.addDoc(F.collection(db, "tareas"), {
        titulo: titulo.slice(0, 120), parentId: t.id, tipo: tipoHeredado(t, porId),
        alcance: t.alcance === "personal" ? "personal" : "comun",
        duenio: E.yo.uid, hecho: false, encargados: t.alcance === "personal" ? [E.yo.uid] : [],
        meta: null, detalle: "", creadoEn: F.serverTimestamp(),
      });
      if (plegado.has("f:" + t.id)) alternarPlegado("f:" + t.id);
    } catch (e) { fallo(e); }
  });
  for (const b of d.querySelectorAll("[data-color]")) b.onclick = () => up({ color: b.dataset.color || null });
  on("aceptar", () => { try { up(responderPedido(t, E.yo.uid, true)); } catch (e) { fallo(e); } });
  on("devolver", () => { try { up(responderPedido(t, E.yo.uid, false)); } catch (e) { fallo(e); } });
  on("pedir", () => {
    const nota = prompt(`¿Algo para decirle a ${o.nombre || "el otro"}? (podés dejarlo vacío)`, "");
    if (nota === null) return;
    try { up({ pedido: pedir(t, E.yo.uid, o.id, nota) }); aviso(`Le pediste «${t.titulo}» a ${o.nombre}.`); } catch (e) { fallo(e); }
  });
  on("borrar", () => {
    if ((hijos[t.id] || []).length) return aviso("Tiene tareas adentro: borralas primero.", true);
    if (confirm(`¿Borrar «${t.titulo}»? Las horas ya registradas quedan.`)) F.deleteDoc(F.doc(db, "tareas", t.id)).catch(fallo);
  });
  // El ámbito lo pone la raíz y lo heredan las hijas (tipoHeredado). Se
  // cambia acá, en la raíz: las que vinieron de Casa Verde llegaron con uno
  // elegido por el agente.
  const selTipo = d.querySelector('[data-a="tipo"]');
  if (selTipo) selTipo.onchange = () => up({ tipo: selTipo.value });
  d.querySelector('[data-a="detalle"]').onchange = (ev) => up({ detalle: ev.target.value.slice(0, 2000) });
  d.querySelector('[data-a="limite"]').onchange = (ev) => up({ limite: ev.target.value || null });
  return d;
}

function listaFamilia(items, { todas = false } = {}) {
  const { porId } = arbol(E.tareas);
  const { raices, hijos } = arbol(items);
  const cont = document.createElement("div");
  const todosHijos = arbol(E.tareas).hijos;
  const bajar = (t, nivel) => {
    cont.append(filaTarea(t, nivel, porId, todosHijos, contarRama(t.id, hijos)));
    if (plegado.has("f:" + t.id)) return;
    for (const h of hijos[t.id] || []) bajar(h, nivel + 1);
  };
  for (const r of raices) bajar(r, 0);
  if (!raices.length) cont.innerHTML = `<p class="gris">${todas ? "Todavía no hay tareas." : "Nada acá."}</p>`;
  return cont;
}

/* ── Una actividad de Casa Verde, con sus detalles y registros ─────────────── */
function semaforoCV(a) {
  const hoy = E.hoy;
  if (a.prioridad === "rojo") return { c: "#c0271f", t: "Urgente" };
  if ((a.recurrenciaDias ?? 0) > 0 && a.fechaInicio) {
    if (a.fechaInicio > hoy) return { c: "#8a918a", t: "Vuelve el " + a.fechaInicio.split("-").reverse().join("/") };
    return { c: "#1f7a32", t: "Toca hacerla" };
  }
  if (a.fechaVencimiento && a.fechaVencimiento < hoy) return { c: "#c0271f", t: "Vencida" };
  if (a.prioridad === "amarillo") return { c: "#b8860b", t: "Importante" };
  return { c: "#1f7a32", t: "Al día" };
}
const fecha = (iso) => iso ? iso.split("-").reverse().join("/") : "";
const cuando = (ms) => ms ? new Date(ms).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

function filaCV(a, nivel, cuantos = 0) {
  const f = document.createElement("div");
  f.className = "fila-tarea";
  f.style.paddingLeft = (nivel * 16) + "px";
  const abierta = E.abierta === "cv:" + a.id;
  const s = semaforoCV(a);
  const corre = estaCorriendo(E.enCursoCV, E.enCursoFam, "cv", a.id);
  if (corre) f.classList.add("corriendo");
  f.innerHTML = `<div class="fila">${flecha("cv:" + a.id, cuantos)}
      ${corre ? `<button class="play parar" aria-label="Parar">■</button>` : `<button class="play" aria-label="Empezar">▶</button>`}
      <span class="txt"><i class="sem" style="background:${s.c}" title="${esc(s.t)}"></i>${esc(a.titulo || "(sin título)")}
        <small class="gris"> ${esc(s.t)}${cuantos && plegado.has("cv:" + a.id) ? ` · ${cuantos} adentro` : ""}</small>${estaEnAgenda("cv:" + a.id) ? ` <span class="ag">📅</span>` : ""}</span>
      <button class="mas" aria-label="Más">${abierta ? "▴" : "⋯"}</button></div>`;
  engancharFlecha(f);
  f.querySelector(".play").onclick = () => (corre ? frenarCV(false).catch(fallo) : arrancarCV(a));
  f.querySelector(".mas").onclick = () => {
    E.abierta = abierta ? null : "cv:" + a.id;
    if (!abierta && !registrosCV[a.id]) cargarRegistrosCV(a.id);
    pintar();
  };
  if (abierta) f.append(fichaCV(a));
  return f;
}

function fichaCV(a) {
  const d = document.createElement("div");
  d.className = "ficha";
  const r = registrosCV[a.id] || {};
  const ms = (x) => x && x.toMillis ? x.toMillis() : 0;
  const quienes = (a.competencias || []).map((u) => E.cvNombres[u] || "").filter(Boolean);
  const datos = [
    a.fechaInicio && ["Desde", fecha(a.fechaInicio)],
    a.fechaVencimiento && ["Vence", fecha(a.fechaVencimiento)],
    a.hora && ["Hora", a.hora],
    a.duracionHoras && ["Lleva", fmtHoras(a.duracionHoras)],
    (a.recurrenciaDias ?? 0) > 0 && ["Se repite", `cada ${a.recurrenciaDias} días`],
    a.monto && ["Monto", String(a.monto)],
    a.esCompra && a.proveedor && ["Proveedor", a.proveedor],
    quienes.length && ["La hacen", quienes.join(", ")],
    a.ultimaRealizacion && ["Última vez", `${cuando(ms(a.ultimaRealizacion))}${a.ultimaRealizacionNombre ? " · " + a.ultimaRealizacionNombre : ""}`],
  ].filter(Boolean);
  d.innerHTML = `
    ${a.detalle ? `<p class="detalle">${esc(a.detalle)}</p>` : `<p class="gris">Sin detalle escrito.</p>`}
    ${datos.length ? `<dl class="datos">${datos.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
    <div class="botones">
      <button class="mini" data-a="tildar">✔ Hecha sin cronómetro</button>
      <a class="mini" href="https://casaverdecanas.com.br/interno/actividades.html?a=${encodeURIComponent(a.id)}&editar=1" target="_blank" rel="noopener">Editar en Casa Verde</a>
    </div>
    ${filaAgendar("cv:" + a.id)}
    <h4>Registros</h4>
    ${r.cargando ? `<p class="gris">Buscando…</p>` : r.error ? `<p class="mal">No se pudieron leer: ${esc(r.error)}</p>`
      : !r.lista || !r.lista.length ? `<p class="gris">Nadie le registró tiempo todavía.</p>`
      : `<p class="gris">En total: <b>${fmtHoras(r.total)}</b> en ${r.lista.length} registro(s).</p>
         <ul class="registros">${r.lista.slice(0, 25).map((x) => `<li><span>${esc(cuando(x.ms))}</span> <b>${esc(x.nombre || E.cvNombres[x.uid] || "—")}</b>
           <span class="num">${x.tipo === "tilde" ? "✔" : x.estado === "en_curso" ? "corriendo" : fmtHoras(x.horas)}</span>${x.notas ? `<small>${esc(x.notas)}</small>` : ""}</li>`).join("")}</ul>`}`;
  d.querySelector('[data-a="tildar"]').onclick = async () => {
    if (!confirm(`¿«${a.titulo}» está hecha? Queda registrada en Casa Verde sin horas.`)) return;
    try { const x = await CV.Core.tildar(a.id, E.cv); aviso(x.recurrente ? `Hecha. Vuelve el ${fecha(x.proxima)}.` : "Hecha."); }
    catch (e) { fallo(e); }
  };
  engancharAgendar(d);
  return d;
}

function listaCV(items) {
  const { raices, hijos } = arbol(items);
  const cont = document.createElement("div");
  const bajar = (a, n) => {
    cont.append(filaCV(a, n, contarRama(a.id, hijos)));
    if (plegado.has("cv:" + a.id)) return;
    for (const h of hijos[a.id] || []) bajar(h, n + 1);
  };
  for (const r of raices) bajar(r, 0);
  return cont;
}

/* ── AHORA ────────────────────────────────────────────────────────────────── */
const h2 = (t) => Object.assign(document.createElement("h2"), { textContent: t });
const gris = (t) => Object.assign(document.createElement("p"), { className: "gris", textContent: t });

const irA = (solapa) => { const b = document.querySelector(`[data-solapa="${solapa}"]`); if (b) b.click(); };

function pintarAhora() {
  const v = $("v-ahora"); v.replaceChildren();
  // app-16: lo que espera una decisión, lo que Claude propone, recordatorios
  // y deseos se mudaron a la solapa Pizarra (pizarra.js).
  // Lo que te pidieron va primero: está esperando una respuesta tuya.
  const pedidos = pedidosPara(E.tareas, E.yo.uid);
  if (pedidos.length) {
    v.append(h2(`Te pidieron (${pedidos.length})`));
    v.append(listaFamilia(pedidos));
  }
  // Hoy con los chicos, de un vistazo: quién los tiene y qué actividades hay.
  const hoyChicos = chicosDelDia(E.hoy, E.familia.patron, E.turnos);
  const evs = eventosDelDia(E.hoy, E.eventos);
  if (Object.keys(hoyChicos).length || evs.length) {
    const t = document.createElement("div"); t.className = "tarjeta chica";
    t.innerHTML = Object.entries(hoyChicos).map(([u, ns]) =>
        `<div>${esc(u === E.yo.uid ? "Vos" : nombreDe(u))}: ${ns.map((id) => { const n = ninoPorId(id) || {}; return `<span class="punto" style="--c:${esc(n.color || "#c89bd8")}"></span>${esc(n.nombre || "?")}`; }).join(" ")}</div>`).join("")
      + evs.map((e) => `<div>👦 ${esc(e.hora || "")} <b>${esc(e.titulo)}</b></div>`).join("");
    v.append(h2("Hoy con los chicos")); v.append(t);
  }
  // app-29 (tiempos:A27): «Lo que tomaste», «De los dos» y «Casa Verde» se
  // fundieron en «Por categoría» (pintarCategorias): una sola lista, sin
  // dividirla dos veces. Quién la tiene se ve en la fila («vos», el nombre).
}

/* ── POR CATEGORÍA, y organizado por cada uno (app-29 → app-30) ──────────────
   Una rama por ámbito, en el orden de TIPOS; adentro, el árbol de CADA UNO:
   las tareas, los proyectos, las actividades de Casa Verde (en su grupo, en
   Producción) y los grupos 📂 propios, colgados donde cada uno los puso
   (arbolOrganizado). Cada fila tiene su ⠿: se arrastra y se suelta ADENTRO de
   otra fila o en una categoría. Se pliega con la misma flechita. */
let orgPadre = {};             // el árbol que está dibujado: clave → padre

/* app-34 (12-oct-2026, Mauro: «que el widget de pizarra también abra la tarea
   tocada»): `?solapa=tareas&abrir=f:<id>` muestra Por categoría con la ficha
   de esa tarea abierta, despliega lo que la tapa (en el orden de cada uno) y
   la trae a la vista. Las tareas llegan después: se reintenta un rato. */
function irATarea(clave) {
  if (!/^f:[\w-]{1,80}$/.test(String(clave || ""))) return;
  E.vistaTareas = "todas";
  E.abierta = clave;
  for (const x of document.querySelectorAll("[data-vt]")) x.setAttribute("aria-selected", String(x.dataset.vt === "todas"));
  const buscar = (n) => {
    let abri = false;
    for (let k = orgPadre[clave], i = 0; k && i < 40; k = orgPadre[k], i++) if (plegado.delete(k)) abri = true;
    if (abri) pintar();
    const el = document.querySelector(`[data-destino="${CSS.escape(clave)}"]`);
    if (el) el.scrollIntoView({ block: "center" });
    else if (n > 0) setTimeout(() => buscar(n - 1), 300);
  };
  pintar();
  setTimeout(() => buscar(20), 100);
}
let orgDefecto = {};           // dónde iría cada cosa sin el orden propio
function nodosOrganizables() {
  const { porId } = arbol(E.tareas);
  const nodos = [];
  for (const t of E.tareas.filter((x) => !x.hecho)) {
    const cat = "cat:" + tipoHeredado(t, porId);
    nodos.push({ clave: "f:" + t.id, padre: t.parentId ? "f:" + t.parentId : cat, cat, t });
  }
  if (E.cv) {
    const cat = "cat:" + TIPO_CASA_VERDE;
    nodos.push({ clave: "g:cv", padre: cat, cat, grupo: { titulo: "Casa Verde", fijo: true } });
    for (const a of E.cvActs || []) nodos.push({ clave: "cv:" + a.id, padre: a.parentId ? "cv:" + a.parentId : "g:cv", cat, a });
  }
  for (const [id, g] of Object.entries(E.grupos || {})) if (g) nodos.push({ clave: "g:" + id, padre: "cat:personal", cat: "cat:personal", grupo: g });
  return nodos;
}
function pintarCategorias(v) {
  const { porId } = arbol(E.tareas);
  const todosHijos = arbol(E.tareas).hijos;
  const nodos = nodosOrganizables();
  const { padre, hijos } = arbolOrganizado(nodos, E.organizar || {});
  orgPadre = padre; orgDefecto = Object.fromEntries(nodos.map((n) => [n.clave, n.padre]));
  const porClave = Object.fromEntries(nodos.map((n) => [n.clave, n]));
  const cuenta = (k) => (hijos[k] || []).reduce((t, c) => t + 1 + cuenta(c), 0);
  const bajar = (k, nivel) => {
    const n = porClave[k]; if (!n) return;
    const f = n.t ? filaTarea(n.t, nivel, porId, todosHijos, cuenta(k)) : n.a ? filaCV(n.a, nivel, cuenta(k)) : filaGrupo(k, n.grupo, nivel, cuenta(k));
    organizable(f, k);
    v.append(f);
    if (plegado.has(k)) return;
    for (const h of hijos[k] || []) bajar(h, nivel + 1);
  };
  let algo = false;
  for (const [k, tipo] of Object.entries(TIPOS)) {
    const cat = "cat:" + k, n = cuenta(cat);
    algo = algo || n > 0;
    const cab = document.createElement("div");
    cab.className = "cat-cab";
    cab.dataset.destino = cat;
    cab.style.setProperty("--c", tipo.color);
    cab.innerHTML = `${flecha(cat, n)}<b>${esc(tipo.nombre)}</b> <small class="gris">${n || "vacía: soltá algo acá"}</small>`;
    engancharFlecha(cab);
    v.append(cab);
    if (plegado.has(cat)) continue;
    for (const h of hijos[cat] || []) bajar(h, 0);
  }
  if (!E.cv) v.append(gris("Casa Verde: sin sesión. Entrá arriba para ver sus actividades acá."));
  if (!algo) v.append(gris("Todavía no hay tareas. Tocá «＋ Tarea» arriba."));
  v.append(gris("Arrastrá del ⠿ y soltá ADENTRO de un proyecto, un grupo o una categoría. Este orden es tuyo: al otro no le cambia nada."));
}

/* El agarre y el «volver a su lugar» de una fila organizable. */
function organizable(f, clave) {
  f.dataset.destino = clave;
  const fila = f.querySelector(".fila");
  const g = document.createElement("span");
  g.className = "pas-agarre org-agarre"; g.textContent = "⠿"; g.title = "Arrastrar";
  g.addEventListener("pointerdown", (ev) => arrastrarOrg(ev, clave));
  fila.prepend(g);
  if ((E.organizar || {})[clave] && !clave.startsWith("g:")) {
    const b = document.createElement("button");
    b.className = "mini volver"; b.textContent = "↩"; b.title = "Volver a su lugar de siempre";
    b.onclick = () => organizar(clave, null);
    fila.insertBefore(b, fila.querySelector(".mas"));
  }
}

/* Guardar dónde cuelga algo, para mí. `null` (o su lugar de siempre) borra el orden propio. */
function organizar(clave, destino) {
  const valor = !destino || (destino === orgDefecto[clave] && !clave.startsWith("g:")) ? F.deleteField() : destino;
  return F.setDoc(F.doc(db, "agendas", E.yo.uid), { organizar: { [clave]: valor }, actualizadoEn: F.serverTimestamp() }, { merge: true }).catch(fallo);
}

/* Un grupo propio 📂: sólo lo ve quien lo armó. */
function filaGrupo(clave, g, nivel, cuantos) {
  const f = document.createElement("div");
  f.className = "fila-tarea grupo";
  f.style.paddingLeft = (nivel * 16) + "px";
  const abierta = E.abierta === clave;
  f.innerHTML = `<div class="fila">${flecha(clave, cuantos)}
      <span class="txt">📂 <b>${esc(g.titulo || "Grupo")}</b> <small class="gris">${g.fijo ? "las de Casa Verde" : "grupo tuyo"}${cuantos && plegado.has(clave) ? ` · ${cuantos} adentro` : ""}</small></span>
      <button class="mas" aria-label="Más">${abierta ? "▴" : "⋯"}</button></div>`;
  engancharFlecha(f);
  f.querySelector(".mas").onclick = () => { E.abierta = abierta ? null : clave; pintar(); };
  if (abierta) {
    const d = document.createElement("div"); d.className = "ficha";
    d.innerHTML = g.fijo ? `<p class="gris">Las actividades de Casa Verde. Podés moverlo a donde te quede más cómodo.</p>`
      : `<label>Nombre <input data-a="nombre" maxlength="60" value="${esc(g.titulo || "")}"></label>
        <div class="botones"><button class="mini" data-a="adentro">＋ Grupo adentro</button><button class="mini" data-a="borrar">Borrar el grupo</button></div>
        <p class="gris">Al borrarlo, lo que tiene adentro vuelve a su lugar de siempre. Las tareas no se borran.</p>`;
    const id = clave.slice(2);
    const nom = d.querySelector('[data-a="nombre"]');
    if (nom) nom.onchange = () => { const t = nom.value.trim().slice(0, 60); if (t) F.setDoc(F.doc(db, "agendas", E.yo.uid), { grupos: { [id]: { titulo: t } } }, { merge: true }).catch(fallo); };
    const ad = d.querySelector('[data-a="adentro"]');
    if (ad) ad.onclick = () => nuevoGrupo(clave);
    const bo = d.querySelector('[data-a="borrar"]');
    if (bo) bo.onclick = () => {
      if (!confirm(`¿Borrar el grupo «${g.titulo}»? Lo de adentro vuelve a su lugar; ninguna tarea se borra.`)) return;
      const org = { [clave]: F.deleteField() };
      for (const [k, p] of Object.entries(E.organizar || {})) if (p === clave) org[k] = F.deleteField();
      E.abierta = null;
      F.setDoc(F.doc(db, "agendas", E.yo.uid), { grupos: { [id]: F.deleteField() }, organizar: org, actualizadoEn: F.serverTimestamp() }, { merge: true }).catch(fallo);
    };
    f.append(d);
  }
  return f;
}
async function nuevoGrupo(adentroDe = "cat:personal") {
  const titulo = (prompt("Nombre del grupo (sólo lo ves vos)", "") || "").trim().slice(0, 60);
  if (!titulo) return;
  const id = idNuevo("g");
  await F.setDoc(F.doc(db, "agendas", E.yo.uid), { grupos: { [id]: { titulo } }, organizar: { ["g:" + id]: adentroDe }, actualizadoEn: F.serverTimestamp() }, { merge: true }).catch(fallo);
  if (plegado.has(adentroDe)) alternarPlegado(adentroDe);
  aviso(`Grupo «${titulo}» listo: arrastrá adentro lo que quieras.`);
}

/* El arrastre de la lista: un fantasma sigue al dedo, lo de abajo se ilumina,
   y al soltar queda ADENTRO de eso. Cerca del borde la pantalla se desplaza. */
function arrastrarOrg(ev, clave) {
  ev.preventDefault();
  const origen = ev.target.closest("[data-destino]");
  const r = origen.querySelector(".fila").getBoundingClientRect();
  const fantasma = origen.querySelector(".fila").cloneNode(true);
  Object.assign(fantasma.style, { position: "fixed", left: r.left + "px", width: r.width + "px", top: r.top + "px", pointerEvents: "none", zIndex: 50, opacity: ".9" });
  fantasma.classList.add("fantasma");
  document.body.append(fantasma);
  origen.classList.add("arrastrando"); document.body.classList.add("arrastrando-algo");
  const dy = ev.clientY - r.top;
  let sobre = null, rueda = 0, x = ev.clientX, y = ev.clientY;
  const marcar = () => {
    const el = document.elementFromPoint(x, y);
    let z = el && el.closest("[data-destino]");
    if (z && !puedeSoltar(clave, z.dataset.destino, orgPadre)) z = null;
    if (z !== sobre) { if (sobre) sobre.classList.remove("encima"); sobre = z; if (sobre) sobre.classList.add("encima"); }
  };
  const mover = (e) => { x = e.clientX; y = e.clientY; fantasma.style.top = (e.clientY - dy) + "px"; marcar(); };
  const desplazar = () => { if (y < 80) { scrollBy(0, -12); marcar(); } else if (y > innerHeight - 80) { scrollBy(0, 12); marcar(); } rueda = requestAnimationFrame(desplazar); };
  rueda = requestAnimationFrame(desplazar);
  const soltar = () => {
    cancelAnimationFrame(rueda);
    removeEventListener("pointermove", mover); removeEventListener("pointerup", soltar); removeEventListener("pointercancel", soltar);
    fantasma.remove(); origen.classList.remove("arrastrando"); document.body.classList.remove("arrastrando-algo");
    if (!sobre) return;
    sobre.classList.remove("encima");
    const destino = sobre.dataset.destino;
    if (destino === orgPadre[clave]) return;
    organizar(clave, destino);
    if (plegado.has(destino)) alternarPlegado(destino);
  };
  addEventListener("pointermove", mover); addEventListener("pointerup", soltar); addEventListener("pointercancel", soltar);
}

/* «Adentro de»: agrupado por categoría, con sangría, en el orden de CADA UNO.
   Los proyectos 📁 y los grupos 📂 se distinguen; Casa Verde no entra (sus
   tareas viven en su base). */
function opcionesAdentro() {
  const nodos = nodosOrganizables().filter((n) => n.t || (n.grupo && !n.grupo.fijo));
  const { hijos } = arbolOrganizado(nodos, E.organizar || {});
  const porClave = Object.fromEntries(nodos.map((n) => [n.clave, n]));
  const sangria = (n) => "\u2003".repeat(n) + (n ? "└ " : "");
  let h = `<option value="">— Suelta, sin proyecto —</option>`;
  for (const [k, tipo] of Object.entries(TIPOS)) {
    const ops = [];
    const bajar = (c, n) => {
      const x = porClave[c]; if (!x) return;
      const tiene = (hijos[c] || []).length;
      ops.push(`<option value="${esc(x.t ? x.t.id : c)}">${sangria(n)}${x.grupo ? "📂 " : tiene ? "📁 " : ""}${esc(x.t ? x.t.titulo : x.grupo.titulo)}</option>`);
      for (const hh of hijos[c] || []) bajar(hh, n + 1);
    };
    for (const c of hijos["cat:" + k] || []) bajar(c, 0);
    if (ops.length) h += `<optgroup label="${esc(tipo.nombre)}">${ops.join("")}</optgroup>`;
  }
  return h;
}

/* ── TAREAS: la pizarra de la semana y la lista entera ────────────────────── */
let lunesPizarra = null;
let formTareaAbierto = false;
$("abrir-tarea").onclick = () => { formTareaAbierto = true; pintar(); $("nueva-titulo").focus(); };
$("cerrar-tarea").onclick = () => { formTareaAbierto = false; pintar(); };
$("nuevo-grupo").onclick = () => nuevoGrupo().catch(fallo);
function pintarTareas() {
  const lunes = lunesPizarra || lunesDe(E.hoy);
  for (const b of document.querySelectorAll("[data-vt]")) b.setAttribute("aria-selected", String(b.dataset.vt === E.vistaTareas));
  const sel = $("nueva-padre");
  const antes = sel.value;
  sel.innerHTML = opcionesAdentro();
  sel.value = antes;
  const suelta = () => !sel.value || sel.value.startsWith("g:");
  $("nueva-tipo").parentElement.hidden = !suelta();
  sel.onchange = () => {
    $("nueva-tipo").parentElement.hidden = !suelta();
    // En un grupo propio, la categoría que se ofrece es la de donde vive el grupo.
    let k = sel.value; if (k.startsWith("g:")) for (let i = 0; k && !k.startsWith("cat:") && i < 50; i++) k = orgPadre[k];
    if (k && k.startsWith("cat:") && TIPOS[k.slice(4)]) $("nueva-tipo").value = k.slice(4);
  };
  // app-30: agregar es un botón que se despliega.
  $("t-botones").hidden = E.vistaTareas === "compras" || formTareaAbierto;
  $("form-tarea").hidden = E.vistaTareas === "compras" || !formTareaAbierto;
  const v = $("v-tareas-lista"); v.replaceChildren();
  if (E.vistaTareas === "compras") { pintarCompras(v); return; }

  if (E.vistaTareas === "pizarra") {
    const nav = document.createElement("div"); nav.className = "nav-semana";
    nav.innerHTML = `<button class="mini" data-s="-7">‹</button><b>Semana del ${fecha(lunes)}</b><button class="mini" data-s="7">›</button>`;
    for (const b of nav.querySelectorAll("[data-s]")) b.onclick = () => { lunesPizarra = sumarDias(lunes, Number(b.dataset.s)); pintar(); };
    v.append(nav);
    const metas = metasDeLaSemana(E.tareas, lunes);
    if (!metas.length) { v.append(gris("La pizarra está vacía. Agregá una meta arriba, o en una tarea tocá «☆ Meta de la semana».")); return; }
    const grupos = [
      ...personas().map((m) => [m.id === E.yo.uid ? "Vos" : m.nombre, (t) => (t.encargados || []).length === 1 && t.encargados[0] === m.id]),
      ["Los dos", (t) => (t.encargados || []).length > 1],
      ["Sin encargado todavía", (t) => !(t.encargados || []).length],
    ];
    const hechas = metas.filter((t) => t.hecho).length;
    v.append(gris(`${hechas} de ${metas.length} hechas.`));
    for (const [nombre, f] of grupos) {
      const del = metas.filter(f);
      if (!del.length) continue;
      v.append(h2(nombre));
      const { porId: pi } = arbol(E.tareas);
      const hijos = arbol(E.tareas).hijos;
      for (const t of del) {
        const fila = filaTarea(t, 0, pi, hijos);
        if (t.deAntes) fila.querySelector(".txt").insertAdjacentHTML("beforeend", ` <small class="gris">· viene de antes</small>`);
        v.append(fila);
      }
    }
    return;
  }
  pintarCategorias(v);
  const hechas = E.tareas.filter((t) => t.hecho);
  if (hechas.length) {
    const det = document.createElement("details");
    det.innerHTML = `<summary>Hechas (${hechas.length})</summary>`;
    det.append(listaFamilia(hechas));
    v.append(det);
  }
}
for (const b of document.querySelectorAll("[data-vt]")) b.onclick = () => { E.vistaTareas = b.dataset.vt; pintar(); };

$("form-tarea").onsubmit = async (ev) => {
  ev.preventDefault();
  const titulo = $("nueva-titulo").value.trim();
  if (!titulo) return;
  const elegido = $("nueva-padre").value || null;
  const grupo = elegido && elegido.startsWith("g:") ? elegido : null;   // app-30: un grupo propio
  const padreId = grupo ? null : elegido;
  const { porId } = arbol(E.tareas);
  const padre = padreId ? porId[padreId] : null;
  // El tipo lo pone la raíz: una hija lo hereda y lo guarda igual, para que
  // la regla pueda validarlo sin leer al padre.
  const tipo = padre ? tipoHeredado(padre, porId) : $("nueva-tipo").value;
  const personal = $("nueva-personal").checked;
  const dia = $("nueva-dia").value || null;
  try {
    const r = await F.addDoc(F.collection(db, "tareas"), {
      titulo: titulo.slice(0, 120), parentId: padreId, tipo,
      alcance: personal ? "personal" : "comun",
      duenio: E.yo.uid, hecho: false, encargados: $("nueva-mia").checked || personal ? [E.yo.uid] : [],
      meta: !personal && $("nueva-meta").checked ? (lunesPizarra || lunesDe(E.hoy)) : null,
      detalle: "", creadoEn: F.serverTimestamp(),
    });
    $("nueva-titulo").value = "";
    formTareaAbierto = false; pintar();
    if (grupo) await organizar("f:" + r.id, grupo);
    // app-29: «para ponerla en la semana o en la organización de la agenda».
    if (dia) { await guardarEnAgenda("f:" + r.id, { dia }); $("nueva-dia").value = ""; aviso(`Agregada y agendada el ${fecha(dia)}.`); }
  } catch (e) { fallo(e); }
};

/* El ojo de las contraseñas (11-oct-2026). Mauro: «un ojo para poder ver la
   contraseña cuando se tipea, en todos los sitios». Pone un botón 👁 adentro de
   cada campo de contraseña de la página —también de los que aparecen después,
   por eso el MutationObserver— que alterna entre ver y ocultar. Corre solo al
   cargar este archivo: ninguna página tiene que acordarse de llamarlo.
   Es el MISMO código en Tiempos, Casa Verde, CasaYourte, remate y el panel:
   si cambia en uno, cambia en los cinco en la misma tanda.
   Los estilos van en línea a propósito: así no depende de la hoja de cada
   sitio, y le gana a las reglas generales de «button» (ancho, fondo, borde). */
function ojosEnClaves(raiz) {
  raiz = raiz || document;
  const poner = (inp) => {
    if (inp.dataset.ojo) return;
    inp.dataset.ojo = "1";
    // La caja ocupa el renglón y el campo la llena: en un teléfono los campos
    // de entrada van a lo ancho, y con una caja «en línea» el de la
    // contraseña quedaba más angosto que el del mail.
    const caja = document.createElement("span");
    caja.style.cssText = "position:relative;display:block";
    inp.parentNode.insertBefore(caja, inp);
    caja.appendChild(inp);
    inp.style.width = "100%";
    inp.style.boxSizing = "border-box";
    inp.style.paddingRight = "2.6em";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ojo-clave";
    b.style.cssText = "position:absolute;right:.25em;top:50%;transform:translateY(-50%);"
      + "background:none;border:0;box-shadow:none;padding:.2em .35em;margin:0;width:auto;"
      + "min-width:0;height:auto;cursor:pointer;font-size:1.1em;line-height:1;color:inherit;opacity:.75";
    const pintar = () => {
      const viendo = inp.type === "text";
      b.textContent = viendo ? "🙈" : "👁";
      b.setAttribute("aria-label", viendo ? "Ocultar la contraseña" : "Mostrar la contraseña");
      b.title = b.getAttribute("aria-label");
    };
    b.onclick = () => { inp.type = inp.type === "password" ? "text" : "password"; pintar(); inp.focus(); };
    pintar();
    caja.appendChild(b);
  };
  const todos = () => raiz.querySelectorAll('input[type="password"]:not([data-ojo])').forEach(poner);
  todos();
  new MutationObserver(todos).observe(raiz.body || raiz, { childList: true, subtree: true });
}
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") ojosEnClaves();

arrancar();
