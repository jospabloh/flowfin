# FlowFin Permissions Coverage

Generated: 2026-08-10T07:12:25.840Z

**Total declared keys:** 215  
**Total action keys:** 143  
**Used keys:** 89  
**Missing (ERROR):** 0  
**Orphans (WARN):** 76  

---

## Inicio (`module.Dashboard`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `dashboard.view.summary` | Resumen de Gastos | RV | RV | `src/pages/Dashboard.jsx:36` |
| `dashboard.view.upcoming` | Pagos Próximos | RV | RV | `src/pages/Dashboard.jsx:37` |
| `dashboard.view.analytics` | Análitica Básica | RV | RV | `src/pages/Dashboard.jsx:38` |
| `dashboard.view.recent` | Movimientos recientes | RV | RV | `src/pages/Dashboard.jsx:39` |
| `dashboard.view.alerts` | Alertas y banners | RV | RV | `src/pages/Dashboard.jsx:40` |
| `dashboard.view.filters` | Filtros del dashboard | RV | RV | `src/pages/Dashboard.jsx:41` |

## Inversiones (`module.Investments`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `investment.view.list` | Listar Inversiones | RV | RV | _orphan_ |
| `investment.view.detail` | Detalles de Inversión | RV | RV | _orphan_ |
| `investment.view.detail_sheet` | Hoja de detalle | RV | RV | _orphan_ |
| `investment.crud.create` | Crear Inversión | RWMDV | none | `src/pages/Investments.jsx:32` |
| `investment.crud.edit` | Editar Inversión | RWMDV | none | _orphan_ |
| `investment.crud.delete` | Eliminar Inversión | RWMDV | none | _orphan_ |
| `investment.payments.add` | Registrar Pago | RWMDV | none | `src/components/investments/InvestmentCard.jsx:40` |
| `investment.payments.history` | Historial de Pagos | RV | none | _orphan_ |

## Rentas (`module.Rentals`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `rental.view.list` | Listar Propiedades | RV | RV | _orphan_ |
| `rental.view.detail` | Detalles de Propiedad | RV | RV | _orphan_ |
| `rental.view.detail_sheet` | Hoja de detalle | RV | RV | _orphan_ |
| `rental.property.create` | Registrar Propiedad | RWMDV | none | `src/pages/Rentals.jsx:28` |
| `rental.property.edit` | Editar Propiedad | RWMDV | none | `src/components/rentals/RentalPropertyCard.jsx:17` |
| `rental.property.delete` | Eliminar Propiedad | RWMDV | none | `src/components/rentals/RentalPropertyCard.jsx:18` |
| `rental.payments.record` | Registrar Pago | RWMDV | none | `src/components/rentals/RentalPropertyCard.jsx:19` |
| `rental.payments.reverse` | Revertir Pago | RWMDV | none | `src/components/rentals/RentalPropertyCard.jsx:20` |
| `rental.payments.history` | Historial de Pagos | RV | none | _orphan_ |

## Reportes (`module.Reports`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `reports.view.charts` | Gráficos | RV | RV | `src/pages/Reports.jsx:47` |
| `reports.view.breakdown` | Desglose por Categoría | RV | RV | `src/pages/Reports.jsx:48` |
| `reports.view.trends` | Tendencias | RV | RV | `src/pages/Reports.jsx:50` |
| `reports.view.by_category` | Por Categoría | RV | RV | `src/pages/Reports.jsx:51` |
| `reports.view.by_person` | Por Persona | RV | RV | `src/pages/Reports.jsx:52` |
| `reports.view.by_method` | Por Método de Pago | RV | RV | `src/pages/Reports.jsx:53` |
| `reports.view.monthly` | Mensual | RV | RV | `src/pages/Reports.jsx:54` |
| `reports.view.comparative` | Comparativa | RV | RV | `src/pages/Reports.jsx:55` |
| `reports.view.detail` | Detalle / Drill-down | RV | RV | `src/pages/Reports.jsx:49` |
| `reports.view.filter` | Filtros y rango de fechas | RV | RV | `src/pages/Reports.jsx:46` |
| `reports.export.pdf` | Descargar PDF | RV | RV | `src/pages/Reports.jsx:56` |
| `reports.export.image` | Descargar Imagen | RV | RV | `src/pages/Reports.jsx:57` |
| `reports.export.share` | Compartir | RV | R | `src/pages/Reports.jsx:58` |

## Pagos del Mes (`module.ScheduledPayments`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `scheduled.view.list` | Listar Pagos Programados | RV | RV | _orphan_ |
| `scheduled.view.calendar` | Vista Calendario | RV | RV | _orphan_ |
| `scheduled.create.form` | Nuevo Pago Programado | RWMDV | R | `src/pages/ScheduledPayments.jsx:71` |
| `scheduled.mark.action` | Registrar como Pagado | RWMDV | R | `src/components/scheduled/ScheduledPaymentItem.jsx:66` |
| `scheduled.manage.edit` | Editar Pago | RWMDV | R | `src/components/scheduled/ScheduledPaymentItem.jsx:67` |
| `scheduled.manage.delete` | Eliminar Pago | RWMDV | R | `src/components/scheduled/ScheduledPaymentItem.jsx:68` |

## Movimientos (`module.Transactions`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `transaction.view.list` | Listar Movimientos | RV | RV | `src/pages/Transactions.jsx:40` |
| `transaction.view.filter` | Filtrar y Buscar | RV | RV | `src/pages/Transactions.jsx:41` |
| `transaction.view.export` | Exportar a Excel | RV | RV | `src/pages/Transactions.jsx:44` |
| `transaction.view.search` | Búsqueda | RV | RV | `src/pages/Transactions.jsx:42` |
| `transaction.view.pending_banner` | Banner de pendientes | RV | RV | `src/pages/Transactions.jsx:43` |
| `transaction.create.manual` | Entrada Manual | RWMDV | RWV | _orphan_ |
| `transaction.create.voice` | Entrada por Voz | RWMDV | RWV | _orphan_ |
| `transaction.create.receipt` | Escanear Ticket | RWMDV | RWV | _orphan_ |
| `transaction.edit.details` | Cambiar Detalles | RWMDV | RMV | `src/components/transactions/TransactionGroup.jsx:18` |
| `transaction.edit.category` | Cambiar Categoría | RWMDV | RMV | _orphan_ |
| `transaction.edit.amount` | Cambiar Monto | RWMDV | RMV | _orphan_ |
| `transaction.delete.action` | Eliminar Registro | RWMDV | RDV | `src/components/transactions/TransactionGroup.jsx:19` |

## Mi Cuenta (`module.AccountSettings`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `account.profile.view` | Ver Información | RV | RV | _orphan_ |
| `account.profile.edit` | Editar Perfil | RWMDV | RWMV | _orphan_ |
| `account.profile.password` | Cambiar Contraseña | RWMV | RWMV | _orphan_ |
| `account.profile.delete` | Eliminar Cuenta | RDV | RDV | `src/pages/AccountSettings.jsx:19` |

## Asistente IA (`module.Assistant`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `assistant.chat.send` | Enviar Mensajes | RWV | RWV | _orphan_ |
| `assistant.chat.voice` | Entrada de Voz | RWV | RWV | _orphan_ |
| `assistant.chat.clear` | Limpiar conversación | RWDV | RV | _orphan_ |
| `assistant.features.receipt` | Escanear Tickets | RWV | RWV | _orphan_ |
| `assistant.features.register` | Registrar Movimientos | RWV | RWV | _orphan_ |
| `assistant.features.predictive_chips` | Chips predictivos | RV | RV | _orphan_ |

## Presupuesto (`module.Budget`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `budget.view.recommendations` | Recomendaciones | RV | RV | _orphan_ |
| `budget.view.health` | Salud Financiera | RV | RV | _orphan_ |
| `budget.view.cards` | Tarjetas de resumen | RV | RV | `src/pages/Budget.jsx:23` |
| `budget.view.chart` | Gráfico de barras | RV | RV | `src/pages/Budget.jsx:24` |
| `budget.view.period_selector` | Selector de periodo | RV | RV | `src/pages/Budget.jsx:25` |

## Registrar (`module.Capture`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `capture.form.basic` | Campos Básicos | RWMDV | RWV | _orphan_ |
| `capture.form.advanced` | Opciones Avanzadas | RWMDV | R | `src/pages/Capture.jsx:55` |
| `capture.ai_assist.suggestions` | Sugerencias Automáticas | RV | RV | `src/pages/Capture.jsx:56` |

## Catálogos (`module.Catalogs`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `catalog.categories.view` | Ver Rubros | RV | RV | _orphan_ |
| `catalog.categories.create` | Crear Rubro | RWMDV | none | `src/pages/Catalogs.jsx:182` |
| `catalog.categories.edit` | Editar Rubro | RWMDV | none | `src/pages/Catalogs.jsx:183` |
| `catalog.categories.delete` | Eliminar Rubro | RWMDV | none | `src/pages/Catalogs.jsx:184` |
| `catalog.categories.exclude_from_totals` | Excluir del total | RWMV | none | `src/pages/Catalogs.jsx:185` |
| `catalog.subcategories.view` | Ver SubRubros | RV | RV | _orphan_ |
| `catalog.subcategories.create` | Crear SubRubro | RWMDV | none | `src/pages/Catalogs.jsx:186` |
| `catalog.subcategories.edit` | Editar SubRubro | RWMDV | none | `src/pages/Catalogs.jsx:187` |
| `catalog.subcategories.delete` | Eliminar SubRubro | RWMDV | none | `src/pages/Catalogs.jsx:188` |
| `catalog.persons.view` | Ver Personas | RV | RV | _orphan_ |
| `catalog.persons.create` | Crear Persona | RWMDV | none | `src/pages/Catalogs.jsx:189` |
| `catalog.persons.edit` | Editar Persona | RWMDV | none | `src/pages/Catalogs.jsx:190` |
| `catalog.persons.delete` | Eliminar Persona | RWMDV | none | `src/pages/Catalogs.jsx:191` |
| `catalog.methods.view` | Ver Formas | RV | RV | _orphan_ |
| `catalog.methods.create` | Crear Forma | RWMDV | none | `src/pages/Catalogs.jsx:192` |
| `catalog.methods.edit` | Editar Forma | RWMDV | none | `src/pages/Catalogs.jsx:193` |
| `catalog.methods.delete` | Eliminar Forma | RWMDV | none | `src/pages/Catalogs.jsx:194` |

## Manual (`module.UserManual`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `docs.manual.view` | Acceder Documentación | RV | RV | _orphan_ |

## Acerca de (`module.About`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `docs.about.view` | Acceder Información | RV | RV | _orphan_ |

## Admin Familia (`module.FamilyAdmin`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `family.admin.members.view` | Ver Miembros | RV | none | _orphan_ |
| `family.admin.members.invite` | Invitar Miembro | RWMDV | none | _orphan_ |
| `family.admin.members.approve` | Aprobar Solicitudes | RWMDV | none | _orphan_ |
| `family.admin.members.remove` | Eliminar Miembro | RWMDV | none | _orphan_ |
| `family.admin.billing.view` | Ver Estado | RV | none | _orphan_ |
| `family.admin.billing.upgrade` | Mejorar Plan | RWMDV | none | _orphan_ |

## Mi Familia (`module.FamilySettings`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `family.settings.basic` | Datos Básicos | RWMDV | R | `src/pages/FamilySettings.jsx:27` |
| `family.settings.locale` | Idioma y Moneda | RWMDV | R | `src/pages/FamilySettings.jsx:28` |
| `family.settings.advanced` | Opciones Avanzadas | RWMDV | R | `src/pages/FamilySettings.jsx:29` |

## Metas (`module.Goals`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `goals.view.list` | Listar Metas | RV | RV | _orphan_ |
| `goals.view.detail` | Detalle de Meta | RV | RV | _orphan_ |
| `goals.view.share_card` | Tarjeta para compartir | RV | RV | _orphan_ |
| `goals.manage.create` | Crear Meta | RWMDV | none | `src/pages/Goals.jsx:29` |
| `goals.manage.edit` | Editar Meta | RWMDV | none | `src/pages/Goals.jsx:30` |
| `goals.manage.delete` | Eliminar Meta | RWMDV | none | `src/pages/Goals.jsx:31` |

## Mi Licencia (`module.LicenseAdmin`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `license.manage.view` | Ver Licencia | none | none | _orphan_ |
| `license.manage.activate` | Activar Licencia | none | none | _orphan_ |
| `license.manage.deactivate` | Desactivar Licencia | none | none | _orphan_ |

## Mensajes (`module.Messages`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `messages.view.inbox` | Bandeja de entrada | RV | RV | _orphan_ |
| `messages.view.thread` | Ver conversación | RV | RV | _orphan_ |
| `messages.manage.send` | Enviar Mensaje | RWV | none | `src/pages/Messages.jsx:48` |
| `messages.manage.delete` | Eliminar Mensaje | RDV | none | _orphan_ |

## MSI (`module.MSI`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `msi.view.list` | Listar Compras MSI | RV | RV | _orphan_ |
| `msi.view.track` | Seguimiento de Pagos | RV | RV | _orphan_ |
| `msi.view.detail_sheet` | Hoja de detalle | RV | RV | _orphan_ |
| `msi.crud.create` | Registrar Compra MSI | RWMDV | none | `src/pages/MSIPage.jsx:35` |
| `msi.crud.edit` | Editar MSI | RWMDV | none | _orphan_ |
| `msi.crud.delete` | Eliminar MSI | RWMDV | none | _orphan_ |
| `msi.payments.record` | Registrar Pago | RWMDV | none | `src/pages/MSIPage.jsx:36` |
| `msi.payments.history` | Historial de Pagos | RV | none | _orphan_ |

## Permisos (`module.PermissionAdmin`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `permission.manage.view` | Ver Matriz | RV | none | _orphan_ |
| `permission.manage.edit` | Editar Permisos | RWMDV | none | _orphan_ |
| `permission.manage.reset` | Restablecer Valores | RWMDV | none | _orphan_ |

## Release Notes (`module.ReleaseNotes`)

_No action keys._

## Ahorros (`module.SavingsDashboard`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `savings.view.summary` | Resumen de ahorros | RV | none | _orphan_ |
| `savings.view.subscriptions` | Suscripciones olvidadas | RV | none | _orphan_ |
| `savings.view.opportunities` | Oportunidades no esenciales | RV | none | _orphan_ |
| `savings.view.refresh` | Actualizar análisis | RV | none | _orphan_ |

## Soporte (`module.SupportTickets`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `support.view.list` | Listar Tickets | RV | RV | _orphan_ |
| `support.view.thread` | Ver Conversación | RV | RV | _orphan_ |
| `support.ticket.create` | Abrir Ticket | RWV | RWV | `src/pages/SupportTickets.jsx:45` |
| `support.ticket.reply` | Responder | RWV | RWV | _orphan_ |

## Viajes (`module.Trips`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `trips.view.list` | Listar Viajes | RV | RV | _orphan_ |
| `trips.view.detail` | Detalle de Viaje | RV | RV | _orphan_ |
| `trips.view.expenses` | Ver Gastos del Viaje | RV | RV | _orphan_ |
| `trips.manage.create` | Crear Viaje | RWMDV | none | `src/pages/Trips.jsx:18` |
| `trips.manage.edit` | Editar Viaje | RWMDV | none | _orphan_ |
| `trips.manage.delete` | Eliminar Viaje | RWMDV | none | _orphan_ |
| `trips.manage.close` | Cerrar Viaje | RWMDV | none | _orphan_ |

## Waitlist Admin (`module.WaitlistAdmin`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `waitlist.manage.view` | Ver Lista de Espera | none | none | _orphan_ |
| `waitlist.manage.invite` | Invitar Usuario | none | none | _orphan_ |
| `waitlist.manage.bulk` | Invitar en Masa | none | none | _orphan_ |
| `waitlist.manage.export` | Exportar Lista | none | none | _orphan_ |

## Orphan Keys (declared but not used)

- `investment.view.list`
- `investment.view.detail`
- `investment.view.detail_sheet`
- `investment.crud.edit`
- `investment.crud.delete`
- `investment.payments.history`
- `rental.view.list`
- `rental.view.detail`
- `rental.view.detail_sheet`
- `rental.payments.history`
- `scheduled.view.list`
- `scheduled.view.calendar`
- `transaction.create.manual`
- `transaction.create.voice`
- `transaction.create.receipt`
- `transaction.edit.category`
- `transaction.edit.amount`
- `account.profile.view`
- `account.profile.edit`
- `account.profile.password`
- `assistant.chat.send`
- `assistant.chat.voice`
- `assistant.chat.clear`
- `assistant.features.receipt`
- `assistant.features.register`
- `assistant.features.predictive_chips`
- `budget.view.recommendations`
- `budget.view.health`
- `capture.form.basic`
- `catalog.categories.view`
- `catalog.subcategories.view`
- `catalog.persons.view`
- `catalog.methods.view`
- `docs.manual.view`
- `docs.about.view`
- `family.admin.members.view`
- `family.admin.members.invite`
- `family.admin.members.approve`
- `family.admin.members.remove`
- `family.admin.billing.view`
- `family.admin.billing.upgrade`
- `goals.view.list`
- `goals.view.detail`
- `goals.view.share_card`
- `license.manage.view`
- `license.manage.activate`
- `license.manage.deactivate`
- `messages.view.inbox`
- `messages.view.thread`
- `messages.manage.delete`
- `msi.view.list`
- `msi.view.track`
- `msi.view.detail_sheet`
- `msi.crud.edit`
- `msi.crud.delete`
- `msi.payments.history`
- `permission.manage.view`
- `permission.manage.edit`
- `permission.manage.reset`
- `savings.view.summary`
- `savings.view.subscriptions`
- `savings.view.opportunities`
- `savings.view.refresh`
- `support.view.list`
- `support.view.thread`
- `support.ticket.reply`
- `trips.view.list`
- `trips.view.detail`
- `trips.view.expenses`
- `trips.manage.edit`
- `trips.manage.delete`
- `trips.manage.close`
- `waitlist.manage.view`
- `waitlist.manage.invite`
- `waitlist.manage.bulk`
- `waitlist.manage.export`

