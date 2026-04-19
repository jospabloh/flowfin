import { useState, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, X } from 'lucide-react';

const sections = [
  {
    id: 'inicio', icon: '🚀', title: 'Comenzar a usar FlowFin',
    content: `FlowFin está diseñado para que empieces a registrar en menos de 2 minutos.

Pasos recomendados:
1. Al entrar por primera vez, crea tu familia con un nombre — se generará un código único (ej: GARCIA123).
2. Comparte ese código con tu pareja o familiares para que se unan desde su dispositivo.
3. Aprueba sus solicitudes de acceso desde "Admin Familia".
4. Ve a "Catálogos" → Personas → Agrega los nombres de tu familia.
5. Ve a "Catálogos" → Formas de pago → Agrega tus tarjetas y métodos habituales.
6. ¡Listo! Usa el botón "+" o el Asistente IA para registrar tu primer movimiento.

Los Rubros y SubRubros ya vienen precargados con palabras clave para que el sistema los detecte automáticamente.`
  },
  {
    id: 'captura', icon: '✏️', title: 'Capturar un movimiento',
    content: `El flujo de captura está diseñado para completarse en 3 pasos o menos:

1. Escribe el monto.
2. Escribe o dicta la descripción — el sistema sugerirá Rubro y SubRubro automáticamente.
3. Confirma y guarda.

Sugerencias inteligentes ✨:
Al escribir la descripción, la app analiza el historial de tu familia y muestra en tiempo real:
• Rubros frecuentes — categorías que usas más para ese tipo de movimiento. Las sugerencias se filtran automáticamente: si estás en Egreso solo aparecen rubros de egreso, y si estás en Ingreso solo aparecen rubros de ingreso.
• Personas frecuentes — los integrantes que más aparecen con descripciones similares.
• Formas de pago frecuentes — los métodos de pago más usados.
Toca cualquier sugerencia para aplicarla. Aplica tanto a egresos como a ingresos.

Auto-completado de descripción:
Cuando tocas una sugerencia de categoría/subcategoría, la descripción se completa automáticamente con el nombre del subrubro (o categoría). Esto evita dejar descripciones muy cortas o ambiguas.

Detección de duplicados:
Si el sistema detecta un movimiento muy similar (mismo monto aproximado, misma categoría, misma fecha), te avisa antes de guardar. Puedes cancelar o confirmar de todos modos.

Opciones adicionales:
• Micrófono 🎤 — Dicta el movimiento en voz: "gasolina BMW 800 pesos con débito". El sistema interpreta el monto y la descripción automáticamente.
• Cámara 📷 — Toma foto del ticket. Escribe el monto manualmente (más confiable que OCR).
• Requerido — Clasifica el gasto: Necesario, Gusto, Urgente, Inversión u Otro.
• Factura — Marca si el gasto tiene factura fiscal.`
  },
  {
    id: 'dashboard', icon: '📊', title: 'Dashboard y filtros',
    content: `El dashboard muestra el resumen financiero familiar en tiempo real.

Filtros disponibles:
• Hoy / Ayer / Semana / Mes — filtran todas las tarjetas y gráficas.
• Por Persona — muestra solo los movimientos de esa persona.

Secciones del dashboard:
• Tarjetas de resumen — Ingresos, Egresos y Balance del período.
• Top Categorías — gráfica de barras con los 5 rubros de mayor gasto.
• Gasto por Persona — gráfica de dona comparativa.
• Últimos movimientos — acceso rápido a los 5 más recientes. La descripción muestra automáticamente las notas adicionales cuando hay espacio (formato: "Descripción — Notas").
• Próximos pagos — inversiones y MSI que vencen pronto.`
  },
  {
    id: 'reportes', icon: '📈', title: 'Reportes dinámicos',
    content: `Los reportes se generan 100% en el dispositivo, sin consumir créditos de IA.

Vistas predefinidas:
• Gastos por Categoría — pie chart con totales por rubro.
• Por Persona — comparativa entre integrantes.
• Evolución Mensual — barras por mes para ver tendencias.
• Métodos de Pago — distribución entre efectivo, tarjetas, etc.

Puedes seleccionar cualquier rango de fechas.

Compartir:
• PDF — genera un documento y usa el menu de compartir del dispositivo.
• PNG — captura el reporte como imagen para WhatsApp, correo, etc.`
  },
  {
    id: 'inversiones', icon: '💰', title: 'Inversiones y pagos programados',
    content: `Usa este módulo para compromisos de pago recurrentes: inmuebles, fondos de inversión, préstamos, seguros, etc.

Cómo funciona:
1. Registra la inversión con monto total, número de pagos y día de pago.
2. El sistema calcula automáticamente cuándo es cada pago.
3. Cada mes, entra y registra el pago realizado.
4. El semáforo de colores te indica el estado: verde (al corriente), amarillo (vence pronto), rojo (vencido).

El dashboard muestra los próximos vencimientos.`
  },
  {
    id: 'msi', icon: '💳', title: 'Meses Sin Intereses (MSI)',
    content: `Controla todas tus compras a meses sin intereses en un solo lugar.

  Para cada MSI registra:
  • Tienda y concepto
  • Monto total y mensualidad
  • Número de meses
  • Fecha de inicio y día de cargo

  El sistema calcula automáticamente el próximo cargo basándose en hoy y el día de cobro especificado. Usa el botón "Registrar Pago" cada mes para mantener el seguimiento actualizado.

  Estado del MSI:
  • Activo — El MSI está vigente y se pueden registrar pagos.
  • Pausa — El MSI está pausado (puedes reactivarlo cuando sea necesario). Toca el botón "Pausar" o "Reactivar" en los detalles del MSI para cambiar su estado.`
  },
  {
    id: 'rentas', icon: '🏠', title: 'Rentas (cobro de propiedades)',
    content: `Módulo completo para familias con propiedades en renta, con seguimiento automático y sincronización con Movimientos.

Cómo funciona:
1. Registra cada propiedad con nombre, inquilino, dirección, renta base y día de pago esperado.
2. Cada mes, el dashboard muestra un banner si hay rentas pendientes (no cobradas o vencidas).
3. Toca "Registrar cobro" → bottom sheet con campos para:
   • Mes del cobro
   • Monto cobrado (pre-cargado con la renta base)
   • ¿Quién recibió el pago? (botones filtrados con personas de la familia — búsqueda en tiempo real)
   • Método de pago (botones filtrados con formas de pago — búsqueda en tiempo real)
   • Fecha del pago
   • Notas opcionales

Sincronización automática:
Al confirmar el cobro, se crea automáticamente un ingreso en Movimientos con la fecha, monto, persona, método de pago y descripción "🏠 Renta [propiedad]".

Indicador de estado:
• 🟢 Verde — El pago del mes actual ya fue registrado.
• 🟡 Amarillo — Pendiente de cobro en el mes actual.

Desregistrar un cobro:
Si cometiste un error, puedes tocar "Desmarcar cobro" en la propiedad correspondiente. Esto elimina el registro del mes actual Y borra automáticamente el ingreso correspondiente en Movimientos. Se mostrará una confirmación antes de proceder.

Editar o eliminar una propiedad:
• Toca el ícono de lápiz ✏️ en la tarjeta de la propiedad para modificar nombre, inquilino, dirección, renta base o día de pago.
• Toca el ícono de eliminar para dar de baja la propiedad. Esta acción no borra los cobros ya registrados en Movimientos.

Historial:
Cada propiedad muestra los últimos 3 cobros registrados con mes, quién recibió y monto.`
  },
  {
    id: 'catalogos', icon: '📚', title: 'Catálogos y personalización',
    content: `Los catálogos son los datos maestros que alimentan la app.

Rubros (Categorías):
Agrega, edita o elimina las categorías de gasto con su color e ícono. Usa el ícono de lápiz ✏️ junto a cada categoría para editarla directamente sin salir de la pantalla.

SubRubros (Subcategorías):
Cada subrubro tiene palabras clave que usa el motor de autodetección. Por ejemplo, si escribes "gasolina" en la descripción, el sistema sugiere automáticamente Transporte > Gasolina.
También puedes editar el nombre, categoría padre y palabras clave de cualquier subrubro tocando el lápiz ✏️.

Tip: Agrega palabras clave específicas de tu uso diario para mejorar la detección automática.

Personas:
Define quiénes son los integrantes de tu familia con su color e inicial para el avatar. Edítalas en cualquier momento con el lápiz ✏️.

Formas de Pago:
Tus tarjetas, cuentas y métodos de pago habituales. Puedes cambiar nombre, banco, tipo e identificador usando el lápiz ✏️.`
  },
  {
    id: 'voz', icon: '🎤', title: 'Captura por voz',
    content: `FlowFin usa el reconocimiento de voz nativo del dispositivo (Web Speech API), sin consumir créditos ni enviar datos a servidores externos.

Cómo usar (pantalla de Captura):
1. En la pantalla de captura, toca el ícono del micrófono.
2. Habla naturalmente: "gasolina BMW ochocientos pesos con débito".
3. El sistema transcribe, detecta el monto y aplica las palabras clave del catálogo.

Nota: El micrófono en la pantalla de Captura siempre usa español (es-MX) para la transcripción. Si quieres dictar en otro idioma, usa el micrófono dentro del Asistente IA, que respeta el idioma configurado en Mi Familia.

Disponibilidad:
• iPhone/iPad: requiere Safari o Chrome.
• Android: funciona en Chrome.
• Desktop: Chrome y Edge.

Si tu navegador no lo soporta, el botón mostrará un aviso.`
  },
  {
    id: 'asistente', icon: '🤖', title: 'Asistente IA',
    content: `El Asistente IA es la característica estrella de FlowFin. Permite registrar gastos e ingresos simplemente hablando o escribiendo de forma natural.

Acceso rápido: En todas las pantallas (excepto el propio Asistente) hay un botón flotante 💬 en la esquina inferior derecha, siempre visible por encima de la barra de navegación.

Idioma: El asistente responde en el idioma activo de la app, según el locale configurado en Mi Familia. Si la app está en español, responde en español; si está en inglés, responde en inglés. Cambia el idioma desde Mi Familia → Idioma/región y el asistente lo sigue automáticamente.

Reconocimiento de voz: El micrófono usa el mismo idioma que la app, para una transcripción más precisa.

Cálculos automáticos:
El asistente puede calcular montos con propinas o porcentajes:
• "188 más 10% de propina" → calcula $206.80 y confirma antes de guardar.
• "500 más 15%" → calcula $575.00 automáticamente.

Matching inteligente de métodos de pago:
El asistente reconoce variaciones de escritura:
• "tdc like u", "TDC Like U", "like u" → resuelve al método correcto registrado.
• "débito", "efectivo", "transfer" → busca el tipo de pago correspondiente.
• Abreviaciones y errores menores se resuelven automáticamente.

Ejemplos de uso (movimiento único):
• "Gasté 500 en gasolina hoy" → Crea el egreso, detecta categoría y guarda.
• "Recibí 10,000 de un cliente" → Registra el ingreso.
• "¿Cuánto gasté esta semana?" → Muestra resumen por categoría y total.
• "Registra 1,200 del súper pagado con tdc like u" → Detecta monto, rubro y método de pago.

Registrar múltiples movimientos en un solo mensaje:
Puedes describir varios gastos o ingresos en un mismo texto o dictado de voz:
• "Gasté 78 en la máquina y 500 en gasolina"
• "Registra: gasolina 500, súper 1200, farmacia 200"
• "Silvia gastó 375 en comida y yo 78 en la máquina"

El asistente detecta todos los movimientos, los resume y pide confirmación antes de guardarlos:
"✅ Identifiqué 3 movimientos:
1. $78 — Máquina expendedora (Alimentación, Pablo)
2. $500 — Gasolina (Transporte, Pablo)
3. $1,200 — Súper (Alimentación, Silvia)
¿Los guardo todos?"

Si falta algún dato en uno de los movimientos, preguntará solo por lo que hace falta.

Campos obligatorios que siempre pedirá antes de guardar:
• Monto
• Tipo (egreso o ingreso)
• Categoría (Rubro)
• Persona (integrante de la familia)
• Fecha (si no se menciona, usa hoy)

También funciona con voz:
1. Toca el ícono del micrófono en el Asistente.
2. Habla naturalmente en español — puedes dictar varios gastos de una vez.
3. El asistente confirma y guarda.

Acciones pendientes: Si un movimiento no tiene persona o categoría, aparece marcado con ⚠️ en Movimientos. Puedes pedirle al asistente que los complete: "¿Cuáles movimientos están pendientes?"

Costo: El asistente consume créditos Base44 por mensaje.
Privacidad: Los datos se procesan dentro de la plataforma Base44. No se comparten con terceros.`
  },
  {
    id: 'familia', icon: '👨‍👩‍👧‍👦', title: 'Sistema de Familias y Acceso',
    content: `FlowFin usa un sistema de códigos de familia para que solo las personas autorizadas puedan ver los datos de su familia.

Cómo funciona:
1. El administrador crea la familia y recibe un código único (ej: GARCIA123).
2. Los demás integrantes ingresan ese código para solicitar acceso.
3. El administrador aprueba o rechaza cada solicitud desde "Admin Familia".
4. Solo miembros aprobados pueden ver los datos de la familia.

Permisos de los miembros:
Todos los integrantes aprobados pueden:
• Ver, registrar y editar movimientos, inversiones, MSI, rentas y pagos programados — sin importar quién los registró originalmente.
• Consultar reportes y el dashboard con información completa de la familia.

El administrador además puede:
• Aprobar o rechazar solicitudes de acceso.
• Gestionar catálogos (rubros, subrubros, personas, formas de pago).
• Configurar los parámetros de la familia (moneda, locale, etc.).

Admin Familia:
• Ver el código de invitación y copiarlo.
• Aprobar o rechazar solicitudes pendientes.
• Ver todos los miembros activos.

Seguridad: Cada familia ve únicamente sus propios datos. Ninguna familia puede ver los datos de otra.`
  },
  {
    id: 'presupuesto', icon: '🎯', title: 'Presupuesto Inteligente',
    content: `El módulo de Presupuesto analiza el historial de gastos de tu familia y genera automáticamente una sugerencia de presupuesto mensual por rubro.

Cómo funciona:
1. Ve al menú "Más" → sección Herramientas → "Presupuesto".
2. Selecciona el período de análisis: último mes, 3 meses o 6 meses.
3. El sistema calcula el promedio mensual de cada categoría de gasto y agrega un 10% de margen de seguridad.
4. Obtendrás una lista ordenada por impacto, con el presupuesto sugerido por rubro.

Indicador de salud financiera:
• 🟢 Finanzas saludables — El presupuesto sugerido es menor al 80% de tus ingresos.
• 🟡 Presupuesto ajustado — El presupuesto representa entre el 80% y 100% de tus ingresos.
• 🔴 Atención — Los egresos históricos superan los ingresos promedio.

Gráfica de distribución:
Muestra visualmente cómo se distribuye el presupuesto sugerido entre los diferentes rubros de gasto, con los colores que configuraste en Catálogos.

Nota: El presupuesto es una sugerencia basada en datos históricos. No modifica ni afecta ningún registro existente.`,
  },
  {
    id: 'programados', icon: '📅', title: 'Pagos Programados',
    content: `Módulo para registrar y hacer seguimiento de todos tus pagos fijos mensuales: luz, agua, internet, colegiatura, suscripciones, etc.

Cómo funciona:
1. Registra el pago con nombre, monto estimado, día de vencimiento, categoría, forma de pago habitual e ícono.
2. Cada mes el sistema muestra cuáles pagos ya fueron pagados y cuáles están pendientes.
3. Toca "Marcar como pagado" → se abre el formulario de confirmación.
4. En el formulario de confirmación completa:
   • Monto pagado (pre-cargado con el monto estimado)
   • Fecha de pago
   • ¿Quién paga? — botones filtrados con personas de la familia (búsqueda en tiempo real), pre-selecciona la primera persona registrada
   • Con qué se pagó — botones filtrados con formas de pago (búsqueda en tiempo real), pre-selecciona la forma habitual del pago programado
   • Notas opcionales
5. Toca "Confirmar pago" — recibirás una notificación de éxito.
6. El dashboard muestra un aviso 🔔 si hay pagos programados pendientes en el mes actual.

Estados y semáforo de colores:
• 🟢 Verde — Al corriente (vence en más de 3 días).
• 🟡 Amarillo "Vence pronto" — Vence en los próximos 3 días.
• 🔴 Rojo "Vencido" — El día de vencimiento ya pasó y no se ha pagado.
• ✓ Pagado — Ya fue registrado con fecha y monto real este mes.

Sincronización automática:
Al marcar un pago como pagado, se crea automáticamente el egreso correspondiente en el registro general de Movimientos, incluyendo la forma de pago seleccionada al momento de confirmar.

Desmarcar un pago:
Si cometiste un error, puedes tocar "Desmarcar" en el pago ya registrado. Esto elimina el registro del mes actual Y borra automáticamente el egreso correspondiente en Movimientos. Se mostrará una confirmación de éxito o error.

Selectores mejorados:
Los campos "¿Quién paga?" y "Con qué se pagó" ahora utilizan botones filtrados con búsqueda en tiempo real, permitiendo seleccionar opciones en un clic mientras escribes para filtrar. Exactamente igual que el flujo de captura de ingresos y egresos.

Diferencia con Inversiones:
Los Pagos Programados son recurrentes sin fin (luz, renta, servicios). Las Inversiones tienen un número fijo de pagos y un monto total definido.`
  },
  {
    id: 'navegacion', icon: '🗂️', title: 'Navegación y menús',
    content: `La navegación está organizada en grupos para facilitar el acceso a cada módulo.

En móvil (barra inferior):
Los 4 accesos directos son: Inicio, Movimientos, + Registrar y Reportes.
El botón "Más" abre un panel con todas las secciones organizadas en grupos:

• Herramientas — Asistente IA y Presupuesto
• Compromisos — Pagos del Mes, Inversiones, MSI y Rentas
• Configuración — Catálogos, Mi Familia, Mi Cuenta y Admin Familia (solo administradores)
• Información — Manual y Acerca de

El botón flotante 💬 en la esquina inferior derecha abre directamente el Asistente IA desde cualquier pantalla.

En escritorio / tablet (barra lateral):
La barra lateral izquierda muestra todos los módulos organizados en las mismas secciones con etiquetas de grupo.
El botón "Registrar" siempre está visible en la parte inferior de la barra.`,
  },
  {
    id: 'export', icon: '📤', title: 'Exportar datos',
    content: `Puedes exportar tus datos en cualquier momento desde la sección de Movimientos.

Formatos disponibles:
• Excel (.xlsx) — Todos los movimientos filtrados con todos los campos: fecha, tipo, monto, descripción, rubro, subrubro, persona, forma de pago, requerido, factura y notas.

Desde Reportes también puedes:
• Compartir el reporte como PDF o imagen PNG directamente a WhatsApp, correo u otras apps usando el menú de compartir del dispositivo.`
  },
  {
    id: 'memoria', icon: '🧠', title: 'Memoria inteligente (aprendizaje sin IA)',
    content: `FlowFin aprende de tus hábitos de captura y los recuerda automáticamente sin consumir créditos de IA.

Qué recuerda la app:
• Asociaciones descripción → categoría, subcategoría, persona y forma de pago. Por ejemplo, si siempre registras "gasolina" con Transporte › Gasolina, la próxima vez que escribas "gasolina" se aplica automáticamente.
• Filtros del Dashboard — el período (Hoy/Semana/Mes…) y la persona que tenías seleccionados la última vez.
• Preferencias de Reportes — el tipo (Egresos/Ingresos/Comparativa) y el preset seleccionado.

Sugerencias en tiempo real mientras capturas:
Mientras escribes la descripción, la app consulta el historial de tu familia y muestra:
• Rubros frecuentes — las categorías más usadas para ese tipo de descripción.
• Personas frecuentes — los integrantes que más aparecen en movimientos similares.
• Formas de pago frecuentes — los métodos de pago más comunes para ese contexto.

Toca cualquier sugerencia para aplicarla. Todo ocurre localmente en tu dispositivo, sin llamadas a IA.

Cómo funciona técnicamente:
• Los hábitos personales se guardan en tu perfil de usuario (campo preferences).
• Las reglas familiares compartidas se guardan en la configuración de la familia (campo smart_rules).
• Ambas se sincronizan automáticamente entre dispositivos al iniciar sesión.`
  },
  {
    id: 'sincronizacion', icon: '🔗', title: 'Sincronización de pagos especializados',
    content: `FlowFin sincroniza automáticamente los pagos de módulos especializados (MSI, Inversiones, Pagos Programados y Rentas) con el registro general de movimientos.

Cómo funciona la sincronización automática:
Cuando registras un pago en cualquiera de estos módulos, el sistema crea automáticamente el movimiento correspondiente en el registro general de Movimientos, sin que tengas que capturarlo dos veces.

• MSI — Al registrar el pago mensual de un MSI, se crea un egreso vinculado.
• Inversiones — Al registrar una cuota de inversión, se genera el egreso correspondiente.
• Pagos Programados — Al marcar un pago del mes como pagado, se registra el egreso.
• Rentas — Al registrar un cobro de renta, se genera el ingreso correspondiente.

Indicador visual en Movimientos:
Las transacciones sincronizadas desde módulos especializados muestran una etiqueta de color con el tipo de origen (💳 MSI, 💰 Inversión, 📅 Pago Programado, 🏠 Renta). Esto te indica de dónde provino ese movimiento.

Vinculación manual:
Si tienes una transacción existente que corresponde a un pago especializado, puedes vincularla manualmente:
1. Abre el movimiento desde la pantalla de Movimientos.
2. Toca "Aplicar pago" en el modal de edición.
3. Selecciona el tipo de pago (MSI, Inversión, etc.) y elige el pago específico.
4. Toca "Vincular" para asociarlos.

Desvinculación:
Puedes quitar el vínculo en cualquier momento tocando la ✕ en la etiqueta del tipo de pago dentro del modal de edición. Esto elimina la asociación pero no borra ningún registro.

Nota: La sincronización automática solo ocurre al crear nuevos pagos. Los pagos registrados antes de esta versión no se sincronizan retroactivamente, pero puedes vincularlos manualmente.`
  },
  {
    id: 'movimientos', icon: '📋', title: 'Gestión de movimientos',
    content: `La sección de Movimientos es el registro completo de todos los ingresos y egresos de tu familia.

Funciones disponibles:
• Buscar — filtra por descripción, rubro, persona o nota en tiempo real.
• Filtrar por categoría y persona — selecciona desde los desplegables superiores.
• Paginación — carga más movimientos al llegar al final de la lista.
• Editar — toca cualquier movimiento para modificar cualquier campo directamente.
• Eliminar — desde el detalle del movimiento.
• Exportar a Excel — descarga todos los movimientos filtrados con un solo toque.

Movimientos pendientes de revisar ⚠️:
Los movimientos sin categoría o sin persona asignada aparecen marcados con un indicador naranja. Puedes:
• Editarlos directamente tocando el movimiento.
• Pedirle al Asistente IA que los complete por ti.

El contador de pendientes también aparece en el ícono de Movimientos en la barra de navegación.`
  },
  {
    id: 'cuenta', icon: '⚙️', title: 'Mi Cuenta',
    content: `La sección "Mi Cuenta" te permite gestionar tu perfil personal dentro de FlowFin.

Acceso: Menú "Más" → Configuración → Mi Cuenta.

Qué puedes hacer:
• Ver tu email y datos de cuenta.
• Consultar el estado de tu licencia y plan activo.
• Eliminar tu cuenta — proceso protegido con confirmación múltiple. Al eliminar tu cuenta se elimina también tu membresía familiar.

Estado de la licencia:
• Prueba gratuita — Acceso completo por 30 días. Se muestra cuántos días restan.
• Activo — Licencia vigente. Aparece la fecha de renovación.
• Solo lectura — El período de prueba venció o la licencia fue suspendida. Puedes consultar todos los registros pero no podrás crear ni editar movimientos hasta renovar.

Modo solo lectura:
Cuando la cuenta está en modo solo lectura, la pantalla de Captura muestra un aviso y el botón de guardar queda deshabilitado. Todos los reportes, el dashboard y el historial siguen disponibles. Para reactivar el acceso completo, contacta soporte.

Nota: Solo el administrador puede aprobar nuevos miembros y gestionar la familia. Si eliminas tu cuenta siendo administrador, la familia queda sin administrador. Contacta soporte si necesitas transferir la administración.`
  },
  {
    id: 'mifamilia', icon: '🏠', title: 'Mi Familia (configuración)',
    content: `La sección "Mi Familia" permite al administrador personalizar el comportamiento global de la app para toda la familia.

Opciones de configuración:
• Nombre de la familia — aparece en la barra de navegación.
• Moneda y símbolo — define cómo se muestran los montos (ej: MXN / $).
• Idioma/región (locale) — afecta el formato de fechas y montos (ej: es-MX, en-US).
• Tipos de gasto requerido — personaliza las opciones de clasificación (Necesario, Gusto, etc.).
• Destinos de transferencia — define destinos frecuentes para el campo "Transferido a".
• Día de inicio de semana — lunes o domingo.

Código de invitación:
Visible también desde "Admin Familia". Compártelo para que otros miembros soliciten unirse.`
  },
];


const glossary = [
  { term: 'Rubro', def: 'Categoría principal del gasto o ingreso (ej: Alimentación, Transporte).' },
  { term: 'SubRubro', def: 'Subcategoría que especifica más el tipo de gasto (ej: Gasolina dentro de Transporte).' },
  { term: 'Forma de Pago', def: 'Método utilizado para la transacción: efectivo, tarjeta de crédito, débito o transferencia.' },
  { term: 'Requerido', def: 'Clasificación de la necesidad del gasto: Necesario, Gusto, Urgente, Inversión u Otro.' },
  { term: 'MSI', def: 'Meses Sin Intereses — compra diferida en mensualidades sin costo adicional.' },
  { term: 'Inversión', def: 'Compromiso de pago mensual para un inmueble, fondo o cualquier activo financiero.' },
  { term: 'Semáforo', def: 'Indicador visual de color: verde (al corriente), amarillo (vence pronto), rojo (vencido).' },
  { term: 'Motor de reglas', def: 'Sistema que detecta palabras clave en la descripción y sugiere Rubro/SubRubro automáticamente, sin IA.' },
  { term: 'Asistente IA', def: 'Chatbot inteligente que entiende lenguaje natural y registra transacciones automáticamente por texto o voz.' },
  { term: 'Código de familia', def: 'Código único alfanumérico (ej: GARCIA123) que se comparte con los integrantes para que soliciten acceso a la familia.' },
  { term: 'Admin Familia', def: 'Administrador de la familia con permisos para aprobar miembros y gestionar el acceso.' },
  { term: 'Mi Familia', def: 'Sección de configuración personal exclusiva de cada familia: nombre, moneda, tipos de gasto, etc.' },
  { term: 'Catálogos', def: 'Datos maestros de la app: Rubros, SubRubros, Personas y Formas de Pago.' },
  { term: 'Sugerencias inteligentes', def: 'Sistema que analiza el historial familiar y propone rubros, personas y métodos de pago frecuentes mientras escribes la descripción.' },
  { term: 'Pagos Programados', def: 'Módulo para hacer seguimiento de pagos fijos mensuales como servicios, suscripciones o colegiaturas.' },
  { term: 'Presupuesto', def: 'Módulo que analiza el historial familiar de egresos y sugiere un presupuesto mensual por categoría con margen del 10%.' },
  { term: 'Salud financiera', def: 'Indicador semáforo que compara el presupuesto sugerido vs los ingresos promedio: verde (<80%), amarillo (80-100%), rojo (>100%).' },
  { term: 'Detección de duplicados', def: 'Verificación automática que avisa si un movimiento ya fue registrado con monto y categoría similares en la misma fecha.' },
  { term: 'Memoria inteligente', def: 'Sistema que aprende los hábitos de captura de la familia (categorías, personas, métodos de pago) y los sugiere automáticamente, sin IA ni créditos.' },
  { term: 'Preferencias de usuario', def: 'Configuración personal que la app recuerda entre sesiones: filtros del dashboard, tipo de reporte, etc.' },
  { term: 'Mi Cuenta', def: 'Sección para gestionar el perfil personal del usuario, incluyendo la opción de eliminar la cuenta.' },
  { term: 'Mi Familia', def: 'Panel de configuración global de la familia: nombre, moneda, locale, tipos de gasto y destinos de transferencia.' },
  { term: 'Movimientos pendientes', def: 'Transacciones sin categoría o persona asignada, marcadas con ⚠️ para revisión posterior.' },
  { term: 'Sincronización automática', def: 'Proceso por el cual un pago registrado en MSI, Inversiones, Pagos Programados o Rentas genera automáticamente el movimiento correspondiente en el registro general.' },
  { term: 'Vinculación de pagos', def: 'Asociación entre una transacción del registro general y un pago especializado (MSI, inversión, pago programado o renta). Puede ser automática o manual.' },
  { term: 'Pago vinculado', def: 'Transacción que tiene un origen identificado en un módulo especializado. Se muestra con una etiqueta de color en la lista de movimientos.' },
  { term: 'Modo solo lectura', def: 'Estado de la cuenta cuando el período de prueba venció o la licencia fue suspendida. Permite consultar todos los registros pero no crear ni editar movimientos.' },
  { term: 'Licencia', def: 'Plan de acceso a FlowFin. Puede estar en prueba gratuita (30 días), activo (con renovación mensual) o solo lectura (suspendido o vencido).' },
];

export default function UserManual() {
   const [search, setSearch] = useState('');

   const filteredSections = useMemo(() => {
     if (!search.trim()) return sections;
     const query = search.toLowerCase();
     return sections.filter(s => s.title.toLowerCase().includes(query) || s.content.toLowerCase().includes(query));
   }, [search]);

   const filteredGlossary = useMemo(() => {
     if (!search.trim()) return glossary;
     const query = search.toLowerCase();
     return glossary.filter(g => g.term.toLowerCase().includes(query) || g.def.toLowerCase().includes(query));
   }, [search]);

   const hasResults = filteredSections.length > 0 || filteredGlossary.length > 0;

   return (
     <div data-tutorial="manual-root" className="pb-8">
       <PageHeader title="Manual de Usuario" subtitle="Guía completa de FlowFin" />

       <div className="px-4 space-y-4">
         {/* Intro card */}
         <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-10 h-10 rounded-xl overflow-hidden bg-black">
               <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/0206f467d_FlowFin_logo.png" alt="FinFlow" className="w-full h-full object-cover" />
             </div>
             <div>
               <h2 className="font-bold text-foreground">FlowFin</h2>
               <p className="text-xs text-muted-foreground">Finanzas Familiares Inteligentes</p>
             </div>
           </div>
           <p className="text-sm text-foreground/80">
             Esta guía te ayudará a aprovechar al máximo todas las funciones de FlowFin.
               Diseñada para parejas y familias que quieren tener control real de sus finanzas sin complicaciones.
           </p>
         </div>

         {/* Search box */}
         <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
           <input
             type="text"
             value={search}
             onChange={e => setSearch(e.target.value)}
             placeholder="Buscar tópicos..."
             className="w-full pl-9 pr-9 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
           />
           {search && (
             <button
               onClick={() => setSearch('')}
               aria-label="Limpiar búsqueda"
               className="absolute right-2 top-1/2 -translate-y-1/2 touch-target"
             >
               <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
             </button>
           )}
         </div>

         {/* No results */}
         {!hasResults && search && (
           <div className="text-center py-8 bg-muted/30 rounded-2xl">
             <p className="text-sm font-medium text-muted-foreground">No se encontraron resultados para "{search}"</p>
             <p className="text-xs text-muted-foreground mt-1">Intenta con otras palabras clave</p>
           </div>
         )}

         {hasResults && (
           <>
             {/* Sections */}
             {filteredSections.length > 0 && (
               <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                 <Accordion type="single" collapsible className="divide-y divide-border">
                   {filteredSections.map(s => (
                     <AccordionItem key={s.id} value={s.id} className="border-0">
                       <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 text-left">
                         <div className="flex items-center gap-3">
                           <span className="text-xl">{s.icon}</span>
                           <span className="text-sm font-semibold text-foreground">{s.title}</span>
                         </div>
                       </AccordionTrigger>
                       <AccordionContent className="px-4 pb-4">
                         <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed pl-8">
                           {s.content}
                         </div>
                       </AccordionContent>
                     </AccordionItem>
                   ))}
                 </Accordion>
               </div>
             )}

             {/* Glossary */}
             {filteredGlossary.length > 0 && (
               <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                 <h3 className="text-sm font-bold text-foreground mb-3">📖 Glosario</h3>
                 <div className="space-y-3">
                   {filteredGlossary.map(g => (
                     <div key={g.term} className="border-b border-border last:border-0 pb-3 last:pb-0">
                       <p className="text-sm font-semibold text-foreground">{g.term}</p>
                       <p className="text-xs text-muted-foreground mt-0.5">{g.def}</p>
                     </div>
                   ))}
                 </div>
               </div>
             )}
           </>
         )}
       </div>
     </div>
   );
 }