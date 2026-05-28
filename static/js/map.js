/* 제주도 노을 맛집 — 카카오맵 + 일몰 방향 시각화 */

let map = null;
let markers = [];
let currentFan = null;
let currentArrow = null;
let currentSunOverlay = null;
let activeSpotCard = null;

// ─── 지도 초기화 ───────────────────────────────────────────────────────────
function initKakaoMap(spotsData, sunsetAzimuth) {
  const container = document.getElementById('map');
  if (!container) return;

  if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined') {
    showMapError('카카오맵 SDK를 불러오지 못했습니다.<br>도메인 등록을 확인해주세요.');
    return;
  }

  try {
    map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(33.4890, 126.4983),
      level: 9,
    });

    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    map.addControl(new kakao.maps.MapTypeControl(), kakao.maps.ControlPosition.TOPRIGHT);

    spotsData.forEach(spot => addSpotMarker(spot));

    // 초기 일몰 방향 (제주 중심 기준)
    drawDirectionFromCenter(sunsetAzimuth);

  } catch (e) {
    console.error('카카오맵 초기화 오류:', e);
    showMapError(
      '카카오맵 초기화 실패: ' + e.message +
      '<br><br>카카오 개발자 콘솔 → 내 앱 → 플랫폼 → Web →<br>' +
      '<strong>http://127.0.0.1:8000</strong> 을 추가해주세요.'
    );
  }
}

function showMapError(msg) {
  const container = document.getElementById('map');
  if (!container) return;
  container.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#1A1A1A;';
  container.innerHTML = `
    <div style="text-align:center;padding:40px;max-width:480px;">
      <div style="font-size:48px;margin-bottom:16px;">🗺️</div>
      <p style="color:#E8EAED;font-size:15px;line-height:1.8;">${msg}</p>
      <p style="color:#9AA0A6;font-size:13px;margin-top:12px;">
        👉 <a href="https://developers.kakao.com" target="_blank" style="color:#E8710A;">developers.kakao.com</a>
      </p>
    </div>
  `;
}

// ─── 마커 추가 ─────────────────────────────────────────────────────────────
function addSpotMarker(spot) {
  const pos = new kakao.maps.LatLng(spot.lat, spot.lng);
  const color = getScoreColor(spot.sunset_score);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
    <ellipse cx="20" cy="48" rx="8" ry="4" fill="rgba(0,0,0,0.20)"/>
    <path d="M20 2 C10 2 2 10 2 20 C2 34 20 48 20 48 C20 48 38 34 38 20 C38 10 30 2 20 2Z"
          fill="${color}" stroke="#111111" stroke-width="2"/>
    <text x="20" y="23" text-anchor="middle" fill="#111111" font-size="13"
          font-weight="bold" font-family="Arial,sans-serif">${spot.sunset_score}</text>
    <text x="20" y="33" text-anchor="middle" fill="rgba(0,0,0,0.75)"
          font-size="8" font-family="Arial,sans-serif">점</text>
  </svg>`;

  const markerImage = new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    new kakao.maps.Size(40, 52),
    { offset: new kakao.maps.Point(20, 52) }
  );

  const marker = new kakao.maps.Marker({ position: pos, image: markerImage, title: spot.name });
  marker.setMap(map);
  markers.push(marker);

  kakao.maps.event.addListener(marker, 'click', () => onSpotClick(spot));
}

function getScoreColor(score) {
  if (score >= 80) return '#FF6B1A';   // 짙은 오렌지
  if (score >= 60) return '#E8710A';   // 딥 오렌지
  if (score >= 40) return '#C45C08';   // 다크 오렌지
  return '#8A6040';                    // 브라운
}

// ─── 스팟 클릭 처리 ────────────────────────────────────────────────────────
async function onSpotClick(spot) {
  // 사이드바 카드 활성화
  highlightSidebarCard(spot.id);

  // 지도 이동
  if (map) {
    map.panTo(new kakao.maps.LatLng(spot.lat, spot.lng));
  }

  const selectedDate = getSelectedDate();

  try {
    const resp = await fetch(`/spots/api/sunset/?lat=${spot.lat}&lng=${spot.lng}&date=${selectedDate}`);
    const sunset = await resp.json();

    // 해당 스팟 좌표에서 일몰 방향 그리기
    drawDirectionFromSpot(spot.lat, spot.lng, sunset.azimuth);

    // 사이드바 일몰 정보 업데이트
    updateSidebarSunset(sunset);

    // 팝업 표시
    showSpotPopup(spot, sunset);

  } catch (e) {
    console.error('일몰 정보 로드 실패:', e);
    showSpotPopup(spot, null);
  }
}

// ─── 일몰 방향 그리기 ──────────────────────────────────────────────────────
function clearDirectionOverlays() {
  if (currentFan)       { currentFan.setMap(null);       currentFan = null; }
  if (currentArrow)     { currentArrow.setMap(null);     currentArrow = null; }
  if (currentSunOverlay){ currentSunOverlay.setMap(null); currentSunOverlay = null; }
}

function drawDirectionFromSpot(lat, lng, azimuth) {
  if (!map) return;
  clearDirectionOverlays();

  const origin  = new kakao.maps.LatLng(lat, lng);
  const fanDeg  = 25;
  const distKm  = 7;

  const left  = pointAtBearing(lat, lng, azimuth - fanDeg, distKm);
  const tip   = pointAtBearing(lat, lng, azimuth,           distKm);
  const right = pointAtBearing(lat, lng, azimuth + fanDeg, distKm);

  // 부채꼴 (반투명 채움)
  currentFan = new kakao.maps.Polygon({
    path: [
      origin,
      new kakao.maps.LatLng(left.lat, left.lng),
      new kakao.maps.LatLng(tip.lat,  tip.lng),
      new kakao.maps.LatLng(right.lat, right.lng),
    ],
    strokeWeight:  2,
    strokeColor:   '#0A71E8',
    strokeOpacity: 0.65,
    fillColor:     '#0A71E8',
    fillOpacity:   0.15,
  });
  currentFan.setMap(map);

  // 화살표 중심선
  currentArrow = new kakao.maps.Polyline({
    path: [origin, new kakao.maps.LatLng(tip.lat, tip.lng)],
    strokeWeight:  3,
    strokeColor:   '#0A71E8',
    strokeOpacity: 0.9,
    strokeStyle:   'solid',
  });
  currentArrow.setMap(map);

  // 원점 태양 아이콘 (역필터로 원래 색상 복구)
  currentSunOverlay = new kakao.maps.CustomOverlay({
    content:  '<div style="filter:invert(1) hue-rotate(180deg) brightness(1.14) saturate(1.25);width:32px;height:32px;background:radial-gradient(circle,#fbbf24,#F28482);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 10px rgba(242,132,130,0.6);">☀️</div>',
    position: origin,
    yAnchor:  0.5,
    xAnchor:  0.5,
  });
  currentSunOverlay.setMap(map);
}

function drawDirectionFromCenter(azimuth) {
  drawDirectionFromSpot(33.4890, 126.4983, azimuth);
}

// 방위각 + 거리(km) → 위경도 변환
function pointAtBearing(lat, lng, bearingDeg, distKm) {
  const R    = 6371;
  const d    = distKm / R;
  const lat1 = lat * Math.PI / 180;
  const lng1 = lng * Math.PI / 180;
  const brng = bearingDeg * Math.PI / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );

  return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
}

// ─── 팝업 ──────────────────────────────────────────────────────────────────
function showSpotPopup(spot, sunset) {
  const popup   = document.getElementById('spot-popup');
  const content = document.getElementById('popup-content');

  const imgHtml = spot.cover
    ? `<img src="${spot.cover}" class="popup-img" alt="${spot.name}">`
    : `<div class="popup-img-placeholder">🌅</div>`;

  const sunsetHtml = sunset
    ? `<div class="popup-sunset">🌅 일몰 ${sunset.sunset_time} · ${sunset.direction_kor} (${sunset.azimuth}°)</div>`
    : '';

  const ratingHtml = spot.avg_rating > 0
    ? `⭐ ${spot.avg_rating} (${spot.review_count}개 후기)`
    : '아직 후기가 없어요';

  content.innerHTML = `
    ${imgHtml}
    <div class="popup-body">
      <div class="popup-name">${spot.name}</div>
      <div class="popup-address">📍 ${spot.address}</div>
      ${sunsetHtml}
      <div class="popup-score">🌅 오늘 노을 점수: <strong>${spot.sunset_score}점</strong> · ${ratingHtml}</div>
      <a href="/spots/${spot.id}/" class="btn btn-primary btn-full" style="margin-top:4px;">자세히 보기 →</a>
    </div>
  `;

  popup.classList.remove('hidden');
}

function closePopup() {
  document.getElementById('spot-popup').classList.add('hidden');
}

// ─── 사이드바 명소 카드 렌더링 ─────────────────────────────────────────────
function renderSidebarSpots(spotsData) {
  const list = document.getElementById('sidebar-spots-list');
  if (!list) return;

  list.innerHTML = spotsData.map(spot => {
    const imgHtml = spot.cover
      ? `<img src="${spot.cover}" class="sidebar-spot-img" alt="${spot.name}" loading="lazy">`
      : `<div class="sidebar-spot-img-placeholder">🌅</div>`;

    const rating = spot.avg_rating > 0 ? `⭐ ${spot.avg_rating}` : '후기 없음';

    return `
      <div class="sidebar-spot-card" id="sidebar-card-${spot.id}" onclick="onSpotClick(${JSON.stringify(spot).replace(/"/g, '&quot;')})">
        ${imgHtml}
        <div class="sidebar-spot-info">
          <div class="sidebar-spot-name">${spot.name}</div>
          <div class="sidebar-spot-meta">
            <span class="sidebar-spot-score">🌅 ${spot.sunset_score}점</span>
            <span>${rating}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function highlightSidebarCard(spotId) {
  if (activeSpotCard) activeSpotCard.classList.remove('active');
  const card = document.getElementById(`sidebar-card-${spotId}`);
  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    activeSpotCard = card;
  }
}

// ─── 사이드바 일몰 정보 업데이트 ───────────────────────────────────────────
function updateSidebarSunset(sunset) {
  const timeEl = document.getElementById('sidebar-sunset-time');
  const dirEl  = document.getElementById('sidebar-sunset-dir');
  if (timeEl) timeEl.textContent = `일몰 ${sunset.sunset_time}`;
  if (dirEl)  dirEl.textContent  = `${sunset.direction_kor} · ${sunset.azimuth}°`;
}

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────
function getSelectedDate() {
  const picker = document.getElementById('date-picker');
  return picker ? picker.value : getTodayString();
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

// 날짜 변경 시 제주 중심 기준 방향 갱신
async function onDateChange() {
  const date = getSelectedDate();
  try {
    const resp = await fetch(`/spots/api/sunset/?lat=33.4890&lng=126.4983&date=${date}`);
    const sunset = await resp.json();
    drawDirectionFromCenter(sunset.azimuth);
    updateSidebarSunset(sunset);
    closePopup();
  } catch (e) {
    console.error('날짜별 일몰 계산 실패:', e);
  }
}

// ─── 명소 검색 (SPOTS_DATA 부분 문자열 필터) ──────────────────────────────

function searchPlaces() {
  const keyword = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const headerEl = document.getElementById('sidebar-list-header');
  const listEl   = document.getElementById('sidebar-spots-list');
  if (!headerEl || !listEl) return;

  if (!keyword) {
    resetSearch();
    return;
  }

  if (typeof SPOTS_DATA === 'undefined') return;

  const results = SPOTS_DATA.filter(s => {
    const name    = (s.name    || '').toLowerCase();
    const address = (s.address || '').toLowerCase();
    const tags    = Array.isArray(s.tags) ? s.tags.join(' ').toLowerCase() : '';
    return name.includes(keyword) || address.includes(keyword) || tags.includes(keyword);
  });

  if (results.length === 0) {
    headerEl.textContent = '검색 결과 없음';
    listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">"${keyword}" 결과가 없습니다.</div>`;
    return;
  }

  headerEl.textContent = `검색 결과 (${results.length}건)`;
  renderSidebarSpots(results);

  if (map && results.length === 1) {
    map.setCenter(new kakao.maps.LatLng(results[0].lat, results[0].lng));
    map.setLevel(5);
  } else if (map && results.length > 1) {
    const bounds = new kakao.maps.LatLngBounds();
    results.forEach(s => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng)));
    map.setBounds(bounds, 60);
  }
}

function resetSearch() {
  const headerEl = document.getElementById('sidebar-list-header');
  if (headerEl) headerEl.textContent = '🔥 오늘 추천 명소';
  if (typeof SPOTS_DATA !== 'undefined') renderSidebarSpots(SPOTS_DATA);
}

// ─── 태양 경로 시각화 ─────────────────────────────────────────────────────
let sunPathPolylines = [];
let sunPathDotOverlays = [];
let sunPathVisible = false;

function clearSunPath() {
  sunPathPolylines.forEach(p => p.setMap(null));
  sunPathPolylines = [];
  sunPathDotOverlays.forEach(o => o.setMap(null));
  sunPathDotOverlays = [];
}

let _sunAnimStyleAdded = false;
function _ensureSunAnimStyle() {
  if (_sunAnimStyleAdded) return;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes sunPulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1}50%{transform:translate(-50%,-50%) scale(1.35);opacity:0.65}}
    @keyframes sunRing{0%{transform:translate(-50%,-50%) scale(1);opacity:0.7}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}
  `;
  document.head.appendChild(s);
  _sunAnimStyleAdded = true;
}

function drawSunPath(data) {
  if (!map || !data.positions || data.positions.length === 0) return;
  clearSunPath();
  _ensureSunAnimStyle();

  const RADIUS_KM = 38;
  const JEJU_LAT  = 33.4890;
  const JEJU_LNG  = 126.4983;
  const positions = data.positions;

  const pathPoints = positions.map(p => {
    const pt = pointAtBearing(JEJU_LAT, JEJU_LNG, p.azimuth, RADIUS_KM);
    return { latlng: new kakao.maps.LatLng(pt.lat, pt.lng), time: p.time, elevation: p.elevation };
  });

  const maxEl = Math.max(...positions.map(p => p.elevation));

  // ── 아크 렌더링: 글로우 레이어 + 선명 레이어 ──────────────────────────────
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const frac  = i / (pathPoints.length - 1);
    const color = frac < 0.5
      ? interpolateColor('#FF8C00', '#FFE033', frac * 2)
      : interpolateColor('#FFE033', '#FF4D4D', (frac - 0.5) * 2);
    const elFrac = Math.max(0, positions[i].elevation) / maxEl;
    const opacity = 0.45 + elFrac * 0.45;

    // 글로우
    const glow = new kakao.maps.Polyline({
      path: [pathPoints[i].latlng, pathPoints[i+1].latlng],
      strokeWeight: 10, strokeColor: color, strokeOpacity: 0.18, strokeStyle: 'solid',
    });
    glow.setMap(map);
    sunPathPolylines.push(glow);

    // 메인
    const line = new kakao.maps.Polyline({
      path: [pathPoints[i].latlng, pathPoints[i+1].latlng],
      strokeWeight: 4, strokeColor: color, strokeOpacity: opacity, strokeStyle: 'solid',
    });
    line.setMap(map);
    sunPathPolylines.push(line);
  }

  // ── 매 정시 마커 ────────────────────────────────────────────────────────────
  const seenHours = new Set();
  pathPoints.forEach((pt, i) => {
    const [h, m] = pt.time.split(':').map(Number);
    if (m > 14 || seenHours.has(h)) return;
    seenHours.add(h);
    const frac  = i / (pathPoints.length - 1);
    const color = frac < 0.5
      ? interpolateColor('#FF8C00', '#FFE033', frac * 2)
      : interpolateColor('#FFE033', '#FF4D4D', (frac - 0.5) * 2);
    const marker = new kakao.maps.CustomOverlay({
      content: `<div style="filter:invert(1) hue-rotate(180deg) brightness(1.14) saturate(1.25);display:flex;flex-direction:column;align-items:center;transform:translateX(-50%)">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};border:1.5px solid white;box-shadow:0 0 5px ${color}CC;"></div>
        <div style="margin-top:3px;font-size:10px;color:white;background:rgba(0,0,0,0.55);padding:1px 5px;border-radius:4px;font-weight:600;white-space:nowrap;">${h}시</div>
      </div>`,
      position: pt.latlng, yAnchor: 0, xAnchor: 0.5,
    });
    marker.setMap(map);
    sunPathDotOverlays.push(marker);
  });

  // ── 일출 ────────────────────────────────────────────────────────────────────
  const addLabel = (latlng, html, yAnchor) => {
    const o = new kakao.maps.CustomOverlay({ content: html, position: latlng, yAnchor, xAnchor: 0.5 });
    o.setMap(map);
    sunPathDotOverlays.push(o);
  };
  addLabel(pathPoints[0].latlng,
    `<div style="filter:invert(1) hue-rotate(180deg) brightness(1.14) saturate(1.25);display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="background:rgba(20,10,0,0.72);color:#FFAA44;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,170,68,0.45);white-space:nowrap;">🌅 일출 ${data.sunrise_time}</div>
      <div style="width:13px;height:13px;border-radius:50%;background:#FF8C00;border:2px solid white;box-shadow:0 0 10px #FF8C0099;"></div>
    </div>`, 1.0);

  // ── 일몰 ────────────────────────────────────────────────────────────────────
  const lastPt = pathPoints[pathPoints.length - 1];
  addLabel(lastPt.latlng,
    `<div style="filter:invert(1) hue-rotate(180deg) brightness(1.14) saturate(1.25);display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="background:rgba(20,10,0,0.72);color:#FF8080;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,128,128,0.45);white-space:nowrap;">🌇 일몰 ${data.sunset_time}</div>
      <div style="width:13px;height:13px;border-radius:50%;background:#FF4D4D;border:2px solid white;box-shadow:0 0 10px #FF4D4D99;"></div>
    </div>`, 1.0);

  // ── 남중(태양 최고도) ────────────────────────────────────────────────────────
  let noonIdx = pathPoints.findIndex(p => p.time === data.solar_noon);
  if (noonIdx < 0) noonIdx = Math.floor(pathPoints.length / 2);
  addLabel(pathPoints[noonIdx].latlng,
    `<div style="filter:invert(1) hue-rotate(180deg) brightness(1.14) saturate(1.25);background:rgba(20,20,0,0.72);color:#FFE033;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;border:1px solid rgba(255,224,51,0.45);white-space:nowrap;">☀️ 남중 ${data.solar_noon}</div>`,
    1.8);

  // ── 현재 태양 위치 (오늘만) ──────────────────────────────────────────────────
  if (data.date === TODAY_STR) {
    const now   = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let   bestIdx = -1, minDiff = Infinity;
    pathPoints.forEach((pt, i) => {
      const [h, m] = pt.time.split(':').map(Number);
      const diff = Math.abs(h * 60 + m - nowMin);
      if (diff < minDiff) { minDiff = diff; bestIdx = i; }
    });
    if (bestIdx >= 0 && minDiff <= 20) {
      addLabel(pathPoints[bestIdx].latlng,
        `<div style="filter:invert(1) hue-rotate(180deg) brightness(1.14) saturate(1.25);position:relative;width:22px;height:22px;">
          <div style="position:absolute;top:50%;left:50%;width:20px;height:20px;border-radius:50%;background:rgba(255,224,51,0.35);animation:sunRing 1.8s ease-out infinite;"></div>
          <div style="position:absolute;top:50%;left:50%;width:14px;height:14px;border-radius:50%;background:#FFE033;border:2.5px solid white;box-shadow:0 0 14px #FFE033CC;animation:sunPulse 2.2s ease-in-out infinite;"></div>
        </div>`, 0.5);
    }
  }
}

function interpolateColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
  const r  = Math.round(r1 + (r2 - r1) * t);
  const g  = Math.round(g1 + (g2 - g1) * t);
  const b  = Math.round(b1 + (b2 - b1) * t);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

async function toggleSunPath() {
  const btn = document.getElementById('sun-path-btn');
  if (sunPathVisible) {
    clearSunPath();
    sunPathVisible = false;
    if (btn) { btn.textContent = '☀️ 해 경로 보기'; btn.classList.remove('active'); }
    return;
  }

  const date = getSelectedDate();
  if (btn) btn.textContent = '로딩 중...';

  try {
    const resp = await fetch(`/spots/api/sun-path/?date=${date}`);
    const data = await resp.json();

    if (data.positions && data.positions.length > 0) {
      drawSunPath(data);
      sunPathVisible = true;
      if (btn) { btn.textContent = '☀️ 해 경로 숨기기'; btn.classList.add('active'); }

      // 줌 아웃해서 제주 전체를 보여줌
      if (map) {
        map.setCenter(new kakao.maps.LatLng(33.4890, 126.4983));
        map.setLevel(10);
      }
    } else {
      if (btn) btn.textContent = '☀️ 해 경로 보기';
    }
  } catch (e) {
    console.error('태양 경로 로드 실패:', e);
    if (btn) btn.textContent = '☀️ 해 경로 보기';
  }
}

// ─── 점수 기준 안내 모달 ───────────────────────────────────────────────────
function openCriteriaModal() {
  const existing = document.getElementById('criteria-modal-bg');
  if (existing) { existing.remove(); return; }

  const html = `
    <div id="criteria-modal-bg" class="criteria-modal-bg" onclick="closeCriteriaModal(event)">
      <div class="criteria-modal" onclick="event.stopPropagation()">
        <h3>🌅 노을 점수 산정 기준</h3>
        <p class="criteria-subtitle">최고 점수 100점 · 4가지 항목의 합산</p>
        <div class="criteria-item">
          <div class="criteria-item-header">
            <span class="criteria-item-name">🧭 방향 일치도</span>
            <span class="criteria-item-max">최대 40점</span>
          </div>
          <div class="criteria-item-desc">오늘의 실제 일몰 방향과 명소에서 노을을 바라보는 방향이 얼마나 일치하는지 계산합니다. 각도 차이가 0°에 가까울수록 만점에 가깝습니다.</div>
        </div>
        <div class="criteria-item">
          <div class="criteria-item-header">
            <span class="criteria-item-name">👁️ 시야 개방도</span>
            <span class="criteria-item-max">최대 30점</span>
          </div>
          <div class="criteria-item-desc">완전 개방 30점 (바다·들판 무장애 파노라마) · 양호 20점 (시야 대부분 확보) · 부분 차단 10점 (건물·나무 등 장애물 있음)</div>
        </div>
        <div class="criteria-item">
          <div class="criteria-item-header">
            <span class="criteria-item-name">🚗 접근 용이성</span>
            <span class="criteria-item-max">최대 20점</span>
          </div>
          <div class="criteria-item-desc">매우 좋음 20점 (차에서 바로) · 좋음 15점 (5분 이내 도보·주차) · 보통 10점 (10분 이상 도보) · 어려움 5점 (등산·험로)</div>
        </div>
        <div class="criteria-item">
          <div class="criteria-item-header">
            <span class="criteria-item-name">🏛️ 공식 관광지</span>
            <span class="criteria-item-max">보너스 10점</span>
          </div>
          <div class="criteria-item-desc">제주도 지정 관광지·국립공원·도립공원 등 공식 명소에는 안전시설·편의시설 보너스 10점을 부여합니다.</div>
        </div>
        <button onclick="closeCriteriaModal()" style="width:100%;margin-top:16px;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;">닫기</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
}

function closeCriteriaModal(event) {
  const modal = document.getElementById('criteria-modal-bg');
  if (modal) modal.remove();
}
