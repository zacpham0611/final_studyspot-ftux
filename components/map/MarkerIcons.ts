import L from 'leaflet';
import { CrowdStatus } from '@/lib/types/database';

export function createFtuMarkerIcon() {
  const svgHtml = `
    <div style="
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(138, 21, 56, 0.25);
        animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #8A1538;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 12px rgba(138, 21, 56, 0.45);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 800;
        font-size: 11px;
        line-height: 1;
      ">
        <span>FTU</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-ftu-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

const CROWD_COLORS: Record<CrowdStatus, string> = {
  empty: '#10B981',
  medium: '#F59E0B',
  full: '#EF4444',
  unknown: '#9CA3AF',
};

export function createPlaceMarkerIcon(
  crowdStatus: CrowdStatus = 'unknown',
  isSelected: boolean = false,
  priceLevel: number = 2,
  isOpen: boolean = true
) {
  const effectiveStatus = isOpen ? crowdStatus : 'unknown';
  const color = CROWD_COLORS[effectiveStatus] || '#9CA3AF';
  const size = isSelected ? 40 : 32;
  const borderWidth = isSelected ? 3 : 2;

  const svgHtml = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    ">
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${isSelected ? '#8A1538' : '#ffffff'};
        border: ${borderWidth}px solid ${isSelected ? '#ffffff' : color};
        box-shadow: 0 4px 12px rgba(0, 0, 0, ${isSelected ? '0.35' : '0.15'});
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: ${isSelected ? 14 : 12}px;
          height: ${isSelected ? 14 : 12}px;
          border-radius: 50%;
          background: ${color};
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-place-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// --- CACHED SINGLETON & DICTIONARY ---
let cachedFtuMarkerIcon: L.DivIcon | null = null;

export function getCachedFtuMarkerIcon(): L.DivIcon {
  if (!cachedFtuMarkerIcon) {
    cachedFtuMarkerIcon = createFtuMarkerIcon();
  }
  return cachedFtuMarkerIcon;
}

const placeMarkerIconCache = new Map<string, L.DivIcon>();

export function getCachedPlaceMarkerIcon(
  crowdStatus: CrowdStatus = 'unknown',
  isSelected: boolean = false,
  priceLevel: number = 2,
  isOpen: boolean = true
): L.DivIcon {
  const effectiveStatus = isOpen ? (crowdStatus || 'unknown') : 'unknown';
  const key = `${effectiveStatus}_${isSelected ? 1 : 0}`;
  let icon = placeMarkerIconCache.get(key);
  if (!icon) {
    icon = createPlaceMarkerIcon(effectiveStatus, isSelected, priceLevel, isOpen);
    placeMarkerIconCache.set(key, icon);
  }
  return icon;
}
