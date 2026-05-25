import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Returns a structured guide of FlowFin app features and how-to instructions.
// Used by Finia to answer questions about the app and guide users.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const guide = {
      app_name: 'FlowFin',
      description: 'Aplicación de finanzas personales y familiares. Permite registrar gastos e ingresos, gestionar presupuestos, pagos programados, tarjetas de crédito (MSI), inversiones, propiedades en renta y viajes.',

      modules: [
        {
          name: 'Dashboard (Inicio)',
          path: '/Dashboard',
          description: 'Vista principal con resumen del mes: ingresos, gastos, balance, top categorías, movimientos recientes, pagos próximos, metas y alertas de presupuesto.',
          how_to: 'Ve al menú principal y selecciona "Inicio" o "Dashboard".'
        },
        {
          name: 'Captura Rápida',
          path: '/Capture',
          description: 'Registra un gasto o ingreso rápidamente. Puedes escribir el concepto, monto, categoría (rubro), persona, método de pago y fecha. También puedes escanear un recibo.',
          how_to: 'Toca el botón "+" flotante o ve a "Captura" en el menú. Llena: Monto, Tipo (Gasto/Ingreso), Rubro, Persona y Forma de Pago. Opcionalmente agrega Descripción y Subrubro.',
          fields: [
            { name: 'Monto', required: true, description: 'Cantidad en pesos (o la moneda configurada).' },
            { name: 'Tipo', required: true, description: '"Gasto" o "Ingreso".' },
            { name: 'Rubro (Categoría)', required: true, description: 'Clasificación del movimiento, ej: Alimentación, Hogar, Salud, Transporte, etc.' },
            { name: 'Subrubro (Subcategoría)', required: false, description: 'Clasificación más específica dentro del rubro.' },
            { name: 'Persona', required: true, description: 'Integrante de la familia al que pertenece el gasto/ingreso.' },
            { name: 'Forma de pago', required: false, description: 'Tarjeta, efectivo, transferencia, etc.' },
            { name: 'Descripción / Concepto', required: false, description: 'Texto libre para detallar el movimiento.' },
            { name: 'Fecha', required: true, description: 'Por defecto es hoy.' },
            { name: 'Necesario/Gusto/Urgente/Inversión', required: false, description: 'Clasificación de prioridad del gasto.' },
          ]
        },
        {
          name: 'Transacciones',
          path: '/Transactions',
          description: 'Lista completa de todos los movimientos registrados. Puedes filtrar por persona, categoría, tipo, método de pago y rango de fechas. Puedes editar o eliminar movimientos.',
          how_to: 'Ve a "Transacciones" en el menú. Usa los filtros para buscar movimientos específicos. Toca un movimiento para ver detalles o editarlo.'
        },
        {
          name: 'Reportes',
          path: '/Reports',
          description: 'Análisis detallados de gastos e ingresos por período: gráficas por categoría, por persona, comparativos mensuales.',
          how_to: 'Ve a "Reportes". Selecciona el período y el tipo de reporte. Puedes ver desglose por rubro o por integrante.'
        },
        {
          name: 'Presupuesto',
          path: '/Budget',
          description: 'Define límites mensuales por categoría. Finia te alertará cuando estés cerca o hayas superado el presupuesto de una categoría.',
          how_to: 'Ve a "Presupuesto". Toca una categoría para asignarle un límite mensual. El dashboard y Finia monitorean automáticamente el avance.'
        },
        {
          name: 'Pagos Programados',
          path: '/ScheduledPayments',
          description: 'Registra pagos fijos mensuales (luz, teléfono, colegiatura, renta, etc.) para no olvidarlos. Finia puede recordártelos y ayudarte a marcarlos como pagados.',
          how_to: 'Ve a "Pagos Programados". Toca "+" para agregar: Nombre del pago, Día de vencimiento, Monto estimado, Categoría y Forma de pago. Para marcar como pagado, toca el pago y selecciona "Registrar pago" — esto crea automáticamente la transacción correspondiente.'
        },
        {
          name: 'MSI (Meses Sin Intereses)',
          path: '/MSI',
          description: 'Controla tus compras a meses sin intereses. Registra la tienda, el total, las mensualidades y el día de cobro para saber cuánto te cobran cada mes.',
          how_to: 'Ve a "MSI". Toca "+" para agregar: Tienda, Concepto, Total, Mensualidad, Total de meses, Fecha de inicio y Día de cobro. Cada mes puedes registrar el pago de la mensualidad.'
        },
        {
          name: 'Inversiones',
          path: '/Investments',
          description: 'Controla inversiones con pagos periódicos: fondos, inmuebles en proceso de pago, etc. Registra el nombre, tipo, total, pagos y fecha de inicio.',
          how_to: 'Ve a "Inversiones". Toca "+" para agregar: Nombre, Tipo (inmueble, fondo, etc.), Monto total, Número de pagos, Mensualidad y Día de pago. Registra cada pago mensual desde la tarjeta de la inversión.'
        },
        {
          name: 'Rentas',
          path: '/Rentals',
          description: 'Administra propiedades en renta. Registra el inmueble, inquilino, renta base y el día esperado de pago. Registra los pagos recibidos cada mes.',
          how_to: 'Ve a "Rentas". Toca "+" para agregar la propiedad: Nombre, Inquilino, Renta base y Día de pago. Cada mes, toca "Registrar pago" en la propiedad para confirmar el cobro de renta — esto crea la transacción de ingreso.'
        },
        {
          name: 'Ahorros y Metas',
          path: '/Goals',
          description: 'Define metas de ahorro con un monto objetivo y fecha límite. Vincula una categoría para que FlowFin calcule automáticamente el avance.',
          how_to: 'Ve a "Metas". Toca "+" para crear una meta: Nombre, Monto objetivo, Fecha límite, Icono y Color. Opcionalmente vincula una categoría de transacciones para cálculo automático del avance.'
        },
        {
          name: 'Viajes',
          path: '/Trips',
          description: 'Registra viajes con presupuesto propio. Asocia gastos al viaje, maneja múltiples monedas y ve el resumen de gastos del viaje.',
          how_to: 'Ve a "Viajes". Crea un viaje con: Nombre, Fechas, Países destino, Monedas usadas y Presupuesto. Cuando registres un gasto, puedes asociarlo al viaje activo.'
        },
        {
          name: 'Catálogos',
          path: '/Catalogs',
          description: 'Administra los rubros (categorías), subrubros (subcategorías), personas e integrantes y formas de pago de tu familia.',
          how_to: 'Ve a "Catálogos". Aquí puedes:\n- Agregar/editar Rubros: nombre, ícono, color, tipo (gasto/ingreso/ambos).\n- Agregar/editar Subrubros: vinculados a un rubro.\n- Agregar/editar Personas/Integrantes.\n- Agregar/editar Formas de Pago: nombre, banco, tipo (débito/crédito/efectivo/transferencia), últimos 4 dígitos, día de corte y día de pago.'
        },
        {
          name: 'Configuración de Familia',
          path: '/FamilySettings',
          description: 'Administra los integrantes de la familia, invita nuevos miembros, configura la moneda y ajusta opciones generales.',
          how_to: 'Ve a "Configuración" o "Mi Familia". Puedes invitar miembros por código o enlace, editar el nombre de la familia y ver los integrantes activos.'
        },
        {
          name: 'Notas de Versión',
          path: '/ReleaseNotes',
          description: 'Consulta las últimas actualizaciones y mejoras de FlowFin.',
          how_to: 'Ve al menú y busca "Novedades" o "Versión".'
        }
      ],

      common_questions: [
        {
          question: '¿Cómo registro un gasto?',
          answer: 'Toca el botón "+" flotante o ve a Captura. Ingresa el monto, selecciona "Gasto", elige el Rubro (categoría), la Persona y la Forma de Pago. Toca Guardar.'
        },
        {
          question: '¿Cómo registro un ingreso?',
          answer: 'Igual que un gasto pero selecciona "Ingreso" como tipo. Por ejemplo: salario, renta cobrada, etc.'
        },
        {
          question: '¿Cómo marco un pago programado como pagado?',
          answer: 'Ve a "Pagos Programados", toca el pago pendiente y selecciona "Registrar pago". Esto marcará el pago como realizado y creará la transacción automáticamente.'
        },
        {
          question: '¿Cómo aplico el pago de una renta?',
          answer: 'Ve a "Rentas", toca la propiedad y selecciona "Registrar pago de renta". Confirma el monto y la fecha — se creará un ingreso automáticamente.'
        },
        {
          question: '¿Cómo aplico el pago de una mensualidad MSI?',
          answer: 'Ve a "MSI", toca la compra a meses y selecciona "Registrar pago". Confirma la mensualidad — se creará el gasto correspondiente.'
        },
        {
          question: '¿Cómo registro un pago de inversión?',
          answer: 'Ve a "Inversiones", toca la inversión y selecciona "Registrar pago". Confirma el monto — se creará la transacción.'
        },
        {
          question: '¿Cómo agrego una persona/integrante?',
          answer: 'Ve a "Catálogos" y luego a "Personas". Toca "+" e ingresa el nombre. También puedes invitar a un usuario a tu familia desde "Configuración de Familia".'
        },
        {
          question: '¿Cómo agrego un rubro o categoría?',
          answer: 'Ve a "Catálogos" y luego a "Rubros". Toca "+" e ingresa el nombre, ícono, color y tipo (Gasto, Ingreso o Ambos).'
        },
        {
          question: '¿Cómo agrego una forma de pago?',
          answer: 'Ve a "Catálogos" y luego a "Formas de Pago". Toca "+" e ingresa el nombre, banco, tipo y los últimos 4 dígitos si aplica.'
        },
        {
          question: '¿Cómo veo mi resumen mensual?',
          answer: 'Ve al Dashboard (Inicio) para ver ingresos, gastos y balance del mes. Para más detalle ve a "Reportes".'
        },
        {
          question: '¿Cómo configuro un presupuesto?',
          answer: 'Ve a "Presupuesto" y toca una categoría para asignarle un límite mensual. FlowFin te avisará cuando te acerques o superes el límite.'
        },
        {
          question: '¿Cómo invito a alguien a mi familia?',
          answer: 'Ve a "Configuración de Familia" y usa el código de familia o el enlace de invitación para compartirlo con la persona que quieres agregar.'
        },
        {
          question: '¿Qué es un subrubro?',
          answer: 'Un subrubro es una clasificación más específica dentro de un rubro. Por ejemplo, dentro del rubro "Alimentación" puedes tener subrubros como "Súper", "Restaurantes", "Cafés", etc.'
        },
        {
          question: '¿Cómo escaneo un recibo?',
          answer: 'En la pantalla de Captura o en el chat con Finia, puedes adjuntar la foto de un recibo. Finia extraerá automáticamente el monto, la tienda y sugerirá la categoría.'
        }
      ]
    };

    return Response.json(guide);
  } catch (error) {
    console.error('finiaGetAppGuide error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});