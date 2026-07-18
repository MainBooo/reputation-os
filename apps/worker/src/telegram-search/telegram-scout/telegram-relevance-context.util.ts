import type { Company, CompanyAlias } from '@prisma/client'
import { extractDomain } from './telegram-query-builder.service'
import type { RelevanceContext } from './telegram-scout.types'

export function buildRelevanceContext(company: Company, aliases: CompanyAlias[]): RelevanceContext {
  const nonExcluded = aliases.filter((a) => !a.isExcluded)

  return {
    companyName: company.name,
    normalizedCompanyName: company.normalizedName,
    website: company.website,
    domain: extractDomain(company.website),
    aliases: nonExcluded.map((a) => a.value.trim()),
    primaryAliases: nonExcluded.filter((a) => a.isPrimary).map((a) => a.value.trim()),
    excludedTerms: aliases.filter((a) => a.isExcluded).map((a) => a.value.trim()),
    city: company.city,
    industry: company.industry
  }
}
