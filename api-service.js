// =========================================================
// 2. API SERVICE & CACHING (การเชื่อมต่อฐานข้อมูลและ F1 API)
// =========================================================

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwZ_VB9I7ClOgDpd8bDkaY09CzipETJMeQPDK6Qk6JYVNPdgfXA6ZrmXDG8gYsJ9I6u/exec";

const apiCache = new Map();
const pendingRequests = new Map();

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
