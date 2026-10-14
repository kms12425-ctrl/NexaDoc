import { describe, it, expect } from 'vitest'
import { allTemplates, templatesByCategory } from './index'
import type { DocumentTemplate } from './index'

const EXPECTED_COUNTS = {
  all: 22,
  blank: 1,
  business: 6,
  personal: 5,
  education: 5,
  creative: 5,
}

/* ── Helpers ──────────────────────────────────────────────────── */

/** Walk every node in a TipTap JSON document and call `fn` for each. */
function walkNodes(node: any, fn: (n: any) => void): void {
  if (!node || typeof node !== 'object') return
  fn(node)
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkNodes(child, fn)
  }
}

/** Every text node must have a string `text` property. */
function validateTextNodes(content: object): string[] {
  const errors: string[] = []
  walkNodes(content, (n) => {
    if (n.type === 'text') {
      if (typeof n.text !== 'string') {
        errors.push(`text node missing string "text" property`)
      }
      if (n.marks && !Array.isArray(n.marks)) {
        errors.push(`text node "marks" is not an array`)
      }
    }
  })
  return errors
}

/* ── Tests ────────────────────────────────────────────────────── */

describe('templates registry', () => {
  describe('allTemplates', () => {
    it(`has ${EXPECTED_COUNTS.all} templates`, () => {
      expect(allTemplates).toHaveLength(EXPECTED_COUNTS.all)
    })

    it('has unique ids', () => {
      const ids = allTemplates.map((t) => t.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('has unique names', () => {
      const names = allTemplates.map((t) => t.name)
      expect(new Set(names).size).toBe(names.length)
    })

    it('every template has required fields', () => {
      for (const tpl of allTemplates) {
        expect(tpl.id).toBeTruthy()
        expect(tpl.name).toBeTruthy()
        expect(tpl.description).toBeTruthy()
        expect(tpl.category).toBeTruthy()
        expect(tpl.accent).toMatch(/^#[0-9a-fA-F]{6}$/)
        expect(typeof tpl.preview).toBe('string')
        expect(tpl.preview.length).toBeGreaterThan(0)
        expect(typeof tpl.content).toBe('object')
      }
    })

    it('every preview is an SVG string', () => {
      for (const tpl of allTemplates) {
        expect(tpl.preview).toContain('<svg')
        expect(tpl.preview).toContain('</svg>')
      }
    })

    it('every content is valid TipTap JSON (type: doc)', () => {
      for (const tpl of allTemplates) {
        const content = tpl.content as any
        expect(content.type).toBe('doc')
        expect(Array.isArray(content.content)).toBe(true)
      }
    })

    it('every text node has a string "text" property', () => {
      for (const tpl of allTemplates) {
        const errors = validateTextNodes(tpl.content)
        if (errors.length > 0) {
          throw new Error(`${tpl.id}: ${errors.join('; ')}`)
        }
      }
    })
  })

  describe('templatesByCategory', () => {
    it('has "all" matching allTemplates', () => {
      expect(templatesByCategory.all).toEqual(allTemplates)
    })

    it('has correct count per category', () => {
      for (const [cat, count] of Object.entries(EXPECTED_COUNTS)) {
        expect(templatesByCategory[cat]).toHaveLength(count)
      }
    })

    it('category arrays are subsets of allTemplates', () => {
      const allIds = new Set(allTemplates.map((t) => t.id))
      for (const [cat, templates] of Object.entries(templatesByCategory)) {
        if (cat === 'all') continue
        for (const tpl of templates) {
          expect(allIds.has(tpl.id)).toBe(true)
        }
      }
    })

    it('blank category contains only the blank template', () => {
      expect(templatesByCategory.blank).toHaveLength(1)
      expect(templatesByCategory.blank[0].id).toBe('blank')
    })

    it('business templates all have category "business"', () => {
      for (const tpl of templatesByCategory.business) {
        expect(tpl.category).toBe('business')
      }
    })

    it('personal templates all have category "personal"', () => {
      for (const tpl of templatesByCategory.personal) {
        expect(tpl.category).toBe('personal')
      }
    })

    it('education templates all have category "education"', () => {
      for (const tpl of templatesByCategory.education) {
        expect(tpl.category).toBe('education')
      }
    })

    it('creative templates all have category "creative"', () => {
      for (const tpl of templatesByCategory.creative) {
        expect(tpl.category).toBe('creative')
      }
    })
  })

  describe('category coverage', () => {
    it('sum of non-blank categories + blank === all', () => {
      const sum =
        templatesByCategory.blank.length +
        templatesByCategory.business.length +
        templatesByCategory.personal.length +
        templatesByCategory.education.length +
        templatesByCategory.creative.length
      expect(sum).toBe(allTemplates.length)
    })

    it('no template appears in two non-all categories', () => {
      const cats = ['blank', 'business', 'personal', 'education', 'creative']
      const seen = new Map<string, string>()
      for (const cat of cats) {
        for (const tpl of templatesByCategory[cat]) {
          const prev = seen.get(tpl.id)
          if (prev) {
            throw new Error(`Template "${tpl.id}" appears in both "${prev}" and "${cat}"`)
          }
          seen.set(tpl.id, cat)
        }
      }
    })
  })
})
