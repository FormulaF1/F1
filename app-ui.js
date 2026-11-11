// =========================================================
// 3. APPLICATION UI & LOGIC (จัดการหน้าจอ, Modal, Timer, Events)
// =========================================================

let secretClicks = 0; 
let clickTimer = null; 
let adminModalInstance = null; 
let statsModalInstance = null; 
let breakdownModalInstance = null; 
let regModalInstance = null; 
let loginGateModalInstance = null; 
let imagePreviewModalInstance = null; 
let driverSelectorModalInstance = null;
let currentSelectingSlot = null;
let countdownInterval = null; 
let currentDeadline = null; 
let globalLeaderboard = []; 
let globalPlayers = []; 
let globalRaces = []; 
let lastPendingList = []; 
let currentActiveMedia = null;
let isRefreshing = false;
let currentArchiveMode = 'quali2025';
let playerChartInstance = null;

function showToast(msg, type='success') { 
  const c = document.getElementById('f1ToastContainer'); 
  if(!c) return; 
  const t = document.createElement('div'); 
  t.className = 'f1-toast ' + type; 
  t.innerHTML = (type==='success'?'✅':'⚠️') + ' <span>' + msg + '</span>'; 
  c.appendChild(t); 
  setTimeout(function() { t.remove(); }, 4700); 
}

function triggerHaptic() { 
  if (navigator.vibrate) navigator.vibrate(40); 
}

window.onload = function() {
  adminModalInstance = new bootstrap.Modal(document.getElementById('adminModal')); 
  statsModalInstance = new bootstrap.Modal(document.getElementById('statsModal')); 
  breakdownModalInstance = new bootstrap.Modal(document.getElementById('breakdownModal')); 
  regModalInstance = new bootstrap.Modal(document.getElementById('regModal')); 
  loginGateModalInstance = new bootstrap.Modal(document.getElementById('loginGateModal')); 
  imagePreviewModalInstance = new bootstrap.Modal(document.getElementById('imagePreviewModal'));

  const driverModalEl = document.getElementById('driverSelectorModal');
  if (driverModalEl) {
    driverSelectorModalInstance = new bootstrap.Modal(driverModalEl);
  }

  const optHtml = '<option value="" disabled selected>-- เลือกนักแข่ง --</option>' + DRIVERS.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
  document.querySelectorAll('.driver-opt').forEach(function(el) { el.innerHTML = optHtml; });

  buildDriverGrid();
  loadData();
};

function buildDriverGrid() {
  const container = document.getElementById('driverGridContainer');
  if (!container) return;
  let html = '';
  DRIVERS.forEach(function(name) {
    const info = DRIVER_INFO[name] || { team: "F1", color: "#888888", img: DEFAULT_DRIVER_IMG };
    const safeName = name.replace(/'/g, "\\'");
    
    const logoUrl = TEAM_LOGOS[info.team] ? getDriveDirectLink(TEAM_LOGOS[info.team]) : '';
    const logoHtml = logoUrl ? '<img src="' + logoUrl + '" class="driver-pick-team-logo" alt="">' : '';

    html += '<div class="driver-pick-btn" data-drivername="' + name.replace(/"/g, '&quot;') + '" style="--team-color: ' + info.color + '" onclick="confirmSelectDriver(\'' + safeName + '\')">' +
              '<div class="driver-pick-badges"></div>' +
              '<div class="driver-pick-name">' + name + '</div>' +
              '<div class="driver-pick-team">' + info.team + logoHtml + '</div>' +
              '<img src="' + getDriveDirectLink(info.img) + '" class="driver-pick-img" alt="' + name + '">' +
            '</div>';
  });
  container.innerHTML = html;
}

function openDriverSelector(slotId) {
  triggerHaptic();
  currentSelectingSlot = slotId;
  const titles = { 
    'pos1': 'P1 (อันดับที่ 1)', 
    'pos2': 'P2 (อันดับที่ 2)', 
    'pos3': 'P3 (อันดับที่ 3)', 
    'pos4': 'P4 (อันดับที่ 4)', 
    'posFL': 'Fastest Lap' 
  };
  const titleEl = document.getElementById('driverSelectorTitle');
  if (titleEl) {
    titleEl.innerHTML = '<i class="fa-solid fa-helmet-safety text-danger me-2"></i>เลือกนักแข่งสำหรับ ' + (titles[slotId] || '');
  }

  document.querySelectorAll('.driver-pick-btn').forEach(function(btn) {
    btn.classList.remove('already-selected');
    const badgeContainer = btn.querySelector('.driver-pick-badges');
    if (badgeContainer) badgeContainer.innerHTML = '';
  });

  const currentPicks = {
    'p1': document.getElementById('pos1') ? document.getElementById('pos1').value : '',
    'p2': document.getElementById('pos2') ? document.getElementById('pos2').value : '',
    'p3': document.getElementById('pos3') ? document.getElementById('pos3').value : '',
    'p4': document.getElementById('pos4') ? document.getElementById('pos4').value : '',
    'pfl': document.getElementById('posFL') ? document.getElementById('posFL').value : ''
  };
  
  const posLabels = { 'p1': 'P1', 'p2': 'P2', 'p3': 'P3', 'p4': 'P4', 'pfl': 'FL' };

  Object.keys(currentPicks).forEach(function(pos) {
    const driverName = currentPicks[pos];
    if (driverName) {
      const btn = document.querySelector('.driver-pick-btn[data-drivername="' + driverName.replace(/"/g, '\\"') + '"]');
      if (btn) {
        btn.classList.add('already-selected');
        const badgeContainer = btn.querySelector('.driver-pick-badges');
        if (badgeContainer) {
          badgeContainer.innerHTML += '<span class="pick-badge ' + pos + '">' + posLabels[pos] + '</span>';
        }
      }
    }
  });

  if (driverSelectorModalInstance) {
    driverSelectorModalInstance.show();
  }
}

function confirmSelectDriver(driverName) {
  triggerHaptic();
  if (!currentSelectingSlot) return;

  const selectEl = document.getElementById(currentSelectingSlot);
  if (selectEl) selectEl.value = driverName;
  updateCardUI(currentSelectingSlot, driverName);

  const slotSequence = ['pos1', 'pos2', 'pos3', 'pos4', 'posFL'];
  const currentIndex = slotSequence.indexOf(currentSelectingSlot);

  const flWrapper = document.getElementById('flWrapper');
  const isSprint = flWrapper && flWrapper.style.display === 'none';

  let nextSlot = null;
  if (currentIndex !== -1 && currentIndex < slotSequence.length - 1) {
    nextSlot = slotSequence[currentIndex + 1];
    if (isSprint && nextSlot === 'posFL') {
      nextSlot = null; 
    }
  }

  if (nextSlot) {
    setTimeout(function() {
      openDriverSelector(nextSlot);
    }, 150);
  } else {
    if (driverSelectorModalInstance) {
      driverSelectorModalInstance.hide();
    }
  }
}

function updateCardUI(slotId, driverName) {
  const card = document.getElementById('card-' + slotId);
  if (!card) return;
  const emptyState = card.querySelector('.slot-empty-state');
  const filledState = card.querySelector('.slot-filled-state');

  if (!driverName) {
    card.classList.remove('filled');
    emptyState.classList.remove('d-none');
    filledState.classList.add('d-none');
    return;
  }

  const info = DRIVER_INFO[driverName] || { team: "F1", color: "#e10600", img: DEFAULT_DRIVER_IMG };
  card.classList.add('filled');
  card.style.setProperty('--team-color', info.color);

  document.getElementById('name-' + slotId).innerText = driverName;
  document.getElementById('team-' + slotId).innerText = info.team;
  document.getElementById('img-' + slotId).src = getDriveDirectLink(info.img);

  const watermarkEl = document.getElementById('watermark-' + slotId);
  if (watermarkEl) {
    watermarkEl.src = getDriveDirectLink(TEAM_LOGOS[info.team] || "");
  }

  emptyState.classList.add('d-none');
  filledState.classList.remove('d-none');
}

function registerSecretClick() { 
  triggerHaptic(); 
  secretClicks++; 
  clearTimeout(clickTimer); 
  if (secretClicks >= 5) { 
    secretClicks = 0; 
    openAdminModal(); 
  } else { 
    clickTimer = setTimeout(function() { secretClicks = 0; }, 2000); 
  } 
}

function openAdminModal() { adminModalInstance.show(); } 
function openRegisterModal() { regModalInstance.show(); } 
function openLoginGateModal() { loginGateModalInstance.show(); }

function getDriveDirectLink(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return 'https://lh3.googleusercontent.com/d/' + match[1];
  }
  return url; 
}

function openMediaPreview(type) { 
  triggerHaptic(); 
  if (!currentActiveMedia || !currentActiveMedia[type]) { 
    showToast('ไม่มีรูป', 'error'); 
    return; 
  } 
  document.getElementById('previewImageSrc').src = getDriveDirectLink(currentActiveMedia[type]); 
  imagePreviewModalInstance.show(); 
}

function openMediaPreview2025(type) { 
  triggerHaptic(); 
  if (!currentActiveMedia || !currentActiveMedia[type]) { 
    showToast('ไม่มีรูปปีก่อน', 'error'); 
    return; 
  } 
  document.getElementById('previewImageSrc').src = getDriveDirectLink(currentActiveMedia[type]); 
  imagePreviewModalInstance.show(); 
}

const imgPreviewEl = document.getElementById('imagePreviewModal');
if (imgPreviewEl) {
  imgPreviewEl.addEventListener('hidden.bs.modal', function () { 
    document.getElementById('previewImageSrc').src = ''; 
  });
}

function previewTrackImageById(imgId) {
  triggerHaptic();
  const el = document.getElementById(imgId);
  if (!el || !el.src) return;
  document.getElementById('previewImageSrc').src = el.src;
  imagePreviewModalInstance.show();
}

function onAdminMediaRaceChange() {
  const raceId = document.getElementById('adMediaRace').value; 
  const currentRace = globalRaces.find(function(r) { return r.id === raceId; });
  if (currentRace && currentRace.media) { 
    document.getElementById('adTrackImgUrl').value = currentRace.media.trackImg || "";
    document.getElementById('adPracticeUrl').value = currentRace.media.practiceImg || ""; 
    document.getElementById('adQuali2025Url').value = currentRace.media.quali2025 || ""; 
    document.getElementById('adRace2025Url').value = currentRace.media.race2025 || ""; 
    document.getElementById('adExtLink').value = currentRace.media.extLink || ""; 
  } else { 
    document.getElementById('adTrackImgUrl').value = "";
    document.getElementById('adPracticeUrl').value = ""; 
    document.getElementById('adQuali2025Url').value = ""; 
    document.getElementById('adRace2025Url').value = ""; 
    document.getElementById('adExtLink').value = ""; 
  }
}

function onAdminRaceChange() {
  const rSel = document.getElementById('adminRace');
  const opt = rSel.options[rSel.selectedIndex];
  if (!opt || !opt.value) return;
  const isSprint = opt.dataset.type === 'Sprint';
  const flWrap = document.getElementById('adminFlWrapper');
  if (flWrap) flWrap.style.display = isSprint ? 'none' : 'block';
}

function switchToRegisterFromLogin() { loginGateModalInstance.hide(); regModalInstance.show(); }

function confirmLoginGate() { 
  triggerHaptic(); 
  const selected = document.getElementById('loginPlayerSelect').value; 
  const pinEl = document.getElementById('loginPin');
  const pin = pinEl ? pinEl.value : "";

  if (!selected) { showToast('กรุณาเลือกชื่อก่อน', 'error'); return; } 
  if (pinEl && (!pin || pin.length !== 4)) { showToast('กรุณากรอก PIN 4 หลัก', 'error'); return; }

  const btn = document.querySelector('#loginGateModal .btn-race');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>ตรวจสอบ...';

  callGAS("loginPlayer", { playerName: selected, pin: pin }).then(function(res) {
    btn.disabled = false; btn.innerHTML = oldText;
    if (res.success) {
      localStorage.setItem('f1_player_name', selected); 
      localStorage.setItem('f1_player_pin', pin); 
      if (pinEl) pinEl.value = '';
      updateUserSessionUI(); 
      loginGateModalInstance.hide(); 
      onRaceChange(); 
      showToast('เข้าสู่ระบบสำเร็จ!', 'success'); 
    } else {
      showToast(res.msg, 'error');
    }
  }).catch(function(err) {
    btn.disabled = false; btn.innerHTML = oldText;
    showToast('Error: ' + err, 'error');
  });
}

function showTab(tabId, el) { 
  triggerHaptic(); 
  document.querySelectorAll('.tab-pane-custom').forEach(function(p) { p.style.display = 'none'; }); 
  document.querySelectorAll('.f1-nav-link').forEach(function(l) { l.classList.remove('active'); }); 
  document.getElementById(tabId).style.display = 'block'; 
  el.classList.add('active'); 
}

function forceRefreshData() { 
  if (isRefreshing) return;
  isRefreshing = true;
  triggerHaptic();
  
  const refreshBtns = document.querySelectorAll('.fa-rotate');
  refreshBtns.forEach(btn => btn.classList.add('fa-spin'));
  
  showToast('กำลังซิงค์ข้อมูลล่าสุด...', 'success');

  callGAS("getInitData").then(function(data) {
    isRefreshing = false; 
    refreshBtns.forEach(btn => btn.classList.remove('fa-spin'));
    if(!data) return;
    
    localStorage.setItem('f1_cached_data', JSON.stringify(data));
    renderUI(data);
    showToast('อัปเดตข้อมูลเรียบร้อย!', 'success');
  }).catch(function(err) { 
    isRefreshing = false; 
    refreshBtns.forEach(btn => btn.classList.remove('fa-spin'));
    showToast('Error: ' + err, 'error'); 
  });
}

function renderUI(data) {
  globalLeaderboard = data.leaderboard || []; 
  globalPlayers = data.players || []; 
  globalRaces = data.races || [];

  const pGate = document.getElementById('loginPlayerSelect');
  if(pGate) pGate.innerHTML = '<option value="" disabled selected>-- เลือกชื่อ --</option>' + globalPlayers.map(function(p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');

  const savedPlayer = localStorage.getItem('f1_player_name');
  if (!savedPlayer || !globalPlayers.includes(savedPlayer)) { 
    const loginEl = document.getElementById('loginGateModal');
    if(loginGateModalInstance && loginEl && !loginEl.classList.contains('show')) loginGateModalInstance.show(); 
  } else { 
    if(pGate) pGate.value = savedPlayer; 
  }
  updateUserSessionUI();

  const openRaces = globalRaces.filter(function(r) { return r.status === 'OPEN'; });
  const selRace = document.getElementById('selRace');
  
  if (selRace) {
    const currentSelected = selRace.value; 
    selRace.innerHTML = '<option value="" disabled selected>-- เลือกสนาม --</option>' + openRaces.map(function(r) { return '<option value="' + r.id + '" data-type="' + r.type + '" data-dl="' + r.deadline + '">🟢 ' + r.name + '</option>'; }).join('');
    
    if (currentSelected && openRaces.some(function(r) { return r.id === currentSelected; })) {
      selRace.value = currentSelected;
    } else if (!currentSelected && openRaces.length === 1) {
      selRace.value = openRaces[0].id;
      setTimeout(onRaceChange, 100); 
    }
  }

  const allRaceOpts = '<option value="" disabled selected>-- เลือกสนาม --</option>' + globalRaces.map(function(r) { return '<option value="' + r.id + '" data-type="' + r.type + '">' + (r.status === 'OPEN' ? '🔴' : (r.status === 'CALCULATED' ? '🏁' : '⚡')) + ' ' + r.name + '</option>'; }).join('');
  ['selCommRace','adminRace','adRaceDead','adRaceCheck','adMediaRace','selCenterRace','sel2025Race'].forEach(function(id) { let el = document.getElementById(id); if(el) el.innerHTML = allRaceOpts; });

  if (globalRaces.length > 0) { document.getElementById('adMediaRace').value = globalRaces[0].id; onAdminMediaRaceChange(); }
  if (openRaces.length > 0) { document.getElementById('selCenterRace').value = openRaces[0].id; document.getElementById('sel2025Race').value = openRaces[0].id; onCenterRaceChange(); on2025RaceChange(); }

  const lbContainer = document.getElementById('lbListContainer'); 
  const podiumContainer = document.getElementById('podiumContainer');

  if (!globalLeaderboard || globalLeaderboard.length === 0) {
    if (podiumContainer) podiumContainer.innerHTML = ''; 
    if (lbContainer) lbContainer.innerHTML = '<div class="text-center text-muted py-3">ยังไม่มีคะแนนสะสม</div>';
  } else {
    let podiumHtml = '<div class="premium-podium-container">'; 
    const top1 = globalLeaderboard[0];
    const top2 = globalLeaderboard[1];
    const top3 = globalLeaderboard[2];
    const rest = globalLeaderboard.slice(3);

    if (top1) {
      const team = top1[4] || "F1";
      const teamColor = TEAM_COLORS[team] || "#555555";
      const logoUrl = TEAM_LOGOS[team] || ""; 
      const carUrl = TEAM_CARS[team] || "";
      const teamIcon = logoUrl ? '<img src="' + getDriveDirectLink(logoUrl) + '" class="team-logo-small" alt="">' : '';
      const carImg = carUrl ? '<img src="' + getDriveDirectLink(carUrl) + '" alt="">' : '';

      podiumHtml += '<div class="premium-card king" style="--team-color: ' + teamColor + '; --border-color: #ffb703;" onclick="showPlayerStats(decodeURIComponent(\'' + encodeURIComponent(String(top1[1])) + '\'))">' +
                      '<div class="bg-glow"></div>' +
                      '<img src="' + getDriveDirectLink(logoUrl) + '" class="watermark-logo" alt="">' +
                      '<div class="card-header">' +
                        '<div class="rank-badge rank-1"><i class="fa-solid fa-crown me-1"></i>1</div>' +
                        '<div class="pts-display">' + top1[2] + ' <span class="pts-label">PTS</span></div>' +
                      '</div>' +
                      '<div class="car-showcase">' + carImg + '</div>' +
                      '<div class="card-footer">' +
                        '<div class="player-name">' + top1[1] + '</div>' +
                        teamIcon +
                      '</div>' +
                    '</div>';
    }

    if (top2 || top3) {
      podiumHtml += '<div class="princes-row">';
      [top2, top3].forEach(function(p, idx) {
        if(!p) return;
        const rank = idx + 2; 
        const team = p[4] || "F1";
        const teamColor = TEAM_COLORS[team] || "#555555";
        const logoUrl = TEAM_LOGOS[team] || ""; 
        const carUrl = TEAM_CARS[team] || "";
        const teamIcon = logoUrl ? '<img src="' + getDriveDirectLink(logoUrl) + '" class="team-logo-small" alt="">' : '';
        const carImg = carUrl ? '<img src="' + getDriveDirectLink(carUrl) + '" alt="">' : '';
        const borderColor = rank === 2 ? '#cbd5e1' : '#d97706';

        podiumHtml += '<div class="premium-card prince" style="--team-color: ' + teamColor + '; --border-color: ' + borderColor + ';" onclick="showPlayerStats(decodeURIComponent(\'' + encodeURIComponent(String(p[1])) + '\'))">' +
                        '<div class="bg-glow"></div>' +
                        '<img src="' + getDriveDirectLink(logoUrl) + '" class="watermark-logo" alt="">' +
                        '<div class="card-header">' +
                          '<div class="rank-badge rank-' + rank + '">' + rank + '</div>' +
                          '<div class="pts-display">' + p[2] + ' <span class="pts-label">PTS</span></div>' +
                        '</div>' +
                        '<div class="car-showcase">' + carImg + '</div>' +
                        '<div class="card-footer">' +
                          '<div class="player-name">' + p[1] + '</div>' +
                          teamIcon +
                        '</div>' +
                      '</div>';
      });
      podiumHtml += '</div>';
    }

    podiumHtml += '</div>';

    if(podiumContainer) podiumContainer.innerHTML = podiumHtml;

    if(lbContainer) {
      lbContainer.innerHTML = rest.map(function(row) {
        const rank = row[0];
        const name = row[1];
        const totalPts = row[2];
        const lastPts = Number(row[3]) || 0;
        const team = row[4] || "F1";

        const teamColor = TEAM_COLORS[team] || "#555555";
        const logoUrl = TEAM_LOGOS[team] || "";
        const carUrl = TEAM_CARS[team] || "";

        const gainBadge = lastPts > 0 ? '<div class="pts-gain-badge">+' + lastPts + '</div>' : '';

        return '<div class="player-list-card" style="--team-color: ' + teamColor + ';" onclick="showPlayerStats(decodeURIComponent(\'' + encodeURIComponent(String(name)) + '\'))">' +
                 '<img src="' + getDriveDirectLink(logoUrl) + '" class="player-list-watermark" alt="">' +
                 (carUrl ? '<img src="' + getDriveDirectLink(carUrl) + '" class="player-list-car-img" alt="Car">' : '') +
                 '<div class="player-list-content">' +
                   '<div class="player-list-left">' +
                     '<div class="player-list-rank">' + rank + '</div>' +
                     '<div class="player-list-name">' + name + '</div>' +
                   '</div>' +
                   '<div class="player-list-right">' +
                     gainBadge +
                     '<div class="player-list-total">' + totalPts + ' <span class="pts-lbl">PTS</span></div>' +
                   '</div>' +
                 '</div>' +
               '</div>';
      }).join('');
    }
  }

  const calcRaces = globalRaces.filter(function(r) { return r.status === 'CALCULATED'; }); 
  const finishedSelect = document.getElementById('selFinishedRace');
  if(finishedSelect) {
    if (calcRaces.length === 0) { 
      finishedSelect.innerHTML = '<option value="" disabled selected>-- ยังไม่มีสนามที่สรุปผล --</option>'; 
      finishedSelect.disabled = true; 
    } else { 
      finishedSelect.disabled = false; 
      finishedSelect.innerHTML = '<option value="" disabled selected>-- เลือกสนาม --</option>' + calcRaces.map(function(r) { return '<option value="' + r.id + '">🏁 ' + r.name + '</option>'; }).join(''); 
    }
  }
}

function loadData(ignoreCache = false) {
  if (!ignoreCache) {
    const cachedStr = localStorage.getItem('f1_cached_data');
    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr);
        renderUI(cachedData);
        document.getElementById('globalLoader').classList.add('hidden');
      } catch(e) {}
    } else {
      document.getElementById('globalLoader').classList.remove('hidden');
    }
  }

  callGAS("getInitData").then(function(data) {
    isRefreshing = false; 
    if(!data) return;
    localStorage.setItem('f1_cached_data', JSON.stringify(data));
    renderUI(data);
    document.getElementById('globalLoader').classList.add('hidden');
  }).catch(function(err) { 
    isRefreshing = false; 
    showToast('Error: ' + err, 'error'); 
    document.getElementById('globalLoader').classList.add('hidden'); 
  });
}

function handleCheckFinishedRace() { 
  triggerHaptic(); 
  const raceId = document.getElementById('selFinishedRace').value; 
  if (!raceId) { showToast('กรุณาเลือกสนามก่อน', 'error'); return; } 
  openBreakdownModal(raceId); 
}

function updateUserSessionUI() {
  const player = localStorage.getItem('f1_player_name');
  const formDisplay = document.getElementById('formPlayerDisplay');
  const bannerEl = document.getElementById('userScoreBanner');

  if (!player) { 
    document.getElementById('myPlayerName').innerText = '--'; 
    document.getElementById('myCurrentRank').innerText = '-'; 
    document.getElementById('myTotalScore').innerText = '0'; 
    if (formDisplay) formDisplay.innerText = '-';
    if (bannerEl) bannerEl.style.removeProperty('--theme-color');
    return; 
  }

  document.getElementById('myPlayerName').innerText = player; 
  if (formDisplay) formDisplay.innerText = player;

  const match = globalLeaderboard.find(function(row) { return String(row[1]).toLowerCase() === player.toLowerCase(); });
  if (match) { 
    document.getElementById('myCurrentRank').innerText = 'อันดับที่ ' + match[0]; 
    document.getElementById('myTotalScore').innerText = match[2]; 
    
    const team = match[4] || "F1";
    const teamColor = TEAM_COLORS[team] || "#e10600";
    if (bannerEl) bannerEl.style.setProperty('--theme-color', teamColor);
    
  } else { 
    document.getElementById('myCurrentRank').innerText = 'ยังไม่มีอันดับ'; 
    document.getElementById('myTotalScore').innerText = '0'; 
    if (bannerEl) bannerEl.style.removeProperty('--theme-color');
  }
}

function onRaceChange() {
  const rSel = document.getElementById('selRace'); 
  const opt = rSel.options[rSel.selectedIndex]; 
  if (!opt || !opt.value) return;
  const raceId = opt.value; 
  const isSprint = opt.dataset.type === 'Sprint'; 
  document.getElementById('flWrapper').style.display = isSprint ? 'none' : 'block';
  
  let rawDl = (opt.dataset.dl || "").trim(); 
  currentDeadline = parseThaiDeadline(rawDl);
  startCountdown();

  const raceObj = globalRaces.find(function(r) { return r.id === raceId; });
  const imgWrapper = document.getElementById('trackImageWrapper');
  const imgEl = document.getElementById('trackImagePreview');
  if (imgWrapper && imgEl) {
    if (raceObj && raceObj.media && raceObj.media.trackImg) {
      imgEl.src = getDriveDirectLink(raceObj.media.trackImg);
      imgWrapper.style.display = 'block';
    } else {
      imgEl.src = '';
      imgWrapper.style.display = 'none';
    }
  }

  ['pos1','pos2','pos3','pos4','posFL'].forEach(function(id) { 
    const el = document.getElementById(id);
    if (el) el.value = ''; 
    updateCardUI(id, ''); 
  });

  const player = localStorage.getItem('f1_player_name'); 
  const histAlert = document.getElementById('savedPredAlert');
  if (player) {
    callGAS("getUserSavedPrediction", { raceId: raceId, playerName: player }).then(function(res) {
      if (res.found) {
        histAlert.style.display = 'block'; 
        document.getElementById('savedPredTime').innerText = 'บันทึกเมื่อ: ' + res.submittedAt; 
        document.getElementById('savedPredContent').innerHTML = '<strong>P1:</strong> ' + res.p1 + ' | <strong>P2:</strong> ' + res.p2 + '<br><strong>P3:</strong> ' + res.p3 + ' | <strong>P4:</strong> ' + res.p4 + (res.fl ? ' | <strong>FL:</strong> ' + res.fl : '');

        const savedVals = [res.p1, res.p2, res.p3, res.p4, res.fl];
        ['pos1','pos2','pos3','pos4','posFL'].forEach(function(id, i) { 
          const val = savedVals[i] || '';
          const el = document.getElementById(id);
          if (el) el.value = val; 
          updateCardUI(id, val);
        });
      } else { histAlert.style.display = 'none'; }
    });
  } else { histAlert.style.display = 'none'; }
}

function formatPirelliTires(tireStr) {
  if (!tireStr || tireStr.trim() === '-' || tireStr.trim() === '') return '-';
  
  const matches = tireStr.toUpperCase().match(/C\d/g);
  if (!matches || matches.length === 0) {
    return tireStr;
  }

  const sorted = matches.slice().sort(function(a, b) {
    return parseInt(a.replace('C', '')) - parseInt(b.replace('C', ''));
  });

  let html = '<div class="pirelli-compounds-wrap">';
  sorted.forEach(function(comp, idx) {
    let colorClass = 'tyre-medium';
    let labelTitle = 'Medium';
    if (sorted.length === 3) {
      if (idx === 0) { colorClass = 'tyre-hard'; labelTitle = 'Hard'; }
      else if (idx === 1) { colorClass = 'tyre-medium'; labelTitle = 'Medium'; }
      else if (idx === 2) { colorClass = 'tyre-soft'; labelTitle = 'Soft'; }
    } else if (idx === 0) {
      colorClass = 'tyre-hard';
    } else if (idx === sorted.length - 1) {
      colorClass = 'tyre-soft';
    }
    html += '<span class="tyre-compound-pill ' + colorClass + '" title="' + labelTitle + '">' + comp + '</span>';
  });
  html += '</div>';
  return html;
}

function onCenterRaceChange() {
  const raceId = document.getElementById('selCenterRace').value; 
  const currentRace = globalRaces.find(function(r) { return r.id === raceId; }); 
  const container = document.getElementById('rcContent');
  if (!currentRace) { container.style.display = 'none'; return; }
  container.style.display = 'block'; 
  currentActiveMedia = currentRace.media || null; 
  const m = currentActiveMedia || {};

  const practiceWrapper = document.getElementById('practiceSectionWrapper');
  const thumbPrac = document.getElementById('thumbPractice');
  
  if (practiceWrapper && thumbPrac) {
    if (m.practiceImg && m.practiceImg.trim() !== "") {
      thumbPrac.src = getDriveDirectLink(m.practiceImg);
      practiceWrapper.style.display = 'block';
    } else {
      thumbPrac.src = '';
      practiceWrapper.style.display = 'none';
    }
  }
  
  const oddsBtn = document.getElementById('rcExtLinkBtn');
  if (oddsBtn) { 
    if (m.extLink && m.extLink.trim() !== "") { 
      oddsBtn.href = m.extLink; 
      oddsBtn.onclick = null; 
    } else { 
      oddsBtn.href = "javascript:void(0)"; 
      oddsBtn.onclick = function() { showToast("ไม่มีลิงก์", "error"); }; 
    } 
  }
  
  const info = currentRace.trackInfo || {};
  document.getElementById('rcTrackType').innerText = info.trackType || '-'; 
  document.getElementById('rcTires').innerHTML = formatPirelliTires(info.tires || '-'); 
  document.getElementById('rcSafetyCar').innerText = info.safetyCar || '-'; 
  document.getElementById('rcWeather').innerHTML = '<span class="weather-icon-animated">' + (info.weather || '-') + '</span>'; 
  document.getElementById('rcPrevWinners').innerText = info.prevWinners || '-'; 
  document.getElementById('rcKeyNote').innerText = info.keyNote || '-';

  const layoutWrapper = document.getElementById('rcTrackLayoutWrapper');
  const layoutImg = document.getElementById('rcTrackLayoutImg');
  if (layoutWrapper && layoutImg) {
    if (m.trackLayoutImg && m.trackLayoutImg.trim() !== "") {
      layoutImg.src = getDriveDirectLink(m.trackLayoutImg);
      layoutWrapper.style.display = 'block';
    } else {
      layoutImg.src = '';
      layoutWrapper.style.display = 'none';
    }
  }
}

function on2025RaceChange() {
  const raceId = document.getElementById('sel2025Race').value; 
  const currentRace = globalRaces.find(function(r) { return r.id === raceId; }); 
  const container = document.getElementById('content2025');
  if (!currentRace) { container.style.display = 'none'; return; }
  container.style.display = 'block'; 
  currentActiveMedia = currentRace.media || null; 
  const m = currentActiveMedia || {};

  const dotQuali = document.getElementById('dotQuali2025');
  const dotRace = document.getElementById('dotRace2025');
  const hasQuali = !!(m.quali2025 && m.quali2025.trim() !== "");
  const hasRace = !!(m.race2025 && m.race2025.trim() !== "");

  if (dotQuali) dotQuali.className = hasQuali ? 'seg-dot ready' : 'seg-dot';
  if (dotRace) dotRace.className = hasRace ? 'seg-dot ready' : 'seg-dot';

  if (currentArchiveMode === 'quali2025' && !hasQuali && hasRace) {
    currentArchiveMode = 'race2025';
  } else if (currentArchiveMode === 'race2025' && !hasRace && hasQuali) {
    currentArchiveMode = 'quali2025';
  }

  switchArchiveMode(currentArchiveMode, true);
}

function switchArchiveMode(mode, skipHaptic) {
  if (!skipHaptic) triggerHaptic();
  currentArchiveMode = mode;

  const btnQuali = document.getElementById('segBtnQuali');
  const btnRace = document.getElementById('segBtnRace');
  const headerTitle = document.getElementById('archiveHeaderTitle');
  const mainImg = document.getElementById('archiveMainImg');
  const badge = document.getElementById('archiveFloatingBadge');
  const emptyState = document.getElementById('archiveEmptyState');

  if (mode === 'quali2025') {
    if (btnQuali) btnQuali.className = 'archive-seg-btn active-quali';
    if (btnRace) btnRace.className = 'archive-seg-btn';
    if (headerTitle) headerTitle.innerHTML = '<i class="fa-solid fa-stopwatch text-info me-2"></i>QUALIFYING CLASSIFICATION';
  } else {
    if (btnQuali) btnQuali.className = 'archive-seg-btn';
    if (btnRace) btnRace.className = 'archive-seg-btn active-race';
    if (headerTitle) headerTitle.innerHTML = '<i class="fa-solid fa-flag-checkered text-warning me-2"></i>OFFICIAL RACE CLASSIFICATION';
  }

  const m = currentActiveMedia || {};
  const imgUrl = m[mode];

  if (imgUrl && imgUrl.trim() !== "") {
    if (mainImg) {
      mainImg.style.opacity = '0.3';
      mainImg.src = getDriveDirectLink(imgUrl);
      mainImg.style.display = 'block';
      setTimeout(function() { mainImg.style.opacity = '1'; }, 50);
    }
    if (badge) badge.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
  } else {
    if (mainImg) {
      mainImg.src = '';
      mainImg.style.display = 'none';
    }
    if (badge) badge.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
  }
}

function openActiveArchivePreview() {
  const m = currentActiveMedia || {};
  if (!m[currentArchiveMode] || m[currentArchiveMode].trim() === "") return;
  openMediaPreview2025(currentArchiveMode);
}

// =========================================================
// ACCURATE PIT-WALL TIMER
// =========================================================
function parseThaiDeadline(rawDl) {
  if (!rawDl) return null;
  let cleanStr = rawDl.trim().replace(' ', 'T');
  if (!cleanStr.includes('Z') && !cleanStr.includes('+') && cleanStr.length <= 19) {
    if (cleanStr.split(':').length === 2) cleanStr += ':00';
    cleanStr += '+07:00';
  }
  const dt = new Date(cleanStr);
  return isNaN(dt.getTime()) ? new Date(rawDl.replace(' ', 'T')) : dt;
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  const box = document.getElementById('countdownBox');
  const submitBtn = document.getElementById('btnPred');
  if (!box) return;

  box.className = 'countdown-box'; 

  if (!currentDeadline || isNaN(currentDeadline.getTime())) {
    box.style.display = 'block';
    box.innerHTML = '<div class="text-secondary small py-1"><i class="fa-solid fa-clock me-1"></i>ยังไม่ได้กำหนดเวลาปิดรับ</div>';
    return;
  }

  box.style.display = 'block';
  box.innerHTML = `
    <div class="timer-units">
      <div><div class="timer-num" id="t-day">00</div><div class="timer-lbl">DAY</div></div>
      <div><div class="timer-num" id="t-hr">00</div><div class="timer-lbl">HRS</div></div>
      <div><div class="timer-num" id="t-min">00</div><div class="timer-lbl">MIN</div></div>
      <div><div class="timer-num" id="t-sec">00</div><div class="timer-lbl">SEC</div></div>
    </div>`;

  const elDay = document.getElementById('t-day');
  const elHr  = document.getElementById('t-hr');
  const elMin = document.getElementById('t-min');
  const elSec = document.getElementById('t-sec');
  const pad = (n) => String(n).padStart(2, '0');

  function updateTimer() {
    const diff = currentDeadline.getTime() - Date.now();

    if (diff <= 0) {
      box.className = 'countdown-box status-closed';
      box.innerHTML = '<div class="text-danger fw-bold py-1"><i class="fa-solid fa-lock me-1"></i>หมดเวลาทายผล (PARC FERMÉ)</div>';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-lock me-2"></i>SESSION CLOSED';
      }
      clearInterval(countdownInterval);
      return;
    }

    if (diff <= 900000) { box.className = 'countdown-box status-critical'; } 
    else if (diff <= 3600000) { box.className = 'countdown-box status-warning'; } 
    else { box.className = 'countdown-box'; }

    if (submitBtn && submitBtn.disabled) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>SUBMIT PREDICTION';
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff / 3600000) % 24);
    const m = Math.floor((diff / 60000) % 60);
    const s = Math.floor((diff / 1000) % 60);

    if (elDay && elDay.textContent !== pad(d)) elDay.textContent = pad(d);
    if (elHr  && elHr.textContent  !== pad(h)) elHr.textContent  = pad(h);
    if (elMin && elMin.textContent !== pad(m)) elMin.textContent = pad(m);
    if (elSec) elSec.textContent = pad(s);
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

// =========================================================
// ADVANCED SCORING ENGINE
// =========================================================
function calculateDetailedScore(actual, pred, isSprint = false) {
  if (!actual || !pred) return { total: 0, details: {} };

  let total = 0;
  const details = {};
  const actualTop4 = [actual.p1, actual.p2, actual.p3, actual.p4].map(d => (d || '').trim().toLowerCase());
  const positions = ['p1', 'p2', 'p3', 'p4'];

  positions.forEach((pos) => {
    const pDriver = (pred[pos] || '').trim().toLowerCase();
    const aDriver = (actual[pos] || '').trim().toLowerCase();

    if (!pDriver) {
      details[pos] = { pts: 0, status: 'MISS', label: 'ไม่ได้เลือก' };
      return;
    }

    if (pDriver === aDriver) {
      total += SCORING_RULES.EXACT_POS;
      details[pos] = { pts: SCORING_RULES.EXACT_POS, status: 'EXACT', label: `✅ เป๊ะ (+${SCORING_RULES.EXACT_POS})` };
    } else if (SCORING_RULES.IN_TOP4_WRONG_POS > 0 && actualTop4.includes(pDriver)) {
      total += SCORING_RULES.IN_TOP4_WRONG_POS;
      details[pos] = { pts: SCORING_RULES.IN_TOP4_WRONG_POS, status: 'PARTIAL', label: `⚡ ติด Top 4 (+${SCORING_RULES.IN_TOP4_WRONG_POS})` };
    } else {
      details[pos] = { pts: 0, status: 'MISS', label: '❌ พลาด (0)' };
    }
  });

  if (!isSprint) {
    const pFL = (pred.fl || '').trim().toLowerCase();
    const aFL = (actual.fl || '').trim().toLowerCase();
    if (pFL && aFL && pFL === aFL) {
      total += SCORING_RULES.FASTEST_LAP;
      details.fl = { pts: SCORING_RULES.FASTEST_LAP, status: 'EXACT', label: `⚡ FL เป๊ะ (+${SCORING_RULES.FASTEST_LAP})` };
    } else {
      details.fl = { pts: 0, status: 'MISS', label: '❌ พลาด (0)' };
    }
  }

  return { total, details };
}

function openBreakdownModal(raceId) {
  triggerHaptic();
  breakdownModalInstance.show();
  const body = document.getElementById('breakdownBody');
  body.innerHTML = '<div class="text-center py-3"><i class="fa-solid fa-spinner fa-spin me-2"></i>กำลังวิเคราะห์ Telemetry คะแนน...</div>';

  callGAS("getRaceBreakdown", { raceId: raceId, playerName: localStorage.getItem('f1_player_name') || '' }, { useCache: true, ttl: 60000 })
    .then(function(res) {
      if (!res.actual) {
        body.innerHTML = '<div class="text-danger text-center">ไม่พบข้อมูลผลการแข่งขัน</div>';
        return;
      }
      const act = res.actual;
      const pred = res.userPred;
      const isSprint = act.type === 'Sprint';
      const calc = calculateDetailedScore(act, pred, isSprint);
      const displayScore = pred && pred.score !== undefined ? pred.score : calc.total;

      function renderMatchRow(posKey, posTitle, actVal, predVal) {
        const info = calc.details[posKey] || { status: 'MISS', label: '0' };
        let pillClass = 'score-pill-miss';
        let borderClass = 'border-secondary';
        if (info.status === 'EXACT') { pillClass = 'score-pill-exact'; borderClass = 'border-success'; }
        else if (info.status === 'PARTIAL') { pillClass = 'score-pill-partial'; borderClass = 'border-warning'; }

        return `
          <div class="p-2 mb-2 rounded bg-black border ${borderClass}">
            <div class="d-flex justify-content-between align-items-center small text-secondary mb-1">
              <span><strong>${posTitle}</strong> (ผลจริง: <span class="text-warning fw-bold">${actVal || '-'}</span>)</span>
              ${pred ? `<span class="${pillClass}">${info.label}</span>` : ''}
            </div>
            <div class="small text-white">คุณทาย: <strong>${predVal || '<span class="text-muted">ไม่ได้ส่ง</span>'}</strong></div>
          </div>`;
      }

      let html = `
        <div class="mb-3 text-center">
          <h6 class="fw-bold text-white mb-2 f1-font">${act.name}</h6>
          ${pred 
            ? `<span class="badge bg-warning text-dark fs-6 px-3 py-2">คะแนนรวมที่ได้: ${displayScore} PTS</span>` 
            : `<span class="badge bg-secondary">คุณไม่ได้ส่งคำทายในสนามนี้</span>`}
        </div>
        ${renderMatchRow('p1', '🥇 P1', act.p1, pred ? pred.p1 : '')}
        ${renderMatchRow('p2', '🥈 P2', act.p2, pred ? pred.p2 : '')}
        ${renderMatchRow('p3', '🥉 P3', act.p3, pred ? pred.p3 : '')}
        ${renderMatchRow('p4', '🏁 P4', act.p4, pred ? pred.p4 : '')}
      `;

      if (!isSprint) {
        html += renderMatchRow('fl', '⚡ Fastest Lap', act.fl, pred ? pred.fl : '');
      }

      body.innerHTML = html;
    });
}

function getShortDriverName(fullName) {
  if (!fullName || fullName === '-') return '-';
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}

function loadCommunityPredictions() {
  const raceId = document.getElementById('selCommRace').value; 
  const box = document.getElementById('commContent'); 
  box.innerHTML = '<div class="text-center text-secondary py-4"><i class="fa-solid fa-spinner fa-spin me-2"></i>กำลังดึงตั๋วโพยเพื่อน...</div>';

  const currentRace = globalRaces.find(function(r) { return r.id === raceId; });
  const isCalculated = currentRace && currentRace.status === 'CALCULATED';

  callGAS("getCommunityPredictions", { raceId: raceId }).then(function(res) {
    if (!res.locked) { 
      box.innerHTML = 
        '<div class="locked-ticket-card">' +
          '<div class="rubber-stamp-locked"><i class="fa-solid fa-lock me-2"></i>LOCKED</div>' +
          '<div class="text-white fw-bold mb-1" style="font-family:\'Rajdhani\',sans-serif; font-size:1.05rem; letter-spacing:0.5px;">PADDOCK PARC FERMÉ</div>' +
          '<div class="small text-secondary">' + res.msg + '</div>' +
        '</div>'; 
      return; 
    }

    if (!res.predictions || res.predictions.length === 0) { 
      box.innerHTML = '<div class="text-center text-muted py-4">ไม่มีใครส่งคำทายในสนามนี้</div>'; 
      return; 
    }

    const total = res.predictions.length;

    const p1Counts = {};
    const flCounts = {};
    res.predictions.forEach(function(p) {
      if (p.p1) p1Counts[p.p1] = (p1Counts[p.p1] || 0) + 1;
      if (p.fl) flCounts[p.fl] = (flCounts[p.fl] || 0) + 1;
    });

    function getTopStat(countsObj, fallbackText) {
      let topDriver = '-';
      let maxCount = 0;
      Object.keys(countsObj).forEach(function(d) {
        if (countsObj[d] > maxCount) {
          maxCount = countsObj[d];
          topDriver = d;
        }
      });
      if (maxCount === 0) return { driver: fallbackText || '-', pct: 0, count: 0, color: '#e10600' };
      const pct = Math.round((maxCount / total) * 100);
      const dInfo = DRIVER_INFO[topDriver] || { color: '#e10600' };
      const barColor = dInfo.color || '#e10600';
      return { driver: topDriver, pct: pct, count: maxCount, color: barColor };
    }

    const topP1Stat = getTopStat(p1Counts, res.topP1);
    const topFLStat = getTopStat(flCounts, res.topFL);

    let html = 
      '<div class="consensus-telemetry-box">' +
        '<div class="consensus-header">' +
          '<span><i class="fa-solid fa-bolt text-info me-1"></i> CONSENSUS TELEMETRY</span>' +
          '<span class="badge bg-dark border border-secondary text-light">' + total + ' PADDOCK PASSES</span>' +
        '</div>' +

        '<div class="consensus-item">' +
          '<div class="consensus-label-row">' +
            '<span class="text-secondary small">🏆 มหาชนเทใจ P1: <strong class="consensus-driver ms-1">' + topP1Stat.driver + '</strong></span>' +
            '<span class="consensus-pct" style="color:' + topP1Stat.color + ';">' + topP1Stat.pct + '% (' + topP1Stat.count + '/' + total + ')</span>' +
          '</div>' +
          '<div class="consensus-track">' +
            '<div class="consensus-fill" style="width:' + topP1Stat.pct + '%; background:' + topP1Stat.color + '; box-shadow: 0 0 10px ' + topP1Stat.color + ';"></div>' +
          '</div>' +
        '</div>' +

        '<div class="consensus-item">' +
          '<div class="consensus-label-row">' +
            '<span class="text-secondary small">⚡ เต็ง Fastest Lap: <strong class="consensus-driver ms-1">' + topFLStat.driver + '</strong></span>' +
            '<span class="consensus-pct" style="color:' + topFLStat.color + ';">' + topFLStat.pct + '% (' + topFLStat.count + '/' + total + ')</span>' +
          '</div>' +
          '<div class="consensus-track">' +
            '<div class="consensus-fill" style="width:' + topFLStat.pct + '%; background:' + topFLStat.color + '; box-shadow: 0 0 10px ' + topFLStat.color + ';"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    html += res.predictions.map(function(p, idx) {
      const c1 = (DRIVER_INFO[p.p1] || {}).color || '#64748b';
      const c2 = (DRIVER_INFO[p.p2] || {}).color || '#64748b';
      const c3 = (DRIVER_INFO[p.p3] || {}).color || '#64748b';
      const c4 = (DRIVER_INFO[p.p4] || {}).color || '#64748b';

      let stubContent = '';
      if (isCalculated || Number(p.score) > 0) {
        stubContent = 
          '<div class="ticket-pts-val text-warning">' + p.score + '</div>' +
          '<div class="ticket-pts-lbl">POINTS</div>';
      } else {
        stubContent = 
          '<div class="ticket-pending-stamp">LOCKED IN</div>' +
          '<div class="ticket-pts-lbl mt-1">WAITING</div>';
      }

      const passNum = String(idx + 1).padStart(2, '0');

      return '<div class="pred-ticket">' +
               '<div class="ticket-main">' +
                 '<div class="ticket-player-header">' +
                   '<div class="ticket-player-name"><i class="fa-solid fa-id-badge text-danger"></i>' + p.player + '</div>' +
                   '<span class="ticket-pass-tag">PASS #' + passNum + '</span>' +
                 '</div>' +
                 '<div class="ticket-picks-grid">' +
                   '<div class="ticket-pick-item"><span class="ticket-pos-pill p1">P1</span><span class="ticket-driver-dot" style="background:' + c1 + '"></span><span class="ticket-driver-txt">' + getShortDriverName(p.p1) + '</span></div>' +
                   '<div class="ticket-pick-item"><span class="ticket-pos-pill p2">P2</span><span class="ticket-driver-dot" style="background:' + c2 + '"></span><span class="ticket-driver-txt">' + getShortDriverName(p.p2) + '</span></div>' +
                   '<div class="ticket-pick-item"><span class="ticket-pos-pill p3">P3</span><span class="ticket-driver-dot" style="background:' + c3 + '"></span><span class="ticket-driver-txt">' + getShortDriverName(p.p3) + '</span></div>' +
                   '<div class="ticket-pick-item"><span class="ticket-pos-pill">P4</span><span class="ticket-driver-dot" style="background:' + c4 + '"></span><span class="ticket-driver-txt">' + getShortDriverName(p.p4) + '</span></div>' +
                 '</div>' +
                 (p.fl ? '<div class="ticket-fl-bar"><i class="fa-solid fa-bolt"></i><span>FL: ' + getShortDriverName(p.fl) + '</span></div>' : '') +
               '</div>' +
               '<div class="ticket-stub">' +
                 stubContent +
               '</div>' +
             '</div>';
    }).join('');

    box.innerHTML = html;
  });
}

// =========================================================
// PLAYER CAREER STATS (SUPER LICENSE + RACE-BY-RACE CHART)
// =========================================================
function showPlayerStats(playerName) {
  triggerHaptic(); 
  statsModalInstance.show(); 
  const body = document.getElementById('statsBody');
  body.innerHTML = '<div class="text-center py-5"><i class="fa-solid fa-spinner fa-spin text-danger fs-1 mb-3"></i><div class="text-secondary small f1-font" style="letter-spacing:1px;">GATHERING TELEMETRY...</div></div>';

  callGAS("getPlayerStats", { playerName: playerName }).then(function(res) {
    let pTeam = "F1";
    const match = globalLeaderboard.find(r => String(r[1]).toLowerCase() === playerName.toLowerCase());
    if (match) pTeam = match[4] || "F1";

    const teamColor = TEAM_COLORS[pTeam] || "#555555";
    const logoUrl = TEAM_LOGOS[pTeam] ? getDriveDirectLink(TEAM_LOGOS[pTeam]) : "";

    let html = `
      <div class="stats-super-license" style="--team-color: ${teamColor}; text-align: left;">
        
        <!-- 1. Super License Header -->
        <div class="sl-header mb-3">
          <div class="sl-avatar">
            ${logoUrl ? `<img src="${logoUrl}" alt="Team">` : `<i class="fa-solid fa-user-astronaut text-secondary"></i>`}
          </div>
          <div class="sl-info">
            <div class="sl-name">${res.playerName}</div>
            <div class="sl-team" style="color: ${teamColor};">${pTeam}</div>
          </div>
          <div class="sl-rank">
            <span class="sl-rank-lbl">CURRENT RANK</span>
            <span class="sl-rank-val">${res.rank}</span>
          </div>
        </div>

        <!-- 2. Telemetry Bento Box -->
        <div class="telemetry-grid mb-3">
          <div class="telemetry-widget border-yellow">
            <div class="widget-head"><i class="fa-solid fa-trophy text-warning"></i> <span>TOTAL SCORE</span></div>
            <div class="widget-value text-warning fs-3">${res.totalScore} <span class="fs-6 text-secondary">PTS</span></div>
          </div>
          <div class="telemetry-widget border-blue">
            <div class="widget-head"><i class="fa-solid fa-crosshairs text-info"></i> <span>EXACT HITS</span></div>
            <div class="widget-value text-info fs-3">${res.exactHits} <span class="fs-6 text-secondary">Times</span></div>
          </div>
          <div class="telemetry-widget border-purple" style="grid-column: span 2;">
            <div class="widget-head"><i class="fa-solid fa-bolt text-purple"></i> <span>FASTEST LAP PREDICTIONS</span></div>
            <div class="widget-value text-purple fs-4">${res.flHits} <span class="fs-6 text-secondary">Successful Picks</span></div>
          </div>
        </div>

        <!-- 3. Telemetry Line Chart -->
        <div class="d-flex align-items-center mb-2">
          <i class="fa-solid fa-chart-area text-danger me-2"></i>
          <span class="f1-font fw-bold text-white" style="letter-spacing: 0.5px; font-size: 0.9rem;">RACE-BY-RACE TELEMETRY</span>
        </div>
        
        <div class="chart-container" style="position: relative; height: 220px; width: 100%; background: #0a0a0e; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 10px 5px;">
          <canvas id="playerTelemetryChart"></canvas>
        </div>
      </div>
    `;
    body.innerHTML = html;

    // การวาดกราฟผ่าน Chart.js (แสดงคะแนนรายสนาม พร้อมป้ายโชว์คะแนนรวมสะสม)
    if (res.history && res.history.length > 0) {
      if (playerChartInstance) {
        playerChartInstance.destroy();
      }

      const ctx = document.getElementById('playerTelemetryChart').getContext('2d');
      
      let labels = [];
      let dataPoints = [];
      let cumulativeScores = []; 
      let runningTotal = 0;

      res.history.forEach((h, i) => {
        labels.push(`R${i+1}`);
        const scoreNum = (h.score === '-' || h.score === '') ? 0 : Number(h.score);
        runningTotal += scoreNum;
        dataPoints.push(scoreNum);          
        cumulativeScores.push(runningTotal); 
      });

      let gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, teamColor + '60'); 
      gradient.addColorStop(1, teamColor + '00'); 

      playerChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: dataPoints,
            borderColor: teamColor,
            backgroundColor: gradient,
            borderWidth: 2,
            pointBackgroundColor: '#000',
            pointBorderColor: teamColor,
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(10, 12, 16, 0.95)',
              titleColor: '#fff',
              bodyColor: teamColor,
              titleFont: { family: 'Rajdhani', size: 14, weight: 'bold' },
              bodyFont: { family: 'Rajdhani', size: 15, weight: 'bold' },
              borderColor: teamColor,
              borderWidth: 1,
              displayColors: false,
              callbacks: {
                title: function(context) {
                  const idx = context[0].dataIndex;
                  return res.history[idx].race;
                },
                label: function(context) {
                  const idx = context.dataIndex;
                  const ptsEarned = res.history[idx].score;
                  const totalSoFar = cumulativeScores[idx];
                  
                  return [
                    `Race Score: +${ptsEarned} PTS`,
                    `Total Score: ${totalSoFar} PTS`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)', tickLength: 0 },
              ticks: { color: '#94a3b8', font: { family: 'Share Tech Mono', size: 10 } }
            },
            y: {
              beginAtZero: true,
              suggestedMax: 9,
              grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
              ticks: { color: '#94a3b8', font: { family: 'Share Tech Mono', size: 10 }, stepSize: 2 }
            }
          },
          interaction: {
            mode: 'index',
            intersect: false,
          }
        }
      });
    } else {
      document.getElementById('playerTelemetryChart').parentElement.innerHTML = `<div class="text-center text-muted small py-5"><i class="fa-solid fa-satellite-dish mb-2 fs-4"></i><br>NO TELEMETRY DATA</div>`;
    }
  });
}

function handleAdminDeadline() { 
  const pin = document.getElementById('adminPin').value, raceId = document.getElementById('adRaceDead').value, rawDt = document.getElementById('adNewDead').value; 
  if (!pin || !raceId) { showToast('กรุณากรอก Admin PIN', 'error'); return; } 
  callGAS("adminUpdateRaceSettings", { pin: pin, raceId: raceId, newDeadline: rawDt?rawDt.replace('T', ' '):'', newStatus: document.getElementById('adNewStatus').value }).then(function(res) { 
    showToast(res.msg, res.success ? 'success' : 'error'); if(res.success) forceRefreshData(); 
  }); 
}

function handleAdminSetupNewSeason() { 
  const pin = document.getElementById('adminPin').value, year = document.getElementById('adSeasonYear').value; 
  if (!pin || !year) return; 
  if (!confirm('ยืนยันการดึงตารางแข่ง?')) return; 
  showToast('กำลังดึงข้อมูลปฏิทิน...', 'success'); 
  callGAS("adminSetupNewSeasonCalendar", { pin: pin, seasonYear: year }).then(function(res) { 
    showToast(res.msg, res.success ? 'success' : 'error'); if(res.success) forceRefreshData(); 
  }); 
}

function handleAdminSaveMediaLinks() { 
  const pin = document.getElementById('adminPin').value;
  const raceId = document.getElementById('adMediaRace').value; 
  if (!pin || !raceId) { showToast('กรุณากรอก Admin PIN', 'error'); return; } 

  const currentRace = globalRaces.find(function(r) { return r.id === raceId; });
  const existingLayoutImg = (currentRace && currentRace.media && currentRace.media.trackLayoutImg) ? currentRace.media.trackLayoutImg : "";

  const payload = { 
    raceId: raceId, 
    trackImg: document.getElementById('adTrackImgUrl').value.trim(), 
    trackLayoutImg: existingLayoutImg, 
    practiceImg: document.getElementById('adPracticeUrl').value.trim(), 
    quali2025: document.getElementById('adQuali2025Url').value.trim(), 
    race2025: document.getElementById('adRace2025Url').value.trim(), 
    extLink: document.getElementById('adExtLink').value.trim(), 
    extTitle: "อัตราต่อรอง" 
  };

  callGAS("adminSaveTrackMediaLinks", { pin: pin, data: payload }).then(function(res) { 
    showToast(res.msg, res.success ? 'success' : 'error'); 
    if(res.success) forceRefreshData(); 
  }); 
}

function matchDriverOption(selectId, apiName) { 
  if (!apiName) return; 
  const select = document.getElementById(selectId); 
  const cleanApi = apiName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); 
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === cleanApi) { 
      select.selectedIndex = i; return; 
    } 
  }
  const lastName = cleanApi.split(" ").pop(); 
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().includes(lastName)) { 
      select.selectedIndex = i; return; 
    } 
  }
}

function handleFetchOfficialResults() { 
  const pin = document.getElementById('adminPin').value, raceId = document.getElementById('adminRace').value, btn = document.getElementById('btnApiFetch'); 
  if (!pin || !raceId) return; 
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
  callGAS("adminFetchOfficialResults", { pin: pin, raceId: raceId }).then(function(res) { 
    btn.disabled = false; btn.innerHTML = 'ดึงผลจริง API'; 
    if (!res.success) { showToast("⚠️ " + res.msg, 'error'); return; } 
    matchDriverOption('adP1', res.data.p1); matchDriverOption('adP2', res.data.p2); matchDriverOption('adP3', res.data.p3); matchDriverOption('adP4', res.data.p4); 
    if (res.data.type !== 'Sprint' && res.data.fl) matchDriverOption('adFL', res.data.fl); 
    if (res.data.url) document.getElementById('adLink').value = res.data.url; 
    showToast(res.msg, 'success'); 
  }); 
}

function checkAdminSubmissions() { 
  const pin = document.getElementById('adminPin').value, raceId = document.getElementById('adRaceCheck').value; 
  if (!pin || !raceId) return; 
  document.getElementById('subStatusContainer').style.display = 'block'; 
  document.getElementById('subStatusSummary').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
  callGAS("adminGetSubmissionStatus", { pin: pin, raceId: raceId }).then(function(res) { 
    if (!res.success) { showToast(res.msg, 'error'); document.getElementById('subStatusContainer').style.display = 'none'; return; } 
    lastPendingList = res.pending || []; 
    document.getElementById('subStatusSummary').innerHTML = 'รวม: <strong>' + res.total + '</strong> | ส่งแล้ว: <strong class="text-success">' + res.submittedCount + '</strong> | ค้าง: <strong class="text-danger">' + res.pendingCount + '</strong>'; 
    document.getElementById('cntPending').innerText = res.pendingCount; 
    document.getElementById('cntSubmitted').innerText = res.submittedCount; 
    document.getElementById('listPending').innerHTML = res.pending.length ? res.pending.map(function(name) { return '<span class="badge bg-danger text-white me-1 mb-1">' + name + '</span>'; }).join('') : '<span class="text-success small">ส่งครบทุกคนแล้ว!</span>'; 
    document.getElementById('listSubmitted').innerHTML = res.submitted.length ? res.submitted.map(function(s) { return '<div class="d-flex justify-content-between py-1 border-bottom border-secondary"><span class="text-white">✅ ' + s.name + '</span><span class="text-secondary">' + s.time + '</span></div>'; }).join('') : 'ยังไม่มีใครส่ง'; 
  }); 
}

function copyPendingList() { 
  if (!lastPendingList || lastPendingList.length === 0) return; 
  const text = '🏁 ทวงคำทายผล F1\n⚠️ คนที่ยังไม่ได้ส่ง (' + lastPendingList.length + ' คน):\n' + lastPendingList.map(function(n, i) { return (i + 1) + '. ' + n; }).join('\n') + '\n\nรีบส่งก่อนหมดเวลานะครับ!'; 
  navigator.clipboard.writeText(text).then(function() { showToast('คัดลอกเรียบร้อย!', 'success'); }); 
}

function handleRegister(e) { 
  e.preventDefault(); triggerHaptic(); 
  const btn = document.getElementById('btnReg'), 
        name = document.getElementById('regName').value, 
        team = document.getElementById('regTeam').value, 
        pinEl = document.getElementById('regPin'),
        pin = pinEl ? pinEl.value : ""; 
        
  btn.disabled = true; 
  callGAS("registerPlayer", { playerName: name, teamName: team, pin: pin }).then(function(res) { 
    showToast(res.msg, res.success ? 'success' : 'error'); btn.disabled = false; 
    if (res.success) { 
      localStorage.setItem('f1_player_name', name); 
      document.getElementById('regName').value = ''; 
      if (pinEl) pinEl.value = ''; 
      regModalInstance.hide(); 
      forceRefreshData(); 
      showTab('tab-pred', document.querySelectorAll('.f1-nav-link')[1]); 
    } 
  }); 
}

function handlePrediction(e) { 
  e.preventDefault(); triggerHaptic(); 
  const player = localStorage.getItem('f1_player_name'); 
  if (!player) { loginGateModalInstance.show(); return; } 
  
  const rSel = document.getElementById('selRace');
  if (!rSel.value) { showToast('กรุณาเลือกสนามแข่งขันก่อนครับ', 'error'); return; }
  
  const p1 = document.getElementById('pos1').value, 
        p2 = document.getElementById('pos2').value, 
        p3 = document.getElementById('pos3').value, 
        p4 = document.getElementById('pos4').value; 
        
  if (!p1 || !p2 || !p3 || !p4) {
    showToast('กรุณาแตะการ์ดเลือกนักแข่งให้ครบทั้ง P1 - P4 ครับ', 'error');
    return;
  }

  const btn = document.getElementById('btnPred');
  const playerPin = localStorage.getItem('f1_player_pin') || '';
  btn.disabled = true; 
  callGAS("submitPrediction", { 
    pin: playerPin, 
    data: { playerName: player, raceId: rSel.value, type: rSel.options[rSel.selectedIndex].dataset.type, p1: p1, p2: p2, p3: p3, p4: p4, fl: document.getElementById('posFL').value } 
  }).then(function(res) { 
    btn.disabled = false; showToast(res.msg, res.success ? 'success' : 'error'); 
    if (res.success) { 
      document.getElementById('savedPredAlert').style.display = 'block'; 
      document.getElementById('savedPredTime').innerText = 'บันทึกเมื่อ: ' + res.submittedAt; 
      document.getElementById('savedPredContent').innerHTML = '<strong>P1:</strong> ' + res.data.p1 + ' | <strong>P2:</strong> ' + res.data.p2 + '<br><strong>P3:</strong> ' + res.data.p3 + ' | <strong>P4:</strong> ' + res.data.p4 + (res.data.fl ? ' | <strong>FL:</strong> ' + res.data.fl : ''); 
      forceRefreshData(); 
    } 
  }); 
}

function handleAdminSubmit(e) { 
  e.preventDefault(); 
  if (!confirm('ยืนยันบันทึกผลและตัดคะแนน?')) return; 
  const btn = document.getElementById('btnAdmin'), rSel = document.getElementById('adminRace'); 
  btn.disabled = true; 
  callGAS("saveResultAndCalculate", { pin: document.getElementById('adminPin').value, resultData: { raceId: rSel.value, type: rSel.options[rSel.selectedIndex].dataset.type, p1: document.getElementById('adP1').value, p2: document.getElementById('adP2').value, p3: document.getElementById('adP3').value, p4: document.getElementById('adP4').value, fl: document.getElementById('adFL').value, link: document.getElementById('adLink').value } }).then(function(res) { 
    showToast(res.msg, res.success ? 'success' : 'error'); btn.disabled = false; 
    if (res.success) { document.getElementById('adminPin').value = ''; adminModalInstance.hide(); forceRefreshData(); } 
  }); 
}

function refreshRaceCenter() {
  triggerHaptic();
  if (isRefreshing) return;
  isRefreshing = true;

  const currentCenterRaceId = document.getElementById('selCenterRace').value;
  const current2025RaceId = document.getElementById('sel2025Race').value;
  
  const refreshBtns = document.querySelectorAll('.fa-rotate');
  refreshBtns.forEach(btn => btn.classList.add('fa-spin'));

  callGAS("getInitData").then(function(data) {
    isRefreshing = false;
    refreshBtns.forEach(btn => btn.classList.remove('fa-spin'));
    if(!data) return;
    
    localStorage.setItem('f1_cached_data', JSON.stringify(data));
    renderUI(data);
    
    if (currentCenterRaceId && document.getElementById('selCenterRace')) {
      document.getElementById('selCenterRace').value = currentCenterRaceId;
      onCenterRaceChange();
    }
    if (current2025RaceId && document.getElementById('sel2025Race')) {
      document.getElementById('sel2025Race').value = current2025RaceId;
      on2025RaceChange();
    }
    
    showToast('อัปเดตข้อมูลและรูปภาพล่าสุดแล้ว!', 'success');
  }).catch(function(err) { 
    isRefreshing = false;
    refreshBtns.forEach(btn => btn.classList.remove('fa-spin'));
    showToast('Error: ' + err, 'error'); 
  });
}

function switchStandings(type) {
  const views = {
    'user': document.getElementById('user-standings-view'),
    'driver': document.getElementById('driver-standings-view'),
    'team': document.getElementById('team-standings-view')
  };
  const btns = {
    'user': document.getElementById('btn-user-standings'),
    'driver': document.getElementById('btn-driver-standings'),
    'team': document.getElementById('btn-team-standings')
  };

  Object.keys(views).forEach(key => {
    if (views[key]) views[key].classList.add('d-none');
    if (btns[key]) btns[key].classList.remove('active');
  });

  if (views[type]) views[type].classList.remove('d-none');
  if (btns[type]) btns[type].classList.add('active');

  const checkCard = document.getElementById('checkResultCard');
  if (checkCard) {
    if (type === 'user') {
      checkCard.style.display = 'block'; 
    } else {
      checkCard.style.display = 'none';  
    }
  }
}

function initOfficialStandingsDOM() {
  const driverListEl = document.getElementById('driverStandingsList');
  if (driverListEl) {
    driverListEl.innerHTML = Object.keys(DRIVER_INFO).map((fullName, idx) => {
      const info = DRIVER_INFO[fullName];
      const parts = fullName.split(' ');
      const shortName = parts[0].charAt(0) + '. ' + parts.slice(1).join(' ');
      const headshotUrl = getDriveDirectLink(info.headshot || info.img);
      const displayTeam = info.standingsTeam || info.team;

      return `
        <div class="f1-standings-row" data-position="${idx + 1}" style="cursor:pointer;" onclick="openDriverHero('${fullName}', this)">
          <div class="col-pos">${idx + 1}</div>
          <div class="col-driver">
            <img src="${headshotUrl}" alt="${shortName}" class="driver-headshot" loading="lazy" decoding="async">
            <div class="driver-info">
              <div class="driver-name text-white">${shortName}</div>
              <div class="team-name m-0" style="color: ${info.color};">${displayTeam}</div>
            </div>
          </div>
          <div class="col-pts text-white">0</div>
        </div>`;
    }).join('');
  }

  const teamListEl = document.getElementById('teamStandingsList');
  if (teamListEl) {
    const mainTeams = ["Ferrari", "Red Bull Racing", "McLaren", "Mercedes", "Aston Martin", "Alpine", "Williams", "VCARB", "Audi", "Haas", "Cadillac"];
    teamListEl.innerHTML = mainTeams.map((teamName, idx) => {
      const color = TEAM_COLORS[teamName] || "#ffffff";
      const bgLogo = getDriveDirectLink(STANDINGS_TEAM_LOGOS[teamName] || TEAM_LOGOS[teamName] || "");
      const car = getDriveDirectLink(TEAM_CARS[teamName] || "");

      return `
        <div class="team-card f1-standings-row" data-position="${idx + 1}" style="--team-color: ${color};">
          <div class="team-card-left">
            <span class="team-pos col-pos">${idx + 1}</span>
            <span class="team-name driver-name">${teamName}</span>
          </div>
          <div class="team-card-center">
            <img src="${bgLogo}" class="team-bg-logo" alt="${teamName} Logo" loading="lazy" decoding="async">
            <img src="${car}" class="team-car-img" alt="${teamName} Car" loading="lazy" decoding="async">
          </div>
          <div class="team-card-right">
            <span class="team-pts col-pts">0</span><span class="pts-label">PTS</span>
          </div>
        </div>`;
    }).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initOfficialStandingsDOM(); 
  fetchF1Standings();         
  fetchF1TeamStandings();     
});
// ฟังก์ชันสร้างลูกเล่นตัวเลขวิ่ง (Count-up Animation สไตล์ Cubic Ease-out)
function animateCountUp(element, target, duration = 2200) {
  let startTimestamp = null;
  const targetNum = parseInt(target, 10) || 0;
  
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    
    // สมการความเร่ง Cubic Ease-out (1 - (1-t)^3) ต้นจัด ปลายไหล
    const easeProgress = 1 - Math.pow(1 - progress, 3); 
    element.innerText = Math.floor(easeProgress * targetNum);
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerText = targetNum;
    }
  };
  window.requestAnimationFrame(step);
}

// ฟังก์ชันสร้างลูกเล่นตัวเลขวิ่ง (Count-up Animation สไตล์ Cubic Ease-out)
function animateCountUp(element, target, duration = 2200) {
  let startTimestamp = null;
  
  // แปลงค่าเป้าหมายให้เป็นตัวเลขเสมอ ป้องกันการดึงค่าแล้วติดช่องว่าง
  const targetNum = parseInt(String(target).replace(/,/g, '').trim(), 10) || 0;
  
  // ถ้าเป้าหมายคือ 0 ให้ใส่ 0 ทันที ไม่ต้องวิ่ง
  if (targetNum === 0) {
    element.innerText = "0";
    return;
  }
  
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    
    // สมการความเร่ง Cubic Ease-out (1 - (1-t)^3) ต้นจัด ปลายไหล
    const easeProgress = 1 - Math.pow(1 - progress, 3); 
    element.innerText = Math.floor(easeProgress * targetNum);
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerText = targetNum; // จบที่เป้าหมายเป๊ะๆ
    }
  };
  window.requestAnimationFrame(step);
}

// ฟังก์ชันสำหรับเปิดหน้า F1 Driver Hero
function openDriverHero(fullName, rowEl) {
  triggerHaptic();
  const info = DRIVER_INFO[fullName];
  if(!info) return;

  const pts = rowEl.querySelector('.col-pts').innerText;
  const pos = rowEl.querySelector('.col-pos').innerText;
  const parts = fullName.split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  document.getElementById('heroDriverFirstName').innerText = firstName;
  document.getElementById('heroDriverLastName').innerText = lastName;
  document.getElementById('heroTeamName').innerText = info.team;
  document.getElementById('heroTeamLogo').src = getDriveDirectLink(TEAM_LOGOS[info.team] || '');
  
  document.getElementById('heroDriverImg').src = getDriveDirectLink(info.heroImg || info.img); 
  
  document.getElementById('heroPos').innerText = 'P' + pos;

  // บังคับเซ็ตค่าเริ่มต้นของ element กลับไปเป็น 0 เสมอก่อนเริ่มนับ
  const ptsEl = document.getElementById('heroPoints');
  ptsEl.innerText = "0"; 
  
  // ให้ตัวเลขเริ่มวิ่งทันทีที่กดเข้าหน้าต่าง
  setTimeout(() => {
    animateCountUp(ptsEl, pts, 2200); 
  }, 10); 

 // ไล่ระดับสี: เริ่มจากสีดำขอบจอ (0%) -> สว่างเป็นสีทีม (15%) -> กลืนกลับไปดำที่ฐาน (65%)
  document.getElementById('heroBgColor').style.background = `linear-gradient(to bottom, #0a0e1c 0%, ${info.color}40 15%, #0a0e1c 65%)`;

  if (!window.driverHeroModalInstance) {
    window.driverHeroModalInstance = new bootstrap.Modal(document.getElementById('driverHeroModal'));
  }
  window.driverHeroModalInstance.show();
}
