// ─────────────────────────────────────────────────────────────────────────────
// firebase-init.js — El único contacto con Firebase. Dos bases, un SDK.
// Sello: init-1
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
export let CV = null;            // { mod, Core } de Casa Verde, o null si no bajó
export let errorCasaVerde = "";

let promesa = null;

export function cargar() {
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
    F = { ...fs, ...au };

    try {
      const mod = await import(CASA_VERDE + "firebase-init.js");
      await mod.cargarFirebase();
      const { Core } = await import(CASA_VERDE + "actividades-core.js");
      CV = { mod, Core };
    } catch (e) {
      CV = null;
      errorCasaVerde = "No se pudo cargar Casa Verde: " + (e && e.message || e);
    }
    return true;
  })();
  return promesa;
}
