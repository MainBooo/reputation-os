-- Инцидент роста трат Yandex Cloud (июль 2026), п.1.
-- DeepScan до фикса 5f0f3cb ставил syncMentionsEnabled=true на промоутнутые
-- auto-таргеты (origin='auto' — страницы, найденные поиском). mentions-sync
-- гонял по каждому из них Yandex Search API с запросами из имени компании —
-- чистые дубли (~138 поисков/день вместо ~30).
--
-- origin='auto-bootstrap' НЕ трогаем: это канонические поисковые сиды
-- (sync.service.ts, externalPlaceId='web-bootstrap:<companyId>'), без них
-- поиск упоминаний останавливается.
--
-- Применено 2026-07-14: 56 строк (Руки Вверх Бар 49, Stereopeople 5, АртКод 2).

UPDATE "CompanySourceTarget"
SET "syncMentionsEnabled" = false, "updatedAt" = now()
WHERE "syncMentionsEnabled" = true
  AND config->>'origin' IN ('auto', 'auto-bootstrap-backfill');
