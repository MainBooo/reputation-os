-- Страховка от дублей «поисковых» WEB-таргетов: у строк без externalPlaceId и
-- externalUrl нет естественного ключа, а @@unique(companyId, sourceId,
-- externalPlaceId) NULL не ловит — source_discovery создавал по второму
-- безключевому таргету на компанию (инцидент Yandex Cloud, июль 2026, п.4).
--
-- ВНИМАНИЕ: партиальный индекс не выражается в schema.prisma — при будущих
-- `prisma migrate diff` проверять, что сгенерированная миграция не содержит
-- DROP INDEX "CompanySourceTarget_companyId_sourceId_null_seed_key".
CREATE UNIQUE INDEX "CompanySourceTarget_companyId_sourceId_null_seed_key"
ON "CompanySourceTarget" ("companyId", "sourceId")
WHERE "externalPlaceId" IS NULL AND "externalUrl" IS NULL;
