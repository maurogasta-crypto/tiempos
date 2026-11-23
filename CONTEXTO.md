# tiempos (Timón) — CONTEXTO para una sesión nueva

> Este archivo es para una sesión de Claude que **no conoce nada del ecosistema**. Explica qué es este repositorio, cómo está armado, cómo funciona,
> qué reglas tiene y por qué, y cómo se trabaja sin romperlo. Leelo entero antes de tocar nada. Es una **foto del 21-nov-2026**
> (`app-44`, reglas v26): si algo de acá contradice el código, **manda el código** y el archivo se corrige en la misma tanda.
> Los demás documentos del repo: `CLAUDE.md` (las reglas cortas), `HISTORIA.md` (el porqué de cada regla, con fechas y errores), `README.md` (el detalle de cada pantalla).
> **Hablale a Mauro siempre en castellano rioplatense.**

## 1 · Qué es y para quién

**Timón** es la aplicación de uso diario de **Mauro** y **Florencia** (pareja, con hijos): pendientes personales, de la familia y de los lugares donde trabajan, en un solo lugar.
Es un sitio **estático** (HTML + módulos ES, sin build ni `npm`), **instalable** (PWA), servido tal cual por GitHub Pages en
`https://maurogasta-crypto.github.io/tiempos/`. El repo público es `maurogasta-crypto/tiempos`.

**El nombre:** desde el 8-nov-2026 se llama Timón, y desde el 17-nov **todo lo visible dice Timón**, incluida la app de Android (repo `pizarra`).
Los nombres internos **no se cambian** porque cambiarlos rompe lo instalado: el repo y la dirección (`tiempos`), la base `tiempos-71d42`, el `id` del manifest,
y en Android el paquete `com.maurogasta.pizarra`, `pizarra.apk` y los sellos `pizarra-N`. Un texto nuevo dice «Timón»; nunca nombres «Tiempos» ni «la Pizarra» como otra app.

**Qué hace hoy**, en una frase por pantalla (la barra de abajo trae Hoy, Tareas, Agenda y «Más»):
- **Hoy** (`hoy.js`): los **ítems** de todos tus espacios en una lista; tildás, agregás, tocás el texto para ver el detalle. Es la pantalla de arranque.
- **Tareas** (`app.js`): árbol de tareas por categoría (producción, mantenimiento, chicos, casa y comida, personal), con encargado, meta de la semana y reloj sólo para lo que se **cobra**.
- **Agenda** (`agenda.js`): tu semana (mañana, tarde, noche) que ordenás arrastrando; es de cada uno. Muestra también lo de los chicos y las llegadas y salidas de Casa Verde.
- **Más:** Pizarra (anotar rápido, preguntarle a la IA, lo que Claude propone), Cotidianas (desayuno, basura, etc., que se tildan), Chicos (con quién están, actividades), Plata (gastos, fijos, año, reparto, extractos, proyectos, análisis), Balance (carga y tiempo liberado), y las **compras** (lista editable, modo súper, lista compartida sin cuenta).
- El **globo 💡/❓** (en todas las solapas): preguntarle a la IA (sólo contesta), mandar una sugerencia o una falla a `reportes/`.

**Dónde encaja en el ecosistema** (plan «Timón», `protocolos/ARQUITECTURA.md` de `datos`): Timón es **la ÚNICA app de uso diario**. Los negocios (Casa Verde, CasaYourte, remate, Paseo, BandoMaps, Hilux, Roli) son apps
**independientes** con su base y su gente; Timón los muestra por un **contrato** (`conector-N.js`), nunca importando sus archivos. `pizarra` (Android) es la cáscara de Timón: lo muestra adentro y pone lo que la web no puede (widgets, avisos, alarmas, compartir).
El servidor común es `timon-servidor` (su código vive en `datos/servidor/`). Las piezas comunes a todos los sitios viven en `datos` (`ojos.js`, `errores.js`, `callmebot.js`, `servidor-1.js`).

## 2 · El ecosistema en un párrafo (para no perderte)

Mauro mantiene varios proyectos con ayuda de sesiones de Claude. **`datos`** es el *panel* (un tablero de pendientes por proyecto + una bóveda de claves que sólo Mauro ve) y guarda las herramientas de línea de comandos y los protocolos.
Una **ronda** automática (Claude, tres veces por día) lee los pendientes, los reportes de cada sitio y los avisos, prepara borradores y propuestas, y respalda las bases; **no escribe plata ni le escribe a nadie de afuera**.
**`bodega`** es un repo privado con copias de las bases y registros de la ronda. **`pizarra`** es la app de Android. **`casaverdecanas`** es Casa Verde (alquiler de cabañas en Brasil; su base `casaverde-20` es la que Timón lee por su conector).
Hay un **agente** (un usuario común de Firebase, nunca una cuenta de servicio) con permisos limitados por las reglas de cada base. Cada sesión de Claude trabaja un repo a la vez, lo **reserva** antes de editarlo (`node herramientas/ronda.mjs reservar <repo>` desde `datos`) y empuja a `main` directo después de verificar.

## 3 · Mapa de archivos (uno por uno)

Todo está en la raíz (plano, sin carpetas), porque se edita desde el teléfono y se sirve tal cual. Cada archivo con lógica lleva su **sello** (`app-44`, `nucleo-48`…) que **sube cuando el archivo cambia**.

| Archivo | Qué hace | De qué depende |
|---|---|---|
| `nucleo.js` (`nucleo-48`, ~135 KB, ~170 exports) | **Todas las cuentas y reglas de negocio, sin Firebase ni pantalla**: tipos de tarea, carga y tiempo liberado (`balanceTiempo`), reparto, agenda (franjas, `ubicarEnSemana`), compras, validaciones (`validarMovimiento`, `validarItem`), balance de plata, fijos/año/trimestre, extractos, ítems (`TIPOS_ITEM`, `ordenarItems`, `materializarHoy`), IA (`leerConsultaIA`, `buscarEnAgenda`, `escudarNombres`), proyectos (`fichaDeProyecto`, `itemsDeProyecto`). Es testeable en Node | nada (puro) |
| `estado.js` (`estado-6`) | El objeto `E` con lo que se sabe (sesión, datos escuchados) y el gancho para redibujar. Las vistas leen de acá | — |
| `firebase-init.js` (`init-7`) | **El único contacto con Firebase.** Dos bases, un SDK, todo **diferido** (`import()` en `try`): si gstatic o Casa Verde no responden, la pantalla lo dice en vez de quedar en blanco. Envuelve las escrituras para despertar a las Pizarras de Android (`QUE_DE_COLECCION`) | SDK `gstatic.com/firebasejs/12.16.0/`, `conector-1.js` de Casa Verde |
| `app.js` (`app-44`, ~1200 líneas) | Entrar, los relojes, la solapa Tareas, la barra de abajo y «Más», ordenar del `?solapa=`/`?proyecto=`/`?gasto=`/`?dictar=`/`?abrir=` | todo lo demás |
| `hoy.js` (`hoy-3`) | La solapa «Hoy»: ítems de mis espacios, chips por proyecto, ficha del ítem; escribe `items/` | `nucleo`, `estado` |
| `pizarra.js` (`pizarra-web-3`) | Anotar, preguntarle a la IA, «Mi pizarra» (la del widget), propuestas, recordatorios, alarmas, deseos | |
| `propone.js` (`propone-8`) | Lo que Claude propone para tu agenda (la misma forma que `propuestasDeConsulta` en Android) | |
| `deseos.js` (`deseos-3`) | Deseos y actividades con frecuencia, «hoy se puede», edición de días y horas | |
| `agenda.js` (`agenda-23`) | Tu semana arrastrando, actividades propias, mes, llegadas/salidas de Casa Verde, alarmas «Avisarme» | |
| `familia.js` (`familia-6`) | Cotidianas y Chicos | |
| `compras.js` (`compras-7`) | Listas de compras (`familia/compras`), modo súper, enlace sin cuenta, y las compras de Casa Verde por su conector | |
| `lista.html` + `lista.js` (`lista-2`) | La lista compartida **sin cuenta** (`?c=<token>`, 48 h). **No está en el SHELL** | |
| `manual.html` (`manual-1`) | El manual de uso para compartir, con un diagrama por acción. Página suelta, fuera del SHELL, `noindex`. **Si cambia lo que hace la app, cambia el manual** | mermaid (CDN) |
| `plata.js` (`plata-19`) | Lo disponible, gastos, foto de boleta (IA), «Por aprobar» | |
| `extractos.js` (`extractos-2`), `finanzas.js` (`finanzas-6`), `proyectos.js` (`proyectos-3`), `cifras.js` (`cifras-1`) | Plata: extractos de bancos, Fijos/Año/Reparto, economía por proyecto, estimado contra real | |
| `proyecto.js` (`proyecto-2`) | La pantalla de UN proyecto (`?proyecto=<cuenta>`): lo que falta, Hoy, lo que viene, la plata, documentos y bitácora | |
| `balance.js` (`balance-5`) | Balance del tiempo, acuerdos, auditoría | |
| `lugares.js` (`lugares-3`) | Mis lugares y el interruptor «Claude organiza mi agenda» | |
| `sugerir.js` (`sugerir-24`) | El globo: IA (sólo contesta), sugerencias y fallas a `reportes/` | |
| `index.html` | El HTML: solapas (`data-solapa`), `<script type="module" src="app.js?v=44">` | |
| `sw.js` (`tiempos-78`) | Service worker: el cascarón abre sin señal. **Sólo lo propio, sólo GET**; Firebase y Casa Verde van siempre a la red. No guarda `?dictar=` ni `?c=` | |
| `manifest.json`, iconos | Hacen la app instalable | |
| `firestore.rules` (v26) | Las reglas de la base `tiempos-71d42` (la plantilla: lleva el marcador `UID-DEL-AGENTE`; las publica Mauro desde el panel) | |
| `pruebas.mjs` (265 casos) | El banco, sin npm ni red | |
| `.github/workflows/pages.yml` | Publica a GitHub Pages (**no se saca**: los push de un agente no disparan la publicación «desde una rama»; no usa secretos) | |

## 4 · Los flujos principales, paso a paso

**Entrar.** La persona entra con mail y contraseña (Firebase Authentication de `tiempos-71d42`, y la misma cuenta abre la sesión de Casa Verde). La primera vez deja una **solicitud** (`solicitudes/{uid}`); el agente la aprueba creando `miembros/{uid}`. Sin ese documento no ve nada. Ningún mail ni UID entra al repo.

**Hoy y los ítems (etapa 4 del plan).** Un **ítem** (`items/{id}`) es la forma única hacia la que van migrando tarea, cita, compra, pedido y pregunta, **de a un tipo por vez** (hoy sólo `tarea`, **en paralelo con la solapa Tareas de siempre**: nada se apaga hasta que lo nuevo se usó una semana, desde el 23-nov). Cada ítem tiene espacio (`familia` o `p-<uid>`; la regla decide por el id), importancia (alta/normal/baja), día, hora y, desde `app-44`, **`proyecto`**: el id de una cuenta de Plata → Cuentas (no hay catálogo aparte). El orden lo pone `ordenarItems`: la **fecha** pone la urgencia (vencido > hoy > mañana), la **persona** la importancia, y lo hecho va al final; lo que no tiene día flota en hoy.

**`hoy/{uid}` (regla 3 del plan: «lo que se calcula, se calcula una vez»).** Cada vez que cambian tus ítems, la app **materializa** un documento con los próximos siete días (`materializarHoy`): cada renglón lleva `dia`, `texto`, `espacio`, `proyecto` (ya resuelto a nombre), `hora`, `clave` (`it:<id>`) y **la acción exacta que se escribe al tildar** (`accion.coleccion/doc/campos`) y la que lo deshace (`accion.deshacer`). Se escribe con respiro de 2 s y sólo si cambió. El **widget «Hoy» de Android** sólo lo pinta y, al tildar, escribe esa acción tal cual: Android no sabe cómo es una tarea. **Si cambia la forma del renglón, cambia `Hoy.kt` de `pizarra` en la misma tanda.**

**Tareas, reloj y Casa Verde.** El cronómetro es **único** y sólo para lo que se cobra: las actividades de Casa Verde y las tareas marcadas «Lleva reloj». Mientras corre uno no arranca otro en ninguna de las dos bases. Casa Verde se usa **por su conector** (`conector-1.js`: `Core.iniciar`, `Core.finalizar`, `Core.tildar`, `Core.tildarCompra`), nunca copiando su lógica; la única escritura directa a su base es la agenda de cada uno (`estado_usuario/{uid}.agenda`, con la misma forma que usa Casa Verde). Las llegadas y salidas de Casa Verde se **leen** (sólo lectura) con la sesión de allá.

**El tiempo con los chicos y el reparto.** La regla del 29-sep: **carga** = estar a cargo de los chicos o producir (una vez, no dos); **tiempo liberado** = estar en algo personal sin los chicos, o que el otro esté solo con los dos chicos mientras uno no produce. Cuenta lo **medido** y lo **acordado que los dos confirmaron** (cada uno firma sólo lo suyo). El tiempo con los chicos **sale del calendario** de Chicos, no de un reloj. El reparto (`repartir`) está escrito y probado pero **no se muestra** hasta que Mauro y Florencia lo acuerden; lo que se muestra es `repartoDelMes`.

**Plata.** Todo es de la familia; la cuenta sólo dice **a qué fue** (destino) y no cambia el reparto. **Cada moneda es un sistema aparte: UYU, BRL y USD nunca se suman ni se convierten.** Un gasto se carga con la **foto de la boleta** (la IA de Casa Verde la lee, vía `claude-proxy`, y deja una sugerencia editable; se sube al guardar, no al elegir, para no dejar huérfanos). El **agente propone** (`propuestas/`) y una persona **aprueba**: recién ahí se escribe el movimiento. Los **extractos** de los bancos (Prex, BTG) se cargan sin repetir (`idExtracto`: si esa función cambia, un extracto cargado dos veces se duplica).

**IA.** La IA de Timón **sólo contesta**: Gemini dice qué buscar (`leerConsultaIA`) y la respuesta la arma el código con lo que ve la sesión; **los números los calcula el código, por moneda**. No escribe nada. Los nombres de los chicos **no salen** hacia la IA (`escudarNombres`) y lo pegado sale sin documento, teléfono ni mail.

**Compras.** Listas editables en `familia/compras`, modo súper por pasillos (la pantalla no se apaga), en vivo entre los dos. «Compartir» crea `compartidas/{token}` (22 letras al azar = la llave): `lista.html?c=<token>` abre esa lista **sin cuenta** durante 48 h; es **la única colección que se lee sin sesión**, sólo con el token, nunca listando. En Casa Verde las compras son actividades «Es una compra»; se ven y tildan acá por su conector.

**Reportes.** El globo manda una sugerencia o falla a `reportes/` (con urgencia); la ronda lo lee y lo convierte en pendiente del panel. El globo despierta al chat con `avisarClaude` (manda **base e id, nunca el texto**) y la nota dice que contesta una IA y puede tardar hasta un día.

**Agente y agenda.** Claude organiza la agenda **sólo de quien enciende «🤝 Claude organiza mi agenda»** (copias previas en `agendas/{uid}/copias`; `herramientas/agenda.mjs` de `datos` conserva la forma de `agenda.js`). `agendas/` está **sellada** para el agente (nunca listarla).

## 5 · Datos y bases

Base principal **`tiempos-71d42`** (Firebase, plan Spark). Colecciones (según `firestore.rules` v26; la regla manda): `solicitudes`, `miembros`, `tareas`, `sesiones`, `_historial` (copia previa de cada cambio del agente), `agendas/{uid}` (+`copias`), `dias`, `turnos`, `eventos`, `familia/{doc}` (`config` con los chicos y el patrón acordado; `compras`, `cuentas`… como mapas), `marcas` (no llevan título: `hasOnly`), `bloques` (acuerdos de tiempo), `movimientos`, `recurrentes`, `propuestas`, `extractos`, `auditoria`, `reportes`, `compartidas/{token}`, `avisos` (buzón: lo crea el agente, lo lee y marca su dueño), `mensajes`, `audios`, `archivos`, `llamadas`, `salud`, `enlace_llave` y `enlace/{par}/cosas`, `alertas`, `deseos`, `items`, `hoy/{uid}`. Todo lo demás está cerrado (deny por defecto).

Segunda base, **`casaverde-20`**, **sólo a través del conector de Casa Verde**; Timón no tiene reglas allá.

**Qué puede el agente** (lo que la ronda y las sesiones hacen con su usuario): leer casi todo; **escribir sólo** `propuestas` y `auditoria` (plata: *propone*), tareas comunes y sesiones **con copia previa en `_historial/`** (crear, nunca editar ni borrar), `avisos` (crear), `miembros` (al aprobar una solicitud), y la agenda de quien lo encendió. **No toca**: `hoy/{uid}` y `agendas` (en `selladas` de `datos/herramientas/firestore.mjs`), `enlace_llave/familia`, y borra la charla sólo con `charla.mjs limpiar` y la autorización de Mauro.
**«Lo que el agente no toca» está escrito en dos lugares** (`firestore.rules` y `selladas` en `datos/herramientas/firestore.mjs`): si cambia uno, cambia el otro.

**Secretos:** ningún valor real de una credencial entra a este repo, a otro ni a un chat. Hay `CONFIG` de Firebase (identifica el proyecto; **no da permisos**; público por diseño), contraseñas de las personas (Firebase Authentication), contraseña del agente (variables de entorno de Claude Code) y el UID del agente (marcador `UID-DEL-AGENTE` en las reglas; el valor, en el panel). **Ningún mail, UID ni nombre de los chicos entra al repo** (es público): los nombres viven en `familia/config`.

## 6 · Reglas de trabajo, con su porqué

1. **Un solo contacto con el SDK (`firebase-init.js`), diferido.** Antes, una caída del CDN dejaba la pantalla en blanco sin un mensaje. Nada que dependa de Firebase corre al nivel superior de un módulo. **Toda escritura va por `F`**: ninguna pantalla importa el SDK por su cuenta (si no, no despierta a las Pizarras).
2. **Casa Verde se usa, no se copia.** Copiar su lógica produce dos copias que divergen en silencio; el banco falla si Timón usa algo que el `OFRECE` del conector no lista. Si cambia la forma de una reserva allá, cambia acá en la misma tanda. **El SDK tiene que ser la misma versión que el de Casa Verde** (comparte el módulo; con otra anda pero con dos SDK en memoria).
3. **Las cuentas viven en `nucleo.js`, sin Firebase ni pantalla**, para poder probarlas en Node. No se duplican en otro archivo.
4. **Una colección nueva entra con su regla en la misma tanda**, y las reglas se editan **completas**, nunca por fragmentos. Cuando el cambio pide publicar reglas se dice: **«hay que publicar `firestore.rules`»** (las publica Mauro; el agente no).
5. **Un tipo de tiempo vive en tres lugares** (`TIPOS`, `index.html`, `tipoValido()` de las reglas) y un tipo de ítem en dos (`TIPOS_ITEM` y la regla v25): el banco exige que digan lo mismo.
6. **El agente no escribe plata: la propone.** Una persona aprueba. Esto vale para gastos, ingresos y acuerdos de tiempo.
7. **UYU, BRL y USD nunca se suman.** Cada moneda es un sistema aparte.
8. **Todo lo que llega de plata se evalúa e incorpora sin repetir y completando lo que había.** Antes de cargar un extracto, una boleta o un dato de plata se lee `PROTOCOLO-PLATA.md` de `datos`.
9. **Nada se apaga hasta que lo nuevo se usó una semana** (regla 8 del plan), de a un tipo de ítem por vez, diciendo el **costo contra el cupo gratuito** en cada tanda que agrega uso (la base ya se quedó sin cupo una vez, el 27-oct).
10. **Un tap, una acción; mirar, hacer, profundizar** (`PROTOCOLO-INTERFAZ` § 14). La pantalla no se redibuja mientras el foco pasa a otro elemento del mismo formulario (`esperarSalida`). Elegir una imagen son **dos inputs** (cámara y archivos). Toda contraseña tiene su ojo 👁 (`ojos.js` de `datos`, diferido y con `.catch`; `errores.js` igual).
11. **La barra de abajo no cambia los ids de solapa** (los widgets de Android entran por `?solapa=`). Su alto entra en `--piso`; «Ajustes de la app» sólo se ve dentro de la app (user agent `PizarraApp/`). **Se publica primero el sitio y después la app.**
12. **Los nombres de los chicos no entran al código ni a las pruebas.** Las direcciones de cada uno viven en `agendas/{uid}`: ninguna entra al código.
13. **Ningún desarrollo pasa de los cupos gratuitos** (`PROTOCOLO-DESARROLLO` § 13): cada tanda que agrega uso dice cuánto para 10 personas. Lo que pide facturación no se hace.

## 7 · Cómo se verifica

Desde la raíz del repo, **sin npm y sin red**:
- `node pruebas.mjs` → hoy **265 casos**. Cubre las cuentas de `nucleo.js`, que cada `id` que busca `app.js` exista en el HTML, que **los imports entre archivos coincidan** (un nombre que un archivo importa y el otro no exporta deja la app en blanco, y `node --check` no lo ve), que las reglas no tengan un mail ni un UID real, que el SDK sea **la misma versión** que el de Casa Verde, y que la única escritura directa a Casa Verde sea la agenda.
- Parseo como módulo: `node --input-type=module --check < archivo.js` (también el JS dentro de los `.html`). `node --check` a secas **no alcanza**.
- Se suben los **sellos** de cada archivo que cambió y la `VERSION` de `sw.js` si cambia algo de `SHELL` (si no, los teléfonos sirven una mezcla de viejo y nuevo).
- La **documentación** (`README.md`, la tabla de archivos y sellos, este archivo) tiene que decir la verdad en la misma tanda.
- Si el cambio toca la forma de `hoy/`, además `Hoy.kt` de `pizarra` y su banco (`./gradlew test assembleRelease lintRelease`, en el repo `pizarra`).

## 8 · Cómo se despliega

Se empuja a `main` directo (criterio permanente de Mauro, 3-nov-2026) **después de verificar**. `pages.yml` publica a GitHub Pages por Actions (Settings → Pages → Source: **GitHub Actions**; no usa secretos). **Un push de un agente no dispara publicaciones «desde una rama»**, por eso el workflow existe y no se saca. Las reglas de Firestore **no** se despliegan por push: las publica Mauro pegando `firestore.rules` en la consola de Firebase (el panel de `datos` tiene el mecanismo de «copiar, abrir consola, ya las publiqué»). El servidor del ecosistema se despliega desde Termux con `datos/herramientas/desplegar.mjs`; **el chat no despliega**.

## 9 · Lo que NO se toca y los errores que ya costaron

- **No renombrar** `tiempos`, `tiempos-71d42`, el `id` del manifest, ni en Android `pizarra`/`com.maurogasta.pizarra`: rompe lo instalado.
- **No importar el SDK desde una pantalla**, ni usar algo de Casa Verde que no esté en su `OFRECE`.
- **No escribir plata** desde el agente; **no mostrar el reparto** antes de que lo acuerden.
- **No guardar `hoy/` ni `agendas/` desde el agente** (sellados) y **nunca listar `agendas`**.
- **No tocar `lista.html` para meterlo al SHELL** (es la única pantalla sin sesión).
- **Nunca copiar un valor de credencial**, un mail, un UID ni el nombre de un hijo al repo.
- Errores que ya pasaron: un nombre importado que otro archivo no exporta dejó la app en blanco; una boleta en pesos quedó en reales (la moneda y la fecha de la factura ganan a las del formulario); la IA armaba planes y se equivocaba (se sacó: ahora sólo contesta); `idExtracto` mal cambiado duplica extractos; la publicación «desde una rama» dejó el sitio clavado en una tanda vieja; la base se quedó sin cupo de lecturas (27-oct) hasta que los pedidos se hicieron por partes.

## 10 · Estado actual y qué falta (21-nov-2026)

- **Hecho:** «Hoy» con ítems y espacios implícitos (`tarea`), `hoy/{uid}` materializado, el widget «Hoy» de Android (pizarra-84/85), el proyecto de cada ítem y la barra de abajo (app-44), las compras de Casa Verde en la solapa Compras (compras-7).
- **En paralelo hasta el 23-nov:** la solapa Tareas y «Hoy» conviven; después de una semana de uso se decide apagar lo viejo.
- **Sin empezar:** hilos dentro de los ítems (etapa 6), más tipos de ítem (cita, compra, pedido, pregunta), espacios con miembros (nacen con el primer negocio, etapa 8; el plan está en `datos/protocolos/INTEGRACION.md` § 8), `timon-1.js` para que los negocios lean y escriban sus ítems, «Foco de hoy», y mover encargado/meta/«a mi agenda»/reloj a la ficha de Hoy.
- **Decisiones de Mauro abiertas** (`INTEGRACION.md` § 9): D1 a D6 (si el libro de cada negocio también se guarda acá, cuentas de Timón para el equipo de cada negocio, qué se muda al final, orden de los negocios, espacios para BandoMaps y Roli, qué señales van a «Hoy»).

## 11 · Glosario

- **Ítem / espacio / hilo:** la forma única de lo pendiente / dónde vive y quién lo ve (`familia`, `p-<uid>`, uno por negocio más adelante) / la conversación de un ítem.
- **Materializar:** dejar armado un documento (`hoy/{uid}`) con lo que otro (el widget) sólo tiene que pintar.
- **Conector (`conector-N.js`):** el contrato versionado por el que un negocio le muestra datos a Timón; un cambio incompatible es un número nuevo al lado.
- **Ronda:** la rutina automática de Claude (tres veces por día) que lee, respalda, propone y avisa; sus reglas están en `datos/ronda/trabajos/`.
- **Agente:** el usuario de Firebase que usa Claude; tiene permisos acotados por las reglas.
- **Panel:** el repo `datos` (tablero de pendientes + bóveda de claves de Mauro).
- **Bodega:** repo privado `maurogasta-crypto/bodega` (respaldos, registros, borradores).
- **Pizarra:** hasta el 17-nov, el nombre de la app de Android; hoy «Pizarra» queda sólo como el nombre de una solapa y su widget (las tareas fijadas).
- **Sello:** el número de versión que lleva cada archivo y que **sube** cuando el archivo cambia (`app-44`, `nucleo-48`…).
- **SHELL:** la lista de archivos que el service worker guarda para abrir sin señal (`sw.js`).
- **Cupo:** el límite gratuito de Firebase Spark (50 K lecturas y 20 K escrituras por día); cada tanda que agrega uso dice cuánto gasta.
- **Parte / tanda:** una entrega de cambios con su verificación y sus sellos.
