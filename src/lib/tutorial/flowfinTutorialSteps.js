export const FLOWFIN_TUTORIAL_STEPS = [
  {
    id: 'join-code',
    kind: 'modal',
    route: '/FamilyAdmin',
    title: 'Código de familia',
    description:
      'Este código es el que debes compartir. Quien quiera unirse a tu familia debe capturarlo en la app y después tú debes aprobar su solicitud.',
    nextLabel: 'Ver aprobación',
  },
  {
    id: 'family-admin-code',
    kind: 'spotlight',
    route: '/FamilyAdmin',
    target: '[data-tutorial="family-admin-code-card"]',
    title: 'Aquí compartes el código',
    description:
      'Copia este código y compártelo con los miembros que deben unirse a la familia.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'family-admin-pending',
    kind: 'spotlight',
    route: '/FamilyAdmin',
    target: '[data-tutorial="family-admin-pending-card"]',
    title: 'Aquí apruebas a los miembros',
    description:
      'Cuando alguien capture el código, su solicitud aparecerá aquí. Hasta que la apruebes no tendrá acceso como miembro.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'family-settings',
    kind: 'spotlight',
    route: '/FamilySettings',
    target: '[data-tutorial="family-settings-card"]',
    title: 'Configuración básica de la familia',
    description:
      'Aquí ajustas nombre, región, moneda, símbolo e inicio de semana.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'catalogs-categories',
    kind: 'spotlight',
    route: '/Catalogs',
    target: '[data-tutorial="catalogs-tab-categories"]',
    title: 'Rubros',
    description:
      'Aquí defines las categorías principales de ingreso y egreso.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'catalogs-subcategories',
    kind: 'spotlight',
    route: '/Catalogs',
    target: '[data-tutorial="catalogs-tab-subcategories"]',
    title: 'SubRubros',
    description:
      'Aquí detallas mejor cada rubro y agregas palabras clave para sugerencias automáticas.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'catalogs-persons',
    kind: 'spotlight',
    route: '/Catalogs',
    target: '[data-tutorial="catalogs-tab-persons"]',
    title: 'Personas',
    description:
      'Aquí registras a los integrantes de la familia. Para guardar movimientos necesitas al menos una persona.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'catalogs-methods',
    kind: 'spotlight',
    route: '/Catalogs',
    target: '[data-tutorial="catalogs-tab-methods"]',
    title: 'Formas de pago',
    description:
      'Aquí registras tarjetas, efectivo, transferencias y cuentas que usarán en la captura.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'capture',
    kind: 'spotlight',
    route: '/Capture',
    target: '[data-tutorial="capture-form-card"]',
    title: 'Registrar tu primer movimiento',
    description:
      'Aquí capturas ingresos y egresos. La app te avisará si todavía te falta información mínima para poder registrarlos.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'manual',
    kind: 'spotlight',
    route: '/UserManual',
    target: '[data-tutorial="manual-root"]',
    title: 'Manual de usuario',
    description:
      'Aquí tienes la guía completa de uso de FlowFin cuando necesites repasar una función.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'support',
    kind: 'spotlight',
    route: '/About',
    target: '[data-tutorial="about-support-card"]',
    title: 'Soporte',
    description:
      'Aquí encuentras los canales de soporte por correo y WhatsApp.',
    nextLabel: 'Siguiente',
  },
  {
    id: 'final',
    kind: 'modal',
    route: '/Dashboard',
    title: 'Todo listo',
    description:
      'Durante tu prueba tienes acceso completo por 30 días. Después la cuenta pasa a modo lectura, los datos se conservan 7 días y luego se eliminan por seguridad.',
    nextLabel: 'Terminar',
    isFinal: true,
  },
];

export function getTutorialStepIndex(stepId) {
  const index = FLOWFIN_TUTORIAL_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? index : 0;
}