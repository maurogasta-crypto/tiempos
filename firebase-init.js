// ─────────────────────────────────────────────────────────────────────────────
// firebase-init.js — El único contacto con Firebase. Dos bases, un SDK.
// Sello: init-4
//
// ── LAS DOS BASES ────────────────────────────────────────────────────────────
// · `tiempos-71d42` — la de la familia: tareas, sesiones y (después) el
//   reparto. La ven sólo Mauro, Florencia y el agente.
// · `casaverde-20` — la de Casa Verde, **a través de su propio código**: se
//   importan `firebase-init.js` y `actividades-core.js` desde el sitio de Casa
//   Verde. Así arrancar, frenar, cerrar el ciclo y repartir honorarios son
//   EXACTAMENTE lo que hace el panel de Casa Verde, y si ese código cambia,
//   esta app lo toma sola. Copiarlo acá sería el error de siempre: dos copias
//   que divergen en silencio.
//
// ── EL MISMO SDK ─────────────────────────────────────────────────────────────
// La versión tiene que ser la MISMA que la de Casa Verde: un módulo se
// identifica por su dirección, así que con la misma dirección el navegador
// baja el SDK una sola vez y las dos bases comparten las mismas funciones.
// Con otra, andaría igual pero con dos SDK enteros en memoria. `pruebas.mjs`
// compara las dos versiones.
//
// ── DIFERIDO, como en todo el ecosistema ─────────────────────────────────────
// Nada se importa en forma estática: si gstatic.com o el sitio de Casa Verde
// no contestan, la pantalla lo dice en vez de quedar en blanco. Y si Casa
// Verde no baja, la parte de la familia anda igual.
// ─────────────────────────────────────────────────────────────────────────────

export const SDK = "https://www.gstatic.com/firebasejs/12.16.0/";
export const CASA_VERDE = "https://casaverdecanas.com.br/interno/";

/* Público por diseño: identifica al proyecto, NO da permisos. Eso lo hacen
   las reglas de `firestore.rules`. */
const CONFIG = {
  apiKey: "AIzaSyAjf8dxZMljfPDRcbyrUIkP0p_y0lNoCyI",
  authDomain: "tiempos-71d42.firebaseapp.com",
  projectId: "tiempos-71d42",
  storageBucket: "tiempos-71d42.firebasestorage.app",
  messagingSenderId: "1054515278200",
  appId: "1:1054515278200:web:3f2f75bc3b252fb343d88d",
};

/* Enlaces vivos: `undefined` hasta que `cargar()` los rellena. */
export let db, auth, F;          // F: las funciones del SDK (doc, query, …)
export let CV = null;            // { mod, Core, CV2 } de Casa Verde, o null si no bajó
export let errorCasaVerde = "";

let promesa = null;

// init-3: la página de una lista compartida (lista.html, compras-4) la abre
// gente sin cuenta: pide `{ casaVerde: false }` y no baja el código de Casa
// Verde, que no le sirve de nada.
export function cargar({ casaVerde = true } = {}) {
  if (promesa) return promesa;
  promesa = (async () => {
    let a, au, fs;
    try {
      [a, au, fs] = await Promise.all([
        import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"),
        import(SDK + "firebase-firestore.js")]);
    } catch (e) {
      promesa = null;
      const err = new Error("No se pudo cargar Firebase. Suele ser falta de señal.");
      err.codigo = "sdk-no-baja";
      throw err;
    }
    // Nombre propio: la app SIN nombre es la de Casa Verde, que la arma su
    // propio firebase-init al importarlo.
    const app = a.getApps().find((x) => x.name === "tiempos") || a.initializeApp(CONFIG, "tiempos");
    try {
      db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({
        tabManager: fs.persistentMultipleTabManager() }) });
    } catch { db = fs.getFirestore(app); }
    auth = au.getAuth(app);
    F = envolverEscrituras({ ...fs, ...au }, () => db, () => auth);
    if (!casaVerde) return true;

    try {
      const mod = await import(CASA_VERDE + "firebase-init.js");
      await mod.cargarFirebase();
      const { Core } = await import(CASA_VERDE + "actividades-core.js");
      // init-2: el núcleo de Casa Verde, para subir las boletas con SU
      // `subirImagen` (comprime y va a su Cloudinary) y leerlas con SU
      // función de IA (`CV2.NETLIFY`). Si no baja, Tiempos anda igual: sólo
      // no hay fotos ni lectura automática.
      let CV2 = null;
      try { ({ CV2 } = await import(CASA_VERDE + "nucleo.js")); } catch { CV2 = null; }
      CV = { mod, Core, CV2 };
    } catch (e) {
      CV = null;
      errorCasaVerde = "No se pudo cargar Casa Verde: " + (e && e.message || e);
    }
    return true;
  })();
  return promesa;
}

// ── DESPERTAR A LAS PIZARRAS (init-4, 24-oct-2026, general:C1 fase 2) ────────
// Mauro: «una conexión en tiempo real entre todos los integrantes». Cada vez
// que esta app guarda algo que muestra la Pizarra, se le pide a `despertar`
// del Netlify de Casa Verde que mande un aviso SIN contenido al tema de
// Tiempos: las Pizarras se ponen al día solas, con su sesión. Se hace ACÁ, en
// las cuatro funciones de escritura, y no en cada pantalla: así ninguna
// escritura nueva se olvida. Sólo las de ESTA base (no las de Casa Verde) y
// sólo las colecciones que la Pizarra lee. Nunca bloquea ni falla: si no
// llega, la Pizarra lo trae a los 10 minutos.
export const DESPERTAR = "https://serene-scone-76bd4e.netlify.app/.netlify/functions/despertar";
export const QUE_DE_COLECCION = {
  tareas: "tareas", alertas: "alertas", agendas: "agenda", eventos: "agenda",
  deseos: "agenda", mensajes: "mensajes", avisos: "avisos", propuestas: "todo",
};
/** Qué cambió, según la dirección de lo escrito (`tareas/abc` → «tareas»); null si la Pizarra no lo muestra. */
export function queCambio(ruta) {
  const c = String(ruta || "").split("/")[0];
  return Object.prototype.hasOwnProperty.call(QUE_DE_COLECCION, c) ? QUE_DE_COLECCION[c] : null;
}
const pendientes = new Map();
function despertarLuego(que, getAuth) {
  // Tres cosas guardadas seguidas despiertan una vez.
  clearTimeout(pendientes.get(que));
  pendientes.set(que, setTimeout(async () => {
    pendientes.delete(que);
    try {
      const u = getAuth() && getAuth().currentUser;
      if (!u || u.isAnonymous) return;
      const t = await u.getIdToken();
      await fetch(DESPERTAR, { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
        body: JSON.stringify({ base: "tiempos", que }) });
    } catch (e) { /* silencio a propósito: lo guardado ya quedó */ }
  }, 2000));
}
export function envolverEscrituras(F, getDb, getAuth) {
  const avisar = (ref) => {
    try {
      if (!ref || ref.firestore !== getDb()) return;
      const que = queCambio(ref.path);
      if (que) despertarLuego(que, getAuth);
    } catch (e) { /* nunca rompe una escritura */ }
  };
  const tras = (fn) => (ref, ...resto) => fn(ref, ...resto).then((r) => { avisar(ref); return r; });
  const G = { ...F, addDoc: tras(F.addDoc), setDoc: tras(F.setDoc), updateDoc: tras(F.updateDoc), deleteDoc: tras(F.deleteDoc) };
  G.writeBatch = (...a) => {
    const b = F.writeBatch(...a), refs = [];
    for (const m of ["set", "update", "delete"]) { const o = b[m].bind(b); b[m] = (ref, ...r) => { refs.push(ref); o(ref, ...r); return b; }; }
    const commit = b.commit.bind(b);
    b.commit = () => commit().then((r) => { refs.forEach(avisar); return r; });
    return b;
  };
  return G;
}
