import { Checkin, CrowdStatus } from '@/lib/types/database';

export interface CrowdCalculationResult {
  score: number | null;
  status: CrowdStatus;
  label: string;
  color: string;
  checkinCount: number;
  latestNote?: string;
  updatedAt?: string;
  isEstimated?: boolean;
}

export const CROWD_CONFIG = {
  empty: {
    status: 'empty' as CrowdStatus,
    label: 'Vắng',
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    description: 'Nhiều chỗ ngồi, không gian yên tĩnh',
  },
  medium: {
    status: 'medium' as CrowdStatus,
    label: 'Vừa',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    description: 'Chỗ ngồi vừa phải, vẫn còn bàn trống',
  },
  full: {
    status: 'full' as CrowdStatus,
    label: 'Đông',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
    description: 'Gần hết bàn hoặc hết chỗ ngồi',
  },
  unknown: {
    status: 'unknown' as CrowdStatus,
    label: 'Chưa có dữ liệu',
    color: '#9CA3AF',
    bgColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    description: 'Chưa có lượt check-in nào trong hệ thống',
  },
};

/**
 * Calculates crowd score and status from checkins in the last 90 minutes.
 * Weight decreases linearly: weight = 1 - (minutes_ago / 90)
 * Score = sum(level * weight) / sum(weight)
 *
 * If no check-ins exist in the last 90 minutes, falls back to cumulative
 * historical check-in data (current time slot ±1h or overall historical average)
 * so markers and cards show an accurate estimated crowd level.
 */
export function calculateCrowdStatus(
  checkins: Checkin[] = [],
  currentTime: Date = new Date()
): CrowdCalculationResult {
  const WINDOW_MINUTES = 90;
  const nowMs = currentTime.getTime();

  // Filter checkins within 90 minutes
  const recentCheckins = checkins.filter((c) => {
    const checkinTime = new Date(c.created_at).getTime();
    const diffMinutes = (nowMs - checkinTime) / (1000 * 60);
    return diffMinutes >= 0 && diffMinutes <= WINDOW_MINUTES;
  });

  if (recentCheckins.length === 0) {
    if (checkins.length > 0) {
      // Vietnam timezone hour (UTC+7)
      const vnFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: 'numeric',
        hour12: false,
      });
      const currentHour = parseInt(vnFormatter.format(currentTime), 10);

      // Look for check-ins in the same time slot (currentHour ± 1 hour)
      const slotCheckins = checkins.filter((c) => {
        const d = new Date(c.created_at);
        const h = parseInt(vnFormatter.format(d), 10);
        const diff = Math.abs(h - currentHour);
        return diff <= 1 || diff === 23;
      });

      const effectiveCheckins = slotCheckins.length > 0 ? slotCheckins : checkins;
      const avgScore = effectiveCheckins.reduce((sum, c) => sum + c.level, 0) / effectiveCheckins.length;

      let estimatedStatus: CrowdStatus = 'empty';
      if (avgScore < 1.67) {
        estimatedStatus = 'empty';
      } else if (avgScore <= 2.33) {
        estimatedStatus = 'medium';
      } else {
        estimatedStatus = 'full';
      }

      const roundedScore = Math.round(avgScore * 100) / 100;
      return {
        score: roundedScore,
        status: estimatedStatus,
        label: `${CROWD_CONFIG[estimatedStatus].label} (Ước tính)`,
        color: CROWD_CONFIG[estimatedStatus].color,
        checkinCount: effectiveCheckins.length,
        isEstimated: true,
      };
    }

    return {
      score: null,
      status: 'unknown',
      label: CROWD_CONFIG.unknown.label,
      color: CROWD_CONFIG.unknown.color,
      checkinCount: 0,
      isEstimated: false,
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const c of recentCheckins) {
    const checkinTime = new Date(c.created_at).getTime();
    const minutesAgo = Math.max(0, (nowMs - checkinTime) / (1000 * 60));
    const weight = 1 - (minutesAgo / WINDOW_MINUTES);
    
    totalWeight += weight;
    weightedSum += c.level * weight;
  }

  if (totalWeight <= 0) {
    return {
      score: null,
      status: 'unknown',
      label: CROWD_CONFIG.unknown.label,
      color: CROWD_CONFIG.unknown.color,
      checkinCount: 0,
    };
  }

  const score = weightedSum / totalWeight;
  let status: CrowdStatus = 'unknown';

  if (score < 1.67) {
    status = 'empty';
  } else if (score <= 2.33) {
    status = 'medium';
  } else {
    status = 'full';
  }

  // Find latest note
  const sorted = [...recentCheckins].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const latestCheckin = sorted[0];

  return {
    score: Math.round(score * 100) / 100,
    status,
    label: CROWD_CONFIG[status].label,
    color: CROWD_CONFIG[status].color,
    checkinCount: recentCheckins.length,
    latestNote: latestCheckin.note,
    updatedAt: latestCheckin.created_at,
  };
}
