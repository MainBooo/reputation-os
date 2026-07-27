# SALE_FIX_PROGRESS

Рабочий файл прогресса исправлений по `REPUTATIONOS_SALE_AUDIT.md`. Ветка: `fix/sale-readiness-hardening`. Обновляется по ходу работы — не финальный отчёт (см. `REPUTATIONOS_SALE_FIX_REPORT.md` для итогов).

| ID | Проблема | Подтверждена | Статус | Изменённые файлы | Тест | Комментарий |
|---|---|---:|---|---|---|---|
| P-01 | Подделка webhook ЮKassa (payment.succeeded без проверки) | — | NOT_STARTED | — | — | BLOCKER |
| P-02 | SSRF через `externalUrl` WEB-источника | — | NOT_STARTED | — | — | BLOCKER |
| P-03 | AI-ответы не работают в проде (ENV только в worker) | — | NOT_STARTED | — | — | CRITICAL |
| P-04 | Telegram Scout — единственный аккаунт на всех клиентов | — | NOT_STARTED | — | — | CRITICAL, roadmap-hardening без полной multi-account архитектуры |
| P-05 | IDOR в `deleteAlias` (нет проверки alias.companyId) | — | NOT_STARTED | — | — | HIGH |
| P-06 | Рецидив бага entitlements (FeatureGate не передаёт workspaceId) | — | NOT_STARTED | — | — | HIGH |
| P-07 | `/internal/jobs/tick`, `/internal/jobs/reconcile` без auth guard | — | NOT_STARTED | — | — | HIGH |
| P-08 | API test suite красный (auth/companies spec) | — | NOT_STARTED | — | — | HIGH |
| P-09 | 5 из 7 типов уведомлений не реализованы, заявлены на фронте | — | NOT_STARTED | — | — | HIGH |
| P-10 | Юр.документы на личный ИНН/почту | — | NOT_STARTED | — | — | MEDIUM |
| P-11 | Инфраструктура переплетена с чужими проектами на VPS | — | NOT_STARTED | — | — | MEDIUM |
| P-12 | Незашифрованные `.env`-бэкапы на диске | — | NOT_STARTED | — | — | MEDIUM |
| P-13 | JWT без refresh/revocation, hardcoded fallback-секрет | — | NOT_STARTED | — | — | MEDIUM |
| P-14 | Аналитика считает IRRELEVANT-упоминания в KPI | — | NOT_STARTED | — | — | MEDIUM |
| P-15 | Тройное дублирование entitlement-фильтра (`platform !== TELEGRAM`) | — | NOT_STARTED | — | — | MEDIUM |
| P-16 | Мусор закоммичен в git (`7.6.0`, `bot-scaffold.tar`, `gen-token.js` x2) | — | NOT_STARTED | — | — | LOW |
| P-17 | Нет bulk-операций и полнотекстового поиска в Inbox | — | NOT_STARTED | — | — | LOW, roadmap |
| P-18 | Restore backup не задокументирован/не протестирован | — | NOT_STARTED | — | — | LOW |
| — | Password reset — кнопка без функционала | — | NOT_STARTED | — | — | Из раздела 5 аудита, не в таблице P-XX |
| — | Приглашения без email-доставки | — | NOT_STARTED | — | — | Из раздела 5 аудита |
| — | Незакоммиченная работа (network hub / entitlements) в рабочем дереве | — | NOT_STARTED | — | — | Базовое состояние, требует разбора перед стартом |

Статусы: NOT_STARTED / IN_PROGRESS / FIXED / PARTIALLY_FIXED / NOT_REPRODUCED / DEFERRED / REQUIRES_EXTERNAL_ACTION.
