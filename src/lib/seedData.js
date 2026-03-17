export const defaultCategories = [
  { name: 'Alimentación', icon: '🍽️', color: '#F97316', type: 'expense' },
  { name: 'Transporte', icon: '🚗', color: '#3B82F6', type: 'expense' },
  { name: 'Servicios', icon: '💡', color: '#EAB308', type: 'expense' },
  { name: 'Hogar', icon: '🏠', color: '#8B5CF6', type: 'expense' },
  { name: 'Entretenimiento', icon: '🎬', color: '#EC4899', type: 'expense' },
  { name: 'Salud', icon: '💊', color: '#14B8A6', type: 'expense' },
  { name: 'Ropa y Calzado', icon: '👕', color: '#F43F5E', type: 'expense' },
  { name: 'Educación', icon: '📚', color: '#6366F1', type: 'expense' },
  { name: 'Regalos y Donaciones', icon: '🎁', color: '#D97706', type: 'expense' },
  { name: 'Auto', icon: '🚙', color: '#64748B', type: 'expense' },
  { name: 'Inversión', icon: '💰', color: '#059669', type: 'both' },
  { name: 'Ingreso', icon: '💵', color: '#10B981', type: 'income' },
];

export const defaultSubcategoriesByCategory = {
  'Alimentación': [
    { name: 'Despensa / Súper', keywords: ['super', 'walmart', 'soriana', 'chedraui', 'despensa', 'mercado', 'oxxo', 'bodega', 'mandado', 'abarrotes', 'frutas', 'verduras', 'comer', 'tepeyac', 'tianguis'] },
    { name: 'Restaurante', keywords: ['restaurante', 'comida', 'food', 'lunch', 'cena', 'desayuno', 'fondita', 'taqueria', 'lonche', 'bistro', 'mariscos', 'sushi', 'pizza', 'tacos'] },
    { name: 'Café / Antojo', keywords: ['cafe', 'coffee', 'starbucks', 'antojo', 'postre', 'panaderia', 'pasteleria', 'helado', 'nieve', 'jugo', 'smoothie'] },
  ],
  'Transporte': [
    { name: 'Gasolina', keywords: ['gasolina', 'gas', 'bencina', 'pemex', 'shell', 'bp', 'oxxo gas', 'combustible', 'litros'] },
    { name: 'Uber / Taxi', keywords: ['uber', 'didi', 'taxi', 'cabify', 'lyft', 'indriver', 'beat', 'ride'] },
    { name: 'Transporte público', keywords: ['metro', 'camion', 'autobus', 'bus', 'colectivo', 'combi', 'microbús'] },
  ],
  'Servicios': [
    { name: 'Luz / CFE', keywords: ['luz', 'cfe', 'electricidad', 'recibo luz', 'electric', 'bimestral'] },
    { name: 'Internet / Cable', keywords: ['internet', 'wifi', 'telmex', 'izzi', 'totalplay', 'axtel', 'megacable', 'cable', 'fibra'] },
    { name: 'Gas', keywords: ['gas', 'naturgy', 'pinfra', 'zeta gas', 'gas natural', 'tanque'] },
    { name: 'Agua', keywords: ['agua', 'sapam', 'capas', 'sacmex', 'conagua', 'recibo agua'] },
    { name: 'Celular', keywords: ['celular', 'telefono', 'telcel', 'att', 'movistar', 'bait', 'plan celular', 'saldo', 'recarga'] },
    { name: 'Streaming', keywords: ['netflix', 'spotify', 'disney', 'hbo', 'prime', 'amazon', 'apple tv', 'youtube', 'crunchyroll', 'max', 'streaming', 'suscripcion'] },
  ],
  'Auto': [
    { name: 'Seguro Auto', keywords: ['seguro', 'hdi', 'gnp', 'qualitas', 'axa', 'primero', 'aseguradora', 'poliza'] },
    { name: 'Servicio / Mantenimiento', keywords: ['servicio', 'aceite', 'llantas', 'frenos', 'afinacion', 'taller', 'mecanico', 'revisión'] },
    { name: 'Tenencia / Multa', keywords: ['tenencia', 'multa', 'infraccion', 'tag', 'iave', 'circuito', 'verificacion'] },
  ],
  'Salud': [
    { name: 'Farmacia', keywords: ['farmacia', 'medicina', 'medicamento', 'pastilla', 'benavides', 'san pablo', 'similares', 'genericos', 'farmacon'] },
    { name: 'Doctor / Consulta', keywords: ['doctor', 'medico', 'consulta', 'especialista', 'dentista', 'optometrista', 'hospital', 'clinica', 'laboratorio'] },
    { name: 'Gym / Deporte', keywords: ['gym', 'gimnasio', 'crossfit', 'pilates', 'yoga', 'deporte', 'smart fit', 'anytime'] },
  ],
  'Hogar': [
    { name: 'Mantenimiento', keywords: ['mantenimiento', 'reparacion', 'plomero', 'electricista', 'pintura', 'albañil', 'carpintero', 'fontanero'] },
    { name: 'Limpieza', keywords: ['limpieza', 'fabuloso', 'cloro', 'jabon', 'ariel', 'detergente', 'suavitel', 'ajax', 'cif', 'vim'] },
    { name: 'Muebles / Deco', keywords: ['mueble', 'silla', 'mesa', 'decoracion', 'cojin', 'cuadro', 'lampara', 'ikea', 'liverpool'] },
  ],
  'Inversión': [
    { name: 'Actinver', keywords: ['actinver', 'acacia', 'inversion', 'fondo'] },
    { name: 'Allianz', keywords: ['allianz', 'seguro vida', 'pension'] },
    { name: 'Ahorro', keywords: ['ahorro', 'guardar', 'deposito ahorro'] },
  ],
};

export const defaultPaymentMethods = [
  { name: 'Efectivo', type: 'cash', bank: '', identifier: '' },
  { name: 'Transferencia', type: 'transfer', bank: '', identifier: '' },
];