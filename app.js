// ─────────────────────────────────────────────────────────────────────────────
// app.js — La pantalla de «tiempos».
// Sello: app-13
//
// Siete solapas (app-4 suma PLATA y cambia HORAS por BALANCE):
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
import { TIPOS, tipoHeredado, arbol, fmtHoras, quePuedoArrancar, esc, isoDe, lunesDe, sumarDias,
         alternarEncargado, pedir, responderPedido, pedidosPara, metasDeLaSemana,
         separarEnCurso, chicosDelDia, eventosDelDia, bloquesPorConfirmar, automaticosPendientes,
         COLORES_TAREA, colorHeredado, estaCorriendo } from "./nucleo.js";
import { E, $, aviso, ganchos, nombreDe, otro, personas, ninoPorId, fallo } from "./estado.js";
import { pintarAgenda, alternarEnAgenda, estaEnAgenda } from "./agenda.js";
import { pintarHoy, pintarChicos, escucharDia } from "./familia.js";
import { pintarPlata } from "./plata.js";
import { pintarBalance } from "./balance.js";
import { pintarCompras } from "./compras.js";
import { montarGlobo } from "./sugerir.js";
import { tarjetasPropone, CLASES_PROPONE, alertasYDeseos } from "./propone.js";

const SOLAPAS = ["ahora", "hoy", "agenda", "tareas", "chicos", "plata", "balance"];
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
    E.compras = d.exists() ? d.data() : {}; pintar();
  }, mal("la lista de compras"));
  F.onSnapshot(F.collection(db, "turnos"), (s) => {
    E.turnos = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); pintar();
  }, mal("los turnos"));
  F.onSnapshot(F.collection(db, "eventos"), (s) => {
    E.eventos = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar();
  }, mal("las actividades de los chicos"));
  F.onSnapshot(F.doc(db, "agendas", E.yo.uid), (d) => {
    E.agenda = (d.exists() && d.data().items) || {};
    E.actividades = (d.exists() && d.data().actividades) || {};     // app-9: las propias, con su clase
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

/* ── Los chicos, en paralelo ──────────────────────────────────────────────────
   «En paralelo a eso está la dedicación a los niños»: estar con ellos es un
   reloj APARTE, que no frena ni bloquea el de la tarea. Cuenta como «chicos»,
   que en la carga vale la mitad (TIPOS.ninos.peso). */
async function empezarCuidado(ninos, juntos = false) {
  if (E.cuidado) return aviso("Ya estás contado con los chicos.", true);
  await F.addDoc(F.collection(db, "sesiones"), {
    tareaId: null, tareaTitulo: "", tipo: "ninos", ninos, juntos,
    uid: E.yo.uid, nombre: E.miembro.nombre || "",
    inicio: F.Timestamp.now(), fin: null, horas: 0, estado: "en_curso",
    registro: "cuidado", creadoEn: F.serverTimestamp(),
  });
}
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
function pintar() {
  if ($("app").hidden) return;
  const foco = document.activeElement;
  if (foco && foco.closest && foco.closest(".ficha, .dia-notas, .evento-form, .pas-ed, .chicos-ed") && foco.matches("textarea, input:not([type=checkbox]):not([type=radio])")) {
    if (!esperandoFoco) { esperandoFoco = true; foco.addEventListener("blur", () => { esperandoFoco = false; setTimeout(pintar, 0); }, { once: true }); }
    return;
  }
  for (const s of SOLAPAS) $("v-" + s).hidden = s !== E.solapa;
  pintarCrono();
  pintarCuidado();
  if (E.solapa === "ahora") pintarAhora();
  if (E.solapa === "hoy") pintarHoy();
  if (E.solapa === "agenda") pintarAgenda();
  if (E.solapa === "tareas") pintarTareas();
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
  const ninos = E.familia.ninos || [];
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
  if (!ninos.length) { c.innerHTML = `<p class="gris">No aparecen los chicos: están en la base, pedíselo al agente.</p>`; return; }
  // app-8, pedido de Mauro: «con Yacko, con Kala, ambos o todos». «Todos
  // juntos» es la familia entera: los mismos chicos que «ambos», y la sesión
  // lo dice (`juntos`) para que el balance lo pueda distinguir.
  c.innerHTML = `<div class="cuidado-botones"><span class="gris">Estoy con</span>` +
    ninos.map((n) => `<button class="mini nino" style="--c:${esc(n.color || "#c89bd8")}" data-con="${esc(n.id)}">${esc(n.nombre)}</button>`).join("") +
    (ninos.length > 1 ? `<button class="mini nino" data-con="*">${ninos.length === 2 ? "Ambos" : "Los " + ninos.length}</button>` : "") +
    `<button class="mini nino" data-con="todos">Todos juntos</button></div>`;
  for (const b of c.querySelectorAll("[data-con]")) b.onclick = () => {
    const todos = ninos.map((n) => n.id);
    const x = b.dataset.con;
    empezarCuidado(x === "*" || x === "todos" ? todos : [x], x === "todos").catch(fallo);
  };
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
  f.innerHTML = `<div class="fila">${flecha("f:" + t.id, cuantos)}
      ${t.hecho ? `<span class="play apagado">✓</span>` : corre ? `<button class="play parar" aria-label="Parar">■</button>` : `<button class="play" aria-label="Empezar">▶</button>`}
      <span class="txt">${esc(t.titulo)}${chipsDe(t, porId)}${cuantos && plegado.has("f:" + t.id) ? ` <small class="gris">· ${cuantos} adentro</small>` : ""}</span>
      <button class="mas" aria-label="Más">${abierta ? "▴" : "⋯"}</button></div>`;
  engancharFlecha(f);
  const p = f.querySelector("button.play");
  if (p) p.onclick = () => (corre ? frenarFamilia(false) : arrancarFamilia(t)).catch(fallo);
  f.querySelector(".mas").onclick = () => { E.abierta = abierta ? null : "f:" + t.id; pintar(); };
  if (abierta) f.append(fichaTarea(t, hijos));
  return f;
}

function fichaTarea(t, hijos) {
  const d = document.createElement("div");
  d.className = "ficha";
  const o = otro();
  const mia = (t.encargados || []).includes(E.yo.uid);
  const comun = t.alcance === "comun";
  const lunes = lunesDe(E.hoy);
  const pedAMi = t.pedido && t.pedido.estado === "pendiente" && t.pedido.a === E.yo.uid;
  d.innerHTML = `
    ${t.pedido && t.pedido.texto ? `<p class="gris">Pedido de ${esc(nombreDe(t.pedido.de))}: «${esc(t.pedido.texto)}»</p>` : ""}
    ${pedAMi ? `<div class="botones"><button class="mini ok" data-a="aceptar">Me ocupo</button><button class="mini" data-a="devolver">No puedo</button></div>` : ""}
    <div class="botones">
      ${t.hecho ? `<button class="mini" data-a="reabrir">Volver a pendiente</button>` : `
      <button class="mini${mia ? " on" : ""}" data-a="yo">${mia ? "✓ Me ocupo yo" : "Me ocupo yo"}</button>
      ${comun && o ? `<button class="mini" data-a="pedir">Pedírsela a ${esc(o.nombre || "el otro")}</button>` : ""}
      ${comun ? `<button class="mini${t.meta ? " on" : ""}" data-a="meta">${t.meta ? "★ Meta de la semana" : "☆ Meta de la semana"}</button>` : ""}
      <button class="mini${estaEnAgenda("f:" + t.id) ? " on" : ""}" data-a="agenda">${estaEnAgenda("f:" + t.id) ? "📅 En mi agenda" : "📅 A mi agenda y ubicarla"}</button>
      <button class="mini" data-a="adentro">＋ Tarea adentro</button>
      <button class="mini" data-a="hecha">✔ Hecha</button>`}
      ${t.duenio === E.yo.uid ? `<button class="mini" data-a="borrar">Borrar</button>` : ""}
    </div>
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
  // «Un botón para arrastrar a mi agenda y ahí poder moverla en la semana»:
  // la pone en la agenda y lleva ahí, donde se arrastra con el agarre ⠿.
  on("agenda", () => {
    const ya = estaEnAgenda("f:" + t.id);
    alternarEnAgenda("f:" + t.id);
    if (!ya) irA("agenda");
  });
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
      <button class="mini${estaEnAgenda("cv:" + a.id) ? " on" : ""}" data-a="agenda">${estaEnAgenda("cv:" + a.id) ? "📅 En mi agenda" : "📅 A mi agenda"}</button>
      <a class="mini" href="https://casaverdecanas.com.br/interno/actividades.html?a=${encodeURIComponent(a.id)}&editar=1" target="_blank" rel="noopener">Editar en Casa Verde</a>
    </div>
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
  d.querySelector('[data-a="agenda"]').onclick = () => alternarEnAgenda("cv:" + a.id);
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
  // Lo que espera una decisión tuya, con un toque para ir a resolverlo.
  const avisos = [];
  // app-12: las de agenda y las preguntas se contestan ACÁ (propone.js); a
  // Plata van sólo la plata, las tareas y las actividades de los chicos.
  const props = (E.propuestas || []).filter((p) => !CLASES_PROPONE.includes(p.clase)).length;
  if (props) avisos.push([`${props} cosa(s) que propuso el agente, para aprobar`, "plata"]);
  const conf = bloquesPorConfirmar(E.bloques, E.yo.uid, personas().map((p) => p.id)).length;
  if (conf) avisos.push([`${conf} acuerdo(s) de tiempo: ¿se cumplieron?`, "balance"]);
  const autos = automaticosPendientes(E.recurrentes, E.movs, E.hoy).length;
  if (autos) avisos.push([`${autos} pago(s) automático(s) de este mes para confirmar`, "plata"]);
  for (const [t, a] of avisos) {
    const b = Object.assign(document.createElement("button"), { className: "aviso-ir", textContent: t + " →" });
    b.onclick = () => irA(a);
    v.append(b);
  }
  // app-12: lo que Claude propone para TU agenda, para aceptar o corregir.
  tarjetasPropone(v);
  // app-13: lo que te recordás hoy y la lista de deseos.
  alertasYDeseos(v);
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
  const vivas = E.tareas.filter((t) => !t.hecho);
  const mias = vivas.filter((t) => (t.encargados || []).includes(E.yo.uid) || t.alcance === "personal");
  const libres = vivas.filter((t) => t.alcance === "comun" && !(t.encargados || []).length);
  v.append(h2("Lo que tomaste"));
  v.append(mias.length ? listaFamilia(mias) : gris("Nada todavía. En una tarea, «Me ocupo yo»."));
  v.append(h2("De los dos, sin encargado"));
  v.append(libres.length ? listaFamilia(libres) : gris("Todas tienen a alguien."));
  v.append(h2("Casa Verde"));
  if (!E.cv) v.append(gris("Sin sesión en Casa Verde."));
  else if (!E.cvActs.length) v.append(gris("Nada pendiente."));
  else v.append(listaCV(E.cvActs));
}

/* ── TAREAS: la pizarra de la semana y la lista entera ────────────────────── */
let lunesPizarra = null;
function pintarTareas() {
  const lunes = lunesPizarra || lunesDe(E.hoy);
  for (const b of document.querySelectorAll("[data-vt]")) b.setAttribute("aria-selected", String(b.dataset.vt === E.vistaTareas));
  const sel = $("nueva-padre");
  const { raices, porId, hijos: hijosSel } = arbol(E.tareas.filter((t) => !t.hecho));
  const antes = sel.value;
  // app-8: se puede meter adentro de cualquier tarea, no sólo de un proyecto.
  const opciones = [];
  const bajarSel = (t, n) => { opciones.push(`<option value="${esc(t.id)}">${"— ".repeat(n)}${esc(t.titulo)}${n ? "" : " (" + esc(TIPOS[tipoHeredado(t, porId)].nombre) + ")"}</option>`); for (const h of hijosSel[t.id] || []) bajarSel(h, n + 1); };
  for (const r of raices) bajarSel(r, 0);
  sel.innerHTML = `<option value="">— Proyecto nuevo (suelto) —</option>` + opciones.join("");
  sel.value = antes;
  $("nueva-tipo").parentElement.hidden = !!sel.value;
  sel.onchange = () => { $("nueva-tipo").parentElement.hidden = !!sel.value; };
  $("nueva-meta").parentElement.hidden = E.vistaTareas !== "pizarra";
  $("form-tarea").hidden = E.vistaTareas === "compras";
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
  v.append(listaFamilia(E.tareas.filter((t) => !t.hecho), { todas: true }));
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
  const padreId = $("nueva-padre").value || null;
  const { porId } = arbol(E.tareas);
  const padre = padreId ? porId[padreId] : null;
  // El tipo lo pone la raíz: una hija lo hereda y lo guarda igual, para que
  // la regla pueda validarlo sin leer al padre.
  const tipo = padre ? tipoHeredado(padre, porId) : $("nueva-tipo").value;
  const personal = $("nueva-personal").checked;
  try {
    await F.addDoc(F.collection(db, "tareas"), {
      titulo: titulo.slice(0, 120), parentId: padreId, tipo,
      alcance: personal ? "personal" : "comun",
      duenio: E.yo.uid, hecho: false, encargados: $("nueva-mia").checked || personal ? [E.yo.uid] : [],
      meta: !personal && E.vistaTareas === "pizarra" && $("nueva-meta").checked ? (lunesPizarra || lunesDe(E.hoy)) : null,
      detalle: "", creadoEn: F.serverTimestamp(),
    });
    $("nueva-titulo").value = "";
  } catch (e) { fallo(e); }
};

arrancar();
