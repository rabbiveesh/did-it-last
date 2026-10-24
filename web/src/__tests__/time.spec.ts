import { describe, expect, it } from 'vitest'

import { localDate } from '@/time'

describe("today's date", () => {
  it('is the calendar day on the phone, written YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
