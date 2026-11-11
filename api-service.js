// =========================================================
// 2. API SERVICE & CACHING (การเชื่อมต่อฐานข้อมูลและ F1 API)
// =========================================================

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwZ_VB9I7ClOgDpd8bDkaY09CzipETJMeQPDK6Qk6JYVNPdgfXA6ZrmXDG8gYsJ9I6u/exec";

const apiCache = new Map();
const pendingRequests = new Map();

// ระบบแคชสำหรับ OpenF1 API เพื่อเพิ่มความเร็วและลดอาการหน่วง (เก็บข้อมูลไว้ในหน่วยความจำชั่วคราว 2 นาที)[cite: 1]
const openF1Cache = new Map();
const OPENF1_CACHE_TTL = 120000; 

async function fetchOpenF1Cached(url) {
  const now = Date.now();
  if (openF1Cache.has(url)) {
    const cached = openF1Cache.get(url);
    if (now - cached.timestamp < OPENF1_CACHE_TTL) {
      return cached.data;
    }
  }

  const response = await fetch(url);
  const data = await response.json();
  openF1Cache.set(url, { data, timestamp: now });
  return data;
}

async function callGAS(action, payload = {}, options = { useCache: false, ttl: 30000 }) {
  const cacheKey = action + "_" + JSON.stringify(payload);

  if (options.useCache && apiCache.has(cacheKey)) {
    const cached = apiCache.get(cacheKey);
    if (Date.now() - cached.timestamp < options.ttl) {
      return cached.data;
    }
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ action: action }, payload)),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const result = await response.json();

      if (options.useCache) {
        apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
      }
      return result;
    } finally {
      clearTimeout(timeoutId);
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

async function fetchF1Standings() {
  try {
    const response = await fetch('https://api.jolpi.ca/ergast/f1/current/driverStandings.json');
    const data = await response.json();
    const standings = data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
    
    const container = document.getElementById('driverStandingsList') || document.querySelector('.f1-official-standings');
    if (!container) return;
    const rows = container.querySelectorAll('.f1-standings-row');
    const rowsArray = Array.from(rows);

    standings.forEach(driverData => {
      const apiFamilyName = driverData.Driver.familyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const points = driverData.points;
      const position = driverData.position;

      const targetRow = rowsArray.find(row => {
        const nameEl = row.querySelector('.driver-name');
        if (!nameEl) return false;
        const htmlName = nameEl.innerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return htmlName.includes(apiFamilyName);
      });

      if (targetRow) {
        targetRow.querySelector('.col-pts').innerText = points;
        targetRow.querySelector('.col-pos').innerText = position;
        targetRow.setAttribute('data-position', position);
      }
    });

    rowsArray.sort((a, b) => {
      const posA = parseInt(a.getAttribute('data-position')) || 999;
      const posB = parseInt(b.getAttribute('data-position')) || 999;
      return posA - posB;
    });

    rowsArray.forEach(row => row.remove());
    rowsArray.forEach(row => container.appendChild(row));
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูลนักแข่ง F1 API:', error);
  }
}

async function fetchF1TeamStandings() {
  try {
    const response = await fetch('https://api.jolpi.ca/ergast/f1/current/constructorStandings.json');
    const data = await response.json();
    const standings = data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
    
    const container = document.getElementById('teamStandingsList') || document.querySelector('.f1-team-cards-container');
    if (!container) return;
    const rowsArray = Array.from(container.querySelectorAll('.team-card'));

    standings.forEach(teamData => {
      const apiTeamId = teamData.Constructor.constructorId.toLowerCase(); 
      const points = teamData.points;
      const position = teamData.position;

      const targetRow = rowsArray.find(row => {
        const nameEl = row.querySelector('.team-name');
        if (!nameEl) return false;
        const htmlName = nameEl.innerText.toLowerCase();
        if (apiTeamId.includes('sauber') && htmlName === 'audi') return true;
        return htmlName.includes(apiTeamId) || apiTeamId.includes(htmlName.split(' ')[0]);
      });

      if (targetRow) {
        targetRow.querySelector('.col-pts').innerText = points;
        targetRow.querySelector('.col-pos').innerText = position;
        targetRow.setAttribute('data-position', position);
      }
    });

    rowsArray.sort((a, b) => {
      const posA = parseInt(a.getAttribute('data-position')) || 999;
      const posB = parseInt(b.getAttribute('data-position')) || 999;
      return posA - posB;
    });

    rowsArray.forEach(row => row.remove());
    rowsArray.forEach(row => container.appendChild(row));
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูลคะแนนทีม:', error);
  }
}

async function fetchLiveWeather() {
  try {
    // ใช้ฟังก์ชันแคช OpenF1 เพื่อดึงข้อมูลสภาพอากาศได้อย่างรวดเร็ว[cite: 1]
    const data = await fetchOpenF1Cached('https://api.openf1.org/v1/weather?session_key=latest');

    if (data && data.length > 0) {
      const latestWeather = data[data.length - 1]; 
      const isRaining = latestWeather.rainfall > 0;
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

async function loadResultsSessionData(sessionKey, btnEl) {
  if (btnEl) {
    document.querySelectorAll('#resultsSessionBtnGroup button').forEach(b => {
      b.classList.remove('active', 'text-white', 'border-white');
    });
    btnEl.classList.add('active', 'text-white', 'border-white');
  }

  const list = document.getElementById('resultsSessionDataList');
  if (!list) return;
  list.innerHTML = '<div class="text-center py-5"><i class="fa-solid fa-spinner fa-spin text-danger fs-3 mb-2"></i><div class="text-secondary small f1-font">CALCULATING TRUE RESULTS...</div></div>';
  
  try {
    // 1. ดึงข้อมูลใหม่สดๆ ด้วย fetch ป้องกันปัญหา Cache สลับสนาม
    const [sessionRes, driversRes, lapsRes, standingsRes] = await Promise.all([
      fetch(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`),
      fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`),
      fetch(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`),
      fetch('https://api.jolpi.ca/ergast/f1/current/driverStandings.json')
    ]);
    
    const sessionData = await sessionRes.json();
    const drivers = await driversRes.json();
    const laps = await lapsRes.json();
    const standingsData = await standingsRes.json();

    // เช็กว่าเป็นรอบแข่งจริง (Race/Sprint) หรือรอบซ้อม
    const sessionName = (sessionData[0] && sessionData[0].session_name) ? sessionData[0].session_name.toLowerCase() : '';
    const isRace = sessionName === 'race' || sessionName === 'sprint';
    
    const seasonStandings = {};
    const standingsLists = standingsData.MRData?.StandingsTable?.StandingsLists;
    if (standingsLists && standingsLists.length > 0) {
      standingsLists[0].DriverStandings.forEach(ds => {
        const familyName = ds.Driver.familyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        seasonStandings[familyName] = { points: ds.points || '0', position: 'P' + ds.position };
      });
    }

    // 2. คำนวณข้อมูลสถิติของรถแต่ละคันจาก /laps (FIA Logic)
    const driverStats = {};
    let sessionFastestLap = Infinity;

    if (Array.isArray(laps)) {
      laps.forEach(l => {
        const dNum = l.driver_number;
        if (!driverStats[dNum]) {
          driverStats[dNum] = { maxLap: 0, bestLap: Infinity, finishTime: Infinity };
        }
        
        // หา Best Lap
        if (l.lap_duration && l.lap_duration > 0) {
          if (l.lap_duration < driverStats[dNum].bestLap) driverStats[dNum].bestLap = l.lap_duration;
          if (l.lap_duration < sessionFastestLap) sessionFastestLap = l.lap_duration;
        }
        
        // หารอบสูงสุดที่วิ่งได้ และเวลาเข้าเส้นชัยในรอบนั้น
        if (l.lap_number && l.lap_number >= driverStats[dNum].maxLap) {
          driverStats[dNum].maxLap = l.lap_number;
          if (l.date_start && l.lap_duration) {
             driverStats[dNum].finishTime = new Date(l.date_start).getTime() + (l.lap_duration * 1000);
          }
        }
      });
    }
    
    // 3. แม็ปปิ้งข้อมูลนักแข่งเข้าด้วยกัน
    let results = drivers.map(d => {
      const dNum = d.driver_number;
      const stats = driverStats[dNum] || { maxLap: 0, bestLap: Infinity, finishTime: Infinity };
      
      const apiLastName = (d.last_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const appDriver = Object.keys(DRIVER_INFO).find(name => {
        const cleanName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cleanName.includes(apiLastName) || apiLastName.includes(cleanName.split(' ').pop());
      }) || d.full_name || 'Driver';
      
      const info = DRIVER_INFO[appDriver] || { team: d.team_name, color: d.team_colour ? `#${d.team_colour}` : '#888888', headshot: DEFAULT_DRIVER_IMG };
      const shortName = (d.first_name ? d.first_name.charAt(0) + '. ' : '') + (d.last_name || d.full_name || '');
      const seasonData = seasonStandings[apiLastName] || { points: '0', position: 'P-' };

      return {
        driver_number: dNum,
        fullName: appDriver,
        shortName: shortName,
        team: info.team || d.team_name || 'F1',
        color: info.color || (d.team_colour ? `#${d.team_colour}` : '#888888'),
        headshot: getDriveDirectLink(info.headshot || info.img || DEFAULT_DRIVER_IMG),
        seasonPoints: seasonData.points,
        seasonPos: seasonData.position,
        maxLap: stats.maxLap,
        bestLap: stats.bestLap,
        finishTime: stats.finishTime,
        timeGap: '-'
      };
    });

    // กรองรถที่ไม่ลงวิ่งออก
    results = results.filter(r => r.maxLap > 0 || r.bestLap !== Infinity);

    // 4. เรียงลำดับนักแข่งตามประเภทเซสชัน
    if (isRace) {
      // 🏎️ แข่งจริง: เรียงตามจำนวนรอบ (มากไปน้อย) -> เวลาเข้าเส้นชัย (น้อยไปมาก)
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
               r.timeGap = 'Winner';
            } else if (r.maxLap < winnerLaps) {
               const lapsBehind = winnerLaps - r.maxLap;
               r.timeGap = `+${lapsBehind} Laps`; // โดนน็อกรอบ
            } else if (r.finishTime !== Infinity && raceWinnerFinishTime !== Infinity) {
               const diffSec = (r.finishTime - raceWinnerFinishTime) / 1000;
               r.timeGap = `+${diffSec.toFixed(3)}s`; // ตามหลังผู้นำ
            } else {
               r.timeGap = 'DNF';
            }
         });
      }
    } else {
      // ⏱️ ซ้อม/ควอลิฟาย: เรียงตาม Best Lap Time
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
      list.innerHTML = `<div class="text-center text-secondary py-4">ไม่มีข้อมูลรถวิ่งในเซสชันนี้</div>`;
      return;
    }
    
    // 5. วาดตาราง
    list.innerHTML = results.map(r => `
      <div class="f1-standings-row" style="cursor:pointer;" onclick="openDriverHeroCustom(this, '${r.fullName.replace(/'/g, "\\'")}', '${r.seasonPoints}', '${r.seasonPos}')">
        <div class="col-pos" style="width: 12%;">${r.pos}</div>
        <div class="col-driver" style="width: 53%;">
          <img src="${r.headshot}" class="driver-headshot" alt="${r.shortName}" loading="lazy">
          <div class="driver-info">
            <div class="driver-name text-white">${r.shortName}</div>
            <div class="team-name m-0" style="color: ${r.color};">${r.team}</div>
          </div>
        </div>
        <div class="col-pts text-end" style="width: 35%; font-family: 'Share Tech Mono', monospace; font-size: 0.85rem;">
           <span class="text-white fw-bold">${r.timeGap}</span>
           <span class="d-none col-pts-season">${r.seasonPoints}</span>
           <span class="d-none col-pos-season">${r.seasonPos}</span>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Session Results Error:', error);
    list.innerHTML = '<div class="text-center text-danger py-4">พบปัญหาในการดึงข้อมูล OpenF1 API<br><span class="small text-secondary">กรุณาลองใหม่อีกครั้ง</span></div>';
  }
}

function openDriverHeroCustom(rowEl, fullName, points, championshipPos) {
  triggerHaptic();
  const info = DRIVER_INFO[fullName];
  if(!info) return;

  const parts = fullName.split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  document.getElementById('heroDriverFirstName').innerText = firstName;
  document.getElementById('heroDriverLastName').innerText = lastName;
  document.getElementById('heroTeamName').innerText = info.team;
  document.getElementById('heroTeamLogo').src = getDriveDirectLink(TEAM_LOGOS[info.team] || '');
  document.getElementById('heroDriverImg').src = getDriveDirectLink(info.heroImg || info.img); 
  document.getElementById('heroPos').innerText = championshipPos;

  const ptsEl = document.getElementById('heroPoints');
  ptsEl.innerText = "0"; 
  
  setTimeout(() => {
    animateCountUp(ptsEl, points, 2200); 
  }, 10); 

  document.getElementById('heroBgColor').style.background = `linear-gradient(to bottom, #0a0e1c 0%, ${info.color}40 15%, #0a0e1c 65%)`;

  if (!window.driverHeroModalInstance) {
    window.driverHeroModalInstance = new bootstrap.Modal(document.getElementById('driverHeroModal'));
  }
  window.driverHeroModalInstance.show();
}
// =========================================================
// ฟังก์ชันสำหรับหน้า TELEMETRY (ดึงเวลา Fastest Sector และ Speed Trap)
// =========================================================
async function loadTelemetryHUD(sessionKey = 'latest') {
  const loadingHtml = '<i class="fa-solid fa-spinner fa-spin text-secondary"></i>';
  const noDataHtml = '<span style="font-size:0.8rem; color:#666;">NO DATA</span>';
  
  ['fastestSec1', 'fastestSec2', 'fastestSec3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="driver-tag">---</div><div class="sector-time text-secondary">${loadingHtml}</div>`;
  });
  const spdEl = document.getElementById('highestSpeed');
  if (spdEl) spdEl.innerHTML = `<div class="driver-tag me-3">---</div><div class="speed-val">${loadingHtml}</div>`;

  try {
    // ดึงผ่าน Cache ของเรา ลดปัญหาการหน่วงของ API
    const [laps, drivers] = await Promise.all([
      fetchOpenF1Cached(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`),
      fetchOpenF1Cached(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`)
    ]);

    let best = {
      sec1: { time: Infinity, driverNum: null },
      sec2: { time: Infinity, driverNum: null },
      sec3: { time: Infinity, driverNum: null },
      speed: { val: 0, driverNum: null }
    };

    if (Array.isArray(laps)) {
      laps.forEach(lap => {
        if (lap.duration_sector_1 && lap.duration_sector_1 < best.sec1.time) {
          best.sec1 = { time: lap.duration_sector_1, driverNum: lap.driver_number };
        }
        if (lap.duration_sector_2 && lap.duration_sector_2 < best.sec2.time) {
          best.sec2 = { time: lap.duration_sector_2, driverNum: lap.driver_number };
        }
        if (lap.duration_sector_3 && lap.duration_sector_3 < best.sec3.time) {
          best.sec3 = { time: lap.duration_sector_3, driverNum: lap.driver_number };
        }
        if (lap.st_speed && lap.st_speed > best.speed.val) {
          best.speed = { val: lap.st_speed, driverNum: lap.driver_number };
        }
      });
    }

    const getDriverUI = (dNum) => {
      const d = (Array.isArray(drivers) ? drivers : []).find(x => x.driver_number === dNum);
      if (!d) return { tag: '---', color: '#888888' };
      
      const apiLastName = (d.last_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const appDriver = Object.keys(DRIVER_INFO).find(name => {
        const cleanName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cleanName.includes(apiLastName) || apiLastName.includes(cleanName.split(' ').pop());
      }) || d.full_name;
      
      const info = DRIVER_INFO[appDriver] || { color: d.team_colour ? `#${d.team_colour}` : '#888888' };
      const shortName = d.name_acronym || (d.last_name || '').substring(0, 3).toUpperCase();
      return { tag: shortName, color: info.color };
    };

    ['sec1', 'sec2', 'sec3'].forEach((secKey, idx) => {
      const targetEl = document.getElementById(`fastestSec${idx + 1}`);
      if (!targetEl) return;
      if (best[secKey].driverNum) {
        const d = getDriverUI(best[secKey].driverNum);
        targetEl.innerHTML = `<div class="driver-tag" style="--team-color: ${d.color};">${d.tag}</div><div class="sector-time text-purple">${best[secKey].time.toFixed(3)}</div>`;
      } else {
        targetEl.innerHTML = `<div class="driver-tag">---</div><div class="sector-time text-secondary">${noDataHtml}</div>`;
      }
    });

    if (spdEl) {
      if (best.speed.driverNum) {
        const d = getDriverUI(best.speed.driverNum);
        spdEl.innerHTML = `<div class="driver-tag me-3" style="--team-color: ${d.color};">${d.tag}</div><div class="speed-val">${best.speed.val} <span class="unit">km/h</span></div>`;
      } else {
        spdEl.innerHTML = `<div class="driver-tag me-3">---</div><div class="speed-val text-secondary">${noDataHtml}</div>`;
      }
    }
  } catch (error) {
    console.error('Telemetry HUD Error:', error);
  }
}
