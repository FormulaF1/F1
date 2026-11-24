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
let currentArchiveMode = 'quali2025';
let isRefreshing = false;
let currentCenterMedia = null;
let currentArchiveMedia = null;
let currentHeroDriver = null;
let isHeroInPredictMode = false;
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

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function syncOneSignalUser(playerName) {
  if (window.OneSignalDeferred && playerName) {
    window.OneSignalDeferred.push(function(OneSignal) {
      try { OneSignal.login(playerName); } catch (e) {}
    });
  }
}

// ฟังก์ชันเช็คและคืนค่าปุ่ม Radio เฉพาะเมื่ออยู่หน้าทายผลและไม่มี Modal เลือกนักแข่งเปิดอยู่
function updateRadioButtonVisibility() {
  const predTab = document.getElementById('tab-pred');
  const radioBtn = document.getElementById('btnTeamRadio');
  const driverModalEl = document.getElementById('driverSelectorModal');
  const heroModalEl = document.getElementById('driverHeroModal');

  if (!radioBtn) return;

  const isPredTabActive = predTab && predTab.style.display !== 'none';
  const isDriverModalOpen = driverModalEl && driverModalEl.classList.contains('show');
  const isHeroModalOpen = heroModalEl && heroModalEl.classList.contains('show');

  if (isPredTabActive && !isDriverModalOpen && !isHeroModalOpen) {
    radioBtn.style.setProperty('display', 'flex', 'important');
  } else {
    radioBtn.style.setProperty('display', 'none', 'important');
  }
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
    driverModalEl.addEventListener('hidden.bs.modal', function () {
      setTimeout(updateRadioButtonVisibility, 200);
    });
  }

    const heroModalEl = document.getElementById('driverHeroModal');
  if (heroModalEl) {
    window.driverHeroModalInstance = new bootstrap.Modal(heroModalEl);

    // ดัน z-index ให้ Hero Modal ซ้อนทับตารางเลือกนักแข่งทันทีแบบ Zero-Lag ไม่ต้องรอพับเก็บ
    heroModalEl.addEventListener('show.bs.modal', function () {
      heroModalEl.style.setProperty('z-index', '1075', 'important');
      setTimeout(function () {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 1) {
          backdrops[backdrops.length - 1].style.setProperty('z-index', '1070', 'important');
        }
      }, 10);
    });

    heroModalEl.addEventListener('hidden.bs.modal', function () {
      if (driverModalEl && driverModalEl.classList.contains('show')) {
        document.body.classList.add('modal-open');
        refreshDriverGridBadges();
      }
      setTimeout(updateRadioButtonVisibility, 200);
    });
  }

  const optHtml = '<option value="" disabled selected>-- เลือกนักแข่ง --</option>' + DRIVERS.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
  document.querySelectorAll('.driver-opt').forEach(function(el) { el.innerHTML = optHtml; });

  initHeroHybridShowcaseUI();
  buildDriverGrid();
  loadData();
  loadLatestNews();
  loadDriverStatsAPI();
  updateRadioButtonVisibility();

  // แจ้งเตือนเมื่อสัญญาณอินเทอร์เน็ตมีการเปลี่ยนแปลง
  window.addEventListener('offline', function() { showToast('สัญญาณสื่อสารขาดหาย (OFFLINE)', 'error'); });
  window.addEventListener('online', function() { showToast('เชื่อมต่อสัญญาณอีกครั้ง (ONLINE)', 'success'); });

  // 🎯 ดันแถบเมนูให้อยู่เหนือ Modal เฉพาะตอนเปิดดูตารางเวลา
  const wtModalEl = document.getElementById('weekendTimetableModal');
  if (wtModalEl) {
    wtModalEl.addEventListener('show.bs.modal', function() {
      const nav = document.querySelector('.f1-nav-tabs');
      if (nav) nav.style.setProperty('z-index', '1060', 'important'); // ดันเมนูขึ้นมาทับกระจกดำ
    });
    wtModalEl.addEventListener('hidden.bs.modal', function() {
      const nav = document.querySelector('.f1-nav-tabs');
      if (nav) nav.style.setProperty('z-index', '1050', 'important'); // คืนค่าเดิมเมื่อปิด
    });
  }
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

    html += '<div class="driver-pick-btn" data-drivername="' + name.replace(/"/g, '&quot;') + '" style="--team-color: ' + info.color + '" onclick="previewDriverBeforeSelect(\'' + safeName + '\')">' +
              '<div class="driver-pick-badges"></div>' +
              '<div class="driver-pick-name">' + name + '</div>' +
              '<div class="driver-pick-team">' + info.team + logoHtml + '</div>' +
              '<img src="' + getDriveDirectLink(info.img) + '" class="driver-pick-img" alt="' + name + '">' +
            '</div>';
  });
  container.innerHTML = html;
}

function refreshDriverGridBadges() {
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
}

function updateSelectorHeaderTitle(slotId) {
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
}

function openDriverSelector(slotId) {
  triggerHaptic();
  currentSelectingSlot = slotId;

  const radioBtn = document.getElementById('btnTeamRadio');
  if (radioBtn) {
    radioBtn.style.setProperty('display', 'none', 'important');
  }

  updateSelectorHeaderTitle(slotId);
  refreshDriverGridBadges();

  const driverModalEl = document.getElementById('driverSelectorModal');
  if (driverSelectorModalInstance && driverModalEl && !driverModalEl.classList.contains('show')) {
    driverSelectorModalInstance.show();
  }
}

function confirmSelectDriver(driverName, skipAssignCurrent) {
  triggerHaptic();
  if (!currentSelectingSlot) return;

  if (!skipAssignCurrent) {
    const selectEl = document.getElementById(currentSelectingSlot);
    if (selectEl) selectEl.value = driverName;
    updateCardUI(currentSelectingSlot, driverName);
  }

  const flWrapper = document.getElementById('flWrapper');
  const isSprint = flWrapper && flWrapper.style.display === 'none';
  const slotSequence = isSprint ? ['pos1', 'pos2', 'pos3', 'pos4'] : ['pos1', 'pos2', 'pos3', 'pos4', 'posFL'];
  const currentIndex = slotSequence.indexOf(currentSelectingSlot);

  // วิ่งหาช่องถัดไปที่ยังว่างอยู่ (ถ้าบางช่องถูกกดเหมาไปแล้วจะข้ามให้อัตโนมัติ)
  let nextSlot = null;
  for (let i = currentIndex + 1; i < slotSequence.length; i++) {
    const el = document.getElementById(slotSequence[i]);
    if (el && !el.value) {
      nextSlot = slotSequence[i];
      break;
    }
  }
  if (!nextSlot) {
    for (let i = 0; i < currentIndex; i++) {
      const el = document.getElementById(slotSequence[i]);
      if (el && !el.value) {
        nextSlot = slotSequence[i];
        break;
      }
    }
  }

  refreshDriverGridBadges();

    if (nextSlot) {
    currentSelectingSlot = nextSlot;
    updateSelectorHeaderTitle(nextSlot);
    const heroModalEl = document.getElementById('driverHeroModal');
    const isHeroOpen = heroModalEl && heroModalEl.classList.contains('show');
    const driverModalEl = document.getElementById('driverSelectorModal');
    if (!isHeroOpen && driverSelectorModalInstance && driverModalEl && !driverModalEl.classList.contains('show')) {
      driverSelectorModalInstance.show();
    }
  } else {
    currentSelectingSlot = null;
    if (driverSelectorModalInstance) {
      driverSelectorModalInstance.hide();
    }
    setTimeout(updateRadioButtonVisibility, 250);
  }
  return nextSlot;
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
  if (!currentCenterMedia || !currentCenterMedia[type]) { 
    showToast('ไม่มีรูป', 'error'); 
    return; 
  } 
  document.getElementById('previewImageSrc').src = getDriveDirectLink(currentCenterMedia[type]); 
  imagePreviewModalInstance.show(); 
}

function openMediaPreview2025(type) { 
  triggerHaptic(); 
  if (!currentArchiveMedia || !currentArchiveMedia[type]) { 
    showToast('ไม่มีรูปปีก่อน', 'error'); 
    return; 
  } 
  document.getElementById('previewImageSrc').src = getDriveDirectLink(currentArchiveMedia[type]); 
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
    btn.disabled = false; 
    btn.innerHTML = oldText;
    if (res.success) {
      localStorage.setItem('f1_player_name', selected); 
      localStorage.setItem('f1_player_pin', pin); 
      syncOneSignalUser(selected);
      if (pinEl) pinEl.value = '';
      updateUserSessionUI(); 
      loginGateModalInstance.hide(); 
      onRaceChange(); 
      showToast('เข้าสู่ระบบสำเร็จ!', 'success'); 
    } else {
      showToast(res.msg, 'error');
    }
  }).catch(function(err) {
    btn.disabled = false; 
    btn.innerHTML = oldText;
    showToast('Error: ' + err, 'error');
  });
}

function showTab(tabId, el) { 
  triggerHaptic(); 

  // 🎯 ปิด Modal ทั้งหมดที่เปิดอยู่ เมื่อกดเปลี่ยนแท็บที่เมนูด้านล่าง
  const openModals = document.querySelectorAll('.modal.show');
  openModals.forEach(modalEl => {
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
  });

  document.querySelectorAll('.tab-pane-custom').forEach(function(p) { p.style.display = 'none'; }); 
  document.querySelectorAll('.f1-nav-link').forEach(function(l) { l.classList.remove('active'); }); 
  document.getElementById(tabId).style.display = 'block'; 
  el.classList.add('active'); 

    // 🎯 ควบคุมการแสดงผลปุ่ม Radio + เตรียมข้อมูลกราฟ 7 สนามล่วงหน้าแบบไม่แย่งคิว API
  const radioBtn = document.getElementById('btnTeamRadio');
  if (radioBtn) {
    if (tabId === 'tab-pred') {
      radioBtn.style.setProperty('display', 'flex', 'important');
      if (typeof loadRecent7RacesHistory === 'function' && !recent7RacesCache && !recent7RacesPromise) {
        setTimeout(function() { loadRecent7RacesHistory(); }, 400);
      }
    } else {
      radioBtn.style.setProperty('display', 'none', 'important');
      closeTeamRadio();
    }
  }

  // 🚀 [ใหม่] เลื่อนหน้าจอไปที่สนาม NEXT อัตโนมัติเมื่อกดแท็บ SCHEDULE
  // (หมายเหตุ: ถ้า ID แท็บตารางเวลาของคุณไม่ใช่ 'tab-schedule' ให้แก้ชื่อให้ตรงนะครับ)
  if (tabId === 'tab-schedule') { 
    setTimeout(function() {
      const scheduleContainer = document.getElementById(tabId);
      if (scheduleContainer) {
        // ค้นหา Element ทุกตัวในหน้านี้
        const elements = scheduleContainer.querySelectorAll('*');
        for (let i = 0; i < elements.length; i++) {
          // ดักจับคำว่า 'NEXT' ที่เราใช้เป็นป้าย
          if (elements[i].textContent.trim() === 'NEXT') {
            // เลื่อนการ์ดนั้นมาไว้ตรงกลางจอ (center) แบบนุ่มนวล (smooth)
            elements[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
            break; // เจอแล้วหยุดหา
          }
        }
      }
    }, 150); // หน่วงเวลาเล็กน้อย 0.15 วิ ให้หน้าต่างแสดงผลเสร็จก่อนแล้วค่อยเลื่อน
  }
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
  ['selCommRace','adminRace','adRaceDead','adRaceCheck','adMediaRace','selCenterRace','sel2025Race', 'selFinishedRace'].forEach(function(id) { let el = document.getElementById(id); if(el) el.innerHTML = allRaceOpts; });

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
  // เรียกใช้ฟังก์ชันวาดหน้าปฏิทิน
      renderScheduleTab();
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
    currentCenterMedia = currentRace.media || null; 
  const m = currentCenterMedia || {};

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
  fetchLiveWeather();

  const layoutWrapper = document.getElementById('rcTrackLayoutWrapper');
  const layoutImg = document.getElementById('rcTrackLayoutImg');
  if (layoutWrapper && layoutImg) {
    // ดึงรูปลิงก์จากตัวแปร MODAL_TRACK_IMAGES แทน ถ้าไม่มีค่อยไปหาใน Sheets
        const fallbackMainId = String(raceId || '').replace(/-SPRINT$/i, '-MAIN');
    const trackLayoutSrc = (typeof MODAL_TRACK_IMAGES !== 'undefined' && (MODAL_TRACK_IMAGES[raceId] || MODAL_TRACK_IMAGES[fallbackMainId])) 
                           ? (MODAL_TRACK_IMAGES[raceId] || MODAL_TRACK_IMAGES[fallbackMainId]) 
                           : ((m.trackLayoutImg && m.trackLayoutImg.trim() !== "") ? getDriveDirectLink(m.trackLayoutImg) : '');
                           
    if (trackLayoutSrc) {
      layoutImg.src = trackLayoutSrc;
      layoutWrapper.style.display = 'block';
    } else {
      layoutImg.src = '';
      layoutWrapper.style.display = 'none';
    }
  }

  if (typeof loadTelemetryHUD === 'function') {
    loadTelemetryHUD('latest'); // บังคับให้ดึงข้อมูลของสนามล่าสุดเสมอ
  }
}

function on2025RaceChange() {
  const raceId = document.getElementById('sel2025Race').value; 
  const currentRace = globalRaces.find(function(r) { return r.id === raceId; }); 
  const container = document.getElementById('content2025');
  if (!currentRace) { container.style.display = 'none'; return; }
  container.style.display = 'block'; 
  currentArchiveMedia = currentRace.media || null;
  const m = currentArchiveMedia || {};

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

    const m = currentArchiveMedia || {};
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
  const m = currentArchiveMedia || {};
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

                const pillBadgeHtml = pred ? ('<span class="' + pillClass + '">' + info.label + '</span>') : '';
        return '<div class="p-2 mb-2 rounded bg-black border ' + borderClass + '">' +
            '<div class="d-flex justify-content-between align-items-center small text-secondary mb-1">' +
              '<span><strong>' + posTitle + '</strong> (ผลจริง: <span class="text-warning fw-bold">' + (actVal || '-') + '</span>)</span>' +
              pillBadgeHtml +
            '</div>' +
            '<div class="small text-white">คุณทาย: <strong>' + (predVal || '<span class="text-muted">ไม่ได้ส่ง</span>') + '</strong></div>' +
          '</div>';
      }

      const headerScoreHtml = pred
        ? ('<span class="badge bg-warning text-dark fs-6 px-3 py-2">คะแนนรวมที่ได้: ' + displayScore + ' PTS</span>')
        : '<span class="badge bg-secondary">คุณไม่ได้ส่งคำทายในสนามนี้</span>';

      let html = '<div class="mb-3 text-center">' +
          '<h6 class="fw-bold text-white mb-2 f1-font">' + act.name + '</h6>' +
          headerScoreHtml +
        '</div>' +
        renderMatchRow('p1', '🥇 P1', act.p1, pred ? pred.p1 : '') +
        renderMatchRow('p2', '🥈 P2', act.p2, pred ? pred.p2 : '') +
        renderMatchRow('p3', '🥉 P3', act.p3, pred ? pred.p3 : '') +
        renderMatchRow('p4', '🏁 P4', act.p4, pred ? pred.p4 : '');

      if (!isSprint) {
        html += renderMatchRow('fl', '⚡ Fastest Lap', act.fl, pred ? pred.fl : '');
      }

            body.innerHTML = html;
    })
    .catch(function(err) {
      body.innerHTML = '<div class="text-danger text-center py-3">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</div>';
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
    const avatarHtml = logoUrl ? ('<img src="' + logoUrl + '" alt="Team">') : '<i class="fa-solid fa-user-astronaut text-secondary"></i>';

    let html = `
      <div class="stats-super-license" style="--team-color: ${teamColor}; text-align: left;">
        
        <!-- 1. Super License Header -->
        <div class="sl-header mb-3">
          <div class="sl-avatar">
            ${avatarHtml}
          </div>
          <div class="sl-info">
            <div class="sl-name">${escapeHtml(res.playerName)}</div>
            <div class="sl-team" style="color: ${teamColor};">${escapeHtml(pTeam)}</div>
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

    // การวาดกราฟผ่าน Chart.js
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
  }).catch(function(err) {
    body.innerHTML = '<div class="text-danger text-center py-4">ไม่สามารถโหลดสถิติได้ กรุณาลองใหม่อีกครั้ง</div>';
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

async function handleFetchOfficialResults() { 
  const pin = document.getElementById('adminPin').value;
  const raceId = document.getElementById('adminRace').value; 
  const btn = document.getElementById('btnApiFetch'); 
  
  if (!pin || !raceId) {
    showToast('กรุณากรอก Admin PIN และเลือกสนามก่อน', 'error');
    return; 
  }
  
  btn.disabled = true; 
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังดึงผลทางการ...'; 
  
  try {
    // 1. ดึงผลการแข่งขันทางการตามหมายเลข Round ของสนามที่เลือกจริง (แม่นยำ 100%)
    const officialRes = await callGAS("adminFetchOfficialResults", { pin: pin, raceId: raceId });
    if (officialRes && officialRes.success && officialRes.data) {
      const d = officialRes.data;
      matchDriverOption('adP1', d.p1); 
      matchDriverOption('adP2', d.p2); 
      matchDriverOption('adP3', d.p3); 
      matchDriverOption('adP4', d.p4); 
      if (d.fl) matchDriverOption('adFL', d.fl);
      if (d.url) document.getElementById('adLink').value = d.url;
      showToast(officialRes.msg, 'success');
      return;
    }

    // 2. Fallback: กรณีเพิ่งเข้าเส้นชัยสดๆ และ Jolpica ยังไม่อัปเดต จึงดึงจาก OpenF1 เซสชันล่าสุด
    const [drivers, positions] = await Promise.all([
      fetchOpenF1Cached('https://api.openf1.org/v1/drivers?session_key=latest', 30000),
      fetchOpenF1Cached('https://api.openf1.org/v1/position?session_key=latest', 30000)
    ]);

    const latestPositions = {};
    (Array.isArray(positions) ? positions : []).forEach(p => {
      latestPositions[p.driver_number] = p.position;
    });

    let results = { p1: '', p2: '', p3: '', p4: '' };
    (Array.isArray(drivers) ? drivers : []).forEach(d => {
      const pos = latestPositions[d.driver_number];
      if (pos === 1) results.p1 = d.full_name;
      if (pos === 2) results.p2 = d.full_name;
      if (pos === 3) results.p3 = d.full_name;
      if (pos === 4) results.p4 = d.full_name;
    });

    matchDriverOption('adP1', results.p1); 
    matchDriverOption('adP2', results.p2); 
    matchDriverOption('adP3', results.p3); 
    matchDriverOption('adP4', results.p4); 

    const raceSelect = document.getElementById('adminRace');
    const isSprint = raceSelect.options[raceSelect.selectedIndex].dataset.type === 'Sprint';

    if (!isSprint) {
      const laps = await fetchOpenF1Cached('https://api.openf1.org/v1/laps?session_key=latest', 30000);
      let fastestLap = null;
      let minDuration = Infinity;

      (Array.isArray(laps) ? laps : []).forEach(lap => {
        if (lap.lap_duration && lap.lap_duration < minDuration) {
          minDuration = lap.lap_duration;
          fastestLap = lap;
        }
      });

      if (fastestLap) {
        const flDriver = (Array.isArray(drivers) ? drivers : []).find(d => d.driver_number === fastestLap.driver_number);
        if (flDriver) matchDriverOption('adFL', flDriver.full_name);
      }
    }

    showToast('ดึงผลสดจาก OpenF1 (เซสชันล่าสุด) สำเร็จ! กรุณาตรวจทานก่อนบันทึก', 'success');
  } catch (error) {
    console.error('Fetch Results Error:', error);
    showToast('⚠️ ไม่สามารถดึงผลการแข่งขันได้: ' + error.message, 'error');
  } finally {
    btn.disabled = false; 
    btn.innerHTML = 'ดึงผลจริง API'; 
  }
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
        oldHtml = btn.innerHTML,
        name = document.getElementById('regName').value.trim(), 
        team = document.getElementById('regTeam').value, 
        pinEl = document.getElementById('regPin'),
        pin = pinEl ? pinEl.value : ""; 
        
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>กำลังลงทะเบียน...';
  callGAS("registerPlayer", { playerName: name, teamName: team, pin: pin })
    .then(function(res) { 
      showToast(res.msg, res.success ? 'success' : 'error'); 
      if (res.success) { 
        localStorage.setItem('f1_player_name', name); 
        localStorage.setItem('f1_player_pin', pin); 
        syncOneSignalUser(name);
        document.getElementById('regName').value = ''; 
        if (pinEl) pinEl.value = ''; 
        regModalInstance.hide(); 
        forceRefreshData(); 
        showTab('tab-pred', document.querySelectorAll('.f1-nav-link')[1]); 
      }
    })
    .catch(function(err) {
      showToast('ลงทะเบียนไม่สำเร็จ: ' + err.message, 'error');
    })
    .finally(function() {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
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
  const oldHtml = btn.innerHTML;
  const playerPin = localStorage.getItem('f1_player_pin') || '';
  btn.disabled = true; 
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>TRANSMITTING...';

  callGAS("submitPrediction", { 
    pin: playerPin, 
    data: { playerName: player, raceId: rSel.value, type: rSel.options[rSel.selectedIndex].dataset.type, p1: p1, p2: p2, p3: p3, p4: p4, fl: document.getElementById('posFL').value } 
  })
    .then(function(res) { 
      showToast(res.msg, res.success ? 'success' : 'error'); 
      if (res.success) { 
        document.getElementById('savedPredAlert').style.display = 'block'; 
        document.getElementById('savedPredTime').innerText = 'บันทึกเมื่อ: ' + res.submittedAt; 
        document.getElementById('savedPredContent').innerHTML =
          '<strong>P1:</strong> ' + escapeHtml(res.data.p1) + ' | <strong>P2:</strong> ' + escapeHtml(res.data.p2) +
          '<br><strong>P3:</strong> ' + escapeHtml(res.data.p3) + ' | <strong>P4:</strong> ' + escapeHtml(res.data.p4) +
          (res.data.fl ? ' | <strong>FL:</strong> ' + escapeHtml(res.data.fl) : ''); 
        forceRefreshData(); 
      } 
    })
    .catch(function(err) {
      showToast('ส่งคำทายไม่สำเร็จ: ' + err.message, 'error');
    })
    .finally(function() {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }); 
}

function handleAdminSubmit(e) { 
  e.preventDefault(); 
  if (!confirm('ยืนยันบันทึกผลและตัดคะแนน?')) return; 
  const btn = document.getElementById('btnAdmin'), 
        oldHtml = btn.innerHTML,
        rSel = document.getElementById('adminRace'); 
  btn.disabled = true; 
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>กำลังบันทึกและตัดคะแนน...';

  callGAS("saveResultAndCalculate", { pin: document.getElementById('adminPin').value, resultData: { raceId: rSel.value, type: rSel.options[rSel.selectedIndex].dataset.type, p1: document.getElementById('adP1').value, p2: document.getElementById('adP2').value, p3: document.getElementById('adP3').value, p4: document.getElementById('adP4').value, fl: document.getElementById('adFL').value, link: document.getElementById('adLink').value } })
    .then(function(res) { 
      showToast(res.msg, res.success ? 'success' : 'error'); 
      if (res.success) { document.getElementById('adminPin').value = ''; adminModalInstance.hide(); forceRefreshData(); } 
    })
    .catch(function(err) {
      showToast('เกิดข้อผิดพลาดขณะตัดคะแนน: ' + err.message, 'error');
    })
    .finally(function() {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
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
    'team': document.getElementById('team-standings-view'),
    'results': document.getElementById('results-standings-view') 
  };
  const btns = {
    'user': document.getElementById('btn-user-standings'),
    'driver': document.getElementById('btn-driver-standings'),
    'team': document.getElementById('btn-team-standings'),
    'results': document.getElementById('btn-results-standings') 
  };

  Object.keys(views).forEach(key => {
    if (views[key]) views[key].classList.add('d-none');
    if (btns[key]) btns[key].classList.remove('active');
  });

  if (views[type]) views[type].classList.remove('d-none');
  if (btns[type]) btns[type].classList.add('active');

    if (type === 'results') {
    const rSel = document.getElementById('selResultsRace');
    if (rSel && rSel.options.length <= 1) {
      loadOpenF1Meetings();
    }
  } else if (type === 'driver' && (!window.f1DriverStandingsMap || Object.keys(window.f1DriverStandingsMap).length === 0)) {
    fetchF1Standings(true);
  }

  const checkCard = document.getElementById('checkResultCard');
  if (checkCard) {
    if (type === 'user') checkCard.style.display = 'block'; 
    else checkCard.style.display = 'none';  
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

function animateCountUp(element, target, duration = 2200) {
  let startTimestamp = null;
  const targetNum = parseInt(String(target).replace(/,/g, '').trim(), 10) || 0;
  
  if (targetNum === 0) {
    element.innerText = "0";
    return;
  }
  
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
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

async function loadOpenF1Meetings() {
  const rSel = document.getElementById('selResultsRace');
  if (!rSel) return;
  
  rSel.innerHTML = '<option value="" disabled selected>-- กำลังโหลดข้อมูลสนาม 2026 --</option>';
  
  try {
        let meetings = null;
    const cachedMeetings = sessionStorage.getItem('openF1_meetings_2026');
    
    if (cachedMeetings) {
      meetings = JSON.parse(cachedMeetings);
    } else {
      meetings = await fetchOpenF1Cached('https://api.openf1.org/v1/meetings?year=2026', 600000);
      sessionStorage.setItem('openF1_meetings_2026', JSON.stringify(meetings));
    }

    const now = new Date();
    const startedMeetings = (Array.isArray(meetings) ? meetings : []).filter(m => {
      const startDate = new Date(m.date_start);
      const isTesting = (m.meeting_name || '').toLowerCase().includes('testing');
      return startDate <= now && !isTesting;
    });
    
    if (startedMeetings.length === 0) {
      rSel.innerHTML = '<option value="" disabled selected>-- ยังไม่มีสนามที่ทำการแข่งขันในปี 2026 --</option>';
      return;
    }

    startedMeetings.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
    
    let opts = '<option value="" disabled selected>-- เลือกสนาม --</option>';
    startedMeetings.forEach(m => {
      opts += `<option value="${m.meeting_key}">🏁 ${m.meeting_name}</option>`;
    });
    rSel.innerHTML = opts;

    const latestMeeting = startedMeetings[startedMeetings.length - 1];
    rSel.value = latestMeeting.meeting_key;
    onResultsRaceChange();
    
  } catch (error) {
    console.error('OpenF1 Meetings Error:', error);
    // หากโดน Block (429) หรือมีปัญหาขัดข้อง ให้แสดงข้อความนี้
    rSel.innerHTML = '<option value="" disabled selected>เชื่อมต่อฐานข้อมูลล่าช้า (API Limit)</option>';
  }
}

async function onResultsRaceChange() {
  const rSel = document.getElementById('selResultsRace');
  const meetingKey = rSel.value;
  if (!meetingKey) return;
  
  const btnGroup = document.getElementById('resultsSessionBtnGroup');
  btnGroup.innerHTML = '<span class="text-secondary small"><i class="fa-solid fa-spinner fa-spin me-2"></i>กำลังโหลด Sessions...</span>';
  
  try {
        const sessions = await fetchOpenF1Cached(`https://api.openf1.org/v1/sessions?meeting_key=${meetingKey}`, 300000);
    
    const now = new Date();
    
    const startedSessions = (Array.isArray(sessions) ? sessions : []).filter(s => {
      return new Date(s.date_start) <= now;
    });
    
    startedSessions.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
    
    if (startedSessions.length === 0) {
      btnGroup.innerHTML = '';
      document.getElementById('resultsSessionDataList').innerHTML = '<div class="text-center text-secondary py-4">ยังไม่มีเซสชันที่เริ่มแข่งขันในสนามนี้</div>';
      return;
    }

    const lastIdx = startedSessions.length - 1;
    btnGroup.innerHTML = startedSessions.map((s, index) => 
      `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 ${index === lastIdx ? 'active text-white border-white' : ''}" style="font-family: 'Rajdhani', sans-serif; font-weight: 700;" onclick="loadResultsSessionData('${s.session_key}', this)">${s.session_name.toUpperCase()}</button>`
    ).join('');
    
    loadResultsSessionData(startedSessions[lastIdx].session_key, btnGroup.lastElementChild);
    
  } catch (error) {
    btnGroup.innerHTML = '<span class="text-danger small">โหลดเซสชันล้มเหลว</span>';
  }
}

function refreshTelemetryDashboard(sessionKey = 'latest') {
  triggerHaptic();
  
  if (typeof loadTelemetryHUD === 'function') {
    loadTelemetryHUD(sessionKey);
  } else {
    console.warn("ไม่พบฟังก์ชัน loadTelemetryHUD กรุณาตรวจสอบไฟล์ api-service.js");
  }
}

let communityChartInstance = null;

function renderConsensusChart(predictionsData, isParcFermeClosed) {
  const lockOverlay = document.getElementById('parcFermeLock');
  const totalBadge = document.getElementById('totalVotersBadge');
  const flTextEl = document.getElementById('consensusFlText');
  const flPercentEl = document.getElementById('consensusFlPercent');
  const flBarEl = document.getElementById('consensusFlBar');
  
  const totalVotes = predictionsData.length;
  if (totalBadge) {
    totalBadge.innerHTML = `${totalVotes} PADDOCK PASSES`;
  }

  if (lockOverlay) {
    lockOverlay.style.display = !isParcFermeClosed ? 'flex' : 'none';
  }

  // รีเซ็ตค่า Fastest Lap ก่อนเสมอ ป้องกันค่าค้างจากสนามก่อนหน้า
  if (flTextEl) flTextEl.innerHTML = `<i class="fa-solid fa-bolt text-info"></i> เต็ง Fastest Lap: --`;
  if (flPercentEl) flPercentEl.innerText = `0% (0/0)`;
  if (flBarEl) flBarEl.style.width = `0%`;

  if (totalVotes === 0) {
    if (communityChartInstance) {
      communityChartInstance.destroy();
      communityChartInstance = null;
    }
    return;
  }

  let p1Counts = {};
  let flCounts = {};

  predictionsData.forEach(p => {
    const p1 = p.p1 || p.pos1; 
    const fl = p.fl || p.posFL;
    
    if (p1) p1Counts[p1] = (p1Counts[p1] || 0) + 1;
    if (fl) flCounts[fl] = (flCounts[fl] || 0) + 1;
  });

  const p1Labels = Object.keys(p1Counts);
  const p1Data = Object.values(p1Counts);
  const p1Colors = p1Labels.map(name => (DRIVER_INFO[name] && DRIVER_INFO[name].color) ? DRIVER_INFO[name].color : '#888888');

  const canvasEl = document.getElementById('p1PredictionChart');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  
  if (communityChartInstance) {
    communityChartInstance.destroy();
  }

  communityChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: p1Labels,
      datasets: [{
        data: p1Data,
        backgroundColor: p1Colors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%', 
      plugins: {
        legend: {
          position: 'right', 
          labels: { 
            color: '#ffffff', 
            font: { family: 'Kanit', size: 10 },
            boxWidth: 10,
            padding: 15,
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const dataset = data.datasets[0];
                const total = dataset.data.reduce((acc, val) => acc + val, 0);
                
                return data.labels.map(function(label, i) {
                  const value = dataset.data[i];
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  const color = dataset.backgroundColor[i];
                  
                  return {
                    text: `${label} (${percentage}% - ${value}/${total})`,
                    fillStyle: color,
                    strokeStyle: color,
                    fontColor: '#ffffff',
                    lineWidth: 0,
                    hidden: isNaN(dataset.data[i]) || chart.getDatasetMeta(0).data[i].hidden,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        }
      }
    }
  });

  let topFlDriver = "-";
  let topFlCount = 0;
  
  for (const [driver, count] of Object.entries(flCounts)) {
    if (count > topFlCount) {
      topFlCount = count;
      topFlDriver = driver;
    }
  }

  if (topFlCount > 0) {
    const flPercent = Math.round((topFlCount / totalVotes) * 100);
    if (flTextEl) flTextEl.innerHTML = `<i class="fa-solid fa-bolt text-info"></i> เต็ง Fastest Lap: ${topFlDriver}`;
    if (flPercentEl) flPercentEl.innerText = `${flPercent}% (${topFlCount}/${totalVotes})`;
    if (flBarEl) flBarEl.style.width = `${flPercent}%`;
  }
}
function getShortDriverName(fullName) {
  if (!fullName || fullName === '-') return '-';
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}

function loadCommunityPredictions() {
  const raceId = document.getElementById('selCommRace').value; 
  const box = document.getElementById('commContent'); 
  
  const consensusBox = document.getElementById('consensusContainer');
  if (consensusBox) {
    consensusBox.style.display = 'block';
  }

  box.innerHTML = '<div class="text-center text-secondary py-4"><i class="fa-solid fa-spinner fa-spin me-2"></i>กำลังดึงตั๋วโพยเพื่อน...</div>';

  const currentRace = globalRaces.find(function(r) { return r.id === raceId; });
  const isCalculated = currentRace && currentRace.status === 'CALCULATED';

  callGAS("getCommunityPredictions", { raceId: raceId }).then(function(res) {
    const predictionsData = res.data || res.predictions || []; 
    
    if (typeof renderConsensusChart === "function") {
      renderConsensusChart(predictionsData, res.locked);
    }

    if (!res.locked) { 
      box.innerHTML = 
        '<div class="locked-ticket-card">' +
          '<div class="rubber-stamp-locked"><i class="fa-solid fa-lock me-2"></i>LOCKED</div>' +
          '<div class="text-white fw-bold mb-1" style="font-family:\'Rajdhani\',sans-serif; font-size:1.05rem; letter-spacing:0.5px;">PADDOCK PARC FERMÉ</div>' +
          '<div class="small text-secondary">' + (res.msg || 'ข้อมูลถูกซ่อนไว้จนกว่าจะหมดเวลา') + '</div>' +
        '</div>'; 
      return; 
    } 

    box.innerHTML = ''; 
    if (predictionsData.length === 0) {
      box.innerHTML = '<div class="text-center text-secondary small py-4">ยังไม่มีผู้ทายผลในสนามนี้</div>';
      return;
    }

    predictionsData.forEach(function(p, index) {
      const p1 = p.p1 || p.pos1 || '-';
      const p2 = p.p2 || p.pos2 || '-';
      const p3 = p.p3 || p.pos3 || '-';
      const p4 = p.p4 || p.pos4 || '-';
      const fl = p.fl || p.posFL || '';

      const c1 = (typeof DRIVER_INFO !== 'undefined' && DRIVER_INFO[p1]) ? DRIVER_INFO[p1].color : '#64748b';
      const c2 = (typeof DRIVER_INFO !== 'undefined' && DRIVER_INFO[p2]) ? DRIVER_INFO[p2].color : '#64748b';
      const c3 = (typeof DRIVER_INFO !== 'undefined' && DRIVER_INFO[p3]) ? DRIVER_INFO[p3].color : '#64748b';
      const c4 = (typeof DRIVER_INFO !== 'undefined' && DRIVER_INFO[p4]) ? DRIVER_INFO[p4].color : '#64748b';

      let stubContent = '';
      if (isCalculated || Number(p.score) > 0) {
        stubContent = 
          '<div class="ticket-pts-val text-warning">' + (p.score || 0) + '</div>' +
          '<div class="ticket-pts-lbl">POINTS</div>';
      } else {
        stubContent = 
          '<div class="ticket-pending-stamp">LOCKED IN</div>' +
          '<div class="ticket-pts-lbl mt-1">WAITING</div>';
      }

      const passNum = String(index + 1).padStart(2, '0');
      const playerName = p.playerName || p.player || 'Unknown';

      const cardHtml = `
        <div class="pred-ticket">
           <div class="ticket-main">
             <div class="ticket-player-header">
               <div class="ticket-player-name"><i class="fa-solid fa-id-badge text-danger me-2"></i>${playerName}</div>
               <span class="ticket-pass-tag">PASS #${passNum}</span>
             </div>
             <div class="ticket-picks-grid">
               <div class="ticket-pick-item"><span class="ticket-pos-pill p1">P1</span><span class="ticket-driver-dot" style="background:${c1}"></span><span class="ticket-driver-txt">${getShortDriverName(p1)}</span></div>
               <div class="ticket-pick-item"><span class="ticket-pos-pill p2">P2</span><span class="ticket-driver-dot" style="background:${c2}"></span><span class="ticket-driver-txt">${getShortDriverName(p2)}</span></div>
               <div class="ticket-pick-item"><span class="ticket-pos-pill p3">P3</span><span class="ticket-driver-dot" style="background:${c3}"></span><span class="ticket-driver-txt">${getShortDriverName(p3)}</span></div>
               <div class="ticket-pick-item"><span class="ticket-pos-pill">P4</span><span class="ticket-driver-dot" style="background:${c4}"></span><span class="ticket-driver-txt">${getShortDriverName(p4)}</span></div>
             </div>
             ${fl ? `<div class="ticket-fl-bar"><i class="fa-solid fa-bolt"></i><span>FL: ${getShortDriverName(fl)}</span></div>` : ''}
           </div>
           <div class="ticket-stub">
             ${stubContent}
           </div>
         </div>
      `;
      box.insertAdjacentHTML('beforeend', cardHtml);
    });
    
  }).catch(function(err) {
      console.error("Community Error:", err);
      box.innerHTML = '<div class="text-center text-danger small py-4">เกิดข้อผิดพลาดในการโหลดข้อมูล<br><span style="font-size:0.7rem; color:#888;">(กรุณารีเฟรช)</span></div>';
  });
}

// =========================================================
// 📰 LATEST PADDOCK NEWS (ระบบดึงข่าวอัตโนมัติจาก RSS)
// =========================================================
async function loadLatestNews() {
  const container = document.getElementById('newsScrollContainer');
  if (!container) return;

  try {
    const rssUrl = 'https://www.motorsport.com/rss/f1/news/';
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&api_key=`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== 'ok' || !data.items || data.items.length === 0) {
      container.innerHTML = '<div class="text-secondary small py-5 text-center w-100">ไม่สามารถเชื่อมต่อศูนย์ข่าวได้</div>';
      return;
    }

    const latestNews = data.items.slice(0, 6);
    let newsHtml = '';
    
    latestNews.forEach(item => {
      let imgUrl = 'https://lh3.googleusercontent.com/d/1UPM7PH4G6QD3W-9YFb_UTcLFsLWZ2fAj';
      if (item.enclosure && item.enclosure.link) {
        imgUrl = item.enclosure.link;
      } else if (item.thumbnail) {
        imgUrl = item.thumbnail;
      }

      const pubDate = new Date(item.pubDate.replace(' ', 'T'));
      const diffHrs = Math.floor((new Date() - pubDate) / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      let timeText = diffHrs < 1 ? 'Just now' : (diffHrs < 24 ? `${diffHrs} hrs ago` : `${diffDays} days ago`);

      newsHtml += `
        <a href="${item.link}" class="news-card-cinematic" target="_blank">
          <img src="${imgUrl}" class="news-bg-img" alt="News Image" onerror="this.src='https://lh3.googleusercontent.com/d/1UPM7PH4G6QD3W-9YFb_UTcLFsLWZ2fAj'">
          <div class="news-gradient-overlay"></div>
          <div class="news-content-overlay">
            <div style="color: #0dcaf0; font-size: 0.75rem; font-family: 'Rajdhani', sans-serif; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
              ${timeText} • Motorsport.com
            </div>
            <div class="news-headline-overlay">${item.title}</div>
          </div>
        </a>
      `;
    });

    container.innerHTML = newsHtml;

  } catch (error) {
    console.error("News Fetch Error:", error);
    container.innerHTML = '<div class="text-danger small py-5 text-center w-100">เกิดข้อผิดพลาดในการโหลดข่าวสาร</div>';
  }
}

// =========================================================
// 🎯 DRIVER FORM RADAR & PREDICTION HERO FLOW
// =========================================================
let heroRadarChartInstance = null;

let DRIVER_STATS = {
  "default": [80, 80, 80, 80, 80, 80]
};

const GAS_STATS_API_URL = "https://script.google.com/macros/s/AKfycbwZ_VB9I7ClOgDpd8bDkaY09CzipETJMeQPDK6Qk6JYVNPdgfXA6ZrmXDG8gYsJ9I6u/exec?action=getStats";

async function loadDriverStatsAPI() {
  try {
    const response = await fetch(GAS_STATS_API_URL);
    const result = await response.json();
    
    if (result.status === "success" && result.data) {
      DRIVER_STATS = { ...DRIVER_STATS, ...result.data };
      console.log("✅ Driver Stats Loaded via API");
    }
  } catch (error) {
    console.error("❌ Failed to fetch driver stats:", error);
  }
}

// 1. ระบบปัดนิ้วซ้าย-ขวา (Touch Swipe) แบบไร้ปุ่มรกตา สำหรับเลื่อนเทียบนักแข่ง
function initHeroHybridShowcaseUI() {
  const heroModalEl = document.getElementById('driverHeroModal');
  if (!heroModalEl) return;

  if (!document.getElementById('hybridShowcaseInlineStyles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'hybridShowcaseInlineStyles';
    styleEl.textContent =
      '.hero-driver-switch-anim { animation: heroFadeSlide 0.22s cubic-bezier(0.22, 1, 0.36, 1); }\n' +
      '@keyframes heroFadeSlide { from { opacity: 0.35; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }';
    document.head.appendChild(styleEl);
  }

  const modalBody = heroModalEl.querySelector('.modal-body');
  if (modalBody && !modalBody.dataset.swipeBound) {
    modalBody.dataset.swipeBound = '1';

    let touchStartX = 0;
    let touchStartY = 0;
    modalBody.addEventListener('touchstart', function (e) {
      if (e.changedTouches && e.changedTouches.length > 0) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }
    }, { passive: true });

    modalBody.addEventListener('touchend', function (e) {
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const diffX = e.changedTouches[0].screenX - touchStartX;
      const diffY = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(diffX) > 55 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
        if (diffX < 0) navigateHeroDriver(1);
        else navigateHeroDriver(-1);
      }
    }, { passive: true });
  }

  document.addEventListener('keydown', function (e) {
    if (!heroModalEl.classList.contains('show')) return;
    if (e.key === 'ArrowLeft') navigateHeroDriver(-1);
    else if (e.key === 'ArrowRight') navigateHeroDriver(1);
  });
}

function navigateHeroDriver(direction) {
  const mBody = document.querySelector('#driverHeroModal .modal-body');
  if (mBody) mBody.scrollLeft = 0; // รีเซ็ตแกนแนวนอนให้อยู่ตรงกลางเสมอ
  if (!Array.isArray(DRIVERS) || DRIVERS.length === 0) return;
  if (!currentHeroDriver) currentHeroDriver = DRIVERS[0];
  triggerHaptic();

  let orderedList = DRIVERS;
  if (!isHeroInPredictMode) {
    const domOrder = [];
    document.querySelectorAll('#driverStandingsList .f1-standings-row').forEach(function (row) {
      const onclickAttr = row.getAttribute('onclick') || '';
      const match = onclickAttr.match(/openDriverHero\('([^']+)'/);
      if (match && match[1]) domOrder.push(match[1]);
    });
    if (domOrder.length > 0) orderedList = domOrder;
  }

  let currentIdx = orderedList.indexOf(currentHeroDriver);
  if (currentIdx === -1) currentIdx = 0;
  const nextIdx = (currentIdx + direction + orderedList.length) % orderedList.length;
  const nextDriverName = orderedList[nextIdx];

  const imgEl = document.getElementById('heroDriverImg');
  if (imgEl) {
    imgEl.classList.remove('hero-driver-switch-anim');
    void imgEl.offsetWidth;
    imgEl.classList.add('hero-driver-switch-anim');
  }

  if (isHeroInPredictMode) {
    previewDriverBeforeSelect(nextDriverName, true);
  } else {
    openDriverHero(nextDriverName, null, true);
  }
}

// =========================================================
// 📈 LAST 7 RACES FINISHING TREND ENGINE (P1-P4 ZONE + TEAM COLOR)
// =========================================================
let recent7RacesCache = null;
let recent7RacesPromise = null;

const RACE_SHORT_CODES = {
  "australia": "AUS", "australian": "AUS", "china": "CHN", "chinese": "CHN",
  "japan": "JPN", "japanese": "JPN", "bahrain": "BHR", "saudi": "SAU",
  "miami": "MIA", "emilia": "IMO", "imola": "IMO", "monaco": "MON",
  "canada": "CAN", "canadian": "CAN", "barcelona": "BCN", "spain": "ESP", "spanish": "ESP", "madrid": "MAD",
  "austria": "AUT", "austrian": "AUT", "britain": "GBR", "british": "GBR", "silverstone": "GBR",
  "belgium": "BEL", "belgian": "BEL", "hungary": "HUN", "hungarian": "HUN",
  "netherlands": "NED", "dutch": "NED", "italy": "ITA", "italian": "ITA", "monza": "ITA",
  "azerbaijan": "AZE", "baku": "AZE", "singapore": "SIN", "austin": "USA", "united states": "USA",
  "mexico": "MEX", "mexican": "MEX", "brazil": "BRA", "são paulo": "BRA", "sao paulo": "BRA",
  "las vegas": "LVG", "vegas": "LVG", "qatar": "QAT", "abu dhabi": "ABU"
};

function getShortRaceCode(nameStr, fallbackIdx) {
  const lower = String(nameStr || "").toLowerCase();
  for (const key in RACE_SHORT_CODES) {
    if (lower.includes(key)) return RACE_SHORT_CODES[key];
  }
  const cleaned = String(nameStr || "").replace(/grand prix/gi, "").trim();
  return cleaned ? cleaned.substring(0, 3).toUpperCase() : ("R" + fallbackIdx);
}

// ดึงประวัติอันดับจบจริง 7 สนามล่าสุดของนักแข่งทั้งกริด (โหลดครั้งเดียว จำแคช 30 นาที ปัดลื่น 0ms)
async function loadRecent7RacesHistory() {
  if (recent7RacesCache) return recent7RacesCache;
  if (recent7RacesPromise) return recent7RacesPromise;

  // เช็กแคชใน localStorage ก่อน (อายุแคช 30 นาที)
  try {
    const raw = localStorage.getItem("f1_last7_form_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp < 1800000) && parsed.labels?.length > 0) {
        recent7RacesCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}

  recent7RacesPromise = (async () => {
    try {
      const [meetings, raceSessions] = await Promise.all([
        fetchOpenF1Cached("https://api.openf1.org/v1/meetings?year=2026", 900000).catch(() => []),
        fetchOpenF1Cached("https://api.openf1.org/v1/sessions?year=2026&session_name=Race", 900000)
      ]);

      const meetingMap = {};
      (Array.isArray(meetings) ? meetings : []).forEach(m => {
        if (m && m.meeting_key) meetingMap[m.meeting_key] = m.meeting_name || m.location || "";
      });

      const now = new Date();
      const finishedRaces = (Array.isArray(raceSessions) ? raceSessions : [])
        .filter(s => s && s.date_start && new Date(s.date_start) <= now)
        .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

      const last7 = finishedRaces.slice(-7);
      if (last7.length === 0) return { labels: [], driverMap: {} };

      // ดึงรายชื่อเลขรถจากสนามล่าสุดเพื่อแมพเข้ากับชื่อนักแข่งในแอป
      const latestKey = last7[last7.length - 1].session_key;
      const latestDrivers = await fetchOpenF1Cached(`https://api.openf1.org/v1/drivers?session_key=${latestKey}`, 900000).catch(() => []);
      const numToAppDriver = {};
      (Array.isArray(latestDrivers) ? latestDrivers : []).forEach(d => {
        if (d && d.driver_number != null && typeof resolveAppDriverName === "function") {
          numToAppDriver[d.driver_number] = resolveAppDriverName(d);
        }
      });

      const labels = [];
      const driverMap = {};
      Object.keys(DRIVER_INFO || {}).forEach(name => { driverMap[name] = []; });

      for (let i = 0; i < last7.length; i++) {
        const s = last7[i];
        const mName = meetingMap[s.meeting_key] || s.country_name || s.location || "";
        labels.push(getShortRaceCode(mName, i + 1));

        const [resList, sDrivers] = await Promise.all([
          fetchOpenF1Cached(`https://api.openf1.org/v1/session_result?session_key=${s.session_key}`, 1800000).catch(() => []),
          fetchOpenF1Cached(`https://api.openf1.org/v1/drivers?session_key=${s.session_key}`, 1800000).catch(() => [])
        ]);

        const localNumMap = Object.assign({}, numToAppDriver);
        (Array.isArray(sDrivers) ? sDrivers : []).forEach(d => {
          if (d && d.driver_number != null && typeof resolveAppDriverName === "function") {
            localNumMap[d.driver_number] = resolveAppDriverName(d);
          }
        });

        const recordedThisRace = new Set();
        (Array.isArray(resList) ? resList : []).forEach(item => {
          const appName = localNumMap[item.driver_number];
          if (!appName || !driverMap[appName] || recordedThisRace.has(appName)) return;
          recordedThisRace.add(appName);

          const isDnf = !!(item.dnf || item.dns || item.dsq || item.position == null);
          const statusTag = item.dsq ? "DSQ" : (item.dns ? "DNS" : (item.dnf ? "DNF" : null));
          const posNum = (!isDnf && item.position != null) ? Number(item.position) : 22;

          driverMap[appName].push({
            pos: posNum,
            status: statusTag || ("P" + posNum),
            isDnf: isDnf
          });
        });

        // กรณีนักแข่งไม่ได้ลงแข่งในสนามนั้น (DNS / สำรอง)
        Object.keys(driverMap).forEach(name => {
          if (!recordedThisRace.has(name)) {
            driverMap[name].push({ pos: null, status: "-", isDnf: false });
          }
        });
      }

      const payload = { labels, driverMap, timestamp: Date.now() };
      recent7RacesCache = payload;
      try { localStorage.setItem("f1_last7_form_v1", JSON.stringify(payload)); } catch (e) {}
      return payload;
    } catch (err) {
      console.warn("Load 7-race trend error:", err);
      return { labels: [], driverMap: {} };
    } finally {
      recent7RacesPromise = null;
    }
  })();

  return recent7RacesPromise;
}

// แปลงรหัสสี Hex เป็น rgba เพื่อทำแสงฟุ้งละลายกลืนกับพื้นหลังแบบไร้ขอบตัด
function hexToRgba(hex, alpha) {
  const clean = String(hex || "#0dcaf0").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return `rgba(13, 202, 240, ${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// ปลั๊กอินวาดเส้นประ TOP 4, แสง Neon Glow รอบเส้นกราฟ และป้ายตำแหน่งเหนือจุด
const f1TrendBroadcastPlugin = {
  id: "f1TrendBroadcastPlugin",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales: { y } } = chart;
    if (!chartArea || !y) return;

    const yP4 = y.getPixelForValue(4.35);
    if (yP4 >= chartArea.top && yP4 <= chartArea.bottom) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = "rgba(237, 180, 11, 0.25)";
      ctx.lineWidth = 1;
      ctx.moveTo(chartArea.left, yP4);
      ctx.lineTo(chartArea.right, yP4);
      ctx.stroke();

      ctx.font = "600 9px 'Rajdhani', sans-serif";
      ctx.fillStyle = "rgba(237, 180, 11, 0.5)";
      ctx.textAlign = "right";
      ctx.fillText("TOP 4 LINE", chartArea.right, yP4 - 4);
      ctx.restore();
    }

    // เปิดเอฟเฟกต์แสง Neon Glow สีประจำทีมให้ตัวเส้นกราฟดูนุ่มนวลมีมิติ
    const borderColor = chart.data.datasets[0]?.borderColor || "#0dcaf0";
    ctx.save();
    ctx.shadowColor = hexToRgba(borderColor, 0.55);
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
  },
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    // ปิด state ของ Neon Glow ก่อนวาดตัวหนังสือ
    ctx.restore();

    const meta = chart.getDatasetMeta(0);
    const rawMeta = chart.data.datasets[0]?.rawRecords || [];
    if (!meta || !meta.data) return;

    ctx.save();
    ctx.font = "700 11px 'Share Tech Mono', 'Rajdhani', sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = 6;

    meta.data.forEach((pt, idx) => {
      const rec = rawMeta[idx];
      if (!rec || rec.pos === null) return;

      if (rec.isDnf) {
        ctx.fillStyle = "#ff4d4f";
      } else if (rec.pos <= 4) {
        ctx.fillStyle = "#EDB40B";
      } else {
        ctx.fillStyle = "#f1f5f9";
      }
      ctx.fillText(rec.status, pt.x, pt.y - 10);
    });
    ctx.restore();
  }
};

async function renderDriverRadar(fullName, teamColor) {
  const canvasEl = document.getElementById("driverRadarChart");
  if (!canvasEl) return;

  const colorCode = teamColor || "#0dcaf0";
  const badgeEl = document.getElementById("driverTop4Summary");

  const trendData = await loadRecent7RacesHistory();
  if (currentHeroDriver && currentHeroDriver !== fullName) return;

  const labels = trendData.labels || [];
  const records = (trendData.driverMap && trendData.driverMap[fullName]) ? trendData.driverMap[fullName] : [];

  const top4Count = records.filter(r => r && !r.isDnf && r.pos !== null && r.pos <= 4).length;
  if (badgeEl) {
    badgeEl.textContent = labels.length > 0 ? `TOP 4: ${top4Count}/${labels.length}` : "LOADING...";
  }

  const validPositions = records.filter(r => r && r.pos !== null).map(r => r.pos);
  const worstPos = validPositions.length > 0 ? Math.max(...validPositions) : 10;
  const dynamicMaxY = Math.min(22, Math.max(7, worstPos + 2));

  const plotValues = records.map(r => (r && r.pos !== null) ? r.pos : null);
  const pointBgColors = records.map(r => {
    if (!r || r.pos === null) return "transparent";
    if (r.isDnf) return "#ff2a2a";
    if (r.pos === 1) return "#EDB40B";
    return "#0d0e12";
  });
  const pointBorderColors = records.map(r => {
    if (!r || r.pos === null) return "transparent";
    if (r.isDnf) return "#ff2a2a";
    return colorCode;
  });

  if (heroRadarChartInstance) {
    heroRadarChartInstance.destroy();
    heroRadarChartInstance = null;
  }

  const ctx = canvasEl.getContext("2d");

  heroRadarChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: fullName,
        data: plotValues,
        rawRecords: records,
        borderColor: colorCode,
        // ✅ คำนวณ Gradient ตามขอบเขตจริงของเส้นกราฟ และเฟดจางหายเป็น 0% ด้านล่างแบบเนียนกริบไร้กรอบ!
          backgroundColor: function(context) {
          const chart = context.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return hexToRgba(colorCode, 0.12);
          const meta = chart.getDatasetMeta(0);
          let topY = chartArea.top;
          if (meta && meta.data && meta.data.length > 0) {
            const ys = meta.data.map(p => p.y).filter(v => typeof v === "number" && !isNaN(v));
            if (ys.length > 0) topY = Math.min(...ys);
          }
          const grad = c.createLinearGradient(0, topY, 0, chartArea.bottom);
          grad.addColorStop(0, hexToRgba(colorCode, 0.30));
          grad.addColorStop(0.45, hexToRgba(colorCode, 0.10));
          grad.addColorStop(0.82, hexToRgba(colorCode, 0.01));
          grad.addColorStop(1, "rgba(10, 14, 28, 0)");
          return grad;
        },
        borderWidth: 3,
        fill: "start",
        tension: 0.38,
        spanGaps: true,
        clip: false,
        pointBackgroundColor: pointBgColors,
        pointBorderColor: pointBorderColors,
        pointBorderWidth: 2.4,
        pointRadius: 4.5,
        pointHoverRadius: 6.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      layout: {
        padding: { top: 24, right: 16, left: 16, bottom: 4 }
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false, drawBorder: false },
          ticks: {
            color: "rgba(226, 232, 240, 0.85)",
            font: { family: "Rajdhani", size: 11, weight: "700" },
            padding: 6
          }
        },
        y: {
          display: false,
          reverse: true,
          min: 1,
          max: dynamicMaxY,
          border: { display: false },
          grid: { display: false, drawBorder: false },
          ticks: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10, 12, 16, 0.92)",
          titleColor: "#ffffff",
          bodyColor: "#EDB40B",
          titleFont: { family: "Rajdhani", size: 13, weight: "bold" },
          bodyFont: { family: "Share Tech Mono", size: 13 },
          borderColor: colorCode,
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            title: function(items) {
              return "GP: " + items[0].label;
            },
            label: function(context) {
              const rec = context.dataset.rawRecords?.[context.dataIndex];
              if (!rec || rec.pos === null) return "Did Not Participate";
              return rec.isDnf ? `Status: ${rec.status}` : `Finish: P${rec.pos}`;
            }
          }
        }
      }
    },
    plugins: [f1TrendBroadcastPlugin]
  });
}


// 3. Clean Editorial Hero (Layout แต้มและปุ่มเหลืองแบบเดิมเป๊ะ + สลับหน้าไว Zero-Lag + ทายซ้ำได้ทุกช่อง)
function previewDriverBeforeSelect(fullName, isSwiping) {
  if (!isSwiping) triggerHaptic();

  const radioBtn = document.getElementById('btnTeamRadio');
  if (radioBtn) radioBtn.style.setProperty('display', 'none', 'important');

  const info = DRIVER_INFO[fullName];
  if (!info) return;

  currentHeroDriver = fullName;
  isHeroInPredictMode = true;

    let currentPts = "0";
  let currentPos = "-";

  // 1. ดึงจากตัวแปรกลางของ API ก่อน (แม่นยำ 100% แม้ตารางซ่อนอยู่)
  if (window.f1DriverStandingsMap && window.f1DriverStandingsMap[fullName]) {
    currentPts = window.f1DriverStandingsMap[fullName].points;
    currentPos = window.f1DriverStandingsMap[fullName].position;
  } else {
    // 2. Fallback ดึงด้วย textContent แทน innerText
    const standingRows = document.querySelectorAll('#driverStandingsList .f1-standings-row');
    standingRows.forEach(function(row) {
      const onclickAttr = row.getAttribute('onclick') || '';
      const lastName = fullName.split(' ').slice(1).join(' ');
      if (onclickAttr.includes(fullName) || (lastName && row.textContent.includes(lastName))) {
        const ptsEl = row.querySelector('.col-pts');
        const posEl = row.querySelector('.col-pos');
        if (ptsEl) currentPts = ptsEl.textContent.trim();
        if (posEl) currentPos = posEl.textContent.trim();
      }
    });

    // 3. หากเปิดการ์ดเร็วกว่าที่ API โหลดเสร็จ ให้ดึงข้อมูลสดแล้ววิ่งเลขตามขึ้นมาทันที!
    if ((!window.f1DriverStandingsMap || Object.keys(window.f1DriverStandingsMap).length === 0) && typeof fetchF1Standings === 'function') {
      fetchF1Standings().then(function() {
        const fresh = window.f1DriverStandingsMap && window.f1DriverStandingsMap[fullName];
        if (fresh && currentHeroDriver === fullName) {
          const hPos = document.getElementById('heroPos');
          const hPts = document.getElementById('heroPoints');
          if (hPos) hPos.textContent = 'P' + fresh.position;
          if (hPts) animateCountUp(hPts, fresh.points, 900);
        }
      });
    }
  }


  const parts = fullName.split(' ');
  document.getElementById('heroDriverFirstName').innerText = parts[0];
  document.getElementById('heroDriverLastName').innerText = parts.slice(1).join(' ');
  document.getElementById('heroTeamName').innerText = info.team;
  document.getElementById('heroTeamLogo').src = getDriveDirectLink(TEAM_LOGOS[info.team] || '');
  document.getElementById('heroDriverImg').src = getDriveDirectLink(info.heroImg || info.img);
  document.getElementById('heroBgColor').style.background = 'linear-gradient(to bottom, #0a0e1c 0%, ' + info.color + '40 15%, #0a0e1c 65%)';

  const heroPtsEl = document.getElementById('heroPoints');
  const heroPosEl = document.getElementById('heroPos');
  if (heroPosEl) heroPosEl.innerText = 'P' + currentPos;

  const standardStatsEl = document.getElementById('heroStandardStats');
  const predictSectionEl = document.getElementById('heroPredictSection');

  if (standardStatsEl) {
    standardStatsEl.style.display = 'flex';
    standardStatsEl.style.marginTop = "35px";
    standardStatsEl.style.flexDirection = "column";
    standardStatsEl.style.alignItems = "flex-start";
    standardStatsEl.style.gap = "15px";

    if (heroPtsEl && heroPtsEl.parentElement) {
      heroPtsEl.parentElement.style.fontSize = "4.5rem";
      heroPtsEl.parentElement.style.lineHeight = "0.9";
      heroPtsEl.parentElement.style.textAlign = "left";
    }
    if (heroPosEl) {
      heroPosEl.style.fontSize = "4.5rem";
      heroPosEl.style.lineHeight = "0.9";
      heroPosEl.style.textAlign = "left";
    }
  }

  if (predictSectionEl) predictSectionEl.style.display = 'block';

  renderDriverRadar(fullName, info.color);

    const btn = document.getElementById('btnConfirmHeroPick');
  const slotLabels = { 'pos1': 'P1', 'pos2': 'P2', 'pos3': 'P3', 'pos4': 'P4', 'posFL': 'FASTEST LAP' };

  if (btn && currentSelectingSlot) {
    btn.classList.remove('btn-success');
    btn.classList.add('btn-warning');
    btn.innerHTML = '<i class="fa-solid fa-check-circle me-2"></i>SELECT FOR <span id="lblHeroSlot">' + (slotLabels[currentSelectingSlot] || '') + '</span>';

    btn.onclick = function() {
      const pickedSlotLabel = slotLabels[currentSelectingSlot] || '';
      const remainingSlot = confirmSelectDriver(currentHeroDriver, false);

      if (remainingSlot) {
        // ยังมีช่องถัดไปว่างอยู่ -> โชว์ Feedback สีเขียวสั้นๆ 0.35 วิ แล้วเปลี่ยนปุ่มเป็นช่องถัดไปทันทีโดยไม่ปิดหน้าการ์ด!
        const nextLabel = slotLabels[remainingSlot] || '';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-success');
        btn.innerHTML = '<i class="fa-solid fa-lock me-2"></i>LOCKED ' + pickedSlotLabel + '! → NEXT: ' + nextLabel;

        setTimeout(function() {
          if (!currentSelectingSlot) return;
          btn.classList.remove('btn-success');
          btn.classList.add('btn-warning');
          btn.innerHTML = '<i class="fa-solid fa-check-circle me-2"></i>SELECT FOR <span id="lblHeroSlot">' + (slotLabels[currentSelectingSlot] || '') + '</span>';
        }, 380);
      } else {
        // เลือกครบทุกช่องแล้ว (P1-P4 + FL) -> ปิดหน้าการ์ดพากลับไปกด Submit ทันที!
        const heroModalEl = document.getElementById('driverHeroModal');
        const heroInst = bootstrap.Modal.getInstance(heroModalEl) || window.driverHeroModalInstance;
        if (heroInst) heroInst.hide();
        showToast('เลือกนักแข่งครบทุกอันดับแล้ว!', 'success');
      }
    };
  }

  const heroModalEl = document.getElementById('driverHeroModal');
  if (!window.driverHeroModalInstance) {
    window.driverHeroModalInstance = new bootstrap.Modal(heroModalEl);
  }
  if (!heroModalEl.classList.contains('show')) {
    if (heroPtsEl) heroPtsEl.innerText = "0";
    window.driverHeroModalInstance.show();
    setTimeout(function() { animateCountUp(heroPtsEl, currentPts, 1400); }, 100);
  } else {
    animateCountUp(heroPtsEl, currentPts, 550);
  }
}

function openDriverHero(fullName, rowEl, isSwiping) {
  if (!isSwiping) triggerHaptic();
  const info = DRIVER_INFO[fullName];
  if (!info) return;

  currentHeroDriver = fullName;
  isHeroInPredictMode = false;

  const radioBtn = document.getElementById('btnTeamRadio');
  if (radioBtn) radioBtn.style.setProperty('display', 'none', 'important');

    let pts = "0";
  let pos = "-";
  if (window.f1DriverStandingsMap && window.f1DriverStandingsMap[fullName]) {
    pts = window.f1DriverStandingsMap[fullName].points;
    pos = window.f1DriverStandingsMap[fullName].position;
  } else if (rowEl) {
    pts = rowEl.querySelector('.col-pts').textContent.trim();
    pos = rowEl.querySelector('.col-pos').textContent.trim();
  } else {
    document.querySelectorAll('#driverStandingsList .f1-standings-row').forEach(function(r) {
      const onclickAttr = r.getAttribute('onclick') || '';
      if (onclickAttr.includes(fullName)) {
        pts = r.querySelector('.col-pts').textContent.trim();
        pos = r.querySelector('.col-pos').textContent.trim();
      }
    });
  }

  const parts = fullName.split(' ');
  document.getElementById('heroDriverFirstName').innerText = parts[0];
  document.getElementById('heroDriverLastName').innerText = parts.slice(1).join(' ');
  document.getElementById('heroTeamName').innerText = info.team;
  document.getElementById('heroTeamLogo').src = getDriveDirectLink(TEAM_LOGOS[info.team] || '');
  document.getElementById('heroDriverImg').src = getDriveDirectLink(info.heroImg || info.img);

  const heroPtsEl = document.getElementById('heroPoints');
  const heroPosEl = document.getElementById('heroPos');
  if (heroPosEl) heroPosEl.innerText = 'P' + pos;

  const standardStatsEl = document.getElementById('heroStandardStats');
  const predictSectionEl = document.getElementById('heroPredictSection');

  if (standardStatsEl) {
    standardStatsEl.style.display = 'block';
    standardStatsEl.style.marginTop = "0px";
    if (heroPtsEl && heroPtsEl.parentElement) heroPtsEl.parentElement.style.fontSize = "";
    if (heroPosEl) heroPosEl.style.fontSize = "";
  }
  if (predictSectionEl) predictSectionEl.style.display = 'none';

  document.getElementById('heroBgColor').style.background = 'linear-gradient(to bottom, #0a0e1c 0%, ' + info.color + '40 15%, #0a0e1c 65%)';

  const heroModalEl = document.getElementById('driverHeroModal');
  if (!window.driverHeroModalInstance) {
    window.driverHeroModalInstance = new bootstrap.Modal(heroModalEl);
  }
  if (!heroModalEl.classList.contains('show')) {
    if (heroPtsEl) heroPtsEl.innerText = "0";
    window.driverHeroModalInstance.show();
    setTimeout(function() { animateCountUp(heroPtsEl, pts, 1800); }, 20);
  } else {
    animateCountUp(heroPtsEl, pts, 600);
  }
}

// ==========================================
// 🔴 PIT WALL RADIO LOGIC (FRONT-END TELEMETRY)
// ==========================================

// เปิด/ปิด หน้าต่างวิทยุ
function togglePitWall() {
  const modal = document.getElementById('pitWallModal');
  if (modal) modal.classList.toggle('hidden');
}
// ป้องกัน Error เวลา showTab() พยายามซ่อนวิทยุ
function closeTeamRadio() {
  const modal = document.getElementById('pitWallModal');
  if (modal && !modal.classList.contains('hidden')) {
    modal.classList.add('hidden');
  }
}
// กดปุ่ม Enter เพื่อส่ง
function handleChatEnter(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendRadioMessage();
  }
}

// ฟังก์ชันไฮไลท์คำสำคัญ (P1, P2, Fastest Lap) ให้เป็นสี Cyan แนวนักซิ่ง
function formatTelemetryText(text) {
  return text.replace(/\b(P[1-5]|Fastest Lap|Undercut|Safety Car)\b/gi, '<span class="telemetry-cyan">$&</span>');
}

// ระบบบันทึกประวัติการแชท
let radioChatHistory = [];

// ส่งข้อความไปหา AI
function sendRadioMessage() {
  const inputEl = document.getElementById('chatInput');
  const message = inputEl.value.trim();
  
  // บรรทัดนี้แหละครับที่มักจะทำให้เกิด Error ถอยหลุดออกจากฟังก์ชัน
  if (!message) return; 

  const chatBox = document.getElementById('chatBox');
  const safeUserMsg = escapeHtml(message);

  // 1. เพิ่มข้อความของผู้เล่น (User) ฝั่งขวา
  chatBox.insertAdjacentHTML('beforeend', `
    <div class="msg-wrapper user">
      <div class="msg-bubble">${safeUserMsg}</div>
    </div>
  `);
  inputEl.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;

  // 2. ขึ้นแอนิเมชันคลื่นวิทยุ (รอ AI คิด) ฝั่งซ้าย
  const waveId = 'wave-' + Date.now();
  chatBox.insertAdjacentHTML('beforeend', `
    <div class="msg-wrapper ai" id="${waveId}">
      <div class="msg-bubble">
        <div class="radio-wave">
          <div class="wave-bar"></div><div class="wave-bar"></div>
          <div class="wave-bar"></div><div class="wave-bar"></div>
        </div>
      </div>
    </div>
  `);
  chatBox.scrollTop = chatBox.scrollHeight;

  // 3. เตรียมข้อมูลผู้เล่นและสนามจริง ส่งไป Backend
  const player = localStorage.getItem('f1_player_name') || 'Driver';
  const rSel = document.getElementById('selRace');
  let currentRace = "สนามถัดไป";
  if (rSel && rSel.selectedIndex > 0) {
    currentRace = rSel.options[rSel.selectedIndex].text.replace(/🟢|🔴|🏁|⚡/g, '').trim();
  }

  const clientData = {
    playerName: player,
    raceName: currentRace,
    message: message,
    chatHistory: radioChatHistory.slice(-4) 
  };

  // 4. เรียกใช้ฟังก์ชัน callGAS สำหรับ GitHub Pages
  callGAS("askRaceEngineer", clientData)
    .then(function(response) {
      const waveEl = document.getElementById(waveId);
      if (waveEl) waveEl.remove();
      
      let finalMsg = response.message || response.msg || "ไม่มีการตอบกลับ";
      radioChatHistory.push({ role: "user", content: message });
      radioChatHistory.push({ role: "assistant", content: finalMsg });

      const formattedText = formatTelemetryText(escapeHtml(finalMsg)).replace(/\n/g, '<br>');
      
      chatBox.insertAdjacentHTML('beforeend', `
        <div class="msg-wrapper ai">
          <div class="msg-bubble">${formattedText}</div>
        </div>
      `);
      chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch(function(error) {
      const waveEl = document.getElementById(waveId);
      if (waveEl) waveEl.remove();
      
      chatBox.insertAdjacentHTML('beforeend', `
        <div class="msg-wrapper ai">
          <div class="msg-bubble" style="border-left-color: #ff9800;">⚠️ สัญญาณขาดหาย: ${escapeHtml(error.toString())}</div>
        </div>
      `);
      chatBox.scrollTop = chatBox.scrollHeight;
    });
}
// ฟังก์ชันส่งข้อความด่วน (Quick Prompt) เข้า Pit Wall Radio
function sendQuickRadioPrompt(promptText) {
  const inputEl = document.getElementById('chatInput');
  if (!inputEl) return;
  inputEl.value = promptText;
  sendRadioMessage(); // สั่งให้ส่งข้อความเข้าแชททันที
}

// ==========================================
// 🗓️ SCHEDULE TAB RENDERER & TIMETABLE MODAL
// ==========================================
let weekendTimetableModalInstance = null;
let currentViewingRaceId = null;

const COUNTRY_FLAGS = {
  "bahrain": "bh", "saudi arabia": "sa", "australia": "au", "australian": "au",
  "japan": "jp", "japanese": "jp", "china": "cn", "chinese": "cn", 
  "miami": "us", "imola": "it", "emilia romagna": "it",
  "monaco": "mc", "canada": "ca", "canadian": "ca", 
  "spain": "es", "spanish": "es", "austria": "at", "austrian": "at",
  "great britain": "gb", "british": "gb", "silverstone": "gb",
  "hungary": "hu", "hungarian": "hu", 
  "belgium": "be", "belgian": "be", 
  "netherlands": "nl", "dutch": "nl",
  "italy": "it", "italian": "it", 
  "azerbaijan": "az", "singapore": "sg", 
  "united states": "us", "austin": "us", "las vegas": "us",
  "mexico": "mx", "mexican": "mx", "mexico city": "mx",
  "brazil": "br", "brazilian": "br", "sao paulo": "br", "são paulo": "br",
  "qatar": "qa", "abu dhabi": "ae"
};

async function renderScheduleTab() {
  const container = document.getElementById('scheduleListContainer');
  if (!container || !globalRaces || globalRaces.length === 0) return;

  const now = new Date();
  let nextRaceId = null;

  // คัดกรองเอาเฉพาะแถวที่เป็น Main Race เพื่อไม่ให้การ์ดแสดงเบิ้ลกับแถว Sprint
  const weekendRaces = globalRaces.filter(r => r.id.includes('-MAIN') || r.type === 'Main');

  const upcomingRaces = weekendRaces.filter(r => r.deadline && new Date(r.deadline) > now);
  if (upcomingRaces.length > 0) nextRaceId = upcomingRaces[0].id;

  let openF1Meetings = [];
  try {
    const cached = sessionStorage.getItem('openF1_meetings_2026');
    if (cached) openF1Meetings = JSON.parse(cached);
        else {
      openF1Meetings = await fetchOpenF1Cached('https://api.openf1.org/v1/meetings?year=2026', 600000);
      sessionStorage.setItem('openF1_meetings_2026', JSON.stringify(openF1Meetings));
    }

  } catch (e) { console.error("API Error:", e); }

  let html = '';
  
  weekendRaces.forEach((race, index) => {
    const isNext = race.id === nextRaceId;
    const roundNum = String(index + 1);
    
        // ตัดคำต่อท้าย เช่น (Main GP), (Main), (Race) ออกจากชื่อใน Google Sheets อัตโนมัติ
    const cleanRaceName = String(race.name || '')
      .replace(/\s*\(\s*main(?:\s*gp|\s*race)?\s*\)/gi, '')
      .trim();

    const gSheetName = cleanRaceName.toLowerCase();
    const baseLocationName = gSheetName.replace(/\s*grand\s*prix.*$/i, '').trim();

    const apiMatch = (Array.isArray(openF1Meetings) ? openF1Meetings : []).find(m => {
      const apiName = String(m.meeting_name || '').toLowerCase();
      if (!apiName || apiName.includes('testing')) return false;
      return gSheetName.includes(apiName) || 
             apiName.includes(gSheetName) ||
             (baseLocationName.length >= 3 && apiName.includes(baseLocationName)) ||
             (gSheetName.includes('brazil') && (apiName.includes('são paulo') || apiName.includes('sao paulo'))) ||
             (gSheetName.includes('emilia') && apiName.includes('imola')) ||
             (gSheetName.includes('netherlands') && apiName.includes('dutch')) ||
             (gSheetName.includes('dutch') && apiName.includes('netherlands'));
    });

    const officialName = (apiMatch && apiMatch.meeting_official_name)
      ? apiMatch.meeting_official_name
      : (race.type === 'Sprint' ? 'FORMULA 1 SPRINT WEEKEND 2026' : 'FORMULA 1 GRAND PRIX 2026');

    const shortCountryName = (apiMatch && apiMatch.meeting_name)
      ? apiMatch.meeting_name.replace(/\s*\(\s*main(?:\s*gp|\s*race)?\s*\)/gi, '').trim()
      : cleanRaceName;

    let flagCode = "un"; 
    Object.keys(COUNTRY_FLAGS).forEach(key => {
      if (shortCountryName.toLowerCase().includes(key)) flagCode = COUNTRY_FLAGS[key];
    });
    const flagImgHtml = `<img src="https://flagcdn.com/w40/${flagCode}.png" class="sch-flag" alt="${shortCountryName}">`;

    let dateDisplay = "TBC";
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    if (apiMatch && apiMatch.date_start) {
      const dtStart = new Date(apiMatch.date_start);
      const dtEnd = new Date(dtStart);
      dtEnd.setDate(dtStart.getDate() + 2); 
      if (dtStart.getMonth() === dtEnd.getMonth()) {
        dateDisplay = `${String(dtStart.getDate()).padStart(2, '0')} - ${String(dtEnd.getDate()).padStart(2, '0')} ${monthNames[dtEnd.getMonth()]}`;
      } else {
        dateDisplay = `${String(dtStart.getDate()).padStart(2, '0')} ${monthNames[dtStart.getMonth()]} - ${String(dtEnd.getDate()).padStart(2, '0')} ${monthNames[dtEnd.getMonth()]}`;
      }
    } else if (race.deadline) {
      const dtEnd = new Date(race.deadline);
      const dtStart = new Date(dtEnd);
      dtStart.setDate(dtEnd.getDate() - 2); 
      if (dtStart.getMonth() === dtEnd.getMonth()) dateDisplay = `${String(dtStart.getDate()).padStart(2, '0')} - ${String(dtEnd.getDate()).padStart(2, '0')} ${monthNames[dtEnd.getMonth()]}`;
      else dateDisplay = `${String(dtStart.getDate()).padStart(2, '0')} ${monthNames[dtStart.getMonth()]} - ${String(dtEnd.getDate()).padStart(2, '0')} ${monthNames[dtEnd.getMonth()]}`;
    }

    // 1. ดึงรูปสำหรับโชว์บน "การ์ดด้านหน้า" (ผังสนามเล็ก)
    const cardTrackImgSrc = (typeof CARD_TRACK_IMAGES !== 'undefined' && CARD_TRACK_IMAGES[race.id]) ? CARD_TRACK_IMAGES[race.id] : ''; 
    
    // 2. ดึงรูปสำหรับแสดง "ด้านใน Modal" (ผังสนามใหญ่)
    const modalTrackImgSrc = (typeof MODAL_TRACK_IMAGES !== 'undefined' && MODAL_TRACK_IMAGES[race.id]) ? MODAL_TRACK_IMAGES[race.id] : ((race.media && race.media.trackLayoutImg) ? getDriveDirectLink(race.media.trackLayoutImg) : '');

    // 3. ดึงรูปรถ/รูปปก (Background Cover) 
    let coverImgSrc = 'https://lh3.googleusercontent.com/d/1UPM7PH4G6QD3W-9YFb_UTcLFsLWZ2fAj'; // รูป Default
    if (typeof SCHEDULE_COVER_IMAGES !== 'undefined' && SCHEDULE_COVER_IMAGES[race.id]) {
      coverImgSrc = SCHEDULE_COVER_IMAGES[race.id];
    } else if (race.media && race.media.schedulePosterImg) {
      coverImgSrc = getDriveDirectLink(race.media.schedulePosterImg);
    } else if (race.media && race.media.trackImg) {
      coverImgSrc = getDriveDirectLink(race.media.trackImg);
    }

    // 🎯 บังคับให้การ์ด NEXT ด้านหน้า ใช้รูปเดียวกับด้านใน Modal เป๊ะๆ 100%
    const posterImgSrc = coverImgSrc;

    // 4. ผูก Event เปิด Modal 
    const clickAction = `onclick="openWeekendTimetable('${race.id}', '${shortCountryName.replace(/'/g, "\\'")}', '${officialName.replace(/'/g, "\\'")}', '${flagCode}', '${coverImgSrc}', '${modalTrackImgSrc}', '${apiMatch ? apiMatch.meeting_key : ''}')"`;
    
    if (isNext) {
      html += `
        <div class="card border-0 rounded-4 overflow-hidden position-relative shadow-lg" ${clickAction} style="margin-bottom: 6px; min-height: 220px; cursor: pointer;">
          
          <img src="${posterImgSrc}" class="position-absolute w-100 h-100" style="object-fit: cover; object-position: center; opacity: 1;" alt="${shortCountryName}" loading="lazy">
          
          <div class="position-absolute w-100 h-100 z-1" style="background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 40%, transparent 60%, rgba(0,0,0,0.9) 100%); pointer-events: none;"></div>

          <div class="position-absolute top-0 end-0 z-3 m-3">
            <span class="badge text-white px-3 py-2 shadow" style="background-color: #e10600; font-size: 0.85rem; letter-spacing: 1.5px; border-radius: 6px;">NEXT</span>
          </div>

          <div class="position-absolute top-0 start-0 p-3 z-2 w-75">
            <div class="d-flex align-items-center gap-2 mb-1">
              ${flagImgHtml}
              <span class="text-white fw-bold small" style="letter-spacing: 1px; text-transform: uppercase;">ROUND ${roundNum}</span>
            </div>
            <h3 class="text-white fw-bold f1-font mb-0 mt-1" style="text-shadow: 0 2px 8px rgba(0,0,0,0.9); line-height: 1.1; letter-spacing: 0.5px;">${shortCountryName}</h3>
          </div>

          <div class="position-absolute bottom-0 start-0 p-3 z-2 w-100">
            <div class="text-white fw-bold f1-font" style="font-size: 1.1rem; letter-spacing: 1px; text-shadow: 0 2px 8px rgba(0,0,0,0.9);">
              ${dateDisplay}
            </div>
          </div>
          
        </div>
      `;
    } else {
      html += `
        <div class="card border-0 rounded-4 shadow-sm" ${clickAction} style="margin-bottom: 6px; cursor: pointer; background-color: #1a1d24;">
          <div class="card-body p-3">
            
            <div class="d-flex align-items-center mb-1">
              <span class="text-secondary fw-bold small me-2" style="font-size: 0.7rem; letter-spacing: 0.5px;">ROUND ${roundNum}</span>
            </div>
            <div class="d-flex align-items-center gap-2 mb-1">
              ${flagImgHtml}
              <h5 class="text-white fw-bold f1-font mb-0" style="font-size: 1.1rem; letter-spacing: 0.5px;">${shortCountryName}</h5>
            </div>

            <div class="text-secondary mb-3" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2;">
              ${officialName}
            </div>

            <div class="d-flex justify-content-between align-items-end mt-2">
              <div class="bg-white text-dark fw-bold px-2 py-1 rounded" style="font-size: 0.8rem; letter-spacing: 1px;">
                <i class="fa-solid fa-flag-checkered me-2 text-danger"></i>${dateDisplay}
              </div>
              
              ${cardTrackImgSrc ? `<img src="${cardTrackImgSrc}" alt="Layout" loading="lazy" style="height: 50px; width: auto; opacity: 0.95;">` : ''}
            </div>
            
          </div>
        </div>
      `;
    }
  });
  container.innerHTML = html;
}

async function openWeekendTimetable(raceId, countryName, officialName, flagCode, bgImgSrc, trackImgSrc, meetingKey) {
  triggerHaptic();
  currentViewingRaceId = raceId;

  // กำหนด UI พื้นฐาน
  document.getElementById('wtCountryName').innerText = countryName;
  document.getElementById('wtOfficialName').innerText = officialName;
  document.getElementById('wtFlagImg').src = `https://flagcdn.com/w40/${flagCode}.png`;
  document.getElementById('wtBgImg').src = bgImgSrc;
  document.getElementById('wtTrackImg').src = trackImgSrc || '';
  document.getElementById('wtTrackImg').style.display = trackImgSrc ? 'block' : 'none';

  // จัดการแสดงผลกรอบผังสนาม (ซ่อนทั้งกรอบ ถ้าไม่มีรูป)
  const trackContainer = document.getElementById('wtTrackContainer');
  if (trackContainer) {
    trackContainer.style.display = trackImgSrc ? 'block' : 'none';
  }

  const tlContainer = document.getElementById('wtTimelineContainer');
  tlContainer.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-danger fs-3 mb-2"></i><div class="small text-secondary">LOADING SESSIONS...</div></div>';

  if (!weekendTimetableModalInstance) {
    weekendTimetableModalInstance = new bootstrap.Modal(document.getElementById('weekendTimetableModal'));
  }
  weekendTimetableModalInstance.show();

  // ดึงข้อมูลตารางเวลาแต่ละ Session จาก API
  if (meetingKey) {
    try {
            const sessions = await fetchOpenF1Cached(`https://api.openf1.org/v1/sessions?meeting_key=${meetingKey}`, 300000);
      sessions.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

      let timelineHtml = '';
      const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      
      sessions.forEach(s => {
        const dt = new Date(s.date_start);
        const dayStr = `${days[dt.getDay()].substring(0,3)} ${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleString('en-US', {month: 'short'}).toUpperCase()}`;
        const timeStr = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
        
        let typeClass = '';
        if (s.session_name.toLowerCase().includes('race')) typeClass = 'tl-race';
        else if (s.session_name.toLowerCase().includes('qualifying')) typeClass = 'tl-quali';

        // 🎯 ตรวจสอบว่าเริ่มแข่งหรือยัง
        const now = new Date();
        const isStarted = dt <= now;
        
        // ถ้าเริ่มแล้วให้คลิกได้และมีลูกศร ถ้ายังไม่เริ่มไม่ต้องลดสี (opacity) และไม่ต้องแสดงไอคอนใดๆ
        const clickAttr = isStarted ? `onclick="toggleSessionResults('${s.session_key}', this)" style="cursor: pointer;"` : ``;
        const iconHtml = isStarted ? `<i class="fa-solid fa-chevron-down ms-2 text-info" style="font-size: 0.8rem;"></i>` : ``;

        timelineHtml += `
          <div class="tl-item ${typeClass}" ${clickAttr}>
            <div class="tl-day">${dayStr}</div>
            <div class="tl-content" style="width: 100%; display: flex; flex-direction: column; align-items: stretch;">
              <div class="d-flex justify-content-between align-items-center w-100">
                <div class="tl-session">${s.session_name.toUpperCase()} ${iconHtml}</div>
                <div class="tl-time"><i class="fa-regular fa-clock me-1"></i>${timeStr}</div>
              </div>
              
              <!-- 🎯 กล่องสำหรับกางผลซ้อม/ผลแข่ง (ซ่อนไว้เป็นค่าเริ่มต้น) -->
              <div class="session-results-container mt-3" style="display: none; width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-left: 0; box-sizing: border-box;"></div>
            </div>
          </div>
        `;
      });

      tlContainer.innerHTML = timelineHtml || '<div class="text-secondary small text-center py-3">ยังไม่มีกำหนดการเซสชัน</div>';
    } catch (e) {
      tlContainer.innerHTML = '<div class="text-danger small text-center py-3">ไม่สามารถดึงตารางเวลาได้</div>';
    }
  } else {
    tlContainer.innerHTML = '<div class="text-secondary small text-center py-3">ตารางเวลายังไม่ถูกประกาศ</div>';
  }
}

// ฟังก์ชันปุ่มลัด: ปิดตารางเวลา แล้วพาวาร์ปไปแท็บ Telemetry เพื่อดู Archive สนามนั้น
function jumpToArchiveFromSchedule() {
  triggerHaptic();
  weekendTimetableModalInstance.hide();
  
  // รอ Modal ปิดสนิทก่อนสลับแท็บ
  setTimeout(() => {
    // 1. สลับไปหน้า Telemetry
    const telemetryTabBtn = document.querySelectorAll('.f1-nav-link')[2]; 
    showTab('tab-center', telemetryTabBtn);
    
    // 2. ปรับค่า Dropdown ของ Archive ให้ตรงกับสนามที่กดมา
    const archiveSelect = document.getElementById('sel2025Race');
    if (archiveSelect && currentViewingRaceId) {
      archiveSelect.value = currentViewingRaceId;
      on2025RaceChange(); 
    }
    
    // 3. เลื่อนหน้าจอลงไปที่ส่วน Archive
    const archiveHeader = document.getElementById('content2025');
    if (archiveHeader) archiveHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });

  }, 300);
}
// ==========================================
// 📊 ฟังก์ชันกางตารางเวลา แล้วเรียกใช้ UI จากหน้า Results
// ==========================================
async function toggleSessionResults(sessionKey, element) {
  triggerHaptic();
  
  // ป้องกันการกางกล่องถ้าเซสชันยังไม่เริ่ม (ปุ่มไม่ active)
  if (element.style.opacity === '0.6') return;
  
  const resultContainer = element.querySelector('.session-results-container');
  const icon = element.querySelector('.tl-session i.fa-chevron-down, .tl-session i.fa-chevron-up');
  
  // 1. หุบกล่องกลับ
  if (resultContainer.style.display === 'block') {
    resultContainer.style.display = 'none';
    if (icon) { icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); }
    return;
  }

  // 2. กางกล่องออก
  resultContainer.style.display = 'block';
  if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); }
  
  // ถ้าเคยดึงข้อมูลแล้ว ไม่ต้องดึงซ้ำ (ลดภาระ API)
  if (resultContainer.innerHTML.trim() !== '') return;

  // 3. เรียกใช้ฟังก์ชันดึงผลและ UI จากหน้า Results
  if (typeof loadResultsSessionData === 'function') {
    // 🎯 ส่งค่า true ในพารามิเตอร์ที่ 4 (disableHeroClick) เพื่อปิดการกดเปิดหน้า Driver Hero ในปฏิทิน
    loadResultsSessionData(sessionKey, null, resultContainer, true);
  } else {
    resultContainer.innerHTML = '<div class="text-center text-danger small py-3">ระบบเชื่อมต่อผลการแข่งขันไม่พร้อมใช้งาน</div>';
  }
}
