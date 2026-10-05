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

