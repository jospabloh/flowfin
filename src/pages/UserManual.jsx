import PageHeader from '@/components/PageHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
• Últimos movimientos — acceso rápido a los 5 más recientes.
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

El sistema calcula automáticamente el próximo cargo y cuántos meses faltan. Usa el botón "Marcar pagado" cada mes para mantener el seguimiento actualizado.`
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
Agrega, edita o elimina las categorías de gasto con su color e ícono.

SubRubros (Subcategorías):
Cada subrubro tiene palabras clave que usa el motor de autodetección. Por ejemplo, si escribes "gasolina" en la descripción, el sistema sugiere automáticamente Transporte > Gasolina.

Tip: Agrega palabras clave específicas de tu uso diario para mejorar la detección.

Personas:
Define quiénes son los integrantes de tu familia con su color e inicial para el avatar.

Formas de Pago:
Tus tarjetas, cuentas y métodos de pago habituales.`
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
  { term: 'Mi Familia', def: 'Sección de configuración personal exclusiva de cada familia: nombre, moneda, tipos de gasto, etc.' },
  { term: 'Catálogos', def: 'Datos maestros de la app: Rubros, SubRubros, Personas y Formas de Pago.' },
];

export default function UserManual() {
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

        {/* Sections */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <Accordion type="single" collapsible className="divide-y divide-border">
            {sections.map(s => (
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

        {/* Glossary */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-3">📖 Glosario</h3>
          <div className="space-y-3">
            {glossary.map(g => (
              <div key={g.term} className="border-b border-border last:border-0 pb-3 last:pb-0">
                <p className="text-sm font-semibold text-foreground">{g.term}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{g.def}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}