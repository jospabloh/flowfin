# FlowFin Permissions Coverage

Generated: 2026-04-26T23:33:51.178Z

**Total declared keys:** 215  
**Total action keys:** 149  
**Used keys:** 132  
**Missing (ERROR):** 0  
**Orphans (WARN):** 35  

---

## Inicio (`module.Dashboard`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `dashboard.view.summary` | Resumen de Gastos | RV | RV | `src/pages/Dashboard.jsx:29` |
| `dashboard.view.upcoming` | Pagos Próximos | RV | RV | `src/pages/Dashboard.jsx:30` |
| `dashboard.view.analytics` | Análitica Básica | RV | RV | `src/pages/Dashboard.jsx:31` |
| `dashboard.view.recent` | Movimientos recientes | RV | RV | `src/pages/Dashboard.jsx:32` |
| `dashboard.view.alerts` | Alertas y banners | RV | RV | `src/pages/Dashboard.jsx:33` |
| `dashboard.view.filters` | Filtros del dashboard | RV | RV | `src/pages/Dashboard.jsx:34` |

## Inversiones (`module.Investments`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `investment.view.list` | Listar Inversiones | RV | RV | `src/pages/Investments.jsx:28` |
| `investment.view.detail` | Detalles de Inversión | RV | RV | `src/pages/Investments.jsx:29` |
| `investment.view.detail_sheet` | Hoja de detalle | RV | RV | `src/components/investments/InvestmentDetailSheet.jsx:32` |
| `investment.crud.create` | Crear Inversión | RWMDV | RWMDV | `src/pages/Investments.jsx:26` |
| `investment.crud.edit` | Editar Inversión | RWMDV | RWMDV | _orphan_ |
| `investment.crud.delete` | Eliminar Inversión | RWMDV | RWMDV | _orphan_ |
| `investment.payments.add` | Registrar Pago | RWMDV | RWMDV | `src/components/investments/InvestmentCard.jsx:37`, `src/pages/Investments.jsx:27` |
| `investment.payments.history` | Historial de Pagos | RV | RV | `src/components/investments/InvestmentDetailSheet.jsx:31` |
| `investment.payments.edit` | Editar Pago | RWMDV | RWMDV | `src/components/investments/InvestmentDetailSheet.jsx:33` |
| `investment.payments.delete` | Eliminar Pago | RWMDV | RWMDV | `src/components/investments/InvestmentDetailSheet.jsx:34` |

## Rentas (`module.Rentals`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `rental.view.list` | Listar Propiedades | RV | RV | `src/pages/Rentals.jsx:27` |
| `rental.view.detail` | Detalles de Propiedad | RV | RV | _orphan_ |
| `rental.view.detail_sheet` | Hoja de detalle | RV | RV | `src/pages/Rentals.jsx:28` |
| `rental.property.create` | Registrar Propiedad | RWMDV | RWMDV | `src/pages/Rentals.jsx:26` |
| `rental.property.edit` | Editar Propiedad | RWMDV | RWMDV | `src/components/rentals/RentalPropertyCard.jsx:17` |
| `rental.property.delete` | Eliminar Propiedad | RWMDV | RWMDV | `src/components/rentals/RentalPropertyCard.jsx:18` |
| `rental.payments.record` | Registrar Pago | RWMDV | RWMDV | `src/components/rentals/RentalPropertyCard.jsx:19` |
| `rental.payments.reverse` | Revertir Pago | RWMDV | RWMDV | `src/components/rentals/RentalPropertyCard.jsx:20` |
| `rental.payments.history` | Historial de Pagos | RV | RV | `src/components/rentals/RentalPropertyCard.jsx:21` |
| `rental.payments.edit` | Editar Pago | RWMDV | RWMDV | `src/components/rentals/RentalPropertyCard.jsx:22` |
| `rental.payments.delete` | Eliminar Pago | RWMDV | RWMDV | `src/components/rentals/RentalPropertyCard.jsx:23` |

## Reportes (`module.Reports`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `reports.view.charts` | Gráficos | RV | RV | `src/pages/Reports.jsx:45` |
| `reports.view.breakdown` | Desglose por Categoría | RV | RV | `src/pages/Reports.jsx:46` |
| `reports.view.trends` | Tendencias | RV | RV | _orphan_ |
| `reports.view.by_category` | Por Categoría | RV | RV | _orphan_ |
| `reports.view.by_person` | Por Persona | RV | RV | _orphan_ |
| `reports.view.by_method` | Por Método de Pago | RV | RV | _orphan_ |
| `reports.view.monthly` | Mensual | RV | RV | _orphan_ |
| `reports.view.comparative` | Comparativa | RV | RV | _orphan_ |
| `reports.view.detail` | Detalle / Drill-down | RV | RV | `src/pages/Reports.jsx:47` |
| `reports.view.filter` | Filtros y rango de fechas | RV | RV | `src/pages/Reports.jsx:44` |
| `reports.export.pdf` | Descargar PDF | RV | RV | `src/pages/Reports.jsx:48` |
| `reports.export.image` | Descargar Imagen | RV | RV | `src/pages/Reports.jsx:49` |
| `reports.export.share` | Compartir | RV | R | `src/pages/Reports.jsx:50` |
| `reports.preset.by_category.view` | Vista Por Categoría | RV | RV | `src/pages/Reports.jsx:51` |
| `reports.preset.by_person.view` | Vista Por Persona | RV | RV | `src/pages/Reports.jsx:52` |
| `reports.preset.by_method.view` | Vista Por Método de Pago | RV | RV | `src/pages/Reports.jsx:53` |
| `reports.preset.monthly.view` | Vista Mensual | RV | RV | `src/pages/Reports.jsx:54` |
| `reports.preset.comparative.view` | Vista Comparativa | RV | RV | `src/pages/Reports.jsx:55` |

## Pagos del Mes (`module.ScheduledPayments`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `scheduled.view.list` | Listar Pagos Programados | RV | RV | `src/pages/ScheduledPayments.jsx:27` |
| `scheduled.view.calendar` | Vista Calendario | RV | RV | _orphan_ |
| `scheduled.create.form` | Nuevo Pago Programado | RWMDV | R | `src/pages/ScheduledPayments.jsx:26` |
| `scheduled.mark.action` | Registrar como Pagado | RWMDV | R | `src/components/scheduled/ScheduledPaymentItem.jsx:34` |
| `scheduled.manage.edit` | Editar Pago | RWMDV | R | `src/components/scheduled/ScheduledPaymentItem.jsx:35` |
| `scheduled.manage.delete` | Eliminar Pago | RWMDV | R | `src/components/scheduled/ScheduledPaymentItem.jsx:36` |
| `scheduled.payments.unmark` | Desmarcar como Pagado | RWMDV | RV | `src/pages/ScheduledPayments.jsx:28` |

## Movimientos (`module.Transactions`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `transaction.view.list` | Listar Movimientos | RV | RV | `src/pages/Transactions.jsx:40` |
| `transaction.view.filter` | Filtrar y Buscar | RV | RV | `src/pages/Transactions.jsx:41` |
| `transaction.view.export` | Exportar a Excel | RV | RV | `src/pages/Transactions.jsx:42` |
| `transaction.view.search` | Búsqueda | RV | RV | `src/pages/Transactions.jsx:38` |
| `transaction.view.pending_banner` | Banner de pendientes | RV | RV | `src/pages/Transactions.jsx:39` |
| `transaction.create.manual` | Entrada Manual | RWMDV | RWV | _orphan_ |
| `transaction.create.voice` | Entrada por Voz | RWMDV | RWV | _orphan_ |
| `transaction.create.receipt` | Escanear Ticket | RWMDV | RWV | _orphan_ |
| `transaction.edit.details` | Cambiar Detalles | RWMDV | RMV | `src/components/transactions/TransactionGroup.jsx:18` |
| `transaction.edit.category` | Cambiar Categoría | RWMDV | RMV | _orphan_ |
| `transaction.edit.amount` | Cambiar Monto | RWMDV | RMV | _orphan_ |
| `transaction.delete.action` | Eliminar Registro | RWMDV | RDV | `src/components/transactions/TransactionGroup.jsx:19` |
| `transaction.fields.amount.edit` | Editar Monto | RWMDV | RMV | `src/components/TransactionEditModal.jsx:35` |
| `transaction.fields.date.edit` | Editar Fecha | RWMDV | RMV | `src/components/TransactionEditModal.jsx:36` |
| `transaction.fields.category.edit` | Editar Categoría | RWMDV | RMV | `src/components/TransactionEditModal.jsx:37` |
| `transaction.fields.person.edit` | Editar Persona | RWMDV | RMV | `src/components/TransactionEditModal.jsx:38` |
| `transaction.fields.payment_method.edit` | Editar Forma de Pago | RWMDV | RMV | `src/components/TransactionEditModal.jsx:39` |
| `transaction.fields.description.edit` | Editar Descripción | RWMDV | RMV | `src/components/TransactionEditModal.jsx:40` |
| `transaction.fields.invoice.toggle` | Toggle Factura | RWMDV | RMV | `src/components/TransactionEditModal.jsx:41` |

## Mi Cuenta (`module.AccountSettings`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `account.profile.view` | Ver Información | RV | RV | _orphan_ |
| `account.profile.edit` | Editar Perfil | RWMDV | RWMV | _orphan_ |
| `account.profile.password` | Cambiar Contraseña | RWMV | RWMV | _orphan_ |
| `account.profile.delete` | Eliminar Cuenta | RDV | RDV | `src/pages/AccountSettings.jsx:19` |
| `account.license.view` | Ver Info de Licencia | RV | RV | `src/pages/AccountSettings.jsx:20` |

## Uso de IA (`module.AIUsage`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `ai.usage.view` | Historial de Consumo | none | none | _orphan_ |
| `ai.usage.export` | Exportar Historial | none | none | _orphan_ |

## Asistente IA (`module.Assistant`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `assistant.chat.send` | Enviar Mensajes | RWV | RWV | `src/pages/Assistant.jsx:17` |
| `assistant.chat.voice` | Entrada de Voz | RWV | RWV | `src/pages/Assistant.jsx:18` |
| `assistant.chat.clear` | Limpiar conversación | RWDV | RV | `src/pages/Assistant.jsx:19` |
| `assistant.features.receipt` | Escanear Tickets | RWV | RWV | _orphan_ |
| `assistant.features.register` | Registrar Movimientos | RWV | RWV | _orphan_ |
| `assistant.features.predictive_chips` | Chips predictivos | RV | RV | `src/pages/Assistant.jsx:20` |
| `assistant.features.receipt.scan` | Botón Escanear Recibo | RWV | RWV | `src/pages/Assistant.jsx:21` |

## Presupuesto (`module.Budget`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `budget.view.recommendations` | Recomendaciones | RV | RV | `src/pages/Budget.jsx:25` |
| `budget.view.health` | Salud Financiera | RV | RV | _orphan_ |
| `budget.view.cards` | Tarjetas de resumen | RV | RV | `src/pages/Budget.jsx:22` |
| `budget.view.chart` | Gráfico de barras | RV | RV | `src/pages/Budget.jsx:23` |
| `budget.view.period_selector` | Selector de periodo | RV | RV | `src/pages/Budget.jsx:24` |

## Registrar (`module.Capture`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `capture.form.basic` | Campos Básicos | RWMDV | RWV | `src/pages/Capture.jsx:42` |
| `capture.form.advanced` | Opciones Avanzadas | RWMDV | R | `src/pages/Capture.jsx:34` |
| `capture.ai_assist.suggestions` | Sugerencias Automáticas | RV | RV | `src/pages/Capture.jsx:35` |
| `capture.input.voice` | Entrada por Voz | RWV | RWV | `src/pages/Capture.jsx:36` |
| `capture.input.photo` | Escanear Ticket | RWV | RWV | `src/pages/Capture.jsx:37` |
| `capture.input.ai_extract` | Entender con IA | RWV | RWV | `src/pages/Capture.jsx:38` |
| `capture.fields.amount.edit` | Editar Monto | RWMDV | RWV | `src/pages/Capture.jsx:39` |
| `capture.fields.date.edit` | Editar Fecha (backdating) | RWMDV | RWV | `src/pages/Capture.jsx:40` |
| `capture.fields.invoice.toggle` | Toggle Factura | RWMDV | RWV | `src/pages/Capture.jsx:41` |

## Catálogos (`module.Catalogs`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `catalog.categories.view` | Ver Rubros | RV | RV | _orphan_ |
| `catalog.categories.create` | Crear Rubro | RWMDV | RWMDV | `src/pages/Catalogs.jsx:171` |
| `catalog.categories.edit` | Editar Rubro | RWMDV | RWMDV | `src/pages/Catalogs.jsx:172` |
| `catalog.categories.delete` | Eliminar Rubro | RWMDV | RWMDV | `src/pages/Catalogs.jsx:173` |
| `catalog.subcategories.view` | Ver SubRubros | RV | RV | _orphan_ |
| `catalog.subcategories.create` | Crear SubRubro | RWMDV | RWMDV | `src/pages/Catalogs.jsx:174` |
| `catalog.subcategories.edit` | Editar SubRubro | RWMDV | RWMDV | `src/pages/Catalogs.jsx:175` |
| `catalog.subcategories.delete` | Eliminar SubRubro | RWMDV | RWMDV | `src/pages/Catalogs.jsx:176` |
| `catalog.persons.view` | Ver Personas | RV | RV | _orphan_ |
| `catalog.persons.create` | Crear Persona | RWMDV | RWMDV | `src/pages/Catalogs.jsx:177` |
| `catalog.persons.edit` | Editar Persona | RWMDV | RWMDV | `src/pages/Catalogs.jsx:178` |
| `catalog.persons.delete` | Eliminar Persona | RWMDV | RWMDV | `src/pages/Catalogs.jsx:179` |
| `catalog.methods.view` | Ver Formas | RV | RV | _orphan_ |
| `catalog.methods.create` | Crear Forma | RWMDV | RWMDV | `src/pages/Catalogs.jsx:180` |
| `catalog.methods.edit` | Editar Forma | RWMDV | RWMDV | `src/pages/Catalogs.jsx:181` |
| `catalog.methods.delete` | Eliminar Forma | RWMDV | RWMDV | `src/pages/Catalogs.jsx:182` |
| `catalog.required_types.view` | Ver Tipos de Gasto | RV | RV | `src/pages/Catalogs.jsx:183` |
| `catalog.required_types.edit` | Editar Tipos de Gasto | RWMDV | RWMDV | `src/pages/Catalogs.jsx:184` |
| `catalog.transfer_destinations.view` | Ver Destinos de Transferencia | RV | RV | `src/pages/Catalogs.jsx:185` |
| `catalog.transfer_destinations.edit` | Editar Destinos de Transferencia | RWMDV | RWMDV | `src/pages/Catalogs.jsx:186` |

## Manual (`module.UserManual`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `docs.manual.view` | Acceder Documentación | RV | RV | `src/pages/UserManual.jsx:564` |

## Acerca de (`module.About`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `docs.about.view` | Acceder Información | RV | RV | _orphan_ |

## Admin Familia (`module.FamilyAdmin`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `family.admin.members.view` | Ver Miembros | RV | none | `src/pages/FamilyAdmin.jsx:15` |
| `family.admin.members.invite` | Invitar Miembro | RWMDV | none | `src/pages/FamilyAdmin.jsx:16` |
| `family.admin.members.approve` | Aprobar Solicitudes | RWMDV | none | `src/pages/FamilyAdmin.jsx:17` |
| `family.admin.members.remove` | Eliminar Miembro | RWMDV | none | `src/pages/FamilyAdmin.jsx:19` |
| `family.admin.members.link` | Vincular a Persona | RWMDV | none | `src/pages/FamilyAdmin.jsx:20` |
| `family.admin.members.reject` | Rechazar Solicitudes | RWMDV | none | `src/pages/FamilyAdmin.jsx:18` |
| `family.admin.billing.view` | Ver Estado | RV | none | `src/pages/FamilyAdmin.jsx:21` |
| `family.admin.billing.upgrade` | Mejorar Plan | RWMDV | none | _orphan_ |

## Mi Familia (`module.FamilySettings`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `family.settings.basic` | Datos Básicos | RWMDV | R | `src/pages/FamilySettings.jsx:27` |
| `family.settings.locale` | Idioma y Moneda | RWMDV | R | `src/pages/FamilySettings.jsx:28` |
| `family.settings.advanced` | Opciones Avanzadas | RWMDV | R | `src/pages/FamilySettings.jsx:29` |

## Mi Licencia (`module.LicenseAdmin`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `license.manage.view` | Ver Licencia | none | none | `src/pages/LicenseAdmin.jsx:39` |
| `license.manage.activate` | Activar Licencia | none | none | _orphan_ |
| `license.manage.deactivate` | Desactivar Licencia | none | none | _orphan_ |

## MSI (`module.MSI`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `msi.view.list` | Listar Compras MSI | RV | RV | `src/pages/MSIPage.jsx:35` |
| `msi.view.track` | Seguimiento de Pagos | RV | RV | _orphan_ |
| `msi.view.detail_sheet` | Hoja de detalle | RV | RV | `src/pages/MSIPage.jsx:36` |
| `msi.crud.create` | Registrar Compra MSI | RWMDV | RWMDV | `src/pages/MSIPage.jsx:33` |
| `msi.crud.edit` | Editar MSI | RWMDV | RWMDV | _orphan_ |
| `msi.crud.delete` | Eliminar MSI | RWMDV | RWMDV | _orphan_ |
| `msi.payments.record` | Registrar Pago | RWMDV | RWMDV | `src/pages/MSIPage.jsx:34` |
| `msi.payments.history` | Historial de Pagos | RV | RV | `src/pages/MSIPage.jsx:37` |
| `msi.payments.edit` | Editar Pago | RWMDV | RWMDV | `src/pages/MSIPage.jsx:39` |
| `msi.payments.delete` | Eliminar Pago | RWMDV | RWMDV | `src/pages/MSIPage.jsx:40` |
| `msi.toggle_status.pause_resume` | Pausar / Reactivar MSI | RWMDV | RWMDV | `src/pages/MSIPage.jsx:38` |

## Permisos (`module.PermissionAdmin`)

| Key | Label | Admin | Member | Used In |
|-----|-------|-------|--------|---------|
| `permission.manage.view` | Ver Matriz | RV | none | `src/pages/PermissionAdmin.jsx:81` |
| `permission.manage.edit` | Editar Permisos | RWMDV | none | `src/pages/PermissionAdmin.jsx:82` |
| `permission.manage.reset` | Restablecer Valores | RWMDV | none | _orphan_ |

## Orphan Keys (declared but not used)

- `investment.crud.edit`
- `investment.crud.delete`
- `rental.view.detail`
- `reports.view.trends`
- `reports.view.by_category`
- `reports.view.by_person`
- `reports.view.by_method`
- `reports.view.monthly`
- `reports.view.comparative`
- `scheduled.view.calendar`
- `transaction.create.manual`
- `transaction.create.voice`
- `transaction.create.receipt`
- `transaction.edit.category`
- `transaction.edit.amount`
- `account.profile.view`
- `account.profile.edit`
- `account.profile.password`
- `ai.usage.view`
- `ai.usage.export`
- `assistant.features.receipt`
- `assistant.features.register`
- `budget.view.health`
- `catalog.categories.view`
- `catalog.subcategories.view`
- `catalog.persons.view`
- `catalog.methods.view`
- `docs.about.view`
- `family.admin.billing.upgrade`
- `license.manage.activate`
- `license.manage.deactivate`
- `msi.view.track`
- `msi.crud.edit`
- `msi.crud.delete`
- `permission.manage.reset`

