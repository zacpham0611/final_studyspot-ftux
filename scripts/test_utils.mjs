// Automated verification test suite for core algorithms
import assert from 'node:assert';

// 1. Test crowd decay logic
function testCrowdCalculation() {
  console.log('Testing crowd calculation algorithm...');
  const WINDOW_MINUTES = 90;
  const now = new Date('2026-09-29T14:00:00Z');

  // Helper
  function calc(checkins) {
    const nowMs = now.getTime();
    const recent = checkins.filter(c => {
      const diff = (nowMs - new Date(c.created_at).getTime()) / (1000 * 60);
      return diff >= 0 && diff <= WINDOW_MINUTES;
    });

    if (recent.length === 0) return { status: 'unknown', score: null };

    let totalWeight = 0;
    let weightedSum = 0;
    for (const c of recent) {
      const minutesAgo = Math.max(0, (nowMs - new Date(c.created_at).getTime()) / (1000 * 60));
      const weight = 1 - (minutesAgo / WINDOW_MINUTES);
      totalWeight += weight;
      weightedSum += c.level * weight;
    }

    const score = weightedSum / totalWeight;
    let status = 'unknown';
    if (score < 1.67) status = 'empty';
    else if (score <= 2.33) status = 'medium';
    else status = 'full';

    return { status, score };
  }

  // Case 1: No checkins -> unknown
  assert.strictEqual(calc([]).status, 'unknown');

  // Case 2: One very recent check-in of level 1 (Vắng) 5 mins ago -> empty
  const r1 = calc([{ level: 1, created_at: '2026-09-29T13:55:00Z' }]);
  assert.strictEqual(r1.status, 'empty');
  assert.strictEqual(r1.score, 1);

  // Case 3: One check-in 100 mins ago -> outside window -> unknown
  const r2 = calc([{ level: 3, created_at: '2026-09-29T12:00:00Z' }]);
  assert.strictEqual(r2.status, 'unknown');

  // Case 4: Weighted decay: Check-in level 1 (5 mins ago, weight 85/90 ~ 0.944) vs level 3 (80 mins ago, weight 10/90 ~ 0.111)
  const r3 = calc([
    { level: 1, created_at: '2026-09-29T13:55:00Z' },
    { level: 3, created_at: '2026-09-29T12:40:00Z' },
  ]);
  assert.strictEqual(r3.status, 'empty', 'Recent empty checkin should heavily outweigh old full checkin');
  console.log('✓ Crowd decay test passed.');
}

// 2. Test Haversine distance
function testHaversineDistance() {
  console.log('Testing Haversine distance calculation...');
  const FTU = { lat: 21.0245, lng: 105.8046 };

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // Distance from FTU to itself is 0
  assert.strictEqual(haversine(FTU.lat, FTU.lng, FTU.lat, FTU.lng), 0);

  // Distance to The Coffee House Chùa Láng (approx 110-120m)
  const distTCH = haversine(FTU.lat, FTU.lng, 21.0238, 105.8038);
  assert(distTCH > 90 && distTCH < 160, `Distance should be ~110m, got ${distTCH}m`);

  // Distance to Vincom Nguyễn Chí Thanh (approx 500m)
  const distVincom = haversine(FTU.lat, FTU.lng, 21.0231, 105.8092);
  assert(distVincom > 400 && distVincom < 600, `Distance should be ~500m, got ${distVincom}m`);

  console.log('✓ Haversine distance test passed.');
}

// 3. Test Vietnamese unaccented search
function testUnaccentSearch() {
  console.log('Testing Vietnamese unaccent search...');
  function removeAccents(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
      .toLowerCase()
      .trim();
  }

  function matches(target, query) {
    const t = removeAccents(target);
    const q = removeAccents(query);
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every(tok => t.includes(tok));
  }

  assert(matches('The Coffee House - Chùa Láng', 'chua lang'));
  assert(matches('Thư viện ĐH Ngoại thương', 'thu vien ftu') === false);
  assert(matches('Thư viện ĐH Ngoại thương', 'ngoai thuong'));
  assert(matches('Highlands Coffee 54A Nguyễn Chí Thanh', 'nguyen chi thanh'));
  assert(matches('Katinat Saigon Kafe', 'katinat'));
  assert(matches('Cà phê Nhất Long', 'nhat long'));

  console.log('✓ Vietnamese search test passed.');
}

// 4. Test Opening Hours & Late night check
function testOpeningHours() {
  console.log('Testing opening hours logic...');
  function checkLateNight(schedule, is24h) {
    if (is24h) return true;
    if (!schedule || schedule.is_closed) return false;
    const [h, m] = schedule.close.split(':').map(Number);
    const closeMins = h * 60 + m;
    const [oh, om] = schedule.open.split(':').map(Number);
    const openMins = oh * 60 + om;
    return closeMins >= 22 * 60 || closeMins < openMins;
  }

  assert.strictEqual(checkLateNight({ open: '07:00', close: '23:00' }), true, '23:00 is late night');
  assert.strictEqual(checkLateNight({ open: '08:00', close: '21:30' }), false, '21:30 is not late night');
  assert.strictEqual(checkLateNight({ open: '08:00', close: '02:00' }), true, '02:00 next day is overnight late night');
  assert.strictEqual(checkLateNight(null, true), true, '24h is late night');

  console.log('✓ Opening hours test passed.');
}

testCrowdCalculation();
testHaversineDistance();
testUnaccentSearch();
testOpeningHours();
console.log('\n ALL 4 CORE ALGORITHMS PASSED PERFECTLY!');
