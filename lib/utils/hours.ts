import { OpeningHours, DailyHours, TimeInterval } from '@/lib/types/database';

export type { TimeInterval };

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
 * Extract an array of valid TimeIntervals from a daily schedule or interval array.
 */
export function getDayIntervals(schedule?: DailyHours | TimeInterval[] | null): TimeInterval[] {
  if (!schedule) return [];

  if (Array.isArray(schedule)) {
    return schedule.filter((i) => i && typeof i.open === 'string' && typeof i.close === 'string');
  }

  if (schedule.intervals && Array.isArray(schedule.intervals) && schedule.intervals.length > 0) {
    return schedule.intervals.filter((i) => i && typeof i.open === 'string' && typeof i.close === 'string');
  }

  if (schedule.open && schedule.close && !schedule.is_closed) {
    return [{ open: schedule.open, close: schedule.close }];
  }

  return [];
}

/**
 * Format daily intervals into user-friendly text:
 * - Single interval: "07:30 - 22:30"
 * - Multiple intervals: "08:00 - 11:45, 13:30 - 17:00"
 * - Closed: "Nghỉ"
 */
export function formatDayIntervals(schedule?: DailyHours | TimeInterval[] | null): string {
  const intervals = getDayIntervals(schedule);
  if (intervals.length === 0) return 'Nghỉ';
  return intervals.map((i) => `${i.open} - ${i.close}`).join(', ');
}

/**
 * Determines whether a time (in minutes from midnight) is within a specific interval.
 * Supports standard daytime shifts and overnight shifts (e.g. 18:00 - 02:00).
 */
export function isTimeInInterval(currentMinutes: number, interval: TimeInterval): boolean {
  const openMins = parseTimeToMinutes(interval.open);
  const closeMins = parseTimeToMinutes(interval.close);

  if (closeMins < openMins) {
    // Overnight shift: e.g. 18:00 to 02:00 next day
    return currentMinutes >= openMins || currentMinutes < closeMins;
  }
  // Regular daytime shift: e.g. 08:00 to 11:45
  return currentMinutes >= openMins && currentMinutes < closeMins;
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
  const activeDays = getOpenDaysFromHours(hours);
  const isTodayOpen = activeDays.includes(currentDayKey);
  const todaySchedule: DailyHours | undefined = hours[currentDayKey] as DailyHours | undefined;

  // 1. If today is not an operating day or explicitly marked closed
  if (!isTodayOpen || todaySchedule?.is_closed) {
    return {
      isOpen: false,
      isLateNight: false,
      statusText: 'Đóng cửa hôm nay',
      todayHoursText: 'Đóng cửa',
    };
  }

  // 2. If 24h per day on an active operating day
  if (hours.is_24h) {
    const is24_7 = activeDays.length === 7;
    return {
      isOpen: true,
      isLateNight: true,
      statusText: is24_7 ? 'Mở cửa 24/7' : 'Mở cửa 24/24 hôm nay',
      todayHoursText: is24_7 ? 'Cả ngày (24/7)' : 'Cả ngày (24h)',
    };
  }

  const todayIntervals = getDayIntervals(todaySchedule);
  if (todayIntervals.length === 0) {
    return {
      isOpen: false,
      isLateNight: false,
      statusText: 'Đóng cửa hôm nay',
      todayHoursText: 'Đóng cửa',
    };
  }

  // Check late-night definition: closes at 22:00 or later, overnight, or 24h
  let isLateNight = false;
  for (const interval of todayIntervals) {
    const openMins = parseTimeToMinutes(interval.open);
    const closeMins = parseTimeToMinutes(interval.close);
    if (closeMins >= 22 * 60 || closeMins < openMins) {
      isLateNight = true;
      break;
    }
  }

  // Check if current time falls within ANY of the today's intervals
  const activeInterval = todayIntervals.find((interval) => isTimeInInterval(currentMinutes, interval));

  let isOpen = false;
  let statusText = 'Đang đóng cửa';

  if (activeInterval) {
    isOpen = true;
    const openMins = parseTimeToMinutes(activeInterval.open);
    const closeMins = parseTimeToMinutes(activeInterval.close);
    const isOvernight = closeMins < openMins;
    const diff = isOvernight
      ? (currentMinutes >= openMins ? (24 * 60 - currentMinutes + closeMins) : (closeMins - currentMinutes))
      : (closeMins - currentMinutes);

    if (diff <= 30 && diff > 0) {
      statusText = `Sắp đóng cửa • Đóng lúc ${activeInterval.close}`;
    } else {
      statusText = `Đang mở cửa • Đóng lúc ${activeInterval.close}`;
    }
  } else {
    isOpen = false;
    // Find next upcoming interval today
    const upcoming = todayIntervals.find((interval) => {
      const openMins = parseTimeToMinutes(interval.open);
      return openMins > currentMinutes;
    });

    if (upcoming) {
      statusText = `Đang đóng cửa • Mở lúc ${upcoming.open}`;
    } else {
      statusText = `Đã đóng cửa hôm nay`;
    }
  }

  return {
    isOpen,
    isLateNight,
    statusText,
    todayHoursText: formatDayIntervals(todaySchedule),
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
 * - 24/7 -> "Mở cửa 24/7 (Cả tuần)"
 * - 24h T2-T6 -> "Mở cửa 24h (Thứ 2 – Thứ 6)"
 * - All 7 days -> "Mở cửa tất cả các ngày (T2 – CN)"
 * - Mon-Fri -> "Mở cửa: Thứ 2 – Thứ 6"
 * - Mon-Sat -> "Mở cửa: Thứ 2 – Thứ 7"
 * - Custom list -> "Mở cửa: Thứ 2, Thứ 4, Thứ 7"
 */
export function formatOpenDaysText(hours?: OpeningHours): string {
  if (!hours) return 'Mở cửa tất cả các ngày (T2 – CN)';

  const openDays = getOpenDaysFromHours(hours);
  const isAll7 = openDays.length === 7;

  if (hours.is_24h) {
    if (isAll7) return 'Mở cửa 24/7 (Cả tuần)';
    const isT2toT6 =
      openDays.length === 5 &&
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every((d) => openDays.includes(d));
    if (isT2toT6) return 'Mở cửa 24h (Thứ 2 – Thứ 6)';
    const dayNames = WEEK_DAYS
      .filter((w) => openDays.includes(w.key))
      .map((w) => (w.key === 'sunday' ? 'CN' : w.label));
    return `Mở cửa 24h (${dayNames.join(', ')})`;
  }

  if (isAll7) return 'Mở cửa tất cả các ngày (T2 – CN)';
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
 * - If 24/7 or 24h on active day: returns all 24 hours [0..23].
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

  // If venue operates 24 hours on open days:
  if (hours.is_24h) {
    return Array.from({ length: 24 }, (_, i) => i); // 0..23
  }

  const extractSlotsFromSchedule = (sched?: DailyHours): number[] => {
    if (!sched || sched.is_closed) return [];
    const intervals = getDayIntervals(sched);
    if (intervals.length === 0) return [];

    const slotsSet = new Set<number>();
    for (const interval of intervals) {
      const parsed = parseHoursRangeToSlots(interval.open, interval.close);
      for (const h of parsed) slotsSet.add(h);
    }
    return Array.from(slotsSet).sort((a, b) => a - b);
  };

  // If today is open and has schedule:
  if (isTodayOpen && todaySchedule && !todaySchedule.is_closed) {
    const slots = extractSlotsFromSchedule(todaySchedule);
    if (slots.length > 0) return slots;
  }

  // If forAdminEdit or today has no schedule, pick the first open day's schedule
  for (const dayKey of DAYS_ORDER) {
    if (activeDays.includes(dayKey)) {
      const sched = hours[dayKey] as DailyHours | undefined;
      if (sched && !sched.is_closed) {
        const slots = extractSlotsFromSchedule(sched);
        if (slots.length > 0) return slots;
      }
    }
  }

  // Fallback to any defined day in the hours object
  const anyDay = hours.monday || hours.tuesday || hours.wednesday || hours.thursday || hours.friday || hours.saturday || hours.sunday;
  if (anyDay && !anyDay.is_closed) {
    const slots = extractSlotsFromSchedule(anyDay);
    if (slots.length > 0) return slots;
  }

  return Array.from({ length: 16 }, (_, i) => i + 7);
}


