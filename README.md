# Tiempos

Un solo cronómetro para Mauro y Florencia: lo de la familia y lo de Casa Verde.
App instalable, sin build, servida tal cual por GitHub Pages.

| | |
|---|---|
| App | https://maurogasta-crypto.github.io/tiempos/ |
| Base | Firebase `tiempos-71d42` (la de la familia) · y `casaverde-20` por el código de Casa Verde |
| Publicación | `.github/workflows/pages.yml` — Settings → Pages → Source: **GitHub Actions** |
| Banco | `node pruebas.mjs` (140 casos, sin npm, sin red) |

## Qué hace (app-16)

**Desde app-16 (7-oct-2026, `tiempos:V7`) las dos primeras solapas son
Pizarra y Tareas**, y Ahora dejó de ser una solapa. Lo pidió Mauro para que la
app del teléfono (la Pizarra) sea una sola app con todo Tiempos adentro:

- **Pizarra** (`pizarra.js`): anotar rápido —sin botón de dictado: se escribe
  o se dicta con el 🎤 del teclado— y «✨ Armar con la IA» arma el plan; lo
  que espera una decisión; **Mi pizarra**, la misma del widget del teléfono
  (`pizarra.<uid>`), con «＋ Elegir» que abre una ventana con las tareas por
  categoría (el ámbito heredado); lo que Claude propone, recordatorios,
  alarmas y deseos.
- **Tareas**: arriba lo que era Ahora (el reloj, lo que te pidieron, lo que
  tomaste, Casa Verde) y abajo la pizarra de la semana, todas y compras.
- **Agenda** con **Semana / Mes**: el mes cuenta qué hay cada día (dorado lo
  tuyo, violeta lo de los chicos) y tocar un día abre esa semana.
- En Pizarra el reloj de arriba sólo aparece si hay algo corriendo.

Lo que sigue describe cada parte; donde dice «Ahora», hoy es arriba de Tareas
(el reloj y lo tomado) o Pizarra (propuestas, recordatorios y deseos).

Lo de arriba de todo —el cronómetro y «Estoy con»— está en todas.

- **Ahora**: un solo cronómetro de tarea. Se elige una tarea de la familia o de
  Casa Verde y corre; mientras corre uno no arranca otro en ninguna de las dos
  bases. Se para con «queda pendiente» o «terminé». Aparte, y **en paralelo**,
  «Estoy con» un chico, **ambos** o **todos juntos** (la familia entera; la
  sesión lo marca con `juntos`): ese reloj no frena ni bloquea el de la tarea.
  Arriba lo que **te pidieron**, después lo que tomaste, lo de los dos sin
  encargado, y Casa Verde. Cada tarea se despliega con «⋯».
- **Los grupos se pliegan** con la flechita ▾/▸, como en Casa Verde (app-7):
  queda una fila con cuántas tiene adentro. Se recuerda en cada teléfono.
- **Ficha de una tarea de la familia**: en la tarea de arriba de un grupo, su
  **ámbito** (las hijas lo heredan); «Me ocupo yo» (un clic), «Pedírsela al
  otro» (con una nota), «Meta de la semana», «A mi agenda», el detalle y para
  cuándo, y **su color** (app-8: lo de adentro lo hereda, salvo que tenga el
  suyo). «＋ Tarea adentro» mete una tarea adentro de cualquier otra, sin límite
  de niveles; «A mi agenda y ubicarla» la pone en la agenda y lleva ahí, donde
  se mueve en la semana con el agarre ⠿. Quien recibe un pedido lo acepta («Me ocupo») o lo devuelve («No
  puedo»); al aceptar, pasa a ser suya y deja de ser de quien la pidió.
- **Ficha de una tarea de Casa Verde**: el detalle, las fechas, la hora, cada
  cuánto se repite, el monto, quiénes la hacen, la última vez, y **los
  registros**: quién le dedicó tiempo, cuándo y cuánto, con el total. Se puede
  dar por hecha sin cronómetro (`Core.tildar`) y abrir en Casa Verde.
- **Hoy**: lo cotidiano se **tilda**, no se cronometra —desayuno, almuerzo,
  merienda, cena, la basura, los cuartos, lavar, doblar y guardar—, con **la
  vajilla al lado de cada comida** (app-8). Queda quién y a qué hora, y cada
  una puede llevar una observación; abajo, las del día. **«＋ Agregar otra»**
  suma una cotidiana para todos los días (`familia/config.cotidianasExtra`);
  las agregadas se sacan con ✕, las de siempre no.
- **Agenda**: mi semana, en mañana, tarde y noche, **arrastrando** del ⠿. Es de
  cada uno: el otro no la ve. Cada día muestra con quién están los chicos y
  sus actividades, que en la agenda aparecen para los dos y no se arrastran.
  Las tareas de Casa Verde van a la agenda **de Casa Verde** (ver abajo).
- **Tareas**: la **pizarra de la semana** —las metas, agrupadas por quién se
  ocupa; lo que no se terminó sigue la semana siguiente— y la lista entera.
  Una tarea tiene su ámbito (producción, mantenimiento, chicos, casa y comida,
  personal), y puede ser de los dos o sólo mía. Un **proyecto** es una tarea
  suelta: «Adentro de» deja elegir cualquier tarea, a cualquier nivel.
  **Compras** (app-8): listas editables —súper, ferretería, materiales, lo que
  sea— que se despliegan con sus casillas; lo comprado se tacha y se saca con un
  botón. Viven en `familia/compras`, de los dos.
  **🛒 Ir al súper** (compras-2, 9-oct-2026): una lista puede tener
  **pasillos** (`secciones`, en el orden en que se camina el local) y cada cosa
  su pasillo y una nota chica. El modo súper muestra una sola lista por
  pasillos, con tildes grandes; lo tildado se tacha y **se queda en su lugar**
  (`recorridoDeCompra`), la pantalla no se apaga mientras está abierto, y
  «↺ Destildar todo» la deja lista para la próxima vez. Los pasillos hoy los
  arma Claude en la base; desde la app se agrega una cosa eligiendo el pasillo.
  **De a dos** (compras-3): la lista es en vivo para los dos, y en el modo
  súper lo que tildó el otro dice quién («✓ Flor») y se ilumina al llegar.
  «🔗 Compartir» manda `…/tiempos/?super=<lista>`, que abre Tiempos directo en
  esa lista; lo abre quien es miembro de Tiempos.
  **Sin cuenta** (compras-4, reglas v13): desde compras-4 «🔗 Compartir»
  manda `lista.html?c=<token>`, que abre ESA lista sin cuenta durante 48 h
  (se renuevan con «+48 h»). Quien la abre escribe su nombre una vez, tilda
  y agrega; Tiempos lo ve al instante con su nombre. Mientras dura, la lista
  vive en `compartidas/{token}` (en `familia/compras` queda el puntero); «Cerrar
  el enlace» la trae de vuelta y borra el documento. El token (22 letras al
  azar) es la llave: la regla no deja listar sin sesión, ni leer vencida, ni
  cambiar otra cosa que las cosas de la lista.
- **Chicos**: la semana o el mes, con un señalador por persona y por chico.
  Sale de **lo acordado** para cada día de la semana, y un día distinto se
  cambia tocándolo. Las **actividades** —básquet, kung fu, amigos, la
  psicóloga— se cargan acá, pueden repetirse cada semana, y las ven los dos
  siempre, las cargue quien las cargue. **Los chicos no se agregan desde la
  app** (pedido de Mauro, 30-sep): son los que están en `familia/config`.
- **Plata**: lo disponible por moneda (nunca se suman entre sí), los gastos y
  las entradas del mes. Un gasto se carga con la **foto de la boleta** (cámara
  o archivo), que la IA de Casa Verde lee y deja como sugerencia editable. Un
  gasto puede ser **pago automático**: cada mes, pasado su día, pide que se
  confirme el monto («Pagado» / «Este mes no»). Arriba, **Por aprobar**: lo que
  el agente sacó de un chat o de un WhatsApp, ya completado y editable; recién
  al aprobarlo se escribe.
- **Balance**: la **carga** y el **tiempo liberado** de cada uno, en la semana
  o el mes, con la regla del 29-sep (abajo). Los **acuerdos de tiempo** —«semana
  de trabajo afuera», «me quedo con los dos»— se cargan antes y, cuando pasan,
  se les pide a los dos que confirmen si se cumplió: recién entonces cuentan.
  Debajo, las horas por tipo y la **auditoría**: lo que se revisa solo (relojes
  olvidados, gastos sin boleta ni detalle, acuerdos sin confirmar, días sin
  nada tildado) y las observaciones del agente, que se pueden contestar.

- **El globo 💡** (abajo a la derecha, en todas las solapas): una
  **sugerencia** o **algo que anda mal**, con qué tan urgente es. Va a
  `reportes/` de esta base, igual que en los sitios, y la ronda diaria del
  agente lo pasa al panel de Mauro como pendiente. Antes de mandar dice que lo
  lee una IA y que puede tardar hasta un día; abajo se ve lo que uno mandó.

### La regla del tiempo (29-sep-2026)

- **Carga**: estar a cargo de los chicos —aunque se esté haciendo otra cosa— o
  estar produciendo. Una vez, no dos.
- **Tiempo liberado** (el cupo que se gasta): estar en algo personal sin los
  chicos, **o** que el otro esté solo con los dos chicos mientras uno no está
  produciendo.
- Una semana de trabajo afuera con el otro a cargo de los dos es neutra: los dos
  tienen carga, nadie gasta cupo.
- Cuenta lo medido (los relojes) y lo acordado **que los dos confirmaron**. Está
  en `balanceTiempo` de `nucleo.js`, con sus casos en el banco.

### Compartir desde Instagram o cualquier red (app-15, sugerir-10 · pizarra-7)

En el teléfono, «Compartir → Tiempos» desde Instagram, Facebook, TikTok,
WhatsApp o el navegador abre la app con el link (limpio de `?igsh=` y
compañía) en la caja del dictado. Instagram no deja leer sus publicaciones
desde afuera, así que la app pide una 📷 captura del reel o del flyer; al
tocar Seguir la sube a Cloudinary (la cuenta de Casa Verde, carpeta `tiempos`)
y abre el sitio con `&imagen=`. El sitio la baja para Gemini **sin volver a
subirla** (`fotoSubida`) y sólo si es de nuestra cuenta; la IA pone el link en
el detalle de lo que propone.

### Lo que enseñó la primera prueba real (sugerir-9, 5-oct-2026, 00:37)

«Preguntar a Florencia por la hora en el dentista. Marcar la pizarra y
generar una alarma para mañana a las 10:30» salió con dos errores de la IA:
la alarma quedó para el 6 (a las 00:37 «mañana» es el 5) y la tarea se llamó
«Marcar la pizarra». Ahora Gemini recibe la hora, la regla de la madrugada y
que «pizarra» es el lugar, nunca el título.

### La app del teléfono (app-14, sugerir-8 · pizarra-2)

- **La Pizarra es la app de Tiempos en Android** (`maurogasta-crypto/pizarra`,
  decisión de Mauro del 5-oct-2026). Dicta con el reconocedor de Android —el
  del teclado, que sí anda— y abre este sitio con `?dictar=<texto>`: el globo
  se abre en Agenda con el texto y se precarga solo. La dirección se limpia al
  entrar y el service worker no la guarda en la caché.
- **Las alarmas suenan desde la app**: lee `alertas/` y las programa en el
  teléfono. «⭐ Hoy se puede» también está ahí, con la misma cuenta
  (`posiblesDelDia` vive en los dos repositorios: si cambia acá, cambia allá).

### Deseos con frecuencia (deseos-1, nucleo-12, reglas v10)

- **Un flyer de algo semanal queda como semanal.** Gemini devuelve los días y
  las horas (`dias`, `hi`, `hf`); uno de un evento, la `fecha`. Lo que no se
  entiende queda vacío y se corrige editando.
- **«⭐ Hoy se puede»**, arriba en Ahora y en Hoy: lo semanal de ese día de la
  semana y lo especial de esa fecha, por hora, de los dos (menos lo
  descartado). En Hoy sigue al día que se esté mirando.
- **La lista «Deseos y actividades que nos gustan»** en Ahora: cada una con
  su ✏️, que abre el formulario ahí mismo — qué, dónde, para quién, cada
  semana (con los días) / una fecha / sin fecha, horas, detalle, y **cambiar o
  sacar el flyer** (se sube al Guardar, nunca al elegirlo). ＋ Agregar a mano,
  sin dictar. La editan los dos; la borra su dueño.
- **Reglas v10**: lo mismo que v9, más que los dos puedan editar un deseo sin
  cambiar de quién es. Hay que publicarlas desde el panel.

### Lo que se sumó el 5-oct-2026, a la noche (nucleo-11, sugerir-6, propone-3, app-13, reglas v9)

- **Un dictado es un PLAN, no una sola actividad.** «Mañana tengo que ir antes
  al gimnasio para llevar los títulos del auto a Pedro» → Gemini recibe TU
  agenda de las próximas dos semanas (`agendaParaIA`, sólo título, día, horas
  y clase), encuentra el gimnasio y propone varias acciones, cada una con su
  casilla: una **tarea** en tu pizarra («juntar títulos del auto para Pedro»),
  un **recordatorio** temprano y una **alarma** un rato antes del gimnasio.
  Se destilda lo que no va y se toca **Hacer**. `leerPlanIA` lo lee con
  desconfianza: una acción que no tiene forma no aparece. Y desde
  `nucleo-13` (`tiempos:A18`) un recordatorio o una alarma que cae en una hora
  que ya pasó se corre —el recordatorio a la próxima hora en punto, la alarma
  al día siguiente a su hora— y la tarjeta lo dice en las dudas: una alerta
  pasada no suena nunca.
  Y desde `nucleo-15` (7-oct-2026) el plan se ordena antes de mostrarlo:
  **lo que el plan ya hace no es una tarea** («Guardar actividades en la
  agenda» se descarta, `esTareaDelSistema`); una actividad de hoy a una hora
  que ya pasó se corre a mañana **junto con sus avisos**; un recordatorio va
  siempre antes de lo que recuerda; y **la alarma de salir trae el viaje**
  que estima la IA —desde dónde, adónde y cuántos minutos—: la hora es la de
  la actividad menos el viaje menos 10 de margen, y la tarjeta lo muestra
  para corregir.
  Y desde `nucleo-16`: «el miércoles» dictado un miércoles después de la
  hora es el de la **semana que viene**, no hoy ni mañana (`diasHastaSiPaso`).
- **El ＋ de cada día** (agenda-8, 8-oct-2026): al lado de cada día de la
  Agenda abre una hoja: primero «Escribí la actividad» con su categoría, y
  abajo todo lo que ya tenés sin día, agrupado por categoría. Al agregar una
  nueva, la app busca si ya existe una parecida (`parecidas`, por palabras) y
  pregunta «¿Es alguna de éstas?» o «No, agregar una nueva». La lista fija
  «Para agendar» ya no está.
- **Mis lugares** (lugares-1, nucleo-17, 7-oct-2026): al armar un plan la
  app pide la ubicación APROXIMADA del teléfono —no se guarda— para saber si
  estás en Uruguay o en Brasil, y elige tu casa de ese país como punto de
  salida. Los lugares de las actividades se anotan solos en «📍 Mis lugares»
  (abajo de la Agenda) y ahí se les pone la dirección una vez. Todo vive en
  `agendas/{uid}`, que ve sólo su dueño; las direcciones van a la IA del plan
  para estimar el viaje, y ninguna entra al código.
- **Pedile a la IA** (sugerir-16, nucleo-22, 10-oct-2026, pedido de Mauro:
  «que agregar a la agenda sea pedir a la IA… todo lo que puede registrar el
  sistema en un solo lugar»). El cuadro de la Pizarra y el globo ya no dicen
  «Para la agenda»: lo dictado se vuelve un plan que además de agenda, pizarra,
  recordatorio, alarma, deseo, compra y pedido puede traer un **gasto** (va a
  Plata con la sesión de quien lo marca; si falta la moneda, la fecha o la
  categoría, el renglón sale sin poder marcarse), las **actividades de los
  chicos** (nueva, cambiar, sacar o saltear un día) y **cambiar o sacar** algo
  de la propia agenda (`reprogramarActividad` y `sacarActividad` de agenda.js,
  los mismos de la pantalla). **Los nombres de los chicos no viajan a la IA**:
  pasan a «Chico1», «Chico2» antes de mandar y vuelven a la vuelta
  (`escudarNombres`/`devolverNombres`). «Los chicos» son todos; si se nombra a
  uno, la actividad es de ése (sugerir-17).
- **Las cuentas y las consultas** (plata-7, sugerir-18, nucleo-24, 10-oct-2026,
  `tiempos:V11`). Mauro: «un control de los gastos de cada lugar y/o vehículo
  y/o persona… un balance a pedido por cualquiera de los conceptos». Un gasto
  o una entrada dice a qué **cuenta** fue (General Flores y su depósito, Santa
  Fe y su depósito, Dgo Aramburú, la Hilux, Pisquito, Casa Verde) y **para
  quién** (una persona o un chico). Las cuentas viven en `familia/cuentas` y se
  arman en Plata → **Cuentas**, que muestra el balance de cada una por moneda.
  La plata no se separa: «los cobros entran a la administración general y los
  costos salen del presupuesto general»; la cuenta sólo dice a qué fue.
  Categorías nuevas: materiales, jornales, combustible, repuestos,
  herramientas; entradas: alquileres y cobro por un trabajo. Sin pesos
  argentinos (Mauro: «no aún»).
  Y el cuadro **contesta**: «¿qué tiene Yacko esta semana?», «gastos de General
  Flores en materiales de septiembre», «balance de la Hilux», «horas de
  octubre». La IA entiende la pregunta; los números los calcula la app
  (`balanceDe`, `actividadesDeChicos`, `horasPorCuenta`), por moneda y sin
  convertir, con lo que falta (gastos sin boleta, meses sin nada). «✨
  Explicar» le pide a la IA un comentario de esos números, sin sumar nada.
  Las horas son las del reloj de Tiempos; las de Casa Verde, todavía no.
  **El cierre del mes** (plata-8): en Plata → Cuentas, con el mes elegido
  arriba, cada cuenta se cierra con un toque; queda en `familia/cierres` con la
  firma de sus números, y si después entra o sale algo de ese mes dice que
  cambió y pide volver a cerrar.
  **El análisis de Claude** (sugerir-19): «📊 Análisis de Claude» en una
  respuesta o en una cuenta manda el pedido a `reportes/` con el campo
  `analisis`; Claude junta los números con `herramientas/analisis.mjs` de
  `datos` (Tiempos y, si corresponde, Casa Verde y remate, por moneda), escribe
  el análisis y lo deja como propuesta de clase «analisis»: aparece en Pizarra
  con «✓ Leído» y queda listado en Plata → Cuentas.
  **El trimestre** (finanzas-2, nucleo-26, Mauro: «resumir un neto de todos
  los ingresos descontando todos los gastos fijos… ajustes trimestrales,
  identificando los gastos que son fijos para tener un costo estimado de
  funcionamiento»). Plata → **Trimestre**, por moneda: lo que entró, los gastos
  fijos (los pagos de un concepto del Año) y los demás, el neto, y el costo de
  funcionamiento que estima el Año (÷ 4). Concepto por concepto, lo estimado
  contra lo pagado, con «Usar lo real» para ajustar el Año; lo que se repite
  en 3 de los últimos 6 meses sin ser un concepto, con «Sumar al Año»; y el
  ajuste lo confirman los dos con la firma de los números (`familia/cierres`
  → `trimestres`). Las horas NO entran: son un control interno de Casa Verde
  (Mauro: el reparto de la familia va por las salidas y lo personal).
- **La economía centralizada** (proyectos-1, nucleo-28, `tiempos:V13`,
  Mauro: «de un solo lugar, saber cómo se están derivando los gastos… la plata
  es toda una… analizar cada proyecto, cuántos recursos se le dedican y si es
  rentable»). Plata → **Proyectos**, por mes, trimestre o los últimos 12
  meses: lo que entró y salió de toda la familia, y cada DESTINO —General
  Flores, Santa Fe, Dgo Aramburú, la Hilux, Pisquito, Casa Verde, cada chico,
  cada uno de los dos y la casa— con lo que se le dedicó, la parte de todo lo
  que salió, lo que dejó y el neto, por moneda. Un gasto va al proyecto de su
  cuenta; si no tiene, al chico o a la persona para quien fue (o al dueño, si
  es personal); si no, a la casa. Entran también las líneas de extractos sin
  registrar que ya tienen categoría. Casa Verde muestra además **su libro
  propio** (lo que cobra y gasta el negocio), leído con la sesión de Casa
  Verde de quien mira y sólo si tiene el permiso de finanzas allá.
- **Los extractos de las cuentas** (extractos-1, nucleo-27, reglas v14,
  `tiempos:V12`, Mauro: «un registro vivo y unificado… cuando se haga un
  análisis de gastos habrá que incluir esta información»). Plata →
  **Extractos**: lo que dice cada banco (Prex de Mauro, BTG de cada uno…),
  línea por línea, en `extractos/`. El chat lee las capturas o el archivo y
  las carga con `herramientas/extractos.mjs` de `datos`, clasificadas: gasto,
  entrada, a revisar (con la pregunta al lado), movimiento propio (cargas,
  cambios), ya en Casa Verde (una seña que entró a Prex) o compra devuelta.
  Acá se corrige la clase, la categoría o la cuenta, y «Registrar las N
  listas» escribe los movimientos de una vez, con la sesión de quien toca y
  con id fijo (`x-<línea>`): no se duplican. El id de cada línea sale de ella
  misma, así que cargar dos veces el mismo extracto no repite nada. El
  análisis de Claude cuenta, aparte, lo que todavía no se registró. Nunca se
  guarda un número de cuenta ni de tarjeta.
  **Lo que hay cargado (10-oct-2026):** Prex de Mauro de oct-2025 a oct-2026
  (de sus capturas), y migrado del sistema viejo de Casa Verde (el proyecto
  Firebase anterior a `casaverde-20`) BTG de Florencia y BTG de Mauro de
  ene a may-2026, con la clasificación que tenían allá traducida a cuentas y
  categorías de acá. En el sistema viejo «X – Personal» era QUIÉN PAGÓ, no
  para quién: por eso «para» queda sólo en los gastos personales.
  **Y nada queda para clasificar a mano** (11-oct, Mauro: «todos esos gastos
  son nuestros… sirven para cifrar nuestro presupuesto anual… no quiero hacer
  un trabajo manual»): lo dudoso lo despejó Claude —una transferencia o un
  pago sin detalle es un gasto «otros» de la familia; una entrada sin detalle,
  un ingreso; lo que el sistema viejo marcaba entre cuentas propias, interno—
  y lo «Personal / Varios» del sistema viejo pasó a la familia. Cada línea
  dice en su nota por qué.
- **Lo que costó vivir un año** (finanzas-3, nucleo-29): arriba de Plata →
  **Año**, de todo lo cargado —lo registrado y los extractos, sin registrar
  nada—, por moneda y categoría, llevado a 12 meses con los meses que cada
  moneda tiene medidos (un mes con menos de tres gastos en esa moneda no
  cuenta como medido). Es la base para el presupuesto anual, y también va en
  el análisis de Claude.
  **Y está cargada en el Año** (11-oct, pedido de Mauro): Luz, Agua, los
  teléfonos y la patente de la camioneta con su promedio real, y por cada
  categoría y moneda un concepto «(base de los extractos)» con el resto. Un
  concepto `base` es lo que cuesta una categoría entera, no una boleta: cuenta
  en el Año y en el costo de funcionamiento, pero no aparece en Fijos ni se
  reclama como «sin pago» en el Trimestre (nucleo-30). Lo personal queda
  afuera: el Año es lo que cuesta funcionar.
- **Lo acordado cada semana es una tabla** (familia-4): los días en filas y una
  columna por persona, con los chicos que están con ella ese día.
- **Las finanzas de la familia** (app-19, 8-oct-2026, `tiempos:V9`): Plata
  tiene cuatro solapas. **Fijos** es la planilla —cada gasto que se repite, con
  los meses al lado; tocar una casilla registra el pago—. **Año** son esos
  gastos con su monto y cada cuánto vencen: lo que cuesta el año ÷ 12 es lo
  que hay que apartar cada mes. **Reparto** muestra el libre del mes (lo que
  entró menos esa reserva), la mitad de cada uno, lo que se compensa por las
  salidas no equiparadas (días × libre ÷ días del mes) y lo que cada uno ya
  gastó en lo personal; el cierre lo confirman los dos. Entran como ingreso
  los honorarios y el neto de los negocios; los gastos del negocio se anotan
  en el año pero no restan, porque ese neto ya los descontó. Toda la noche
  afuera cuenta un día entero. **Los ingresos de los negocios llegan solos
  como propuestas** («De las cuentas de los negocios», arriba de Día a día):
  la ronda corre `herramientas/ingresos.mjs` de `datos` para el mes cerrado —
  honorarios pagados de los dos, el neto de Casa Verde y lo cobrado en remate
  (bruto)— y una persona aprueba o corrige.
- **Claude organiza mi agenda** (app-18, agenda-9, lugares-2, reglas v11,
  8-oct-2026): abajo de la Agenda, el interruptor «🤝 Claude organiza mi
  agenda». Encendido, Claude puede leer TU agenda y tus lugares, mover y
  agregar actividades, y poner o correr tus alarmas con el viaje; lo que toca
  dice ✨ y por qué. Cada cambio deja una copia de cómo estaba en
  `agendas/{uid}/copias`, que ves sólo vos, y se deshace pidiéndoselo. Apagado,
  todo queda como antes. Es de cada uno: no abre la agenda del otro. **Hasta
  que Mauro publique las reglas v11, el interruptor se guarda pero Claude no
  puede entrar.**
- **Reprogramar** (agenda-6, propone-6, 7-oct-2026): en la Agenda, ✎ en una
  actividad le cambia día y horas (su marca del balance se borra y se vuelve a
  crear, como manda la regla); en Pizarra → «Te recordás» se ven todas las
  alarmas y recordatorios de las próximas dos semanas, y ✎ les cambia día y hora.
- **Las acciones posibles** (`ACCIONES` de `nucleo.js`): actividad (a tu
  agenda, y al calendario de los chicos si es de ellos), tarea (personal, con
  `pizarra` marcada para vos), recordatorio y alarma (a `alertas/`), deseo (a
  `deseos/`), coordinar (se lo pasa a Claude), **compra** («no olvidar
  comprar pilas» → a la lista de compras que se llame así, o una nueva) y
  **pedido** («pedile a Flor que…» → una tarea común a cargo del otro,
  marcada para SU pizarra; Claude además le avisa por WhatsApp si lo
  encendió). Gemini recibe los nombres de las listas de compras para elegir.
- **El dictado de Android repetía lo que iba entendiendo** («el el jueves el
  jueves llevo…»). Ahora se rearma con todos los resultados y
  `limpiarDictado` saca los tramos repetidos, también antes de mandarlo a la
  IA — sirve igual para el micrófono del teclado.
- **La lista de deseos.** «Me gustaría que los chicos vayan a esta actividad»
  o «quisiera coordinar con Florencia para tomar esta clase», con la captura:
  queda como deseo, con la imagen, en Ahora → Deseos. Claude lo cruza con los
  turnos del otro y pregunta; cuando lo acuerdan, «Ya lo acordamos: agendar»
  abre el dictado con el deseo cargado, y al agendar el deseo pasa a
  «agendado». «Ya no» lo descarta.
- **Los recordatorios** se ven en Ahora → «Te recordás». Por WhatsApp los
  manda la ronda de Claude, con el mismo candado de «Mis avisos»: sólo a
  quien encendió «que Claude me escriba». **La alarma que suena a la hora
  necesita la APK** (línea `tiempos:V3`): la web no puede sonar con el
  teléfono bloqueado. Hasta entonces se guarda y se ve en la lista.
- **Reglas v9**: `alertas/` (las lee su dueño y el agente; las escribe sólo
  su dueño) y `deseos/` (los leen los dos y el agente; los crea su dueño).
  Hay que publicarlas desde el panel.

### Lo que se sumó el 5-oct-2026, a la tarde (nucleo-9, sugerir-4, propone-2)

- **«✨ Precargar» con Gemini, en el momento.** Después de dictar (o de
  elegir la captura), la app le pregunta a Gemini por `claude-proxy` —el
  mismo de las boletas— y llena la tarjeta al instante: qué, día, horas,
  lugar, clase, quién, si es con los chicos. Se corrige y se toca
  **Agendar**: va a tu agenda (y, si se marca, al calendario de los
  chicos). Lo que Gemini contesta se lee con desconfianza
  (`leerAgendaIA`): lo que no tiene forma va vacío y a «no estoy seguro».
  A Gemini **no le van los nombres de los chicos**.
- **El pedido igual le llega a Claude**, con `yaAgendado`: él cruza con el
  otro y, si queda libre en ese rato, le deja la pregunta en Ahora. Si se
  eligió «lo hace el otro», no se agenda nada tuyo y Claude le propone a él
  o ella.

### Lo que se sumó el 5-oct-2026 (nucleo-8, app-12, sugerir-3, propone-1)

- **Dictar a la agenda.** El globo (ahora 🎙) abre en «Agenda»: el botón
  redondo graba con el reconocimiento de voz del teléfono y late mientras
  escucha; lo entendido aparece en el cuadro y se corrige con el teclado
  antes de mandar. Se puede sumar la **captura de un flyer** (cámara o
  archivo, se sube a Cloudinary al mandar). **El audio no se guarda ni
  viaja**: viaja el texto. Va a `reportes/` como un pedido con
  `agenda: true`, y despierta a Claude (consulta en vivo).
- **Lo que vuelve: «Claude propone» en Ahora.** Claude interpreta lo dicho
  —con sus imprecisiones—, cruza con lo que ya hay (marcas, turnos, chicos)
  y deja en `propuestas/` una tarjeta por persona: `agenda` (para tu
  agenda, editable: qué, día, desde/hasta, lugar, clase, recordar) o
  `consulta` (a quien queda libre: «¿qué tenés pensado para ese rato?»).
  **Aceptar escribe TU agenda con TU sesión**, igual que cargarla a mano,
  y suma la marca; nada entra a la agenda de nadie sin su toque. La
  respuesta a una consulta vuelve a Claude como un pedido más. Lo de los
  chicos sigue en Plata (`evento`), como antes.
- Sin reglas nuevas: `reportes` acepta los campos de más, `propuestas` ya
  dejaba crear al agente y decidir a la persona, y cada uno escribe su agenda.

### Lo que se sumó el 3-oct-2026 (nucleo-7, app-11, plata-2)

- **La tarea que corre se ve en su fila**: el ▶ pasa a **■** (tocarlo para,
  y queda pendiente) y la fila queda recuadrada, en Casa Verde y en la
  familia (`estaCorriendo`). Lo pidió Mauro al probar el cronómetro.
- **Las boletas se leen con `gemini-2.5-flash-lite` y 2000 tokens**: el
  `gemini-2.5-flash` piensa antes de contestar y el JSON llegaba cortado,
  como en el inventario de remate. El banco fija el modelo.

### Lo que se sumó el 30-sep-2026 (nucleo-6, app-10)

- **Estar con los chicos vale lo mismo que producir**: es lo que deja producir
  al otro. **Todos juntos** —lo marque quien lo marque— es **½ y ½** en la
  carga; si lo marcan los dos, es un solo rato.
- **Las salidas se cuentan en DÍAS, no en horas** (`saldoSalidas`):
  una **noche** (desde las 20, **sin marcar la vuelta**) vale **½** —el otro
  se hace cargo de la cena, la casa y de acostarlos—; un **día entero**, **1**;
  un **rato** de mañana o de tarde, **¼**. Dos noches de uno equiparan un día
  entero del otro. El Balance dice quién tiene salida **a favor** y cuánta.
- **Las marca cualquiera**: en Balance → Salidas, la propia o la del otro
  («salió Florencia»), aunque el otro no la haya marcado; quien salió la puede
  sacar («No salí»). Y la **agenda**: una actividad se carga con su clase
  **obligatoria** —trabajo, tarea, personal o con los chicos—; una personal
  cuenta como salida (desde las 20 es noche, diez horas o más es un día, si no
  un rato). El título queda en la agenda de cada uno: a `marcas/` va sólo de
  quién, qué clase, qué unidad y cuándo, y la regla (v8) no deja que viaje más.
- **Salir juntos es neutro**, aunque uno también la haya marcado como propia.
- **La doble marcación no suma**: dos marcas de la misma persona que se pisan
  son una salida, y vale la mayor (la noche marcada por los dos, ½).
- **Sólo acumula si ese día estaban los chicos** (según con quién están cada
  día, en Chicos). Si nunca se cargó eso, cuenta siempre.

Los nombres de los chicos **no están en el código**: viven en la base
(`familia/config`). Este repositorio es público.

## Casa Verde entra por su propio código

`firebase-init.js` importa `firebase-init.js` y `actividades-core.js` del sitio
de Casa Verde. Arrancar, frenar y tildar son `Core.iniciar`, `Core.finalizar` y
`Core.tildar`: los mismos que usa el panel de Casa Verde, no una copia. Desde
app-4 también importa su `nucleo.js`, para subir las boletas con su
`CV2.subirImagen` (a su Cloudinary, carpeta `tiempos`) y leerlas con su función
de IA (`CV2.NETLIFY + "/claude-proxy"`). La foto se sube al guardar, no al
elegirla, para no dejar huérfanos que nadie puede borrar.

La app **no escribe nada de Casa Verde por su cuenta, salvo la agenda de cada
uno** (`estado_usuario/{uid}.agenda`), con la misma forma que usa la agenda de
Casa Verde: así lo que se ordena acá se ve igual allá, y al revés. Casa Verde
tiene sólo mañana y tarde, así que una suya soltada en «noche» queda en la
tarde. El banco comprueba que ésa sea la única escritura directa.

Consecuencia a saber: si Casa Verde cambia la versión del SDK de Firebase, hay
que cambiarla acá en la misma tanda; si no, anda igual pero con dos SDK.

## El reparto

La regla está escrita y probada en `nucleo.js` (`repartir`), con las palabras
de Mauro al lado. **Todavía no se muestra**: se muestra cuando Mauro y
Florencia la acuerden.

## Primer ingreso

1. Entrar con el mail y la contraseña (los mismos de Casa Verde).
2. La primera vez pide acceso: deja una solicitud.
3. El agente la aprueba creando `miembros/{uid}`. Desde ahí, adentro.

## Los archivos

| Archivo | Qué hace | Sello |
|---|---|---|
| `nucleo.js` | todas las cuentas, sin Firebase ni pantalla | `nucleo-30` |
| `estado.js` | lo que comparten las vistas | `estado-3` |
| `app.js` | entrar, los relojes, Tareas (con lo que era Ahora arriba) | `app-27` |
| `pizarra.js` | la solapa Pizarra: anotar, Mi pizarra con su ventana por categorías, propuestas, recordatorios y deseos | `pizarra-web-2` |
| `lugares.js` | mis lugares (casa por país y los lugares de las actividades, con dirección) y dónde estoy, para el viaje, y el interruptor «Claude organiza mi agenda» | `lugares-2` |
| `compras.js` | la lista de compras, en `familia/compras` | `compras-4` |
| `lista.html` + `lista.js` | la lista compartida sin cuenta (`?c=<token>`); fuera del SHELL | `lista-1` |
| `propone.js` | lo que Claude propone y te pregunta, tus recordatorios y tus deseos, en Pizarra | `propone-8` |
| `deseos.js` | los deseos y actividades que les gustan: «hoy se puede», la lista y su edición (días, horas, flyer) | `deseos-2` |
| `sugerir.js` | el globo ✏️: pedirle a la IA (sin dictado propio), sugerencias y fallas, a `reportes/` | `sugerir-19` |
| `plata.js` | lo disponible, los gastos, las boletas, lo que propone el agente, y sus solapas | `plata-11` |
| `extractos.js` | Plata → Extractos: las líneas de cada banco, para clasificarlas y registrarlas de a muchas, con cuenta y para quién | `extractos-2` |
| `proyectos.js` | Plata → Proyectos: la economía centralizada, cada destino con lo que se le dedica y su neto, y el libro propio de Casa Verde | `proyectos-1` |
| `finanzas.js` | Fijos (la planilla mes a mes), Año (los gastos del año) y Reparto (el libre del mes y su cierre) | `finanzas-3` |
| `balance.js` | el balance del tiempo, las salidas, los acuerdos, la auditoría | `balance-4` |
| `agenda.js` | mi semana, arrastrando, las actividades propias con su clase, y el mes | `agenda-10` |
| `familia.js` | Hoy y Chicos | `familia-4` |
| `firebase-init.js` | el único contacto con las dos bases | `init-3` |
| `estilos.css` | | `estilos-21` |
| `sw.js` | el cascarón sin señal | `tiempos-42` |
| `firestore.rules` | las reglas; se publican desde el panel, que pone el UID del agente | v14 |

## Lo que vino de Casa Verde (29-sep-2026)

En Casa Verde quedaron **sólo Limpiezas, Mantenimiento CasaVerde y
Reparaciones CasaVerde** (lo decidió Mauro: «el resto va a la lista de
Tiempos, que coordinaré con Florencia»). Pasaron 40 tareas, en diez grupos:
Santa fe, Anuncio Hilux, Moto para viaje, Motonetas venta, Baja del auto, el
cumple, Dgo Aramburú, Terraza dormitorios Casa Verde, General flores y General
Casa Verde — con su detalle, su fecha, si estaban hechas y quién se ocupaba.

- Cada una guarda `origen: "casaverde:actividades/<id>"` y su id es `cv-<id>`:
  correr la mudanza otra vez no duplica nada. El guion está en la bodega
  (`herramientas/mudar-proyectos-personales.mjs`).
- En Casa Verde quedaron en la **papelera** (marcadas como las borra su
  pantalla, con `mudadoA`), no borradas: se pueden recuperar desde allá.
- Sus relojes viejos (cuatro tildes de 0 h) quedaron allá, como historia.
- El cumple llegó como hecho, con sus ítems: allá ya estaba borrado.
- El ámbito de cada grupo lo eligió el agente; se cambia en la ficha del grupo.
- Llegaron como tareas «de los dos». Una que vea uno solo la tiene que crear
  esa persona: el agente no puede.
