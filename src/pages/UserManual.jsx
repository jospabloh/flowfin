import { useState, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, X } from 'lucide-react';

const sections = [
  {
    id: 'inicio', icon: '🚀', title: 'Comenzar a usar FamilyFlow',
    content: `FamilyFlow está diseñado para que empieces a registrar en menos de 2 minutos.

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

Auto-completado de descripción:
Cuando tocas una sugerencia de categoría/subcategoría, la descripción se completa automáticamente con el nombre del subrubro (o categoría). Esto evita dejar descripciones muy cortas o ambiguas.

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
    content: `Módulo para familias con propiedades en renta.

Por cada propiedad puedes:
• Registrar los datos del inquilino
• Ver si el pago del mes actual ya fue cobrado
• Registrar el cobro con fecha, monto y cuenta de depósito
• Ver el historial de cobros

El indicador verde/amarillo te dice de un vistazo qué propiedades ya pagaron este mes.`
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
    content: `FamilyFlow usa el reconocimiento de voz nativo del dispositivo (Web Speech API), sin consumir créditos ni enviar datos a servidores externos.

Cómo usar:
1. En la pantalla de captura, toca el ícono del micrófono.
2. Habla naturalmente: "gasolina BMW ochocientos pesos con débito".
3. El sistema transcribe, detecta el monto y aplica las palabras clave del catálogo.

Disponibilidad:
• iPhone/iPad: requiere Safari o Chrome.
• Android: funciona en Chrome.
• Desktop: Chrome y Edge.

Si tu navegador no lo soporta, el botón mostrará un aviso.`
  },
  {
    id: 'asistente', icon: '🤖', title: 'Asistente IA — Ventaja FamilyFlow',
    content: `El Asistente IA es la característica estrella de FamilyFlow. Permite registrar gastos e ingresos simplemente hablando o escribiendo de forma natural en español.

  Acceso rápido: En todas las pantallas (excepto el propio Asistente) hay un botón flotante 💬 en la esquina inferior derecha para abrirlo directamente.

  Ejemplos de uso:
  • "Gasté 500 pesos en gasolina hoy" → El asistente crea el egreso, detecta la categoría y la guarda.
  • "Recibí 10,000 de un cliente" → Registra el ingreso con la fuente que menciones.
  • "¿Cuánto gasté esta semana?" → El asistente consulta y te muestra un resumen.
  • "Registra 1,200 del súper pagado con tarjeta" → Detecta monto, rubro, método de pago.
  • "¿Cuáles movimientos están incompletos?" → El asistente lista los que faltan información.
  • "Completa los datos pendientes" → El asistente detecta movimientos sin persona o categoría y te ayuda a completarlos.

  Campos obligatorios que el asistente siempre pedirá antes de guardar:
  • Monto
  • Tipo (egreso o ingreso)
  • Categoría (Rubro)
  • Persona (uno de los integrantes de la familia)
  • Fecha (si no se menciona, usa hoy)

  Si falta alguno, el asistente preguntará antes de guardar. Nunca asumirá datos.

  También funciona con voz:
  1. Toca el ícono del micrófono en el Asistente.
  2. Habla tu transacción naturalmente en español.
  3. El asistente confirma y guarda.

  Acciones pendientes: Si un movimiento no tiene persona o categoría asignada, aparece marcado como "⚠️ Pendiente de revisar" en la sección de Movimientos. Puedes pedirle al asistente que los complete: "¿Cuáles movimientos están pendientes de revisar?".

  Costo: El asistente consume créditos Base44 por mensaje. El costo es muy bajo para el beneficio que proporciona.

  Privacidad: Los datos se procesan dentro de la plataforma Base44. No se comparten con terceros.`
  },
  {
    id: 'familia', icon: '👨‍👩‍👧‍👦', title: 'Sistema de Familias y Acceso',
    content: `FamilyFlow usa un sistema de códigos de familia para que solo las personas autorizadas puedan ver los datos de su familia.

Cómo funciona:
1. El administrador crea la familia y recibe un código único (ej: GARCIA123).
2. Los demás integrantes ingresan ese código para solicitar acceso.
3. El administrador aprueba o rechaza cada solicitud desde "Admin Familia".
4. Solo miembros aprobados pueden ver los datos de la familia.

Admin Familia:
• Ver el código de invitación y copiarlo.
• Aprobar o rechazar solicitudes pendientes.
• Ver todos los miembros activos.

Seguridad: Cada familia ve únicamente sus propios datos. Ninguna familia puede ver los datos de otra.`
  },
  {
    id: 'export', icon: '📤', title: 'Exportar datos',
    content: `Puedes exportar tus datos en cualquier momento desde la sección de Movimientos.

Formatos disponibles:
• Excel (.xlsx) — Todos los movimientos filtrados con todos los campos: fecha, tipo, monto, descripción, rubro, subrubro, persona, forma de pago, requerido, factura y notas.

Desde Reportes también puedes:
• Compartir el reporte como PDF o imagen PNG directamente a WhatsApp, correo u otras apps usando el menú de compartir del dispositivo.`
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
     <div className="pb-8">
       <PageHeader title="Manual de Usuario" subtitle="Guía completa de FamilyFlow" />

       <div className="px-4 space-y-4">
         {/* Intro card */}
         <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
               <span className="text-primary-foreground font-bold text-lg">F</span>
             </div>
             <div>
               <h2 className="font-bold text-foreground">FamilyFlow</h2>
               <p className="text-xs text-muted-foreground">Finanzas Familiares Inteligentes</p>
             </div>
           </div>
           <p className="text-sm text-foreground/80">
             Esta guía te ayudará a aprovechar al máximo todas las funciones de la app.
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