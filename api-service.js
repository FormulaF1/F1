// =========================================================
// 2. API SERVICE & CACHING (การเชื่อมต่อฐานข้อมูลและ F1 API v3.0 - Anti-429 & Failover)
// =========================================================

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwZ_VB9I7ClOgDpd8bDkaY09CzipETJMeQPDK6Qk6JYVNPdgfXA6ZrmXDG8gYsJ9I6u/exec";

const apiCache = new Map();
const pendingRequests = new Map();

// ระบบแคช + คิวควบคุมความเร็วสำหรับ OpenF1 (กันติด HTTP 429 ถาวร)
const openF1Cache = new Map();
const openF1Pending = new Map();
const OPENF1_CACHE_TTL = 300000; // 5 นาที
let openF1Queue = Promise.resolve();
let lastOpenF1Time = 0;
const OPENF1_MIN_INTERVAL = 400; // เว้นระยะ 400ms ต่อคำขอ (ไม่เกิน 2.5 req/วินาที)

const jolpicaCache = new Map();
const JOLPICA_CACHE_TTL = 300000;

window.f1DriverStandingsMap = window.f1DriverStandingsMap || {};
let officialStandingsPromise = null;

function cleanTextForMatch(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// คิวควบคุมการยิง OpenF1 ทีละคำขอ + ลองใหม่อัตโนมัติหากชน 429
function queuedOpenF1Fetch(url) {
  const task = async () => {
    const wait = Math.max(0, OPENF1_MIN_INTERVAL - (Date.now() - lastOpenF1Time));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastOpenF1Time = Date.now();

    let res = await fetch(url);
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1600));
      lastOpenF1Time = Date.now();
      res = await fetch(url);
    }
    return res;
  };

  const next = openF1Queue.then(task, task);
  openF1Queue = next.catch(() => {});
  return next;
}

// ดึงข้อมูลจาก OpenF1 พร้อม Memory Cache + SessionStorage Cache + Request Queue
async function fetchOpenF1Cached(url, customTtl = OPENF1_CACHE_TTL) {
  const now = Date.now();
  if (openF1Cache.has(url)) {
    const cached = openF1Cache.get(url);
    if (now - cached.timestamp < customTtl) return cached.data;
  }

  try {
    const rawSession = sessionStorage.getItem("of1_v3_" + url);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (now - parsed.timestamp < customTtl) {
        openF1Cache.set(url, parsed);
        return parsed.data;
      }
    }
  } catch (e) {}

  if (openF1Pending.has(url)) {
    return openF1Pending.get(url);
  }

  const reqPromise = (async () => {
    try {
      const response = await queuedOpenF1Fetch(url);
      if (!response.ok) {
        throw new Error(`OpenF1 HTTP ${response.status}`);
      }
      const data = await response.json();
      const entry = { data, timestamp: Date.now() };
      openF1Cache.set(url, entry);
      try { sessionStorage.setItem("of1_v3_" + url, JSON.stringify(entry)); } catch (e) {}
      return data;
    } finally {
      openF1Pending.delete(url);
    }
  })();

  openF1Pending.set(url, reqPromise);
  return reqPromise;
}

// ดึงข้อมูลจาก Jolpica API แบบคุม Timeout สั้น 3.5 วินาที (ถ้า 504 ล่ม ให้ตัดข้ามทันที ไม่ค้าง!)
async function fetchJolpicaCached(url, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && jolpicaCache.has(url)) {
    const cached = jolpicaCache.get(url);
    if (now - cached.timestamp < JOLPICA_CACHE_TTL) return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Jolpica HTTP ${response.status}`);
    const data = await response.json();
    jolpicaCache.set(url, { data, timestamp: now });
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
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

      if (!response.ok) throw new Error(`GAS HTTP ${response.status}`);
      const result = await response.json();

      if (["submitPrediction", "registerPlayer", "saveResultAndCalculate", "adminUpdateRaceSettings", "adminSaveTrackMediaLinks"].includes(action)) {
        apiCache.clear();
      } else if (options.useCache && result && result.success !== false) {
        apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
      }

      return result;
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("การเชื่อมต่อใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง");
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

// =========================================================
// 🏆 ระบบดึงตารางคะแนนนักขับ (WDC) & ทีม (WCC) อัตโนมัติ (OpenF1 Primary + Jolpica + LocalStorage)
// =========================================================
async function loadCombinedOfficialStandings(forceRefresh = false) {
  if (!forceRefresh && officialStandingsPromise) {
    return officialStandingsPromise;
  }

  officialStandingsPromise = (async () => {
    let drivers = [];
    let constructors = [];

    // 1. ดึงจาก OpenF1 Championship API จากเซสชัน Race ล่าสุดของปี 2026 (เสถียรและไม่ล่มเหมือน Jolpica)
    try {
      const raceSessions = await fetchOpenF1Cached("https://api.openf1.org/v1/sessions?year=2026&session_name=Race", 900000);
      const now = new Date();
      const finishedRaces = (Array.isArray(raceSessions) ? raceSessions : [])
        .filter(s => s && s.date_start && new Date(s.date_start) <= now)
        .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

      const targetKey = finishedRaces.length > 0
        ? finishedRaces[finishedRaces.length - 1].session_key
        : "latest";

      const champDrivers = await fetchOpenF1Cached(`https://api.openf1.org/v1/championship_drivers?session_key=${targetKey}`, 600000);
      const openDrivers = await fetchOpenF1Cached(`https://api.openf1.org/v1/drivers?session_key=${targetKey}`, 600000);
      const champTeams = await fetchOpenF1Cached(`https://api.openf1.org/v1/championship_teams?session_key=${targetKey}`, 600000);

      if (Array.isArray(champDrivers) && champDrivers.length > 0) {
        const numMap = {};
        (Array.isArray(openDrivers) ? openDrivers : []).forEach(d => {
          if (d && d.driver_number != null) numMap[d.driver_number] = d;
        });

        drivers = champDrivers.map(cd => {
          const dInfo = numMap[cd.driver_number] || {};
          return {
            position: String(cd.position_current || "-"),
            points: String(cd.points_current ?? "0"),
            Driver: {
              familyName: dInfo.last_name || dInfo.full_name || "",
              givenName: dInfo.first_name || ""
            }
          };
        }).filter(item => item.Driver.familyName);
      }

      if (Array.isArray(champTeams) && champTeams.length > 0) {
        constructors = champTeams.map(ct => ({
          position: String(ct.position_current || "-"),
          points: String(ct.points_current ?? "0"),
          Constructor: {
            constructorId: cleanTextForMatch(ct.team_name),
            name: ct.team_name || ""
          }
        }));
      }
    } catch (e) {
      console.warn("OpenF1 Championship fetch fallback:", e.message);
    }

    // 2. Fallback: ถ้า OpenF1 ไม่มีข้อมูล ค่อยเช็ก Jolpica (ตั้ง Timeout ไว้แค่ 3.5 วิ ไม่ให้ค้าง)
    if (drivers.length === 0) {
      try {
        const dData = await fetchJolpicaCached("https://api.jolpi.ca/ergast/f1/2026/driverStandings.json", forceRefresh);
        const lists = dData?.MRData?.StandingsTable?.StandingsLists;
        if (lists && lists.length > 0) drivers = lists[0].DriverStandings || [];
      } catch (e) {}
    }

    if (constructors.length === 0) {
      try {
        const cData = await fetchJolpicaCached("https://api.jolpi.ca/ergast/f1/2026/constructorStandings.json", forceRefresh);
        const lists = cData?.MRData?.StandingsTable?.StandingsLists;
        if (lists && lists.length > 0) constructors = lists[0].ConstructorStandings || [];
      } catch (e) {}
    }

    // 3. บันทึกเก็บลง localStorage เครื่องผู้เล่น เผื่อเน็ตหลุดหรือ API ล่มในอนาคต
    if (drivers.length > 0 || constructors.length > 0) {
      try {
        localStorage.setItem("f1_standings_backup_2026", JSON.stringify({ drivers, constructors }));
      } catch (e) {}
    } else {
      try {
        const backup = JSON.parse(localStorage.getItem("f1_standings_backup_2026") || "null");
        if (backup) {
          drivers = backup.drivers || [];
          constructors = backup.constructors || [];
        }
      } catch (e) {}
    }

    return { drivers, constructors };
  })();

  try {
    return await officialStandingsPromise;
  } finally {
    setTimeout(() => { officialStandingsPromise = null; }, 5000);
  }
}

// อัปเดตตารางคะแนนนักแข่งโลก (WDC)
async function fetchF1Standings(forceRefresh = false) {
  try {
    const { drivers: standings } = await loadCombinedOfficialStandings(forceRefresh);
    if (!standings || standings.length === 0) return;

    const container = document.getElementById("driverStandingsList") || document.querySelector(".f1-official-standings");
    const rowsArray = container ? Array.from(container.querySelectorAll(".f1-standings-row")) : [];

    standings.forEach(driverData => {
      const apiFamilyName = cleanTextForMatch(driverData?.Driver?.familyName);
      if (!apiFamilyName) return;

      const points = String(driverData.points ?? "0");
      const position = String(driverData.position || driverData.positionText || "-");

      if (typeof DRIVER_INFO !== "undefined") {
        const matchedFull = Object.keys(DRIVER_INFO).find(fullName => {
          const cleanFull = cleanTextForMatch(fullName);
          const cleanLast = cleanFull.split(" ").pop();
          return cleanFull.includes(apiFamilyName) || (cleanLast.length >= 2 && apiFamilyName.includes(cleanLast));
        });
        if (matchedFull) {
          window.f1DriverStandingsMap[matchedFull] = { points: points, position: position };
        }
      }

      const targetRow = rowsArray.find(row => {
        const onclickAttr = cleanTextForMatch(row.getAttribute("onclick") || "");
        const nameEl = row.querySelector(".driver-name");
        const htmlName = nameEl ? cleanTextForMatch(nameEl.textContent) : "";
        return onclickAttr.includes(apiFamilyName) || htmlName.includes(apiFamilyName);
      });

      if (targetRow) {
        const ptsEl = targetRow.querySelector(".col-pts");
        const posEl = targetRow.querySelector(".col-pos");
        if (ptsEl) ptsEl.textContent = points;
        if (posEl) posEl.textContent = position;
        targetRow.setAttribute("data-position", position);
      }
    });

    if (container && rowsArray.length > 0) {
      rowsArray.sort((a, b) => {
        const posA = parseInt(a.getAttribute("data-position"), 10) || 999;
        const posB = parseInt(b.getAttribute("data-position"), 10) || 999;
        return posA - posB;
      });

      const fragment = document.createDocumentFragment();
      rowsArray.forEach(row => fragment.appendChild(row));
      container.appendChild(fragment);
    }
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการดึงข้อมูลนักแข่ง F1 API:", error);
  }
}

// อัปเดตตารางคะแนนทีมผู้ผลิต (WCC)
async function fetchF1TeamStandings(forceRefresh = false) {
  try {
    const { constructors: standings } = await loadCombinedOfficialStandings(forceRefresh);
    if (!standings || standings.length === 0) return;

    const container = document.getElementById("teamStandingsList") || document.querySelector(".f1-team-cards-container");
    if (!container) return;

    const rowsArray = Array.from(container.querySelectorAll(".team-card"));

    standings.forEach(teamData => {
      const apiTeamId = cleanTextForMatch(teamData?.Constructor?.constructorId);
      const apiTeamName = cleanTextForMatch(teamData?.Constructor?.name);
      if (!apiTeamId && !apiTeamName) return;

      const points = String(teamData.points ?? "0");
      const position = String(teamData.position || teamData.positionText || "-");

      const targetRow = rowsArray.find(row => {
        const nameEl = row.querySelector(".team-name");
        if (!nameEl) return false;
        const htmlName = cleanTextForMatch(nameEl.textContent);

        if ((apiTeamId.includes("sauber") || apiTeamId.includes("audi") || apiTeamName.includes("audi") || apiTeamName.includes("sauber")) && htmlName === "audi") return true;
        if ((apiTeamId === "rb" || apiTeamId.includes("vcarb") || apiTeamName.includes("racing bulls") || apiTeamName === "rb") && htmlName === "vcarb") return true;
        if ((apiTeamId.includes("red_bull") || apiTeamName.includes("red bull")) && htmlName.includes("red bull")) return true;
        if ((apiTeamId.includes("aston") || apiTeamName.includes("aston")) && htmlName.includes("aston")) return true;
        if ((apiTeamId.includes("cadillac") || apiTeamName.includes("cadillac")) && htmlName.includes("cadillac")) return true;

        const firstWord = htmlName.split(" ")[0];
        return (apiTeamId && htmlName.includes(apiTeamId)) ||
               (apiTeamName && apiTeamName.includes(firstWord)) ||
               (firstWord.length > 2 && apiTeamId.includes(firstWord));
      });

      if (targetRow) {
        const ptsEl = targetRow.querySelector(".col-pts");
        const posEl = targetRow.querySelector(".col-pos");
        if (ptsEl) ptsEl.textContent = points;
        if (posEl) posEl.textContent = position;
        targetRow.setAttribute("data-position", position);
      }
    });

    rowsArray.sort((a, b) => {
      const posA = parseInt(a.getAttribute("data-position"), 10) || 999;
      const posB = parseInt(b.getAttribute("data-position"), 10) || 999;
      return posA - posB;
    });

    const fragment = document.createDocumentFragment();
    rowsArray.forEach(row => fragment.appendChild(row));
    container.appendChild(fragment);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการดึงข้อมูลคะแนนทีม:", error);
  }
}

// ดึงสภาพอากาศสดจากสนามล่าสุดผ่าน OpenF1
async function fetchLiveWeather() {
  try {
    const data = await fetchOpenF1Cached("https://api.openf1.org/v1/weather?session_key=latest");

    if (Array.isArray(data) && data.length > 0) {
      const latestWeather = data[data.length - 1];
      const isRaining = Number(latestWeather.rainfall) > 0;
      const weatherIcon = isRaining ? "🌧️" : "☀️";

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

      const weatherEl = document.getElementById("rcWeather");
      if (weatherEl) {
        weatherEl.innerHTML = weatherHtml;
        weatherEl.classList.remove("weather-icon-animated");
      }
    }
  } catch (error) {
    console.error("❌ OpenF1 Weather API Error:", error);
  }
}

function formatLapTime(seconds) {
  if (!seconds || isNaN(seconds)) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3).padStart(6, "0");
  return mins > 0 ? `${mins}:${secs}` : `${secs}s`;
}

function resolveAppDriverName(apiDriver) {
  if (!apiDriver || typeof DRIVER_INFO === "undefined") {
    return apiDriver?.full_name || "Driver";
  }
  const apiLast = cleanTextForMatch(apiDriver.last_name);
  const apiFull = cleanTextForMatch(apiDriver.full_name);

  if (apiLast && apiLast.length >= 2) {
    const matched = Object.keys(DRIVER_INFO).find(name => {
      const cleanApp = cleanTextForMatch(name);
      const appLast = cleanApp.split(" ").pop();
      return cleanApp.includes(apiLast) || (appLast.length >= 2 && apiLast.includes(appLast));
    });
    if (matched) return matched;
  }

  if (apiFull && apiFull.length >= 3) {
    const matchedFull = Object.keys(DRIVER_INFO).find(name => cleanTextForMatch(name) === apiFull);
    if (matchedFull) return matchedFull;
  }

  return apiDriver.full_name || "Driver";
}

// ดึงผลการแข่งขันอย่างเป็นทางการแต่ละเซสชัน (อิง Official Classification จาก session_result + position ก่อนคำนวณ laps)
async function loadResultsSessionData(sessionKey, btnEl, targetContainer = null, disableHeroClick = false) {
  if (btnEl) {
    document.querySelectorAll("#resultsSessionBtnGroup button").forEach(b => {
      b.classList.remove("active", "text-white", "border-white");
    });
    btnEl.classList.add("active", "text-white", "border-white");
  }

  const list = targetContainer || document.getElementById("resultsSessionDataList");
  if (!list) return;
  list.innerHTML = '<div class="text-center py-5"><i class="fa-solid fa-spinner fa-spin text-danger fs-3 mb-2"></i><div class="text-secondary small f1-font">CALCULATING OFFICIAL CLASSIFICATION...</div></div>';

  try {
    // ดึง Official Session Result ควบคู่กับ Drivers และ Laps (ผ่านระบบคิวกันติด 429)
    const [sessionData, officialRes, drivers, laps] = await Promise.all([
      fetchOpenF1Cached(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`),
      fetchOpenF1Cached(`https://api.openf1.org/v1/session_result?session_key=${sessionKey}`).catch(() => []),
      fetchOpenF1Cached(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`),
      fetchOpenF1Cached(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`)
    ]);

    // หาก session_result ยังว่าง (เช่น เซสชันเพิ่งจบสดๆ) ให้ดึงลำดับเข้าเส้นชัยจริงจาก /v1/position สำรองไว้
    let finalPositionsMap = {};
    if (!Array.isArray(officialRes) || officialRes.length === 0) {
      const posData = await fetchOpenF1Cached(`https://api.openf1.org/v1/position?session_key=${sessionKey}`).catch(() => []);
      if (Array.isArray(posData)) {
        posData.forEach(p => {
          if (p && p.driver_number != null && p.position != null) {
            finalPositionsMap[p.driver_number] = Number(p.position);
          }
        });
      }
    }

    const sessionName = (Array.isArray(sessionData) && sessionData[0]?.session_name)
      ? sessionData[0].session_name.toLowerCase()
      : "";
    const isRace = sessionName === "race" || sessionName === "sprint";

    // แมพข้อมูลจาก Official Result (แม่นยำ 100% รวม Penalty / DNF / DSQ / Lapped)
    const officialMap = {};
    if (Array.isArray(officialRes)) {
      officialRes.forEach(item => {
        if (item && item.driver_number != null) {
          officialMap[item.driver_number] = item;
        }
      });
    }

    // คำนวณ Fastest Lap และแก้ไขบั๊กเวลาค้างจากรอบก่อนหน้าเมื่อ lap_duration เป็น null
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
          // ✅ แก้บั๊กสำคัญ: ถ้ารอบใหม่ไม่มี lap_duration ต้องรีเซ็ตเป็น Infinity ห้ามเอาเวลารอบที่ 49 มาค้างเด็ดขาด!
          if (l.date_start && l.lap_duration && l.lap_duration > 0) {
            driverStats[dNum].finishTime = new Date(l.date_start).getTime() + (l.lap_duration * 1000);
          } else {
            driverStats[dNum].finishTime = Infinity;
          }
        }
      });
    }

    const uniqueDriversMap = new Map();
    (Array.isArray(drivers) ? drivers : []).forEach(d => {
      if (d && d.driver_number !== undefined && !uniqueDriversMap.has(d.driver_number)) {
        uniqueDriversMap.set(d.driver_number, d);
      }
    });

    const hasOfficialData = Object.keys(officialMap).length > 0;
    const hasPositionData = Object.keys(finalPositionsMap).length > 0;

    let results = Array.from(uniqueDriversMap.values()).map(d => {
      const dNum = d.driver_number;
      const stats = driverStats[dNum] || { maxLap: 0, bestLap: Infinity, finishTime: Infinity };
      const off = officialMap[dNum] || null;
      const appDriver = resolveAppDriverName(d);

      const fallbackColor = d.team_colour ? `#${String(d.team_colour).replace("#", "")}` : "#888888";
      const info = (typeof DRIVER_INFO !== "undefined" && DRIVER_INFO[appDriver])
        ? DRIVER_INFO[appDriver]
        : { team: d.team_name || "F1", color: fallbackColor, headshot: DEFAULT_DRIVER_IMG };

      const nameParts = appDriver.split(" ");
      const shortName = nameParts.length > 1
        ? `${nameParts[0].charAt(0)}. ${nameParts.slice(1).join(" ")}`
        : (d.name_acronym || appDriver);

      const mapEntry = (window.f1DriverStandingsMap && window.f1DriverStandingsMap[appDriver])
        ? window.f1DriverStandingsMap[appDriver]
        : { points: "0", position: "-" };

      const rawHeadshot = info.headshot || info.img || d.headshot_url || DEFAULT_DRIVER_IMG;
      const headshotUrl = (typeof getDriveDirectLink === "function") ? getDriveDirectLink(rawHeadshot) : rawHeadshot;

      const officialPos = (off && off.position != null)
        ? Number(off.position)
        : (finalPositionsMap[dNum] || 999);

      return {
        driver_number: dNum,
        fullName: appDriver,
        shortName: shortName,
        team: info.team || d.team_name || "F1",
        color: info.color || fallbackColor,
        headshot: headshotUrl,
        seasonPoints: mapEntry.points,
        seasonPos: "P" + mapEntry.position,
        officialPos: officialPos,
        officialObj: off,
        maxLap: (off && off.number_of_laps != null) ? Number(off.number_of_laps) : stats.maxLap,
        bestLap: stats.bestLap,
        finishTime: stats.finishTime,
        timeGap: "-"
      };
    });

    if (!hasOfficialData) {
      results = results.filter(r => r.maxLap > 0 || r.bestLap !== Infinity || r.officialPos < 999);
    }

    if (hasOfficialData) {
      // 🎯 กรณีมี Official Classification จาก FIA (ตรงความจริง 100% ทุกกรณี!)
      results.sort((a, b) => a.officialPos - b.officialPos);

      const winnerLaps = results[0]?.maxLap || 0;
      results.forEach((r, idx) => {
        const off = r.officialObj;
        r.pos = (off && off.position != null) ? off.position : (idx + 1);

        if (off && off.dsq) {
          r.timeGap = "DSQ";
        } else if (off && off.dns) {
          r.timeGap = "DNS";
        } else if (off && off.dnf) {
          r.timeGap = "DNF";
        } else if (isRace) {
          if (idx === 0) {
            r.timeGap = winnerLaps > 0 ? `${winnerLaps} Laps` : "WINNER";
          } else if (off && off.gap_to_leader != null && off.gap_to_leader !== "") {
            const g = off.gap_to_leader;
            if (typeof g === "number") {
              r.timeGap = `+${g.toFixed(3)}s`;
            } else {
              const gStr = String(g).trim();
              r.timeGap = gStr.startsWith("+") ? gStr : `+${gStr}`;
            }
          } else if (r.maxLap < winnerLaps) {
            const diffLaps = winnerLaps - r.maxLap;
            r.timeGap = `+${diffLaps} ${diffLaps === 1 ? "Lap" : "Laps"}`;
          } else {
            r.timeGap = "-";
          }
        } else {
          // Practice / Qualifying
          let bestDur = r.bestLap;
          if (off && Array.isArray(off.duration)) {
            const validDurs = off.duration.filter(v => typeof v === "number" && v > 0);
            if (validDurs.length > 0) bestDur = validDurs[validDurs.length - 1];
          } else if (off && typeof off.duration === "number" && off.duration > 0) {
            bestDur = off.duration;
          }

          if (idx === 0 && bestDur !== Infinity) {
            r.timeGap = formatLapTime(bestDur);
          } else if (off && off.gap_to_leader != null) {
            const g = Array.isArray(off.gap_to_leader)
              ? off.gap_to_leader.filter(v => v != null).pop()
              : off.gap_to_leader;
            if (typeof g === "number") r.timeGap = `+${g.toFixed(3)}s`;
            else if (g) r.timeGap = String(g).startsWith("+") ? String(g) : `+${g}`;
            else r.timeGap = bestDur !== Infinity ? formatLapTime(bestDur) : "NO TIME";
          } else if (bestDur !== Infinity && sessionFastestLap !== Infinity) {
            r.timeGap = `+${(bestDur - sessionFastestLap).toFixed(3)}s`;
          } else {
            r.timeGap = "NO TIME";
          }
        }
      });
    } else if (isRace) {
      // Fallback กรณีเซสชันกำลังแข่งสดและยังไม่ออกใบ Official Result
      results.sort((a, b) => {
        if (hasPositionData && a.officialPos !== b.officialPos) {
          return a.officialPos - b.officialPos;
        }
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
            r.timeGap = `+${lapsBehind} ${lapsBehind === 1 ? "Lap" : "Laps"}`;
          } else if (r.finishTime !== Infinity && raceWinnerFinishTime !== Infinity && r.finishTime >= raceWinnerFinishTime) {
            const diffSec = (r.finishTime - raceWinnerFinishTime) / 1000;
            r.timeGap = `+${diffSec.toFixed(3)}s`;
          } else {
            r.timeGap = "-";
          }
        });
      }
    } else {
      results.sort((a, b) => a.bestLap - b.bestLap);
      results.forEach((r, idx) => {
        r.pos = idx + 1;
        if (r.bestLap === Infinity) {
          r.timeGap = "NO TIME";
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
      const canOpenHero = !disableHeroClick && typeof DRIVER_INFO !== "undefined" && !!DRIVER_INFO[r.fullName];
      const rowStyle = canOpenHero ? "cursor:pointer;" : "";
      const safeFullName = r.fullName.replace(/'/g, "\\'");
      const rowClick = canOpenHero
        ? `onclick="openDriverHeroCustom(this, '${safeFullName}', '${r.seasonPoints}', '${r.seasonPos}')"`
        : "";

      return `
        <div class="f1-standings-row" style="${rowStyle}" ${rowClick}>
          <div class="col-pos" style="width: 12%;">${r.pos}</div>
          <div class="col-driver" style="width: 53%;">
            <img src="${r.headshot}" class="driver-headshot" alt="${r.shortName}" loading="lazy" onerror="this.src='${DEFAULT_DRIVER_IMG}'">
            <div class="driver-info">
              <div class="driver-name text-white">${r.shortName} ${isFastestOverall ? '<i class="fa-solid fa-stopwatch text-purple ms-1" title="Fastest Lap"></i>' : ""}</div>
              <div class="team-name m-0" style="color: ${r.color};">${r.team}</div>
            </div>
          </div>
          <div class="col-pts text-end" style="width: 35%; font-family: 'Share Tech Mono', monospace; font-size: 0.85rem;">
            <span class="f1-time-pill ${idx === 0 ? "winner-pill" : ""}">${r.timeGap}</span>
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("Session Results Error:", error);
    list.innerHTML = '<div class="text-center text-danger py-4">พบปัญหาในการดึงข้อมูล OpenF1 API<br><span class="small text-secondary">กรุณารอสักครู่แล้วลองใหม่อีกครั้ง</span></div>';
  }
}

function openDriverHeroCustom(rowEl, fullName, points, championshipPos) {
  if (typeof triggerHaptic === "function") triggerHaptic();
  const info = (typeof DRIVER_INFO !== "undefined") ? DRIVER_INFO[fullName] : null;
  if (!info) return;

  if (typeof currentHeroDriver !== "undefined") currentHeroDriver = fullName;
  if (typeof isHeroInPredictMode !== "undefined") isHeroInPredictMode = false;

  const radioBtn = document.getElementById("btnTeamRadio");
  if (radioBtn) radioBtn.style.setProperty("display", "none", "important");

  const parts = fullName.trim().split(" ");
  document.getElementById("heroDriverFirstName").innerText = parts[0] || "";
  document.getElementById("heroDriverLastName").innerText = parts.slice(1).join(" ") || "";
  document.getElementById("heroTeamName").innerText = info.team;
  document.getElementById("heroTeamLogo").src = getDriveDirectLink(TEAM_LOGOS[info.team] || "");
  document.getElementById("heroDriverImg").src = getDriveDirectLink(info.heroImg || info.img);

  let finalPts = points;
  let finalPos = championshipPos;
  if (window.f1DriverStandingsMap && window.f1DriverStandingsMap[fullName]) {
    finalPts = window.f1DriverStandingsMap[fullName].points;
    finalPos = "P" + window.f1DriverStandingsMap[fullName].position;
  }

  const heroPtsEl = document.getElementById("heroPoints");
  const heroPosEl = document.getElementById("heroPos");
  const cleanPos = String(finalPos || "-").startsWith("P") ? finalPos : ("P" + finalPos);
  if (heroPosEl) heroPosEl.textContent = cleanPos;

  const standardStatsEl = document.getElementById("heroStandardStats");
  const predictSectionEl = document.getElementById("heroPredictSection");
  if (standardStatsEl) {
    standardStatsEl.style.display = "block";
    standardStatsEl.style.marginTop = "0px";
    if (heroPtsEl && heroPtsEl.parentElement) heroPtsEl.parentElement.style.fontSize = "";
    if (heroPosEl) heroPosEl.style.fontSize = "";
  }
  if (predictSectionEl) predictSectionEl.style.display = "none";

  if (heroPtsEl) heroPtsEl.textContent = "0";
  setTimeout(() => {
    if (typeof animateCountUp === "function") {
      animateCountUp(heroPtsEl, finalPts, 1200);
    } else if (heroPtsEl) {
      heroPtsEl.textContent = finalPts;
    }
  }, 30);

  document.getElementById("heroBgColor").style.background = `linear-gradient(to bottom, #0a0e1c 0%, ${info.color}40 15%, #0a0e1c 65%)`;

  if (!window.driverHeroModalInstance) {
    window.driverHeroModalInstance = new bootstrap.Modal(document.getElementById("driverHeroModal"));
  }
  window.driverHeroModalInstance.show();
}

async function loadTelemetryHUD(sessionKey = "latest") {
  try {
    const [drivers, laps] = await Promise.all([
      fetchOpenF1Cached(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`),
      fetchOpenF1Cached(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`)
    ]);

    if (!Array.isArray(drivers) || !Array.isArray(laps)) return;

    const driverMap = {};
    drivers.forEach(d => {
      if (!d || d.driver_number === undefined) return;
      let driverColor = d.team_colour ? `#${String(d.team_colour).replace("#", "")}` : "#888888";

      const matchedFullName = resolveAppDriverName(d);
      if (typeof DRIVER_INFO !== "undefined" && DRIVER_INFO[matchedFullName]) {
        driverColor = DRIVER_INFO[matchedFullName].color;
      }

      driverMap[d.driver_number] = {
        name: d.name_acronym || (d.last_name ? d.last_name.substring(0, 3).toUpperCase() : "---"),
        color: driverColor
      };
    });

    let bestS1 = { time: Infinity, driverNum: null };
    let bestS2 = { time: Infinity, driverNum: null };
    let bestS3 = { time: Infinity, driverNum: null };
    let bestSpeed = { speed: 0, driverNum: null };

    laps.forEach(lap => {
      if (lap.duration_sector_1 > 0 && lap.duration_sector_1 < bestS1.time) bestS1 = { time: lap.duration_sector_1, driverNum: lap.driver_number };
      if (lap.duration_sector_2 > 0 && lap.duration_sector_2 < bestS2.time) bestS2 = { time: lap.duration_sector_2, driverNum: lap.driver_number };
      if (lap.duration_sector_3 > 0 && lap.duration_sector_3 < bestS3.time) bestS3 = { time: lap.duration_sector_3, driverNum: lap.driver_number };
      if (lap.st_speed > 0 && lap.st_speed > bestSpeed.speed) bestSpeed = { speed: lap.st_speed, driverNum: lap.driver_number };
    });

    const updateUI = (elementId, data, isSpeed = false) => {
      const parentEl = document.getElementById(elementId);
      if (!parentEl || !data.driverNum) return;

      const driver = driverMap[data.driverNum] || { name: "---", color: "#888888" };
      const tagEl = parentEl.querySelector(".driver-tag");
      if (tagEl) {
        tagEl.innerText = driver.name;
        tagEl.style.setProperty("--team-color", driver.color);
      }

      const valEl = parentEl.querySelector(isSpeed ? ".speed-val" : ".sector-time");
      if (valEl) {
        if (isSpeed) valEl.innerHTML = `${Math.round(data.speed)} <span class="unit">km/h</span>`;
        else valEl.innerText = data.time.toFixed(3);
      }
    };

    updateUI("fastestSec1", bestS1);
    updateUI("fastestSec2", bestS2);
    updateUI("fastestSec3", bestS3);
    updateUI("highestSpeed", bestSpeed, true);

  } catch (error) {
    console.error("❌ Telemetry HUD Error:", error);
  }
}
