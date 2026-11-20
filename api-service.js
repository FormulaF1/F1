// =========================================================
// 2. API SERVICE & CACHING (การเชื่อมต่อฐานข้อมูลและ F1 API v2.0)
// =========================================================

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwZ_VB9I7ClOgDpd8bDkaY09CzipETJMeQPDK6Qk6JYVNPdgfXA6ZrmXDG8gYsJ9I6u/exec";

const apiCache = new Map();
const pendingRequests = new Map();

// ระบบแคชและรวมคำขอซ้ำสำหรับ OpenF1 & Jolpica API เพื่อลดอาการหน่วงและกันติด Rate Limit (429)
const openF1Cache = new Map();
const openF1Pending = new Map();
const OPENF1_CACHE_TTL = 120000; // 2 นาที

const jolpicaCache = new Map();
const JOLPICA_CACHE_TTL = 300000; // 5 นาที

// Helper สำหรับตัดวรรณยุกต์พิเศษ (เช่น Pérez -> perez, Hülkenberg -> hulkenberg)
function cleanTextForMatch(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ดึงข้อมูลจาก OpenF1 แบบมี Cache + ป้องกันการแคชค่า Error + รวม Request ที่ยิงซ้ำพร้อมกัน
async function fetchOpenF1Cached(url, customTtl = OPENF1_CACHE_TTL) {
  const now = Date.now();
  if (openF1Cache.has(url)) {
    const cached = openF1Cache.get(url);
    if (now - cached.timestamp < customTtl) {
      return cached.data;
    }
  }

  if (openF1Pending.has(url)) {
    return openF1Pending.get(url);
  }

  const reqPromise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OpenF1 HTTP ${response.status}`);
      }
      const data = await response.json();
      openF1Cache.set(url, { data, timestamp: Date.now() });
      return data;
    } finally {
      openF1Pending.delete(url);
    }
  })();

  openF1Pending.set(url, reqPromise);
  return reqPromise;
}

// ดึงข้อมูลจาก Jolpica API แบบมี Cache
async function fetchJolpicaCached(url, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && jolpicaCache.has(url)) {
    const cached = jolpicaCache.get(url);
    if (now - cached.timestamp < JOLPICA_CACHE_TTL) {
      return cached.data;
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Jolpica HTTP ${response.status}`);
  }
  const data = await response.json();
  jolpicaCache.set(url, { data, timestamp: now });
  return data;
}

// เชื่อมต่อ Google Apps Script Backend
async function callGAS(action, payload = {}, options = { useCache: false, ttl: 30000 }) {
  const cacheKey = action + "_" + JSON.stringify(payload);

  if (options.useCache && apiCache.has(cacheKey)) {
    const cached = apiCache.get(cacheKey);
    if (Date.now() - cached.timestamp < (options.ttl || 30000)) {
      return cached.data;
    }
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // ขยายเวลา Timeout เป็น 30 วินาทีสำหรับ AI Race Engineer และงานคำนวณของ Admin
  const isHeavyTask = action === "askRaceEngineer" || action === "saveResultAndCalculate" || action.startsWith("admin");
  const timeoutMs = options.timeout || (isHeavyTask ? 30000 : 18000);

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ action: action }, payload)),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GAS HTTP ${response.status}`);
      }

      const result = await response.json();

      // ล้าง Cache หน้าเว็บอัตโนมัติเมื่อมีการอัปเดตข้อมูลสำคัญ
      if (["submitPrediction", "registerPlayer", "saveResultAndCalculate", "adminUpdateRaceSettings", "adminSaveTrackMediaLinks"].includes(action)) {
        apiCache.clear();
      } else if (options.useCache && result && result.success !== false) {
        apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
      }

      return result;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('การเชื่อมต่อใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ดึงตารางคะแนนนักแข่งโลก (WDC)
async function fetchF1Standings(forceRefresh = false) {
  try {
    const data = await fetchJolpicaCached('https://api.jolpi.ca/ergast/f1/current/driverStandings.json', forceRefresh);
    const lists = data?.MRData?.StandingsTable?.StandingsLists;
    if (!lists || lists.length === 0) return;

    const standings = lists[0].DriverStandings || [];
    const container = document.getElementById('driverStandingsList') || document.querySelector('.f1-official-standings');
    if (!container) return;

    const rowsArray = Array.from(container.querySelectorAll('.f1-standings-row'));

    standings.forEach(driverData => {
      const apiFamilyName = cleanTextForMatch(driverData?.Driver?.familyName);
      if (!apiFamilyName) return;

      const points = driverData.points || '0';
      const position = driverData.position || driverData.positionText || '-';

      const targetRow = rowsArray.find(row => {
        const nameEl = row.querySelector('.driver-name');
        if (!nameEl) return false;
        const htmlName = cleanTextForMatch(nameEl.innerText);
        return htmlName.includes(apiFamilyName);
      });

      if (targetRow) {
        const ptsEl = targetRow.querySelector('.col-pts');
        const posEl = targetRow.querySelector('.col-pos');
        if (ptsEl) ptsEl.innerText = points;
        if (posEl) posEl.innerText = position;
        targetRow.setAttribute('data-position', position);
      }
    });

    rowsArray.sort((a, b) => {
      const posA = parseInt(a.getAttribute('data-position'), 10) || 999;
      const posB = parseInt(b.getAttribute('data-position'), 10) || 999;
      return posA - posB;
    });

    const fragment = document.createDocumentFragment();
    rowsArray.forEach(row => fragment.appendChild(row));
    container.appendChild(fragment);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูลนักแข่ง F1 API:', error);
  }
}

// ดึงตารางคะแนนทีมผู้ผลิต (WCC)
async function fetchF1TeamStandings(forceRefresh = false) {
  try {
    const data = await fetchJolpicaCached('https://api.jolpi.ca/ergast/f1/current/constructorStandings.json', forceRefresh);
    const lists = data?.MRData?.StandingsTable?.StandingsLists;
    if (!lists || lists.length === 0) return;

    const standings = lists[0].ConstructorStandings || [];
    const container = document.getElementById('teamStandingsList') || document.querySelector('.f1-team-cards-container');
    if (!container) return;

    const rowsArray = Array.from(container.querySelectorAll('.team-card'));

    standings.forEach(teamData => {
      const apiTeamId = cleanTextForMatch(teamData?.Constructor?.constructorId);
      const apiTeamName = cleanTextForMatch(teamData?.Constructor?.name);
      if (!apiTeamId) return;

      const points = teamData.points || '0';
      const position = teamData.position || teamData.positionText || '-';

      const targetRow = rowsArray.find(row => {
        const nameEl = row.querySelector('.team-name');
        if (!nameEl) return false;
        const htmlName = cleanTextForMatch(nameEl.innerText);

        // จับคู่ชื่อทีมพิเศษระหว่าง API กับชื่อปี 2026 ในแอป
        if ((apiTeamId.includes('sauber') || apiTeamId.includes('audi')) && htmlName === 'audi') return true;
        if ((apiTeamId === 'rb' || apiTeamId.includes('vcarb') || apiTeamName.includes('racing bulls')) && htmlName === 'vcarb') return true;
        if (apiTeamId === 'red_bull' && htmlName.includes('red bull')) return true;
        if (apiTeamId.includes('aston') && htmlName.includes('aston')) return true;

        const firstWord = htmlName.split(' ')[0];
        return htmlName.includes(apiTeamId) || (firstWord.length > 2 && apiTeamId.includes(firstWord));
      });

      if (targetRow) {
        const ptsEl = targetRow.querySelector('.col-pts');
        const posEl = targetRow.querySelector('.col-pos');
        if (ptsEl) ptsEl.innerText = points;
        if (posEl) posEl.innerText = position;
        targetRow.setAttribute('data-position', position);
      }
    });

    rowsArray.sort((a, b) => {
      const posA = parseInt(a.getAttribute('data-position'), 10) || 999;
      const posB = parseInt(b.getAttribute('data-position'), 10) || 999;
      return posA - posB;
    });

    const fragment = document.createDocumentFragment();
    rowsArray.forEach(row => fragment.appendChild(row));
    container.appendChild(fragment);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูลคะแนนทีม:', error);
  }
}

// ดึงสภาพอากาศสดจากสนามล่าสุดผ่าน OpenF1
async function fetchLiveWeather() {
  try {
    const data = await fetchOpenF1Cached('https://api.openf1.org/v1/weather?session_key=latest');

    if (Array.isArray(data) && data.length > 0) {
      const latestWeather = data[data.length - 1];
      const isRaining = Number(latestWeather.rainfall) > 0;
      const weatherIcon = isRaining ? '🌧️' : '☀️';

      const weatherHtml = `
        <div class="d-flex flex-column align-items-end">
          <div>
            <span class="weather-icon-animated me-1">${weatherIcon}</span>
            Air: ${latestWeather.air_temperature}°C | Track: ${latestWeather.track_temperature}°C
          </div>
          <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">
            <i class="fa-solid fa-wind me-1"></i>ลม: ${latestWeather.wind_speed} m/s | 
            <i class="fa-solid fa-gauge me-1"></i>กดอากาศ: ${latestWeather.pressure} mbar
          </div>
        </div>
      `;

      const weatherEl = document.getElementById('rcWeather');
      if (weatherEl) {
        weatherEl.innerHTML = weatherHtml;
        weatherEl.classList.remove('weather-icon-animated');
      }
    }
  } catch (error) {
    console.error('❌ OpenF1 Weather API Error:', error);
  }
}

function formatLapTime(seconds) {
  if (!seconds || isNaN(seconds)) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3).padStart(6, '0');
  return mins > 0 ? `${mins}:${secs}` : `${secs}s`;
}

// จับคู่ชื่อนักแข่งจาก API เข้ากับคีย์มาตรฐานใน DRIVER_INFO
function resolveAppDriverName(apiDriver) {
  if (!apiDriver || typeof DRIVER_INFO === 'undefined') {
    return apiDriver?.full_name || 'Driver';
  }
  const apiLast = cleanTextForMatch(apiDriver.last_name);
  const apiFull = cleanTextForMatch(apiDriver.full_name);

  if (apiLast && apiLast.length >= 2) {
    const matched = Object.keys(DRIVER_INFO).find(name => {
      const cleanApp = cleanTextForMatch(name);
      const appLast = cleanApp.split(' ').pop();
      return cleanApp.includes(apiLast) || (appLast.length >= 2 && apiLast.includes(appLast));
    });
    if (matched) return matched;
  }

  if (apiFull && apiFull.length >= 3) {
    const matchedFull = Object.keys(DRIVER_INFO).find(name => cleanTextForMatch(name) === apiFull);
    if (matchedFull) return matchedFull;
  }

  return apiDriver.full_name || 'Driver';
}

// ดึงและคำนวณผลการแข่งขันแต่ละเซสชัน (Practice / Quali / Sprint / Race)
async function loadResultsSessionData(sessionKey, btnEl, targetContainer = null, disableHeroClick = false) {
  if (btnEl) {
    document.querySelectorAll('#resultsSessionBtnGroup button').forEach(b => {
      b.classList.remove('active', 'text-white', 'border-white');
    });
    btnEl.classList.add('active', 'text-white', 'border-white');
  }

  const list = targetContainer || document.getElementById('resultsSessionDataList');
  if (!list) return;
  list.innerHTML = '<div class="text-center py-5"><i class="fa-solid fa-spinner fa-spin text-danger fs-3 mb-2"></i><div class="text-secondary small f1-font">CALCULATING OFFICIAL CLASSIFICATION...</div></div>';

  try {
    const [sessionData, drivers, laps, standingsData] = await Promise.all([
      fetchOpenF1Cached(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`),
      fetchOpenF1Cached(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`),
      fetchOpenF1Cached(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`),
      fetchJolpicaCached('https://api.jolpi.ca/ergast/f1/current/driverStandings.json').catch(() => null)
    ]);

    const sessionName = (Array.isArray(sessionData) && sessionData[0]?.session_name)
      ? sessionData[0].session_name.toLowerCase()
      : '';
    const isRace = sessionName === 'race' || sessionName === 'sprint';

    const seasonStandings = {};
    const standingsLists = standingsData?.MRData?.StandingsTable?.StandingsLists;
    if (standingsLists && standingsLists.length > 0) {
      standingsLists[0].DriverStandings.forEach(ds => {
        const familyName = cleanTextForMatch(ds?.Driver?.familyName);
        if (familyName) {
          seasonStandings[familyName] = { points: ds.points || '0', position: 'P' + ds.position };
        }
      });
    }

    const driverStats = {};
    let sessionFastestLap = Infinity;

    if (Array.isArray(laps)) {
      laps.forEach(l => {
        const dNum = l.driver_number;
        if (!driverStats[dNum]) {
          driverStats[dNum] = { maxLap: 0, bestLap: Infinity, finishTime: Infinity };
        }
        if (l.lap_duration && l.lap_duration > 0) {
          if (l.lap_duration < driverStats[dNum].bestLap) driverStats[dNum].bestLap = l.lap_duration;
          if (l.lap_duration < sessionFastestLap) sessionFastestLap = l.lap_duration;
        }
        if (l.lap_number && l.lap_number >= driverStats[dNum].maxLap) {
          driverStats[dNum].maxLap = l.lap_number;
          if (l.date_start && l.lap_duration) {
            driverStats[dNum].finishTime = new Date(l.date_start).getTime() + (l.lap_duration * 1000);
          }
        }
      });
    }

    // กรองเลขรถซ้ำในเซสชันเดียวกัน (กรณี API ส่งข้อมูลซ้ำ)
    const uniqueDriversMap = new Map();
    (Array.isArray(drivers) ? drivers : []).forEach(d => {
      if (d && d.driver_number !== undefined && !uniqueDriversMap.has(d.driver_number)) {
        uniqueDriversMap.set(d.driver_number, d);
      }
    });

    let results = Array.from(uniqueDriversMap.values()).map(d => {
      const dNum = d.driver_number;
      const stats = driverStats[dNum] || { maxLap: 0, bestLap: Infinity, finishTime: Infinity };
      const appDriver = resolveAppDriverName(d);
      const apiLastName = cleanTextForMatch(d.last_name || appDriver.split(' ').pop());

      const fallbackColor = d.team_colour ? `#${String(d.team_colour).replace('#', '')}` : '#888888';
      const info = (typeof DRIVER_INFO !== 'undefined' && DRIVER_INFO[appDriver])
        ? DRIVER_INFO[appDriver]
        : { team: d.team_name || 'F1', color: fallbackColor, headshot: DEFAULT_DRIVER_IMG };

      const nameParts = appDriver.split(' ');
      const shortName = nameParts.length > 1
        ? `${nameParts[0].charAt(0)}. ${nameParts.slice(1).join(' ')}`
        : (d.name_acronym || appDriver);

      const seasonData = seasonStandings[apiLastName] || { points: '0', position: 'P-' };
      const rawHeadshot = info.headshot || info.img || d.headshot_url || DEFAULT_DRIVER_IMG;
      const headshotUrl = (typeof getDriveDirectLink === 'function') ? getDriveDirectLink(rawHeadshot) : rawHeadshot;

      return {
        driver_number: dNum,
        fullName: appDriver,
        shortName: shortName,
        team: info.team || d.team_name || 'F1',
        color: info.color || fallbackColor,
        headshot: headshotUrl,
        seasonPoints: seasonData.points,
        seasonPos: seasonData.position,
        maxLap: stats.maxLap,
        bestLap: stats.bestLap,
        finishTime: stats.finishTime,
        timeGap: '-'
      };
    });

    results = results.filter(r => r.maxLap > 0 || r.bestLap !== Infinity);

    if (isRace) {
      results.sort((a, b) => {
        if (b.maxLap !== a.maxLap) return b.maxLap - a.maxLap;
        return a.finishTime - b.finishTime;
      });

      if (results.length > 0) {
        const raceWinnerFinishTime = results[0].finishTime;
        const winnerLaps = results[0].maxLap;

        results.forEach((r, idx) => {
          r.pos = idx + 1;
          if (idx === 0) {
            r.timeGap = `${winnerLaps} Laps`;
          } else if (r.maxLap < winnerLaps) {
            const lapsBehind = winnerLaps - r.maxLap;
            r.timeGap = `+${lapsBehind} ${lapsBehind === 1 ? 'Lap' : 'Laps'}`;
          } else if (r.finishTime !== Infinity && raceWinnerFinishTime !== Infinity) {
            const diffSec = Math.max(0, (r.finishTime - raceWinnerFinishTime) / 1000);
            r.timeGap = `+${diffSec.toFixed(3)}s`;
          } else {
            r.timeGap = 'DNF';
          }
        });
      }
    } else {
      results.sort((a, b) => a.bestLap - b.bestLap);
      results.forEach((r, idx) => {
        r.pos = idx + 1;
        if (r.bestLap === Infinity) {
          r.timeGap = 'NO TIME';
        } else if (idx === 0) {
          r.timeGap = formatLapTime(r.bestLap);
        } else {
          const diff = r.bestLap - sessionFastestLap;
          r.timeGap = `+${diff.toFixed(3)}s`;
        }
      });
    }

    if (results.length === 0) {
      list.innerHTML = `<div class="text-center text-secondary py-4">ไม่มีข้อมูลเวลาในเซสชันนี้</div>`;
      return;
    }

    list.innerHTML = results.map((r, idx) => {
      const isFastestOverall = (r.bestLap === sessionFastestLap && sessionFastestLap !== Infinity);
      const canOpenHero = !disableHeroClick && typeof DRIVER_INFO !== 'undefined' && !!DRIVER_INFO[r.fullName];
      const rowStyle = canOpenHero ? 'cursor:pointer;' : '';
      const safeFullName = r.fullName.replace(/'/g, "\\'");
      const rowClick = canOpenHero
        ? `onclick="openDriverHeroCustom(this, '${safeFullName}', '${r.seasonPoints}', '${r.seasonPos}')"`
        : '';

      return `
        <div class="f1-standings-row" style="${rowStyle}" ${rowClick}>
          <div class="col-pos" style="width: 12%;">${r.pos}</div>
          <div class="col-driver" style="width: 53%;">
            <img src="${r.headshot}" class="driver-headshot" alt="${r.shortName}" loading="lazy" onerror="this.src='${DEFAULT_DRIVER_IMG}'">
            <div class="driver-info">
              <div class="driver-name text-white">${r.shortName} ${isFastestOverall ? '<i class="fa-solid fa-stopwatch text-purple ms-1" title="Fastest Lap"></i>' : ''}</div>
              <div class="team-name m-0" style="color: ${r.color};">${r.team}</div>
            </div>
          </div>
          <div class="col-pts text-end" style="width: 35%; font-family: 'Share Tech Mono', monospace; font-size: 0.85rem;">
            <span class="f1-time-pill ${idx === 0 ? 'winner-pill' : ''}">${r.timeGap}</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Session Results Error:', error);
    list.innerHTML = '<div class="text-center text-danger py-4">พบปัญหาในการดึงข้อมูล OpenF1 API<br><span class="small text-secondary">กรุณารอสักครู่แล้วลองใหม่อีกครั้ง</span></div>';
  }
}

// เปิดหน้าการ์ดเต็มจอนักแข่งเมื่อคลิกจากหน้า Results
function openDriverHeroCustom(rowEl, fullName, points, championshipPos) {
  if (typeof triggerHaptic === 'function') triggerHaptic();
  const info = (typeof DRIVER_INFO !== 'undefined') ? DRIVER_INFO[fullName] : null;
  if (!info) return;

  // ✅ ซิงค์ State ให้ตรงกับระบบ Touch Swipe ใน app-ui.js
  if (typeof currentHeroDriver !== 'undefined') currentHeroDriver = fullName;
  if (typeof isHeroInPredictMode !== 'undefined') isHeroInPredictMode = false;

  const radioBtn = document.getElementById('btnTeamRadio');
  if (radioBtn) radioBtn.style.setProperty('display', 'none', 'important');

  const parts = fullName.trim().split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  document.getElementById('heroDriverFirstName').innerText = firstName;
  document.getElementById('heroDriverLastName').innerText = lastName;
  document.getElementById('heroTeamName').innerText = info.team;
  document.getElementById('heroTeamLogo').src = getDriveDirectLink(TEAM_LOGOS[info.team] || '');
  document.getElementById('heroDriverImg').src = getDriveDirectLink(info.heroImg || info.img);

  const heroPtsEl = document.getElementById('heroPoints');
  const heroPosEl = document.getElementById('heroPos');
  const cleanPos = String(championshipPos || '-').startsWith('P') ? championshipPos : ('P' + championshipPos);
  if (heroPosEl) heroPosEl.innerText = cleanPos;

  const standardStatsEl = document.getElementById('heroStandardStats');
  const predictSectionEl = document.getElementById('heroPredictSection');
  if (standardStatsEl) {
    standardStatsEl.style.display = 'block';
    standardStatsEl.style.marginTop = "0px";
    if (heroPtsEl && heroPtsEl.parentElement) heroPtsEl.parentElement.style.fontSize = "";
    if (heroPosEl) heroPosEl.style.fontSize = "";
  }
  if (predictSectionEl) predictSectionEl.style.display = 'none';

  if (heroPtsEl) heroPtsEl.innerText = "0";
  setTimeout(() => {
    if (typeof animateCountUp === 'function') {
      animateCountUp(heroPtsEl, points, 1200);
    } else if (heroPtsEl) {
      heroPtsEl.innerText = points;
    }
  }, 30);

  document.getElementById('heroBgColor').style.background = `linear-gradient(to bottom, #0a0e1c 0%, ${info.color}40 15%, #0a0e1c 65%)`;

  if (!window.driverHeroModalInstance) {
    window.driverHeroModalInstance = new bootstrap.Modal(document.getElementById('driverHeroModal'));
  }
  window.driverHeroModalInstance.show();
}

// =========================================================
// ฟังก์ชันสำหรับหน้า TELEMETRY (ดึงเวลา Fastest Sector และ Speed Trap แบบขนานพร้อม Cache)
// =========================================================
async function loadTelemetryHUD(sessionKey = 'latest') {
  try {
    const [drivers, laps] = await Promise.all([
      fetchOpenF1Cached(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`),
      fetchOpenF1Cached(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`)
    ]);

    if (!Array.isArray(drivers) || !Array.isArray(laps)) return;

    const driverMap = {};
    drivers.forEach(d => {
      if (!d || d.driver_number === undefined) return;
      let driverColor = d.team_colour ? `#${String(d.team_colour).replace('#', '')}` : '#888888';

      const matchedFullName = resolveAppDriverName(d);
      if (typeof DRIVER_INFO !== 'undefined' && DRIVER_INFO[matchedFullName]) {
        driverColor = DRIVER_INFO[matchedFullName].color;
      }

      driverMap[d.driver_number] = {
        name: d.name_acronym || (d.last_name ? d.last_name.substring(0, 3).toUpperCase() : '---'),
        color: driverColor
      };
    });

    let bestS1 = { time: Infinity, driverNum: null };
    let bestS2 = { time: Infinity, driverNum: null };
    let bestS3 = { time: Infinity, driverNum: null };
    let bestSpeed = { speed: 0, driverNum: null };

    laps.forEach(lap => {
      if (lap.duration_sector_1 > 0 && lap.duration_sector_1 < bestS1.time) {
        bestS1 = { time: lap.duration_sector_1, driverNum: lap.driver_number };
      }
      if (lap.duration_sector_2 > 0 && lap.duration_sector_2 < bestS2.time) {
        bestS2 = { time: lap.duration_sector_2, driverNum: lap.driver_number };
      }
      if (lap.duration_sector_3 > 0 && lap.duration_sector_3 < bestS3.time) {
        bestS3 = { time: lap.duration_sector_3, driverNum: lap.driver_number };
      }
      if (lap.st_speed > 0 && lap.st_speed > bestSpeed.speed) {
        bestSpeed = { speed: lap.st_speed, driverNum: lap.driver_number };
      }
    });

    const updateUI = (elementId, data, isSpeed = false) => {
      const parentEl = document.getElementById(elementId);
      if (!parentEl || !data.driverNum) return;

      const driver = driverMap[data.driverNum] || { name: '---', color: '#888888' };
      const tagEl = parentEl.querySelector('.driver-tag');
      if (tagEl) {
        tagEl.innerText = driver.name;
        tagEl.style.setProperty('--team-color', driver.color);
      }

      const valEl = parentEl.querySelector(isSpeed ? '.speed-val' : '.sector-time');
      if (valEl) {
        if (isSpeed) {
          valEl.innerHTML = `${Math.round(data.speed)} <span class="unit">km/h</span>`;
        } else {
          valEl.innerText = data.time.toFixed(3);
        }
      }
    };

    updateUI('fastestSec1', bestS1);
    updateUI('fastestSec2', bestS2);
    updateUI('fastestSec3', bestS3);
    updateUI('highestSpeed', bestSpeed, true);

  } catch (error) {
    console.error("❌ Telemetry HUD Error:", error);
  }
}
