import { TelegramQueryBuilderService, transliterateRuToLatin, extractDomain } from './telegram-query-builder.service'
import type { CompanyScoutInput, TelegramScoutBudgets } from './telegram-scout.types'
import type { Company, CompanyAlias } from '@prisma/client'

const BUDGETS: TelegramScoutBudgets = {
  maxQueriesPerCompany: 6,
  maxStrongQueries: 3,
  maxMediumQueries: 2,
  maxWeakQueries: 1,
  maxPagesPerQuery: 3,
  maxMessagesPerRun: 300,
  maxNewSourcesPerRun: 15,
  maxRuntimeMs: 180_000
}

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    workspaceId: 'w1',
    name: 'Кофейня Ромашка',
    normalizedName: 'кофейня ромашка',
    website: 'https://romashka-coffee.ru/about',
    normalizedWebsite: 'romashka-coffee.ru',
    city: 'Москва',
    normalizedCity: 'москва',
    industry: 'кофейня',
    description: null,
    logoUrl: null,
    isActive: true,
    responsePreset: 'FORMAL' as any,
    initialSyncCompletedAt: null,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    subscriptionId: null,
    ...overrides
  } as Company
}

function alias(overrides: Partial<CompanyAlias>): CompanyAlias {
  return {
    id: `alias-${Math.random()}`,
    companyId: 'c1',
    value: 'alias',
    normalizedValue: 'alias',
    priority: 100,
    isPrimary: false,
    isExcluded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as CompanyAlias
}

describe('TelegramQueryBuilderService', () => {
  const builder = new TelegramQueryBuilderService()

  it('produces strong queries from name, domain, and primary alias', () => {
    const input: CompanyScoutInput = {
      company: company(),
      aliases: [alias({ value: 'Romashka', isPrimary: true, priority: 1 })]
    }

    const queries = builder.build(input, BUDGETS)
    const strong = queries.filter((q) => q.class === 'strong')

    expect(strong.map((q) => q.text)).toEqual(
      expect.arrayContaining(['Кофейня Ромашка', 'romashka-coffee.ru', 'Romashka'])
    )
    expect(strong.length).toBeLessThanOrEqual(BUDGETS.maxStrongQueries)
  })

  it('caps strong queries at maxStrongQueries even with more primary aliases', () => {
    const input: CompanyScoutInput = {
      company: company(),
      aliases: [
        alias({ value: 'Primary1', isPrimary: true, priority: 1 }),
        alias({ value: 'Primary2', isPrimary: true, priority: 2 }),
        alias({ value: 'Primary3', isPrimary: true, priority: 3 })
      ]
    }

    const queries = builder.build(input, BUDGETS)
    expect(queries.filter((q) => q.class === 'strong').length).toBe(BUDGETS.maxStrongQueries)
  })

  it('fills medium class with priority non-primary aliases and one transliteration', () => {
    const input: CompanyScoutInput = {
      company: company({ website: null }),
      aliases: [alias({ value: 'Короткое имя', isPrimary: false, priority: 5 })]
    }

    const queries = builder.build(input, BUDGETS)
    const medium = queries.filter((q) => q.class === 'medium')

    expect(medium.some((q) => q.text === 'Короткое имя')).toBe(true)
    expect(medium.length).toBeLessThanOrEqual(BUDGETS.maxMediumQueries)
  })

  it('puts remaining aliases into weak class, capped at maxWeakQueries', () => {
    const input: CompanyScoutInput = {
      company: company({ website: null }),
      aliases: [
        alias({ value: 'Продукт А', priority: 50 }),
        alias({ value: 'Продукт Б', priority: 51 }),
        alias({ value: 'Продукт В', priority: 52 })
      ]
    }

    const queries = builder.build(input, BUDGETS)
    const weak = queries.filter((q) => q.class === 'weak')

    expect(weak.length).toBe(BUDGETS.maxWeakQueries)
  })

  it('never exceeds the total maxQueriesPerCompany budget', () => {
    const input: CompanyScoutInput = {
      company: company(),
      aliases: [
        alias({ value: 'P1', isPrimary: true, priority: 1 }),
        alias({ value: 'P2', isPrimary: true, priority: 2 }),
        alias({ value: 'M1', priority: 10 }),
        alias({ value: 'M2', priority: 11 }),
        alias({ value: 'W1', priority: 20 }),
        alias({ value: 'W2', priority: 21 })
      ]
    }

    const queries = builder.build(input, BUDGETS)
    expect(queries.length).toBeLessThanOrEqual(BUDGETS.maxQueriesPerCompany)
  })

  it('excludes CompanyAlias.isExcluded=true from every query class', () => {
    const input: CompanyScoutInput = {
      company: company(),
      aliases: [
        alias({ value: 'BadTwin', isPrimary: true, isExcluded: true, priority: 1 }),
        alias({ value: 'Ромашка Клининг', isExcluded: true, priority: 2 })
      ]
    }

    const queries = builder.build(input, BUDGETS)
    expect(queries.some((q) => q.text === 'BadTwin')).toBe(false)
    expect(queries.some((q) => q.text === 'Ромашка Клининг')).toBe(false)
  })

  it('deduplicates identical query text across classes', () => {
    const input: CompanyScoutInput = {
      company: company({ name: 'Ромашка', website: null }),
      aliases: [alias({ value: 'Ромашка', isPrimary: true, priority: 1 })]
    }

    const queries = builder.build(input, BUDGETS)
    const texts = queries.map((q) => q.text.toLowerCase())
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('does not invent typo/phonetic variants beyond the single transliteration', () => {
    const input: CompanyScoutInput = {
      company: company({ website: null }),
      aliases: []
    }

    const queries = builder.build(input, BUDGETS)
    // name + one transliteration = at most 2 queries total for this minimal input.
    expect(queries.length).toBeLessThanOrEqual(2)
  })
})

describe('transliterateRuToLatin', () => {
  it('transliterates a Cyrillic name deterministically', () => {
    expect(transliterateRuToLatin('Ромашка')).toBe('romashka')
  })

  it('returns null for already-Latin input', () => {
    expect(transliterateRuToLatin('Romashka')).toBeNull()
  })
})

describe('extractDomain', () => {
  it('strips protocol, www, and path', () => {
    expect(extractDomain('https://www.example.com/about')).toBe('example.com')
  })

  it('returns null for missing website', () => {
    expect(extractDomain(null)).toBeNull()
  })
})
