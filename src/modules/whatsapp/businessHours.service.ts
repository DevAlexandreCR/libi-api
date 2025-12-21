import { DayOfWeek } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { notFound } from '../../utils/errors'

export interface BusinessHoursInput {
  dayOfWeek: DayOfWeek
  isEnabled: boolean
  openTime: string // "HH:mm"
  closeTime: string // "HH:mm"
  crossesMidnight: boolean
}

// Días de la semana en orden
const DAYS_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

// Nombres de días en español
const DAY_NAMES_ES: Record<DayOfWeek, string> = {
  MONDAY: 'lunes',
  TUESDAY: 'martes',
  WEDNESDAY: 'miércoles',
  THURSDAY: 'jueves',
  FRIDAY: 'viernes',
  SATURDAY: 'sábado',
  SUNDAY: 'domingo',
}

/**
 * Obtener horarios de negocio para un comercio
 */
export async function getBusinessHours(merchantId: string) {
  return prisma.businessHours.findMany({
    where: { merchantId },
    orderBy: { dayOfWeek: 'asc' },
  })
}

/**
 * Actualizar o crear horarios de negocio
 */
export async function upsertBusinessHours(
  merchantId: string,
  hours: BusinessHoursInput[]
) {
  // Verificar que el comercio existe
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  })
  if (!merchant) throw notFound('Merchant not found')

  // Eliminar horarios existentes y crear nuevos
  await prisma.businessHours.deleteMany({ where: { merchantId } })

  const created = await prisma.businessHours.createMany({
    data: hours.map((h) => ({
      merchantId,
      ...h,
    })),
  })

  return created
}

/**
 * Verificar si el bot debe responder en este momento
 * Retorna { shouldRespond: boolean, message?: string }
 */
export async function checkBusinessHoursStatus(merchantId: string, timezone = 'America/Bogota') {
  // Obtener el comercio con sus horarios
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      businessHours: true,
    },
  })

  if (!merchant) {
    return { shouldRespond: false, message: 'Comercio no encontrado' }
  }

  // Si no hay horarios configurados, el bot siempre responde
  if (!merchant.businessHours.length) {
    return { shouldRespond: true }
  }

  // Usar timezone del merchant o el por defecto
  const tz = merchant.timezone || timezone
  const now = new Date()
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
  const currentMinutes = timeToMinutes(localTime)

  const localDate = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
  }).format(now)

  // Mapear día de la semana
  const dayMap: Record<string, DayOfWeek> = {
    Monday: 'MONDAY',
    Tuesday: 'TUESDAY',
    Wednesday: 'WEDNESDAY',
    Thursday: 'THURSDAY',
    Friday: 'FRIDAY',
    Saturday: 'SATURDAY',
    Sunday: 'SUNDAY',
  }
  const currentDay = dayMap[localDate]

  // Buscar horario para hoy
  const todayHours = merchant.businessHours.find((h) => h.dayOfWeek === currentDay)

  // Si hoy no hay servicio
  if (!todayHours || !todayHours.isEnabled) {
    const nextBusinessDay = findNextOpenSchedule(merchant.businessHours, currentDay, currentMinutes)
    const message = buildClosedMessage(
      todayHours ? 'closed_today' : 'no_service_today',
      nextBusinessDay
    )
    return { shouldRespond: false, message }
  }

  // Verificar si estamos dentro del horario
  const isOpen = isTimeInRange(localTime, todayHours.openTime, todayHours.closeTime, todayHours.crossesMidnight)

  if (!isOpen) {
    // Verificar si estamos en horario del día anterior que cruza medianoche
    const yesterdayDay = getPreviousDay(currentDay)
    const yesterdayHours = merchant.businessHours.find((h) => h.dayOfWeek === yesterdayDay)

    if (yesterdayHours && yesterdayHours.isEnabled && yesterdayHours.crossesMidnight) {
      const isInYesterdayRange = isTimeInRange(
        localTime,
        '00:00',
        yesterdayHours.closeTime,
        false
      )

      if (isInYesterdayRange) {
        return { shouldRespond: true }
      }
    }

    // Estamos fuera de horario
    const nextSchedule = findNextOpenSchedule(merchant.businessHours, currentDay, currentMinutes)
    const message = buildClosedMessage('outside_hours', nextSchedule)
    return { shouldRespond: false, message }
  }

  return { shouldRespond: true }
}

/**
 * Verificar si una hora está dentro de un rango
 */
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
    // Cruza medianoche: de 20:00 a 01:00
    return current >= open || current < close
  }
}

/**
 * Convertir tiempo "HH:mm" a minutos desde medianoche
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Obtener el día anterior
 */
function getPreviousDay(day: DayOfWeek): DayOfWeek {
  const index = DAYS_ORDER.indexOf(day)
  const prevIndex = index === 0 ? DAYS_ORDER.length - 1 : index - 1
  return DAYS_ORDER[prevIndex]
}

/**
 * Encontrar el siguiente horario de atención disponible
 */
function findNextOpenSchedule(
  businessHours: Array<{
    dayOfWeek: DayOfWeek
    isEnabled: boolean
    openTime: string
    closeTime: string
    crossesMidnight?: boolean
  }>,
  currentDay: DayOfWeek,
  currentMinutes: number
) {
  const currentIndex = DAYS_ORDER.indexOf(currentDay)

  for (let offset = 0; offset < DAYS_ORDER.length; offset++) {
    const day = DAYS_ORDER[(currentIndex + offset) % DAYS_ORDER.length]
    const hours = businessHours.find((h) => h.dayOfWeek === day && h.isEnabled)
    if (!hours) continue

    const openMinutes = timeToMinutes(hours.openTime)
    const closeMinutesRaw = timeToMinutes(hours.closeTime)
    let closeMinutes = closeMinutesRaw

    // Si cruza medianoche, el cierre es el día siguiente
    if (hours.crossesMidnight || closeMinutes <= openMinutes) {
      closeMinutes += 24 * 60
    }

    const base = offset * 24 * 60
    const openAbsolute = openMinutes + base
    const closeAbsolute = closeMinutes + base

    // Si el siguiente horario aún no empieza, este es el próximo
    if (currentMinutes < openAbsolute) {
      return {
        day,
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        crossesMidnight: hours.crossesMidnight ?? false,
      }
    }

    // Si estuviéramos dentro del rango, este slot sigue vigente
    if (currentMinutes >= openAbsolute && currentMinutes < closeAbsolute) {
      return {
        day,
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        crossesMidnight: hours.crossesMidnight ?? false,
      }
    }
  }

  return null
}

/**
 * Construir mensaje de cerrado
 */
function buildClosedMessage(
  reason: 'closed_today' | 'no_service_today' | 'outside_hours',
  scheduleInfo: { day: DayOfWeek; openTime: string; closeTime: string; crossesMidnight?: boolean } | null
): string {
  if (reason === 'no_service_today') {
    if (!scheduleInfo) {
      return '⏰ Lo sentimos, actualmente no tenemos servicio. Por favor intenta más tarde.'
    }
    const dayName = DAY_NAMES_ES[scheduleInfo.day]
    if (scheduleInfo.crossesMidnight) {
      return `⏰ Lo sentimos, hoy no tenemos servicio. Nuestro próximo horario es el *${dayName}* de ${scheduleInfo.openTime} a ${scheduleInfo.closeTime} del día siguiente.`
    }
    return `⏰ Lo sentimos, hoy no tenemos servicio. Nuestro próximo horario es el *${dayName}* de ${scheduleInfo.openTime} a ${scheduleInfo.closeTime}.`
  }

  if (reason === 'closed_today') {
    if (!scheduleInfo) {
      return '⏰ Lo sentimos, actualmente estamos cerrados.'
    }
    const dayName = DAY_NAMES_ES[scheduleInfo.day]
    if (scheduleInfo.crossesMidnight) {
      return `⏰ Lo sentimos, hoy no tenemos servicio. Nuestro próximo horario es el *${dayName}* de ${scheduleInfo.openTime} a ${scheduleInfo.closeTime} del día siguiente.`
    }
    return `⏰ Lo sentimos, hoy no tenemos servicio. Nuestro próximo horario es el *${dayName}* de ${scheduleInfo.openTime} a ${scheduleInfo.closeTime}.`
  }

  if (reason === 'outside_hours') {
    if (!scheduleInfo) {
      return '⏰ Lo sentimos, estamos cerrados en este momento.'
    }
    const dayName = DAY_NAMES_ES[scheduleInfo.day]
    if (scheduleInfo.crossesMidnight) {
      return `⏰ Lo sentimos, estamos cerrados en este momento. Nuestro próximo horario es el *${dayName}* de ${scheduleInfo.openTime} a ${scheduleInfo.closeTime} del día siguiente.`
    }
    return `⏰ Lo sentimos, estamos cerrados en este momento. Nuestro próximo horario es el *${dayName}* de ${scheduleInfo.openTime} a ${scheduleInfo.closeTime}.`
  }

  return '⏰ Lo sentimos, estamos cerrados en este momento.'
}
