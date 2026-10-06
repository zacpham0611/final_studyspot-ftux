import { OpeningHours, DailyHours } from '@/lib/types/database';

export interface PlaceHoursStatus {
  isOpen: boolean;
  isLateNight: boolean;
  statusText: string;
  todayHoursText: string;
}

const DAYS_MAP: (keyof OpeningHours)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Parse time string "HH:mm" into minutes since midnight
 */
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Evaluates whether a place is currently open and whether it is a late-night venue.
 * Timezone: Asia/Ho_Chi_Minh (UTC+7)
 */
export function getOpeningStatus(
  hours?: OpeningHours,
  overrideDate?: Date
): PlaceHoursStatus {
  if (!hours) {
    return {
      isOpen: true,
      isLateNight: false,
      statusText: 'Đang mở cửa',
      todayHoursText: '07:00 - 22:30',
    };
  }

  if (hours.is_24h) {
    return {
      isOpen: true,
      isLateNight: true,
      statusText: 'Mở cửa 24/7',
      todayHoursText: 'Cả ngày (24/7)',
    };
  }

  // Get current date in Vietnam time
  const now = overrideDate || new Date();
  // Format to VN locale time
  const vnTimeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const currentMinutes = parseTimeToMinutes(vnTimeStr);

  const dayOfWeekIndex = now.getDay(); // 0 is Sunday
  const currentDayKey = DAYS_MAP[dayOfWeekIndex];
  const todaySchedule: DailyHours | undefined = hours[currentDayKey] as DailyHours | undefined;

  // Check late-night definition: closes at 22:00 or later, overnight, or 24h
  let isLateNight = false;
  if (todaySchedule && !todaySchedule.is_closed) {
    const closeMins = parseTimeToMinutes(todaySchedule.close);
    const openMins = parseTimeToMinutes(todaySchedule.open);
    if (closeMins >= 22 * 60 || closeMins < openMins) {
      isLateNight = true;
    }
  }

  if (!todaySchedule || todaySchedule.is_closed) {
    return {
      isOpen: false,
      isLateNight,
      statusText: 'Đóng cửa hôm nay',
      todayHoursText: 'Đóng cửa',
    };
  }

  const openMins = parseTimeToMinutes(todaySchedule.open);
  const closeMins = parseTimeToMinutes(todaySchedule.close);

  let isOpen = false;
  let statusText = 'Đang đóng cửa';

  if (closeMins < openMins) {
    // Overnight shift: e.g. 08:00 to 02:00 next day
    if (currentMinutes >= openMins || currentMinutes < closeMins) {
      isOpen = true;
      statusText = `Đang mở cửa • Đóng lúc ${todaySchedule.close}`;
    } else {
      statusText = `Đang đóng cửa • Mở lúc ${todaySchedule.open}`;
    }
  } else {
    // Regular daytime shift: e.g. 07:00 to 23:00
    if (currentMinutes >= openMins && currentMinutes < closeMins) {
      isOpen = true;
      if (closeMins - currentMinutes <= 30) {
        statusText = `Sắp đóng cửa • Đóng lúc ${todaySchedule.close}`;
      } else {
        statusText = `Đang mở cửa • Đóng lúc ${todaySchedule.close}`;
      }
    } else if (currentMinutes < openMins) {
      statusText = `Đang đóng cửa • Mở lúc ${todaySchedule.open}`;
    } else {
      statusText = `Đã đóng cửa lúc ${todaySchedule.close}`;
    }
  }

  return {
    isOpen,
    isLateNight,
    statusText,
    todayHoursText: `${todaySchedule.open} - ${todaySchedule.close}`,
  };
}

export const WEEK_DAYS = [
  { key: 'monday', label: 'T2', shortName: 'Thứ 2', full: 'Thứ Hai' },
  { key: 'tuesday', label: 'T3', shortName: 'Thứ 3', full: 'Thứ Ba' },
  { key: 'wednesday', label: 'T4', shortName: 'Thứ 4', full: 'Thứ Tư' },
  { key: 'thursday', label: 'T5', shortName: 'Thứ 5', full: 'Thứ Năm' },
  { key: 'friday', label: 'T6', shortName: 'Thứ 6', full: 'Thứ Sáu' },
  { key: 'saturday', label: 'T7', shortName: 'Thứ 7', full: 'Thứ Bảy' },
  { key: 'sunday', label: 'CN', shortName: 'CN', full: 'Chủ Nhật' },
] as const;

export type DayKey = (typeof WEEK_DAYS)[number]['key'];

export const ALL_DAY_KEYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Extracts list of active open days from an OpeningHours configuration.
 * Fully backwards compatible with legacy schedules where days are defined without open_days array.
 */
export function getOpenDaysFromHours(hours?: OpeningHours): string[] {
  if (!hours) return [...ALL_DAY_KEYS];
  if (hours.is_24h) return [...ALL_DAY_KEYS];

  if (Array.isArray(hours.open_days) && hours.open_days.length > 0) {
    return hours.open_days;
  }

  // Fallback: examine each day's is_closed flag
  const activeDays: string[] = [];
  ALL_DAY_KEYS.forEach((dayKey) => {
    const daySchedule = hours[dayKey] as DailyHours | undefined;
    if (!daySchedule || !daySchedule.is_closed) {
      activeDays.push(dayKey);
    }
  });

  return activeDays.length > 0 ? activeDays : [...ALL_DAY_KEYS];
}

/**
 * Formats human-readable summary of opening days for display:
 * - 24/7 -> "Mở cửa 24/7"
 * - All 7 days -> "Mở cửa tất cả các ngày"
 * - Mon-Fri -> "Mở cửa: Thứ 2 – Thứ 6"
 * - Mon-Sat -> "Mở cửa: Thứ 2 – Thứ 7"
 * - Custom list -> "Mở cửa: Thứ 2, Thứ 4, Thứ 7"
 */
export function formatOpenDaysText(hours?: OpeningHours): string {
  if (!hours) return 'Mở cửa tất cả các ngày (T2 – CN)';
  if (hours.is_24h) return 'Mở cửa 24/7';

  const openDays = getOpenDaysFromHours(hours);
  if (openDays.length === 7) return 'Mở cửa tất cả các ngày (T2 – CN)';
  if (openDays.length === 0) return 'Tạm đóng cửa';

  // Check if T2–T6 (monday through friday)
  const isT2toT6 =
    openDays.length === 5 &&
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every((d) => openDays.includes(d));
  if (isT2toT6) return 'Mở cửa: Thứ 2 – Thứ 6';

  // Check if T2–T7 (monday through saturday)
  const isT2toT7 =
    openDays.length === 6 &&
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].every((d) => openDays.includes(d));
  if (isT2toT7) return 'Mở cửa: Thứ 2 – Thứ 7';

  // Format comma separated days in standard order
  const dayNames = WEEK_DAYS
    .filter((w) => openDays.includes(w.key))
    .map((w) => (w.key === 'sunday' ? 'Chủ Nhật' : w.shortName));

  return `Mở cửa: ${dayNames.join(', ')}`;
}

/**
 * Parses time intervals from open/close strings and returns array of valid hour numbers (0..23).
 * Supports standard "09:00 - 22:00" as well as multi-shift intervals e.g. "08:00–12:00, 13:30–18:00".
 */
export function parseHoursRangeToSlots(openStr?: string, closeStr?: string): number[] {
  if (!openStr && !closeStr) {
    return Array.from({ length: 16 }, (_, i) => i + 7); // fallback 7..22
  }

  const combined = `${openStr || ''} - ${closeStr || ''}`;
  // Look for intervals like "08:00 - 12:00" or "08:00-12:00"
  const regex = /(\d{1,2})(?::(\d{2}))?\s*[-–~]\s*(\d{1,2})(?::(\d{2}))?/g;
  const matches = Array.from(combined.matchAll(regex));

  if (matches.length > 0) {
    const slotsSet = new Set<number>();
    for (const match of matches) {
      const startH = parseInt(match[1], 10);
      const endH = parseInt(match[3], 10);
      if (isNaN(startH) || isNaN(endH)) continue;

      if (endH >= startH) {
        for (let h = startH; h <= endH; h++) {
          if (h >= 0 && h <= 23) slotsSet.add(h);
        }
      } else {
        // Overnight
        for (let h = startH; h <= 23; h++) slotsSet.add(h);
        for (let h = 0; h <= endH; h++) slotsSet.add(h);
      }
    }
    const result = Array.from(slotsSet).sort((a, b) => a - b);
    if (result.length > 0) return result;
  }

  // Fallback to simple startHour and endHour
  const startH = openStr ? parseInt(openStr.split(':')[0], 10) : 7;
  const endH = closeStr ? parseInt(closeStr.split(':')[0], 10) : 22;

  if (isNaN(startH) || isNaN(endH)) {
    return Array.from({ length: 16 }, (_, i) => i + 7);
  }

  const slots: number[] = [];
  if (endH >= startH) {
    for (let h = startH; h <= endH; h++) {
      if (h >= 0 && h <= 23) slots.push(h);
    }
  } else {
    for (let h = startH; h <= 23; h++) slots.push(h);
    for (let h = 0; h <= endH; h++) slots.push(h);
  }
  return slots.length > 0 ? slots : Array.from({ length: 16 }, (_, i) => i + 7);
}

/**
 * Returns valid hourly slots (numbers from 0..23) according to the venue's specific opening schedule.
 * - If 24/7: returns all 24 hours [0..23].
 * - If open 09:00-22:00: returns [9, 10, ..., 22].
 * - If closed today and not for Admin editing: returns [] (closed today).
 * - If for Admin edit: returns the venue's active open day slots so Admin can configure it.
 */
export function getValidHourlySlots(
  hours?: OpeningHours,
  options?: { forAdminEdit?: boolean; targetDate?: Date }
): number[] {
  if (!hours) {
    return Array.from({ length: 16 }, (_, i) => i + 7); // Default 7..22
  }

  if (hours.is_24h) {
    return Array.from({ length: 24 }, (_, i) => i); // 0..23
  }

  const now = options?.targetDate || new Date();
  // Get Vietnam locale day index
  const vnDateStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDayIndex = new Date(vnDateStr).getDay(); // 0 is Sunday
  const DAYS_ORDER: (keyof OpeningHours)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const currentDayKey = DAYS_ORDER[vnDayIndex];

  const activeDays = getOpenDaysFromHours(hours);
  const isTodayOpen = activeDays.includes(currentDayKey);
  const todaySchedule = hours[currentDayKey] as DailyHours | undefined;

  // If today is closed and NOT for admin edit:
  if (!options?.forAdminEdit && (!isTodayOpen || todaySchedule?.is_closed)) {
    return []; // Closed today
  }

  // If today is open and has schedule:
  if (isTodayOpen && todaySchedule && !todaySchedule.is_closed) {
    return parseHoursRangeToSlots(todaySchedule.open, todaySchedule.close);
  }

  // If forAdminEdit or today has no schedule, pick the first open day's schedule
  for (const dayKey of DAYS_ORDER) {
    if (activeDays.includes(dayKey)) {
      const sched = hours[dayKey] as DailyHours | undefined;
      if (sched && !sched.is_closed) {
        return parseHoursRangeToSlots(sched.open, sched.close);
      }
    }
  }

  // Fallback to any defined day in the hours object
  const anyDay = hours.monday || hours.tuesday || hours.wednesday || hours.thursday || hours.friday || hours.saturday || hours.sunday;
  if (anyDay && !anyDay.is_closed) {
    return parseHoursRangeToSlots(anyDay.open, anyDay.close);
  }

  return Array.from({ length: 16 }, (_, i) => i + 7);
}


