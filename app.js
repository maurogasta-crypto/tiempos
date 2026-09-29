// ─────────────────────────────────────────────────────────────────────────────
// app.js — La pantalla de «tiempos».
// Sello: app-1
//
// Tres solapas: AHORA (el cronómetro único y qué arrancar), TAREAS (las de la
// familia) y SEMANA (horas por tipo, de los dos). Las cuentas no viven acá:
// están en `nucleo.js`, probadas. Esto dibuja y llama.
//
// Casa Verde entra por su propio código (`CV.Core`), nunca copiado: arrancar
// es `Core.iniciar`, frenar es `Core.finalizar`. Ver `firebase-init.js`.
// ─────────────────────────────────────────────────────────────────────────────

import { cargar, db, auth, F, CV, errorCasaVerde } from "./firebase-init.js";
import { TIPOS, TIPO_CASA_VERDE, tipoHeredado, arbol, sumarPorTipo, cargaDe,
         semanaDe, fmtHoras, quePuedoArrancar, esc } from "./nucleo.js";

const $ = (id) => document.getElementById(id);
const E = {                                   // el estado de la pantalla
  yo: null, miembro: null, miembros: [], cv: null, cvNombre: "",
  tareas: [], cvActs: [], enCursoFam: null, enCursoCV: null,
  solapa: "ahora", semana: null, reloj: null,
};

function aviso(t, mal = false) {
  const n = $("aviso");
  n.textContent = t; n.className = mal ? "aviso mal" : "aviso";
  n.hidden = !t;
  if (t && !mal) setTimeout(() => { if (n.textContent === t) n.hidden = true; }, 5000);
}
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
    await F.signInWithEmailAndPassword(auth, mail, clave);
    // La misma cuenta entra también a Casa Verde. Si falla ahí, la parte de
    // la familia anda igual y se dice.
    if (CV && !CV.mod.auth.currentUser) {
      try { await CV.mod.signInWithEmailAndPassword(CV.mod.auth, mail, clave); }
      catch { aviso("Entraste, pero Casa Verde no aceptó esa contraseña: sus tareas no se van a ver.", true); }
    }
  } catch (e) {
    aviso(e.code === "auth/invalid-credential" ? "Mail o contraseña incorrectos." : "No se pudo entrar: " + e.message, true);
  } finally { $("btn-entrar").disabled = false; $("clave").value = ""; }
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
  escucharFamilia();
  await conectarCasaVerde();
  pintar();
  clearInterval(E.reloj);
  E.reloj = setInterval(pintarReloj, 1000);
}

/* ── Pedir acceso ─────────────────────────────────────────────────────────────
   Entrar no alcanza: hay que ser MIEMBRO. El primer ingreso deja una
   solicitud con el mail de la sesión (la regla lo verifica) y el agente la
   aprueba creando `miembros/{uid}`. Así ningún mail ni UID queda escrito en
   este repositorio, que es público. */
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
  // Dos consultas y no una: cada una tiene que poder probarse contra la regla.
  F.onSnapshot(F.query(c, F.where("alcance", "==", "comun")),
    (s) => { comunes = s.docs.map((d) => ({ id: d.id, ...d.data() })); unir(); });
  F.onSnapshot(F.query(c, F.where("alcance", "==", "personal"), F.where("duenio", "==", E.yo.uid)),
    (s) => { mias = s.docs.map((d) => ({ id: d.id, ...d.data() })); unir(); });
  F.onSnapshot(F.query(F.collection(db, "sesiones"), F.where("uid", "==", E.yo.uid),
    F.where("estado", "==", "en_curso"), F.limit(1)), (s) => {
    const d = s.docs[0];
    E.enCursoFam = d ? { id: d.id, ...d.data(), titulo: d.data().tareaTitulo || "una tarea personal",
                         inicioMs: d.data().inicio && d.data().inicio.toMillis() } : null;
    pintar();
  });
  F.onSnapshot(F.collection(db, "miembros"), (s) => { E.miembros = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
}

async function arrancarFamilia(t) {
  const ok = quePuedoArrancar(E.enCursoCV, E.enCursoFam);
  if (!ok.puede) return aviso(ok.motivo, true);
  const { porId } = arbol(E.tareas);
  const tipo = tipoHeredado(t, porId);
  await F.addDoc(F.collection(db, "sesiones"), {
    tareaId: t.id,
    // El título de una tarea PERSONAL no viaja en la sesión: la sesión la
    // lee el otro, para los totales, y lo personal es de cada uno.
    tareaTitulo: t.alcance === "comun" ? t.titulo : "",
    tipo, uid: E.yo.uid, nombre: E.miembro.nombre || "",
    inicio: F.Timestamp.now(), fin: null, horas: 0, estado: "en_curso",
    registro: "cronometro", creadoEn: F.serverTimestamp(),
  });
}

async function frenarFamilia() {
  const s = E.enCursoFam; if (!s) return;
  const ahora = F.Timestamp.now();
  const horas = Math.round(Math.max(0, (ahora.toMillis() - s.inicioMs) / 3600000) * 100) / 100;
  await F.updateDoc(F.doc(db, "sesiones", s.id), { fin: ahora, horas, estado: "finalizada" });
  aviso(`Registrado: ${fmtHoras(horas)}.`);
}

/* ── Casa Verde, por su propio código ─────────────────────────────────────── */
async function conectarCasaVerde() {
  if (!CV) { E.cv = null; return; }
  const u = CV.mod.auth.currentUser;
  if (!u) { E.cv = null; return; }
  const p = await CV.mod.getDoc(CV.mod.doc(CV.mod.db, "usuarios", u.uid)).catch(() => null);
  E.cvNombre = (p && p.exists() && p.data().nombre) || "";
  E.cv = { uid: u.uid, nombre: E.cvNombre };
  // Para sumar las horas de Casa Verde a las de la familia hace falta saber
  // qué cuenta de allá es de quién. Lo escribe cada uno en su ficha.
  if (E.miembro.cvUid !== u.uid)
    await F.updateDoc(F.doc(db, "miembros", E.yo.uid), { cvUid: u.uid, actualizadoEn: F.serverTimestamp() }).catch(() => {});
  const M = CV.mod;
  M.onSnapshot(CV.Core.consultaActividades(E.cv, false), (s) => {
    E.cvActs = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => !a.hecho && !CV.Core.limpiezaLatente(a));
    pintar();
  }, (e) => aviso("Casa Verde no deja leer sus tareas: " + e.message, true));
  M.onSnapshot(M.query(M.collection(M.db, "sesiones"), M.where("uid", "==", u.uid),
    M.where("estado", "==", "en_curso"), M.limit(1)), (s) => {
    const d = s.docs[0];
    E.enCursoCV = d ? { id: d.id, ...d.data(), titulo: d.data().actividadTitulo,
                        inicioMs: d.data().inicio && d.data().inicio.toMillis() } : null;
    pintar();
  });
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
    aviso(`Registrado en Casa Verde: ${fmtHoras(r.horas)}${terminada ? " · tarea terminada" : ""}.`);
  } catch (e) { aviso(e.message, true); }
}

/* ── Dibujar ──────────────────────────────────────────────────────────────── */
for (const b of document.querySelectorAll("[data-solapa]")) b.onclick = () => {
  E.solapa = b.dataset.solapa;
  for (const x of document.querySelectorAll("[data-solapa]")) x.setAttribute("aria-selected", String(x === b));
  pintar();
};

function pintarReloj() {
  const s = E.enCursoCV || E.enCursoFam;
  const n = $("reloj-tiempo");
  if (!s || !n) return;
  const seg = Math.max(0, Math.floor((Date.now() - s.inicioMs) / 1000));
  n.textContent = `${Math.floor(seg / 3600)}:${String(Math.floor(seg / 60) % 60).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
}

function pintar() {
  if ($("app").hidden) return;
  for (const s of ["ahora", "tareas", "semana"]) $("v-" + s).hidden = s !== E.solapa;
  pintarCrono();
  if (E.solapa === "ahora") pintarAhora();
  if (E.solapa === "tareas") pintarTareas();
  if (E.solapa === "semana") pintarSemana();
  $("cv-estado").textContent = !CV ? errorCasaVerde
    : !E.cv ? "Casa Verde: sin sesión. Salí y volvé a entrar con la misma contraseña de Casa Verde." : "";
}

function pintarCrono() {
  const s = E.enCursoCV || E.enCursoFam;
  const c = $("crono");
  if (!s) { c.innerHTML = `<p class="gris">No hay nada corriendo.</p>`; return; }
  const deCV = !!E.enCursoCV;
  c.innerHTML = `<div class="crono-vivo">
      <span class="chip" style="--c:${deCV ? TIPOS.produccion.color : (TIPOS[s.tipo] || TIPOS.personal).color}">${deCV ? "Casa Verde" : esc((TIPOS[s.tipo] || {}).nombre)}</span>
      <b>${esc(s.titulo)}</b>
      <div id="reloj-tiempo" class="reloj">0:00:00</div>
      <div class="botones">
        <button class="boton" id="parar">Parar</button>
        ${deCV ? `<button class="boton sec" id="parar-terminar">Parar y terminé la tarea</button>` : ""}
      </div></div>`;
  $("parar").onclick = () => (deCV ? frenarCV(false) : frenarFamilia()).catch((e) => aviso(e.message, true));
  if (deCV) $("parar-terminar").onclick = () => frenarCV(true);
  pintarReloj();
}

function listaArbol(items, { alTocar, etiqueta }) {
  const { raices, hijos } = arbol(items);
  const ul = document.createElement("div");
  const fila = (t, nivel) => {
    const f = document.createElement("div");
    f.className = "fila"; f.style.paddingLeft = (nivel * 16) + "px";
    f.innerHTML = `<button class="play" aria-label="Empezar">▶</button><span class="txt">${esc(t.titulo)}${etiqueta ? etiqueta(t) : ""}</span>`;
    f.querySelector(".play").onclick = () => alTocar(t);
    ul.append(f);
    for (const h of hijos[t.id] || []) fila(h, nivel + 1);
  };
  for (const r of raices) fila(r, 0);
  return ul;
}

function pintarAhora() {
  const v = $("v-ahora-listas"); v.replaceChildren();
  const fam = E.tareas.filter((t) => !t.hecho);
  const h1 = document.createElement("h2"); h1.textContent = "Familia"; v.append(h1);
  if (!fam.length) v.append(Object.assign(document.createElement("p"), { className: "gris", textContent: "Todavía no hay tareas. Se cargan en la solapa «Tareas»." }));
  else {
    const { porId } = arbol(E.tareas);
    v.append(listaArbol(fam, { alTocar: (t) => arrancarFamilia(t).catch((e) => aviso(e.message, true)),
      etiqueta: (t) => ` <small class="tipo" style="--c:${TIPOS[tipoHeredado(t, porId)].color}">${esc(TIPOS[tipoHeredado(t, porId)].nombre)}${t.alcance === "personal" ? " · sólo vos" : ""}</small>` }));
  }
  const h2 = document.createElement("h2"); h2.textContent = "Casa Verde"; v.append(h2);
  if (!E.cv) v.append(Object.assign(document.createElement("p"), { className: "gris", textContent: "Sin sesión en Casa Verde." }));
  else if (!E.cvActs.length) v.append(Object.assign(document.createElement("p"), { className: "gris", textContent: "Nada pendiente." }));
  else v.append(listaArbol(E.cvActs, { alTocar: (a) => arrancarCV(a) }));
}

function pintarTareas() {
  const sel = $("nueva-padre");
  const { raices, porId } = arbol(E.tareas);
  sel.innerHTML = `<option value="">— Nueva raíz —</option>` +
    raices.map((r) => `<option value="${esc(r.id)}">${esc(r.titulo)} (${esc(TIPOS[tipoHeredado(r, porId)].nombre)})</option>`).join("");
  $("nueva-tipo").parentElement.hidden = !!sel.value;
  sel.onchange = () => { $("nueva-tipo").parentElement.hidden = !!sel.value; };
  const v = $("v-tareas-lista"); v.replaceChildren();
  const vivas = E.tareas.filter((t) => !t.hecho);
  if (!vivas.length) { v.innerHTML = `<p class="gris">Todavía no hay tareas.</p>`; return; }
  const { raices: rs, hijos } = arbol(vivas);
  const fila = (t, nivel) => {
    const f = document.createElement("div");
    f.className = "fila"; f.style.paddingLeft = (nivel * 16) + "px";
    const mia = t.duenio === E.yo.uid;
    f.innerHTML = `<span class="txt">${esc(t.titulo)} <small class="tipo" style="--c:${TIPOS[tipoHeredado(t, porId)].color}">${esc(TIPOS[tipoHeredado(t, porId)].nombre)}${t.alcance === "personal" ? " · sólo vos" : " · de los dos"}</small></span>
      <button class="mini" data-a="hecha">Hecha</button>${mia ? `<button class="mini" data-a="borrar">Borrar</button>` : ""}`;
    f.querySelector('[data-a="hecha"]').onclick = () => F.updateDoc(F.doc(db, "tareas", t.id), { hecho: true, actualizadoEn: F.serverTimestamp() }).catch((e) => aviso(e.message, true));
    const b = f.querySelector('[data-a="borrar"]');
    if (b) b.onclick = () => {
      if ((hijos[t.id] || []).length) return aviso("Tiene tareas adentro: borralas primero.", true);
      if (confirm(`¿Borrar «${t.titulo}»? Las horas ya registradas quedan.`)) F.deleteDoc(F.doc(db, "tareas", t.id)).catch((e) => aviso(e.message, true));
    };
    v.append(f);
    for (const h of hijos[t.id] || []) fila(h, nivel + 1);
  };
  for (const r of rs) fila(r, 0);
}

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
  try {
    await F.addDoc(F.collection(db, "tareas"), {
      titulo: titulo.slice(0, 120), parentId: padreId, tipo,
      alcance: $("nueva-personal").checked ? "personal" : "comun",
      duenio: E.yo.uid, hecho: false, creadoEn: F.serverTimestamp(),
    });
    $("nueva-titulo").value = "";
  } catch (e) { aviso("No se pudo: " + e.message, true); }
};

async function pintarSemana() {
  const v = $("v-semana-cuerpo");
  const { desdeMs, hastaMs } = semanaDe();
  v.innerHTML = `<p class="gris">Sumando…</p>`;
  try {
    const desde = F.Timestamp.fromMillis(desdeMs);
    const fam = await F.getDocs(F.query(F.collection(db, "sesiones"), F.where("inicio", ">=", desde)));
    const sesiones = fam.docs.map((d) => ({ ...d.data(), inicioMs: d.data().inicio && d.data().inicio.toMillis() }));
    // Las horas de Casa Verde de cada uno, contadas como producción.
    const cvUids = Object.fromEntries(E.miembros.filter((m) => m.cvUid).map((m) => [m.cvUid, m.id]));
    if (CV && E.cv && Object.keys(cvUids).length) {
      // Por persona y SIN filtro de fecha: igualdad sobre un campo y rango
      // sobre otro pide un índice compuesto, y en la base de Casa Verde ése
      // es un cambio más para publicar. Son pocas sesiones: se filtra acá.
      const M = CV.mod;
      for (const cvUid of Object.keys(cvUids)) {
        const s = await M.getDocs(M.query(M.collection(M.db, "sesiones"), M.where("uid", "==", cvUid)));
        for (const d of s.docs) sesiones.push({ ...d.data(), uid: cvUids[cvUid], tipo: TIPO_CASA_VERDE,
          inicioMs: d.data().inicio && d.data().inicio.toMillis() });
      }
    }
    const tot = sumarPorTipo(sesiones, { desdeMs, hastaMs });
    const personas = E.miembros.length ? E.miembros : [E.miembro];
    v.innerHTML = personas.map((m) => {
      const t = tot[m.id] || {};
      const max = Math.max(1, ...Object.values(t));
      return `<div class="persona"><h3>${esc(m.nombre || "—")} <small>carga ${fmtHoras(cargaDe(t))}</small></h3>` +
        Object.entries(TIPOS).map(([k, x]) => `<div class="barra-fila"><span>${esc(x.nombre)}</span>
          <span class="barra"><i style="width:${Math.round(100 * (t[k] || 0) / max)}%;background:${x.color}"></i></span>
          <span class="num">${fmtHoras(t[k] || 0)}</span></div>`).join("") + `</div>`;
    }).join("") + `<p class="gris">La carga es producción + mantenimiento + chicos. Casa Verde cuenta como producción. Semana de lunes a domingo.</p>`;
  } catch (e) { v.innerHTML = `<p class="mal">No se pudo sumar: ${esc(e.message)}</p>`; }
}

arrancar();
