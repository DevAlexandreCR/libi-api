import { describe, it, expect, beforeEach } from 'vitest'
import { DayOfWeek } from '@prisma/client'

// Mock de funciones para testing
const DAYS_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

function isTimeInRange(
  currentTime: string,
  openTime: string,
  closeTime: string,
  crossesMidnight: boolean
): boolean {
  const current = timeToMinutes(currentTime)
  const open = timeToMinutes(openTime)
  const close = timeToMinutes(closeTime)

  if (!crossesMidnight) {
    return current >= open && current < close
  } else {
    return current >= open || current < close
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

describe('Business Hours Logic', () => {
  describe('timeToMinutes', () => {
    it('should convert 09:00 to 540 minutes', () => {
      expect(timeToMinutes('09:00')).toBe(540)
    })

    it('should convert 18:00 to 1080 minutes', () => {
      expect(timeToMinutes('18:00')).toBe(1080)
    })

    it('should convert 00:00 to 0 minutes', () => {
      expect(timeToMinutes('00:00')).toBe(0)
    })

    it('should convert 23:59 to 1439 minutes', () => {
      expect(timeToMinutes('23:59')).toBe(1439)
    })
  })

  describe('isTimeInRange - Normal hours', () => {
    it('should return true when time is within normal business hours', () => {
      expect(isTimeInRange('10:00', '09:00', '18:00', false)).toBe(true)
      expect(isTimeInRange('09:00', '09:00', '18:00', false)).toBe(true)
      expect(isTimeInRange('17:59', '09:00', '18:00', false)).toBe(true)
    })

    it('should return false when time is outside normal business hours', () => {
      expect(isTimeInRange('08:59', '09:00', '18:00', false)).toBe(false)
      expect(isTimeInRange('18:00', '09:00', '18:00', false)).toBe(false)
      expect(isTimeInRange('20:00', '09:00', '18:00', false)).toBe(false)
    })
  })

  describe('isTimeInRange - Crosses midnight', () => {
    it('should return true when time is within hours that cross midnight', () => {
      // 20:00 to 01:00 next day
      expect(isTimeInRange('20:00', '20:00', '01:00', true)).toBe(true)
      expect(isTimeInRange('23:30', '20:00', '01:00', true)).toBe(true)
      expect(isTimeInRange('00:30', '20:00', '01:00', true)).toBe(true)
      expect(isTimeInRange('00:59', '20:00', '01:00', true)).toBe(true)
    })

    it('should return false when time is outside hours that cross midnight', () => {
      // 20:00 to 01:00 next day
      expect(isTimeInRange('01:00', '20:00', '01:00', true)).toBe(false)
      expect(isTimeInRange('10:00', '20:00', '01:00', true)).toBe(false)
      expect(isTimeInRange('19:59', '20:00', '01:00', true)).toBe(false)
    })
  })

  describe('Day order', () => {
    it('should have correct day order starting with Monday', () => {
      expect(DAYS_ORDER[0]).toBe('MONDAY')
      expect(DAYS_ORDER[6]).toBe('SUNDAY')
    })

    it('should have 7 days', () => {
      expect(DAYS_ORDER).toHaveLength(7)
    })
  })
})
