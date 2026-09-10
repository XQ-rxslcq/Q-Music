import { describe, expect, it } from 'vitest'
import { formatTime, parseTimeInput } from '../src/core/format'

describe('formatTime', () => {
  it('formats seconds', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(125.9)).toBe('2:05')
  })
  it('guards invalid', () => {
    expect(formatTime(NaN)).toBe('0:00')
    expect(formatTime(-1)).toBe('0:00')
  })
})

describe('parseTimeInput', () => {
  it('parses mm:ss and seconds', () => {
    expect(parseTimeInput('12.5')).toBe(12.5)
    expect(parseTimeInput('1:30')).toBe(90)
    expect(parseTimeInput('0:05.5')).toBe(5.5)
  })
  it('rejects bad input', () => {
    expect(parseTimeInput('')).toBeNull()
    expect(parseTimeInput('1:99')).toBeNull()
    expect(parseTimeInput('abc')).toBeNull()
  })
})
