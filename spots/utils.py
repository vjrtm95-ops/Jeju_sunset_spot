from astral import LocationInfo
from astral.sun import sun, azimuth as calc_azimuth, elevation as calc_elevation
from datetime import date, timedelta
from zoneinfo import ZoneInfo
import requests
from django.conf import settings


JEJU_CENTER = LocationInfo("Jeju", "Korea", "Asia/Seoul", 33.4890, 126.4983)
SEOUL_TZ    = ZoneInfo("Asia/Seoul")

# ── 점수 테이블 ──────────────────────────────────────────────────────────────
_OPENNESS_SCORE   = {1: 10, 2: 20, 3: 30}
_ACCESS_SCORE     = {1: 5,  2: 10, 3: 15, 4: 20}
OFFICIAL_BONUS    = 10
DIRECTION_MAX     = 40          # 방향 일치도 최대 점수


def _direction_score(spot_azimuth, sunset_azimuth):
    diff = abs(spot_azimuth - sunset_azimuth)
    if diff > 180:
        diff = 360 - diff
    return max(0, round(DIRECTION_MAX * (1 - diff / 90)))


def score_spot_detailed(spot, sunset_azimuth):
    """명소별 다요소 점수 계산 — dict 반환"""
    d_score = _direction_score(spot.view_azimuth, sunset_azimuth)
    o_score = _OPENNESS_SCORE.get(spot.view_openness, 20)
    a_score = _ACCESS_SCORE.get(spot.accessibility, 15)
    b_score = OFFICIAL_BONUS if spot.is_official else 0
    total   = min(100, d_score + o_score + a_score + b_score)
    return {
        'total':         total,
        'direction':     d_score,
        'openness':      o_score,
        'accessibility': a_score,
        'official':      b_score,
    }


def score_spot_for_today(spot_view_azimuth, sunset_azimuth,
                          view_openness=2, accessibility=3, is_official=False):
    """단순 점수 반환 (레거시 호환 유지)"""
    d = _direction_score(spot_view_azimuth, sunset_azimuth)
    o = _OPENNESS_SCORE.get(view_openness, 20)
    a = _ACCESS_SCORE.get(accessibility, 15)
    b = OFFICIAL_BONUS if is_official else 0
    return min(100, d + o + a + b)


# ── 일몰 계산 ────────────────────────────────────────────────────────────────
def get_sunset_for_location(lat, lng, target_date):
    """임의 위치·날짜의 일몰 정보"""
    try:
        loc = LocationInfo("Spot", "Korea", "Asia/Seoul", lat, lng)
        s   = sun(loc.observer, date=target_date, tzinfo=SEOUL_TZ)
        t   = s['sunset']
        az  = calc_azimuth(loc.observer, t)
        return {
            'sunset_time':   t.strftime('%H:%M'),
            'azimuth':       round(float(az), 1),
            'direction_kor': azimuth_to_korean(az),
            'direction_en':  azimuth_to_english(az),
            'date':          target_date.strftime('%Y-%m-%d'),
        }
    except Exception:
        return {
            'sunset_time': '19:00', 'azimuth': 280.0,
            'direction_kor': '서북서', 'direction_en': 'WNW',
            'date': target_date.strftime('%Y-%m-%d'),
        }


def get_sunset_info():
    """오늘 제주 중심 일몰 정보"""
    return get_sunset_for_location(33.4890, 126.4983, date.today())


# ── 태양 경로 ────────────────────────────────────────────────────────────────
def get_sun_path(target_date):
    """하루 동안 태양의 방위각·고도 경로 (15분 간격)"""
    try:
        s        = sun(JEJU_CENTER.observer, date=target_date, tzinfo=SEOUL_TZ)
        sunrise  = s['sunrise']
        sunset_t = s['sunset']
        noon     = s['noon']

        positions = []
        current   = sunrise
        while current <= sunset_t:
            az = calc_azimuth(JEJU_CENTER.observer, current)
            el = calc_elevation(JEJU_CENTER.observer, current)
            if float(el) >= -1:
                positions.append({
                    'time':      current.strftime('%H:%M'),
                    'azimuth':   round(float(az), 1),
                    'elevation': round(float(el), 1),
                })
            current = current + timedelta(minutes=15)

        return {
            'sunrise_time':     sunrise.strftime('%H:%M'),
            'sunset_time':      sunset_t.strftime('%H:%M'),
            'solar_noon':       noon.strftime('%H:%M'),
            'sunrise_azimuth':  round(float(calc_azimuth(JEJU_CENTER.observer, sunrise)), 1),
            'sunset_azimuth':   round(float(calc_azimuth(JEJU_CENTER.observer, sunset_t)), 1),
            'positions':        positions,
            'date':             target_date.strftime('%Y-%m-%d'),
        }
    except Exception:
        return {'positions': [], 'sunrise_time': '06:00', 'sunset_time': '19:00',
                'solar_noon': '12:30', 'sunrise_azimuth': 65.0, 'sunset_azimuth': 295.0,
                'date': target_date.strftime('%Y-%m-%d')}


# ── 방위각 → 방향 변환 ───────────────────────────────────────────────────────
def azimuth_to_korean(az):
    dirs = ['북','북북동','북동','동북동','동','동남동','남동','남남동',
            '남','남남서','남서','서남서','서','서북서','북서','북북서']
    return dirs[round(az / 22.5) % 16]


def azimuth_to_english(az):
    dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
            'S','SSW','SW','WSW','W','WNW','NW','NNW']
    return dirs[round(az / 22.5) % 16]


# ── 날씨 ────────────────────────────────────────────────────────────────────
def get_jeju_weather():
    api_key = settings.OPENWEATHER_API_KEY
    if not api_key:
        return None
    try:
        resp = requests.get(
            'https://api.openweathermap.org/data/2.5/weather',
            params={'lat': 33.4890, 'lon': 126.4983, 'appid': api_key,
                    'units': 'metric', 'lang': 'kr'},
            timeout=5
        )
        if resp.status_code == 200:
            d = resp.json()
            clouds = d['clouds']['all']
            return {
                'temp':          round(d['main']['temp']),
                'feels_like':    round(d['main']['feels_like']),
                'description':   d['weather'][0]['description'],
                'humidity':      d['main']['humidity'],
                'wind_speed':    round(d['wind']['speed'] * 3.6, 1),
                'icon':          d['weather'][0]['icon'],
                'clouds':        clouds,
                'visibility':    d.get('visibility', 10000) // 1000,
                'sunset_quality': _sunset_quality(clouds),
            }
    except Exception:
        pass
    return None


def _sunset_quality(cloud_pct):
    if cloud_pct < 20:
        return {'level': '맑음',     'score': 90, 'emoji': '🌅', 'color': '#f97316'}
    elif cloud_pct < 50:
        return {'level': '부분 구름', 'score': 70, 'emoji': '🌤', 'color': '#fbbf24'}
    elif cloud_pct < 80:
        return {'level': '흐림',     'score': 40, 'emoji': '⛅', 'color': '#94a3b8'}
    else:
        return {'level': '매우 흐림', 'score': 15, 'emoji': '☁️', 'color': '#64748b'}
