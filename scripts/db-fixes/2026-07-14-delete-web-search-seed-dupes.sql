-- Инцидент роста трат Yandex Cloud (июль 2026), п.4.
-- У каждой из 3 компаний было по два «поисковых» WEB-таргета без URL:
-- канонический bootstrap-сид (externalPlaceId='web-bootstrap:<companyId>')
-- и голый дубль (externalPlaceId IS NULL, externalUrl IS NULL, origin NULL),
-- который ежедневно создавал source_discovery через
-- WebMentionAdapter.discoverTargets (website у компаний пуст). Дубль получал
-- syncMentionsEnabled=true по дефолту колонки → лишняя пара поисков в день.
--
-- Ссылок на удаляемые строки нет (Mention/WatchedPage/RatingSnapshot = 0,
-- проверено 2026-07-14). Пересоздание закрыто кодом (discoverTargets WEB
-- больше не возвращает голый таргет) и partial unique index (миграция
-- 20260714064500_web_seed_null_unique_guard).

DELETE FROM "CompanySourceTarget"
WHERE id IN (
  'cmqkvmo6d003lsfo67g4xir7h', -- Stereopeople
  'cmr4vslie00uzmtzmf8yvjikd', -- АртКод
  'cmqkvmo5s003fsfo6agd6qh2m'  -- Руки Вверх Бар
);
