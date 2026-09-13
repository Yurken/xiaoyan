import { describe, it, expect } from 'vitest'
import {
  SESSION_STATUS_LABEL,
  SOURCE_TYPE_LABEL,
  CANDIDATE_STATUS_CONFIG,
  EXPERIMENT_STATUS_CONFIG,
  normalizeResearchOutput,
  createLogEntry,
  formatAuthors,
} from '../shared'

describe('shared', () => {
  describe('SESSION_STATUS_LABEL', () => {
    it('should map all status values', () => {
      expect(SESSION_STATUS_LABEL.idle).toBe('未运行')
      expect(SESSION_STATUS_LABEL.running).toBe('运行中')
      expect(SESSION_STATUS_LABEL.paused).toBe('已暂停')
      expect(SESSION_STATUS_LABEL.completed).toBe('已完成')
      expect(SESSION_STATUS_LABEL.failed).toBe('失败')
    })
  })

  describe('SOURCE_TYPE_LABEL', () => {
    it('should map all source types', () => {
      expect(SOURCE_TYPE_LABEL.paper).toBe('论文')
      expect(SOURCE_TYPE_LABEL.uploaded_document).toBe('上传文档')
      expect(SOURCE_TYPE_LABEL.web).toBe('网页')
      expect(SOURCE_TYPE_LABEL.dataset).toBe('数据集')
      expect(SOURCE_TYPE_LABEL.experiment).toBe('实验')
    })
  })

  describe('CANDIDATE_STATUS_CONFIG', () => {
    it('should have config for all statuses', () => {
      expect(CANDIDATE_STATUS_CONFIG.proposed).toBeDefined()
      expect(CANDIDATE_STATUS_CONFIG.selected).toBeDefined()
      expect(CANDIDATE_STATUS_CONFIG.rejected).toBeDefined()
      expect(CANDIDATE_STATUS_CONFIG.deferred).toBeDefined()
    })

    it('should have label, color, and bg for each status', () => {
      for (const config of Object.values(CANDIDATE_STATUS_CONFIG)) {
        expect(config.label).toBeDefined()
        expect(config.color).toBeDefined()
        expect(config.bg).toBeDefined()
      }
    })
  })

  describe('EXPERIMENT_STATUS_CONFIG', () => {
    it('should have config for draft and frozen', () => {
      expect(EXPERIMENT_STATUS_CONFIG.draft).toBeDefined()
      expect(EXPERIMENT_STATUS_CONFIG.frozen).toBeDefined()
    })
  })

  describe('normalizeResearchOutput', () => {
    it('should return default values for empty input', () => {
      const result = normalizeResearchOutput({})
      expect(result.title).toBe('研究标题')
      expect(result.abstract).toBe('')
      expect(result.problemStatement).toBe('')
      expect(result.rationale).toBe('')
      expect(result.methods).toBe('')
      expect(result.technicalDetails).toEqual([])
      expect(result.experiments).toEqual([])
      expect(result.datasets).toEqual([])
      expect(result.results).toBe('')
      expect(result.references).toEqual([])
    })

    it('should handle snake_case fields from backend', () => {
      const result = normalizeResearchOutput({
        problem_statement: 'Test problem',
        technical_details: ['detail1', 'detail2'],
      })
      expect(result.problemStatement).toBe('Test problem')
      expect(result.technicalDetails).toEqual(['detail1', 'detail2'])
    })

    it('should prefer camelCase over snake_case', () => {
      const result = normalizeResearchOutput({
        problemStatement: 'Camel case',
        problem_statement: 'Snake case',
      })
      expect(result.problemStatement).toBe('Camel case')
    })

    it('should pass through provided values', () => {
      const result = normalizeResearchOutput({
        title: 'Custom Title',
        abstract: 'Custom Abstract',
        results: 'Custom Results',
      })
      expect(result.title).toBe('Custom Title')
      expect(result.abstract).toBe('Custom Abstract')
      expect(result.results).toBe('Custom Results')
    })
  })

  describe('createLogEntry', () => {
    it('should create entry with default info level', () => {
      const entry = createLogEntry('Test message')
      expect(entry.text).toBe('Test message')
      expect(entry.level).toBe('info')
      expect(entry.id).toBeDefined()
      expect(entry.time).toBeDefined()
    })

    it('should create entry with specified level', () => {
      const entry = createLogEntry('Error message', 'error')
      expect(entry.level).toBe('error')
    })

    it('should generate unique ids', () => {
      const entry1 = createLogEntry('Message 1')
      const entry2 = createLogEntry('Message 2')
      expect(entry1.id).not.toBe(entry2.id)
    })
  })

  describe('formatAuthors', () => {
    it('should format single author', () => {
      expect(formatAuthors(['Author One'])).toBe('Author One')
    })

    it('should format multiple authors within limit', () => {
      expect(formatAuthors(['A', 'B', 'C'])).toBe('A, B, C')
    })

    it('should truncate and add et al. when exceeding limit', () => {
      expect(formatAuthors(['A', 'B', 'C', 'D'])).toBe('A, B, C et al.')
    })

    it('should respect custom maxDisplay', () => {
      expect(formatAuthors(['A', 'B', 'C', 'D'], 2)).toBe('A, B et al.')
    })
  })
})
