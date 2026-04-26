import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Mail, MessageCircle, Heart, Shield, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const CURRENT_VERSION = '2.15.0';

const VERSION_HISTORY = [
  {
    version: '2.15.0',
    date: '2026-04-24',
    label: 'Actual',
    changes: [
      'Botón flotante de acción (FAB): reemplaza el botón del Asistente — al tocarlo se despliegan dos opciones: "Chat" (Asistente IA) y "Agregar" (Captura); con animación spring',
      'FAB: arrastrable a cualquier posición de la pantalla; recuerda su posición; los botones secundarios se ajustan dinámicamente según el cuadrante donde esté',
      'FAB: visible en móvil, tablet y desktop; etiquetas "Chat" y "Agregar" bajo cada botón para mayor claridad',
      'Sistema de permisos centralizado: nueva página Admin Permisos (solo administradores) con tabla editable de artefactos y roles (Leer / Crear / Modificar / Eliminar)',
      'Jerarquía de roles: platform admin, family admin y miembro regular con accesos diferenciados y bien definidos',
      'Mi Licencia: nueva sección en Configuración para administradores de familia — muestra estado del plan, fechas y miembros sin acceso a datos de otras familias',
      'Fix RLS crítico: Pagos Programados y Rentas ahora pueden ser creados, editados y eliminados por cualquier miembro de la familia (antes estaban restringidos incorrectamente)',
    ],
  },
  {
    version: '2.14.0',
    date: '2026-04-24',
    label: '',
    changes: [
      'Asistente IA: nueva pantalla de bienvenida dinámica con resumen del mes, desglose por integrante y chips de acciones contextuales',
      'Asistente IA: router determinístico — responde consultas analíticas comunes sin llamar al LLM cuando la confianza es ≥ 75%',
      'Asistente IA: escaneo de tickets por cámara — envía foto del recibo y el Asistente extrae monto, comercio y categoría automáticamente',
      'Asistente IA: aislamiento de datos entre familias — FAMILY_ID y PERSON_ID inyectados en cada conversación (fix crítico de seguridad)',
      'Asistente IA: el LLM solo se activa cuando el usuario envía un mensaje (lazy-inject); ya no se dispara al abrir el chat',
      'Asistente IA: confirmación obligatoria antes de cualquier escritura — el asistente nunca registra movimientos de forma autónoma',
      'Asistente IA: 3 capas anti-alucinación matemática — el LLM nunca calcula montos, siempre usa datos reales via Tool Calls',
      'Asistente IA: consultas de gasto siempre acotadas al usuario autenticado; context refresh automático tras registrar un movimiento',
      'Asistente IA: límite de 2000 registros en consultas analíticas para totales completos y correctos',
      'Admin: nueva página "Uso de IA" con costo mensual acumulado, historial de escaneos de tickets y filtro por fecha (solo admin de plataforma)',
      'Admin Familia: corregida pérdida de vinculación de persona al cambiar de sección sin guardar',
      'Admin Familia: la persona vinculada a un miembro muestra su nombre correctamente (ya no mostraba "Sin vincular" tras guardar)',
    ],
  },
  {
    version: '2.13.0',
    date: '2026-04-22',
    label: '',
    changes: [
      'Asistente IA: Fase 1 — consistencia visual con helpers centralizados de formateo, componente Spinner unificado y tokens de color semánticos mejorados',
      'Asistente IA: Fase 2 — inteligencia programática con normalizador de 50+ comercios mexicanos, sugerencias con scoring de confianza y detección de cantidades atípicas',
      'Asistente IA: Fase 2 — chips predictivos por horario y día de semana, auto-selección de método de pago preferido, acciones rápidas dinámicas para el chat',
      'Asistente IA: Fase 3 — Base44 IA como capa activa con context pack automático (resumen mensual + próximos pagos) en cada conversación',
      'Detección de anomalías: nuevas entidades AnomalyAlert (z-score de picos de gasto) y UserProfile (estadísticas familiares semanales)',
      'Chat: detección automática de gastos recurrentes (≥3 meses con varianza ≤40%); máximo 3 anomalías en el contexto del Asistente',
      'Chat: user identity mapping via membership ID (sin filtrar por email) y per-person context personalizado',
      'Chat: todos los miembros de la familia incluidos en contexto byPerson para respuestas más precisas',
      'Permisos: admin puede actualizar cualquier membresía de la familia vía RLS',
      'UI: botón flotante del Asistente ahora hidden en desktop (visible solo en móvil); icono actualizado a Sparkles',
      'Persistencia: family member assignment y chat spending amounts persisten correctamente entre sesiones',
      'Formularios: optimistic updates en linkPersonMutation mantienen el dropdown actualizado',
    ],
  },
  {
    version: '2.12.0',
    date: '2026-04-21',
    label: '',
    changes: [
      'Tutorial interactivo: nuevo sistema guiado paso a paso con spotlight contextual al iniciar FlowFin por primera vez',
      'Tutorial: checkbox "No mostrar más" en el pie del tutorial para descartar permanentemente desde cualquier paso',
      'Tutorial: layout adaptado a pantallas pequeñas — hoja inferior en móvil con scroll interno',
      'Tutorial: persistencia del estado entre sesiones y dispositivos mediante hook dedicado',
      'Licencias: nuevo estado "Archivado" — activa 14 días después de vencer; la cuenta se elimina 15 días después si no se renueva',
      'Licencias: 17 automatizaciones de correo para todo el ciclo de vida (bienvenida, recordatorios, renovación, vencimiento, archivado)',
      'Planes actualizados: FlowFin Home $299 MXN/mes (1–4 miembros) y FlowFin Family+ $499 MXN/mes (5–10 miembros); eliminado plan Circle',
      'Admin Licencias: toggle de auto-renovación por familia con botón para enviar correos de prueba',
      'Captura: corrección de contraste en el desplegable de categorías (legible en tema claro y oscuro)',
      'Móvil: sección Sistema/Licencias ahora visible en el cajón "Más" (solo administradores)',
    ],
  },
  {
    version: '2.11.0',
    date: '2026-04-09',
    label: '',
    changes: [
      'Inicio en móvil: corregida condición de carga que podía mostrar incorrectamente la pantalla de incorporación a usuarios que ya pertenecen a una familia',
      'Bootstrap: eliminada brecha de un ciclo de render que causaba que el estado de membresía apareciera como no cargado antes de que la consulta se activara',
      'Resultado: los usuarios con membresía activa ya no son dirigidos erróneamente al flujo de unirse a una familia al abrir la app desde acceso directo o marcador',
    ],
  },
  {
    version: '2.10.0',
    date: '2026-04-08',
    label: '',
    changes: [
      'Captura: las sugerencias automáticas de rubros ahora se filtran correctamente según el tipo de movimiento (egreso o ingreso)',
      'Captura: al registrar un Ingreso ya no aparecen sugerencias de categorías de Egreso, y viceversa',
      'Motor de sugerencias: matchCategory ahora recibe el tipo de transacción y excluye categorías que no aplican',
    ],
  },
  {
    version: '2.9.0',
    date: '2026-04-07',
    label: '',
    changes: [
      'Módulo Rentas: reconstruido completamente — ahora funcional y estable en producción',
      'Rentas: CRUD completo de propiedades (crear, editar, eliminar)',
      'Rentas: registro de cobro crea automáticamente ingreso en Movimientos vinculado',
      'Rentas: desmarcar cobro elimina también el ingreso vinculado en Movimientos',
      'Rentas: guardia de duplicados — evita registrar dos cobros del mismo mes para la misma propiedad',
      'Rentas: categoría "Rentas" se crea automáticamente si no existe al registrar un cobro',
      'Rentas: historial de últimos 3 cobros visible por propiedad',
    ],
  },
  {
    version: '2.8.0',
    date: '2026-04-07',
    label: '',
    changes: [
      'Asistente IA: idioma ahora sigue el locale activo de la app (ya no hardcodeado en español)',
      'Asistente IA: reconocimiento de voz usa el mismo locale de la app',
      'Asistente IA: matching inteligente para métodos de pago (ej: "tdc like u" → TDC Like U)',
      'Asistente IA: soporte de cálculo de propinas y porcentajes (ej: "188 más 10% de propina")',
      'Asistente IA: normalización robusta para personas, categorías y métodos de pago con variaciones de escritura',
      'Asistente IA: reglas mejoradas de inferencia de categorías por palabras clave',
      'Asistente IA: soporte mejorado de múltiples movimientos en un solo mensaje con resumen y confirmación',
    ],
  },
  {
    version: '2.7.0',
    date: '2026-04-07',
    label: '',
    changes: [
      'Asistente IA: ahora siempre responde en español — se eliminó el comportamiento donde el modelo respondía en inglés',
      'Asistente IA: soporte para registrar múltiples movimientos en un solo mensaje (texto o voz)',
      'Asistente IA: al recibir varios gastos/ingresos en un mensaje, muestra resumen de todos y los guarda con confirmación',
      'Asistente IA: eliminado el comportamiento de "processing checkpoint" y el pedido de escribir "continue"',
      'Botón flotante del Asistente: corregido posicionamiento — ya no queda cubierto por la barra de navegación inferior',
      'Pantalla de carga: actualizada al logo oficial actual de FlowFin en todas las pantallas de splash/loading',
    ],
  },
  {
    version: '2.6.0',
    date: '2026-04-07',
    label: '',
    changes: [
      'Asistente IA: eliminada exposición de IDs internos, nombres de campos y detalles técnicos en las respuestas al usuario',
      'Asistente IA: respuestas ahora siempre en lenguaje natural y amigable, orientadas al usuario final',
      'Asistente IA: nuevo fallback claro cuando algo falla — el asistente pide reintentar sin exponer errores técnicos',
      'Asistente IA: confirmación de transacciones mejorada — resumen siempre coherente tras completar búsquedas internas',
      'Banner de actualización: corregido — ya no aparece falsamente cuando la app está en la versión más reciente',
      'Base de datos sincronizada con la versión del código (2.6.0)',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-04-06',
    label: '',
    changes: [
      'Pagos Programados: interfaz mejorada con botones filtrados para seleccionar persona y método de pago (búsqueda en tiempo real)',
      'Rentas: nuevo módulo completo para registrar cobros de propiedades con sincronización automática a Movimientos como ingreso',
      'Rentas: bottom sheet para registro de pagos, campos de fecha, monto, persona que recibió y método de pago',
      'Dashboard: banner de rentas pendientes que muestra propiedades sin cobro en mes actual o vencidas',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-04-06',
    label: '',
    changes: [
      'Nuevo logotipo oficial de FlowFin actualizado en toda la aplicación: pantalla de carga, barra lateral, Manual de Usuario y sección Acerca de',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-04-06',
    label: '',
    changes: [
      'Corrección de nombre: el archivo Excel de movimientos ahora se descarga como "FlowFin_YYYY-MM-DD.xlsx" (antes decía FamilyFlow)',
      'Corrección de nombre: los reportes compartidos o descargados como PDF y PNG ahora usan el nombre FlowFin en lugar de FamilyFlow',
      'Consistencia de marca: todas las referencias a FamilyFlow en archivos exportados han sido reemplazadas por FlowFin',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-04-06',
    label: '',
    changes: [
      'Pagos Programados: al desmarcar un pago, ahora se elimina también el egreso vinculado en Movimientos (antes quedaba huérfano)',
      'Pagos Programados: corregido bug donde al desmarcar y volver a marcar se creaba un egreso duplicado',
      'Pagos Programados: eliminada la automation redundante que podía generar transacciones duplicadas — ahora solo el formulario de confirmación crea el egreso',
      'Limpieza de datos: eliminadas transacciones huérfanas generadas por el bug anterior',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-04-06',
    label: '',
    changes: [
      'Pagos Programados: campo "¿Quién paga?" ahora muestra selector con las personas de la familia (igual que en captura de gastos/ingresos)',
      'Pagos Programados: se pre-selecciona automáticamente la primera persona de la familia al abrir el formulario de confirmación',
      'Toasts: el botón X para cerrar notificaciones ahora es siempre visible en móvil (antes solo aparecía al pasar el cursor)',
      'Consistencia UI: los selectores de personas y métodos de pago en Pagos Programados son idénticos a los de la pantalla de captura',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-04-06',
    label: '',
    changes: [
      'Rebrand oficial: la aplicación ahora se llama FlowFin en toda la interfaz, documentación y pantallas de carga',
      'Actualización de nombre en título del navegador, pantallas de carga, Manual de Usuario y sección Acerca de',
      'Corrección de todas las referencias a "FamilyFlow" y "FinFlow" reemplazadas por "FlowFin"',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-04-06',
    label: '',
    changes: [
      'Pagos Programados: nuevo campo "Con qué se pagó" al confirmar un pago — pre-selecciona la forma de pago habitual del pago programado y permite cambiarla al momento de confirmar',
      'Pagos Programados: nuevo campo "¿Quién paga?" al confirmar — muestra el nombre del usuario actual como sugerencia y permite editarlo',
      'Pagos Programados: los toasts de confirmación y error ahora se cierran automáticamente en 5 segundos o manualmente con el botón X',
      'Corrección de toaster: el botón X en las notificaciones ahora funciona correctamente en toda la app',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-04-06',
    label: '',
    changes: [
      'Pagos Programados: retroalimentación inmediata con notificaciones de éxito y error al marcar o desmarcar un pago',
      'Pagos Programados: manejo correcto de errores con try/catch — el spinner desaparece siempre aunque falle la operación',
      'Pagos Programados: botones con área de toque mínima de 44×44px para mejor accesibilidad en iOS y Android',
      'Pagos Programados: soporte correcto de safe-area-inset-bottom para que el botón "Confirmar pago" no quede oculto bajo el home indicator en iPhone',
      'Pagos Programados: indicador de carga animado (spinner) en botones "Marcar como pagado" y "Desmarcar" durante el procesamiento',
      'Sincronización de movimientos: invalidación de caché garantizada después de cada operación de pago',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-04-04',
    label: '',
    changes: [
      'Corrección de permisos familiares: todos los miembros de la familia pueden ver, crear y editar inversiones, MSI, rentas y pagos programados sin importar quién los registró',
      'Corrección de dashboard para miembros no-administradores: los banners de pagos pendientes (inversiones, MSI, rentas) ahora muestran información correcta para todos los integrantes',
      'Acceso unificado a pagos de inversión, MSI y renta para toda la familia',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-04-04',
    label: '',
    changes: [
      'Sincronización automática de pagos especializados: al registrar un pago de MSI, Inversión, Pago Programado o Renta se crea automáticamente el movimiento en el registro general',
      'Vinculación manual de movimientos con pagos especializados desde la pantalla de edición de transacción',
      'Indicador visual en la lista de movimientos que muestra si una transacción está vinculada a un pago especializado (MSI, Inversión, etc.)',
      'Desvinculación de transacciones: posibilidad de quitar el vínculo entre una transacción y su pago especializado',
      'Nueva función de backend para gestionar vínculos: valida, asocia y protege contra vínculos duplicados',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-04-03',
    label: '',
    changes: [
      'Nuevo módulo Presupuesto: sugerencia inteligente de presupuesto mensual por rubro basada en historial familiar',
      'Indicador de salud financiera: semáforo verde/amarillo/rojo según la relación gasto-ingreso',
      'Navegación reorganizada en grupos (Herramientas, Compromisos, Configuración, Información) para mayor claridad',
      'Barra lateral de escritorio con secciones agrupadas y etiquetas de categoría',
      'Menú "Más" en móvil reorganizado con grupos visuales y colores por sección',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-04-03',
    label: '',
    changes: [
      'Sugerencias inteligentes en captura: rubros, personas y formas de pago frecuentes basados en historial familiar',
      'Detección automática de movimientos duplicados con opción de confirmar o cancelar',
      'Módulo de Pagos Programados: administra recibos, servicios y cualquier pago recurrente mensual',
      'Banner de actualización automática: avisa cuando hay una nueva versión disponible',
      'Indicadores de pagos pendientes en el dashboard (programados, inversiones y rentas)',
      'Mejoras de rendimiento con carga lazy de páginas y skeleton de carga animado',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04-03',
    label: '',
    changes: [
      'Sugerencias inteligentes en captura: rubros, personas y formas de pago frecuentes basados en historial familiar',
      'Detección automática de movimientos duplicados con opción de confirmar o cancelar',
      'Módulo de Pagos Programados: administra recibos, servicios y cualquier pago recurrente mensual',
      'Banner de actualización automática: avisa cuando hay una nueva versión disponible',
      'Indicadores de pagos pendientes en el dashboard (programados, inversiones y rentas)',
      'Mejoras de rendimiento con carga lazy de páginas y skeleton de carga animado',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-04-02',
    label: '',
    changes: [
      'Edición de ítems en catálogos (rubros, subrubros, personas, formas de pago)',
      'Auto-completado de descripción al seleccionar sugerencia de categoría',
      'Descripción mejorada en dashboard y movimientos: muestra notas cuando la descripción es corta',
      'Toggle de tema claro/oscuro disponible en cajón móvil y barra lateral',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-20',
    label: '',
    changes: [
      'Asistente IA para registro y consulta de movimientos',
      'Soporte de captura por voz con reconocimiento nativo',
      'Exportación de reportes a Excel y PDF',
      'Módulo de Rentas con seguimiento mensual',
      'Módulo de Inversiones con calendario de pagos',
      'Módulo MSI (Meses Sin Intereses) con historial',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-02-01',
    label: '',
    changes: [
      'Lanzamiento inicial de FlowFin',
      'Registro de ingresos y egresos con categorías',
      'Dashboard con resumen por periodo y persona',
      'Catálogos de rubros, subrubros, personas y formas de pago',
      'Sistema de familias con código de acceso',
      'Soporte para modo claro y oscuro',
    ],
  },
];

export default function About() {
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <div className="pb-8">
      <PageHeader title="Acerca de" subtitle="FlowFin" />

      <div className="px-4 space-y-4">
        {/* App identity */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm text-center">
          <div className="w-20 h-20 rounded-3xl overflow-hidden mx-auto shadow-xl mb-4 bg-black">
            <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/0206f467d_FlowFin_logo.png" alt="FinFlow" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-1">FlowFin</h2>
          <p className="text-sm text-muted-foreground mb-3">Sistema integral de finanzas familiares</p>
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">Versión {CURRENT_VERSION}</span>
        </div>

        {/* Description */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-2">Acerca de FlowFin</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            FlowFin es una solución moderna y completa para la gestión de finanzas familiares,
            diseñada para parejas y familias que desean tener control real de sus ingresos, egresos,
            inversiones y compromisos financieros.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            Proporciona herramientas intuitivas para registrar movimientos con captura por voz,
            autodetección de categorías, reportes dinámicos exportables y seguimiento de pagos
            programados, todo sin depender de inteligencia artificial en el uso diario.
          </p>
        </div>

        {/* Features */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-3">Características Principales</h3>
          <div className="space-y-3">
            {[
              { icon: Shield, title: 'Privacidad y seguridad', desc: 'Tus datos financieros son privados. El reconocimiento de voz usa la API nativa del dispositivo.' },
              { icon: Heart, title: 'Diseño para familias', desc: 'Configuración personalizada por familia, soporte para múltiples personas y métodos de pago.' },
            ].map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Developer info */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-3">Equipo Desarrollador</h3>
          <div className="flex items-center gap-3 mb-3">
            <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/062f64e09_Logo_ACACIA_HighRes.jpg" alt="ACACIA" className="w-12 h-12 rounded-2xl shadow-md flex-shrink-0 object-cover" />
            <div>
              <p className="text-sm font-bold text-foreground">ACACIA Consultoría</p>
              <p className="text-xs text-muted-foreground">en Informática y Cómputo</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Desarrollado con dedicación para ofrecerte la mejor experiencia en la gestión de tus finanzas familiares.
          </p>
        </div>

        {/* Contact */}
        <div data-tutorial="about-support-card" className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-3">Contacto y Soporte</h3>
          <div className="space-y-3">
            <a href="mailto:soporte@acaciaco.com.mx" className="flex items-center gap-3 p-3 bg-muted rounded-xl hover:bg-muted/70 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Email</p>
                <p className="text-xs text-muted-foreground">soporte@acaciaco.com.mx</p>
              </div>
            </a>
            <a href="https://wa.me/524498958291" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-muted rounded-xl hover:bg-muted/70 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground">+52 449 895 8291</p>
              </div>
            </a>
          </div>
        </div>

        {/* Legal */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-2">Derechos Reservados</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            © 2026 ACACIA Consultoría en Informática y Cómputo{'\n'}
            Todos los derechos reservados.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Licencia registrada a: <span className="text-foreground font-medium">h.josepablo@gmail.com</span>
          </p>
        </div>

        {/* Current version changes */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Novedades v{CURRENT_VERSION}</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Actual</span>
          </div>
          <ul className="space-y-2">
            {VERSION_HISTORY[0].changes.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-primary mt-0.5 flex-shrink-0">✦</span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Version history collapsible */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-bold text-foreground">Historial de versiones</span>
            {historyOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {historyOpen && (
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
              {VERSION_HISTORY.slice(1).map(v => (
                <div key={v.version}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-foreground">v{v.version}</span>
                    <span className="text-[10px] text-muted-foreground">{v.date}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {v.changes.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-muted-foreground/50 mt-0.5 flex-shrink-0">–</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Made with love */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            Hecho con <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> para las familias
          </p>
        </div>
      </div>
    </div>
  );
}