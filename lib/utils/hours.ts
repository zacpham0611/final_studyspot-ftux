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
