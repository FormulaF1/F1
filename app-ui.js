// =========================================================
// 3. APPLICATION UI & LOGIC (HYBRID SHOWCASE EDITION v2.2)
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
let weekendTimetableModalInstance = null;

let currentSelectingSlot = null;
let currentHeroDriver = null;
let isHeroInPredictMode = false;

let countdownInterval = null;
let currentDeadline = null;
let globalLeaderboard = [];
let globalPlayers = [];
let globalRaces = [];
let lastPendingList = [];

let currentCenterMedia = null;
let currentArchiveMedia = null;

let isRefreshing = false;
let currentArchiveMode = 'quali2025';
let currentViewingRaceId = null;

let playerChartInstance = null;
let communityChartInstance = null;
let heroRadarChartInstance = null;
let radioChatHistory = [];

let DRIVER_STATS = {
  "default": [80, 80, 80, 80, 80, 80]
};

// =========================================================
// TOAST, HAPTICS & UTILITIES
// =========================================================
function showToast(msg, type) {
  if (!type) type = 'success';
  const c = document.getElementById('f1ToastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'f1-toast ' + type;
  t.innerHTML = (type === 'success' ? '✅' : '⚠️') + ' <span>' + msg + '</span>';
  c.appendChild(t);
  setTimeout(function () { t.remove(); }, 4500);
}

function triggerHaptic(ms) {
  if (!ms) ms = 35;
  if (navigator.vibrate) navigator.vibrate(ms);
}

function getDriveDirectLink(url) {
  if (!url) return "";
  const match = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(url).match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return 'https://lh3.googleusercontent.com/d/' + match[1];
  }
  return url;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function syncOneSignalPlayer(playerName) {
  if (!playerName || !window.OneSignalDeferred) return;
  window.OneSignalDeferred.push(function (OneSignal) {
    try { OneSignal.login(playerName); } catch (e) {}
  });
}

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

// =========================================================
// INITIALIZATION
// =========================================================
window.addEventListener('DOMContentLoaded', function () {
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
      setTimeout(updateRadioButtonVisibility, 180);
    });
  }

  const heroModalEl = document.getElementById('driverHeroModal');
  if (heroModalEl) {
    window.driverHeroModalInstance = new bootstrap.Modal(heroModalEl);

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
      setTimeout(updateRadioButtonVisibility, 180);
    });
  }

  const imgPreviewEl = document.getElementById('imagePreviewModal');
  if (imgPreviewEl) {
    imgPreviewEl.addEventListener('hidden.bs.modal', function () {
      document.getElementById('previewImageSrc').src = '';
    });
  }

  const wtModalEl = document.getElementById('weekendTimetableModal');
  if (wtModalEl) {
    weekendTimetableModalInstance = new bootstrap.Modal(wtModalEl);
    wtModalEl.addEventListener('show.bs.modal', function () {
      const nav = document.querySelector('.f1-nav-tabs');
      if (nav) nav.style.setProperty('z-index', '1060', 'important');
    });
    wtModalEl.addEventListener('hidden.bs.modal', function () {
      const nav = document.querySelector('.f1-nav-tabs');
      if (nav) nav.style.setProperty('z-index', '1050', 'important');
    });
  }

  const optHtml = '<option value="" disabled selected>-- เลือกนักแข่ง --</option>' +
    DRIVERS.map(function (d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
  document.querySelectorAll('.driver-opt').forEach(function (el) { el.innerHTML = optHtml; });

  initHeroHybridShowcaseUI();
  buildDriverGrid();
  initOfficialStandingsDOM();
  loadData();
  fetchF1Standings();
  fetchF1TeamStandings();
  loadOpenF1Meetings();
  loadLatestNews();
  loadDriverStatsAPI();
  updateRadioButtonVisibility();

  window.addEventListener('offline', function () { showToast('สัญญาณสื่อสารขาดหาย (OFFLINE)', 'error'); });
  window.addEventListener('online', function () { showToast('เชื่อมต่อสัญญาณอีกครั้ง (ONLINE)', 'success'); });
});

// =========================================================
// HYBRID SHOWCASE ENGINE (ZERO-LAG + MULTI-SLOT + SWIPE COMPARE)
// =========================================================
function initHeroHybridShowcaseUI() {
  const heroModalEl = document.getElementById('driverHeroModal');
  if (!heroModalEl) return;

  if (!document.getElementById('hybridShowcaseInlineStyles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'hybridShowcaseInlineStyles';
    styleEl.textContent = [
      '.hero-nav-arrow { position: absolute; top: 42%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(13, 16, 26, 0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.18); color: #ffffff; display: flex; align-items: center; justify-content: center; z-index: 15; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.45); }',
      '.hero-nav-arrow:active { transform: translateY(-50%) scale(0.9); background: #e10600; border-color: #e10600; }',
      '.hero-nav-prev { left: 12px; }',
      '.hero-nav-next { right: 12px; }',
      '.hero-multi-slot-wrap { background: rgba(10, 14, 24, 0.82); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px; margin-bottom: 10px; }',
      '.hero-multi-slot-lbl { font-family: "Rajdhani", "Kanit", sans-serif; font-size: 0.72rem; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; }',
      '.hero-slot-pills { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }',
      '.hero-slot-pills.sprint-mode { grid-template-columns: repeat(4, 1fr); }',
      '.hero-slot-pill-btn { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); color: #cbd5e1; border-radius: 8px; padding: 7px 2px; font-family: "Rajdhani", sans-serif; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.5px; transition: all 0.18s ease; display: flex; flex-direction: column; align-items: center; line-height: 1.1; }',
      '.hero-slot-pill-btn .sub-owner { font-family: "Kanit", sans-serif; font-size: 0.58rem; font-weight: 400; color: #64748b; margin-top: 2px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 3px; }',
      '.hero-slot-pill-btn.active-assigned { background: linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(5, 150, 105, 0.18)); border-color: #10b981; color: #ffffff; box-shadow: 0 0 12px rgba(16, 185, 129, 0.35); }',
      '.hero-slot-pill-btn.active-assigned .sub-owner { color: #6ee7b7; font-weight: 600; }',
      '.hero-slot-pill-btn.active-fl { background: linear-gradient(135deg, rgba(168, 85, 247, 0.32), rgba(126, 34, 206, 0.2)); border-color: #a855f7; color: #ffffff; box-shadow: 0 0 12px rgba(168, 85, 247, 0.35); }',
      '.hero-slot-pill-btn.active-fl .sub-owner { color: #d8b4fe; font-weight: 600; }',
      '.hero-slot-pill-btn.target-focus:not(.active-assigned):not(.active-fl) { border-color: #f59e0b; box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.4); }',
      '.hero-driver-switch-anim { animation: heroFadeSlide 0.22s cubic-bezier(0.22, 1, 0.36, 1); }',
      '@keyframes heroFadeSlide { from { opacity: 0.35; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }'
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  const modalBody = heroModalEl.querySelector('.modal-body');
  if (modalBody && !document.getElementById('btnHeroPrevDriver')) {
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.id = 'btnHeroPrevDriver';
    prevBtn.className = 'hero-nav-arrow hero-nav-prev';
    prevBtn.title = 'นักแข่งคนก่อนหน้า';
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.onclick = function (e) { e.stopPropagation(); navigateHeroDriver(-1); };

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.id = 'btnHeroNextDriver';
    nextBtn.className = 'hero-nav-arrow hero-nav-next';
    nextBtn.title = 'นักแข่งคนถัดไป';
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.onclick = function (e) { e.stopPropagation(); navigateHeroDriver(1); };

    modalBody.appendChild(prevBtn);
    modalBody.appendChild(nextBtn);

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

  const predictSectionEl = document.getElementById('heroPredictSection');
  const confirmBtn = document.getElementById('btnConfirmHeroPick');
  if (predictSectionEl && confirmBtn && !document.getElementById('heroMultiSlotBar')) {
    const multiBar = document.createElement('div');
    multiBar.id = 'heroMultiSlotBar';
    multiBar.className = 'hero-multi-slot-wrap';
    multiBar.innerHTML =
      '<div class="hero-multi-slot-lbl">' +
        '<span><i class="fa-solid fa-layer-group text-warning me-1"></i>QUICK ASSIGN (แตะดักได้หลายอันดับ)</span>' +
        '<span class="text-info" style="font-size:0.68rem;"><i class="fa-solid fa-arrows-left-right me-1"></i>ปัดเทียบได้</span>' +
      '</div>' +
      '<div class="hero-slot-pills" id="heroSlotPillsContainer"></div>';
    confirmBtn.parentElement.insertBefore(multiBar, confirmBtn);
  }

  document.addEventListener('keydown', function (e) {
    if (!heroModalEl.classList.contains('show')) return;
    if (e.key === 'ArrowLeft') navigateHeroDriver(-1);
    else if (e.key === 'ArrowRight') navigateHeroDriver(1);
  });
}

function navigateHeroDriver(direction) {
  if (!currentHeroDriver || !Array.isArray(DRIVERS) || DRIVERS.length === 0) return;
  triggerHaptic(25);

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

  const currentIdx = orderedList.indexOf(currentHeroDriver);
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
    openDriverHeroByName(nextDriverName, true, null);
  }
}

function renderHeroMultiSlotBar(driverName) {
  const container = document.getElementById('heroSlotPillsContainer');
  if (!container) return;

  const flWrapper = document.getElementById('flWrapper');
  const isSprint = flWrapper && flWrapper.style.display === 'none';
  container.className = isSprint ? 'hero-slot-pills sprint-mode' : 'hero-slot-pills';

  const slots = [
    { id: 'pos1', label: 'P1' },
    { id: 'pos2', label: 'P2' },
    { id: 'pos3', label: 'P3' },
    { id: 'pos4', label: 'P4' }
  ];
  if (!isSprint) {
    slots.push({ id: 'posFL', label: '⚡FL' });
  }

  container.innerHTML = slots.map(function (s) {
    const selEl = document.getElementById(s.id);
    const assignedVal = selEl ? selEl.value : '';
    const isThisDriver = assignedVal === driverName;
    const isTargetSlot = currentSelectingSlot === s.id;

    let activeClass = '';
    if (isThisDriver) {
      activeClass = (s.id === 'posFL') ? 'active-fl' : 'active-assigned';
    } else if (isTargetSlot) {
      activeClass = 'target-focus';
    }

    const ownerShort = isThisDriver ? '✓ เลือกแล้ว' : (assignedVal ? getShortDriverName(assignedVal) : 'ว่าง');
    const safeDriver = driverName.replace(/'/g, "\\'");

    return '<button type="button" class="hero-slot-pill-btn ' + activeClass + '" onclick="toggleHeroSlotAssignment(\'' + s.id + '\', \'' + safeDriver + '\')">' +
      '<span>' + s.label + '</span>' +
      '<span class="sub-owner">' + escapeHtml(ownerShort) + '</span>' +
      '</button>';
  }).join('');

  updateHeroPrimaryButtonLabel(driverName);
}

function toggleHeroSlotAssignment(slotId, driverName) {
  triggerHaptic(35);
  const selectEl = document.getElementById(slotId);
  if (!selectEl) return;

  if (selectEl.value === driverName) {
    selectEl.value = '';
    updateCardUI(slotId, '');
  } else {
    selectEl.value = driverName;
    updateCardUI(slotId, driverName);
  }

  refreshDriverGridBadges();
  renderHeroMultiSlotBar(driverName);
}

function updateHeroPrimaryButtonLabel(driverName) {
  const btn = document.getElementById('btnConfirmHeroPick');
  if (!btn || !currentSelectingSlot) return;

  const slotLabels = { 'pos1': 'P1', 'pos2': 'P2', 'pos3': 'P3', 'pos4': 'P4', 'posFL': 'FASTEST LAP' };
  const targetSel = document.getElementById(currentSelectingSlot);
  const alreadyInTarget = targetSel && targetSel.value === driverName;

  const flWrapper = document.getElementById('flWrapper');
  const isSprint = flWrapper && flWrapper.style.display === 'none';
  const activeSlots = isSprint ? ['pos1', 'pos2', 'pos3', 'pos4'] : ['pos1', 'pos2', 'pos3', 'pos4', 'posFL'];
  const emptyCount = activeSlots.filter(function (id) {
    const el = document.getElementById(id);
    return !el || !el.value;
  }).length;

  if (alreadyInTarget && emptyCount === 0) {
    btn.innerHTML = '<i class="fa-solid fa-flag-checkered me-2"></i>ยืนยันโพยครบทุกช่อง (DONE)';
  } else if (alreadyInTarget) {
    btn.innerHTML = '<i class="fa-solid fa-forward-step me-2"></i>ไปเลือกช่องถัดไป (NEXT SLOT)';
  } else {
    const lbl = slotLabels[currentSelectingSlot] || '';
    btn.innerHTML = '<i class="fa-solid fa-check-circle me-2"></i>SELECT FOR <span id="lblHeroSlot">' + lbl + '</span>';
  }
}

// =========================================================
// DRIVER SELECTOR GRID & PREDICTION CARDS
// =========================================================
function buildDriverGrid() {
  const container = document.getElementById('driverGridContainer');
  if (!container) return;
  let html = '';
  DRIVERS.forEach(function (name) {
    const info = DRIVER_INFO[name] || { team: "F1", color: "#888888", img: DEFAULT_DRIVER_IMG };
    const safeName = name.replace(/'/g, "\\'");
    const logoUrl = TEAM_LOGOS[info.team] ? getDriveDirectLink(TEAM_LOGOS[info.team]) : '';
    const logoHtml = logoUrl ? '<img src="' + logoUrl + '" class="driver-pick-team-logo" alt="">' : '';

    html += '<div class="driver-pick-btn" data-drivername="' + name.replace(/"/g, '&quot;') + '" style="--team-color: ' + info.color + '" onclick="previewDriverBeforeSelect(\'' + safeName + '\', false)">' +
      '<div class="driver-pick-badges"></div>' +
      '<div class="driver-pick-name">' + name + '</div>' +
      '<div class="driver-pick-team">' + info.team + logoHtml + '</div>' +
      '<img src="' + getDriveDirectLink(info.img) + '" class="driver-pick-img" alt="' + name + '" loading="lazy">' +
      '</div>';
  });
  container.innerHTML = html;
}

function refreshDriverGridBadges() {
  document.querySelectorAll('.driver-pick-btn').forEach(function (btn) {
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

  Object.keys(currentPicks).forEach(function (pos) {
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
  if (radioBtn) radioBtn.style.setProperty('display', 'none', 'important');

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
    const driverModalEl = document.getElementById('driverSelectorModal');
    if (driverSelectorModalInstance && driverModalEl && !driverModalEl.classList.contains('show')) {
      driverSelectorModalInstance.show();
    }
  } else {
    if (driverSelectorModalInstance) {
      driverSelectorModalInstance.hide();
    }
    setTimeout(updateRadioButtonVisibility, 220);
  }
}

function updateCardUI(slotId, driverName) {
  const card = document.getElementById('card-' + slotId);
  if (!card) return;
  const emptyState = card.querySelector('.slot-empty-state');
  const filledState = card.querySelector('.slot-filled-state');

  if (!driverName) {
    card.classList.remove('filled');
    card.style.removeProperty('--team-color');
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

// =========================================================
// DRIVER FORM RADAR & HERO MODAL CONTROLLERS
// =========================================================
async function loadDriverStatsAPI() {
  try {
    const baseUrl = (typeof GAS_API_URL !== 'undefined') ? GAS_API_URL : '';
    if (!baseUrl) return;
    const response = await fetch(baseUrl + '?action=getStats');
    const result = await response.json();

    if (result.status === "success" && result.data) {
      DRIVER_STATS = Object.assign({}, DRIVER_STATS, result.data);
    }
  } catch (error) {
    console.error("Failed to fetch driver stats:", error);
  }
}

function renderDriverRadar(fullName, teamColor) {
  const canvasEl = document.getElementById('driverRadarChart');
  if (!canvasEl) return;

  const statsData = DRIVER_STATS[fullName] || DRIVER_STATS["default"];
  const colorCode = teamColor || "#0dcaf0";

  if (heroRadarChartInstance && heroRadarChartInstance.canvas === canvasEl) {
    const ds = heroRadarChartInstance.data.datasets[0];
    ds.label = fullName;
    ds.data = statsData;
    ds.backgroundColor = colorCode + '40';
    ds.borderColor = colorCode;
    ds.pointBorderColor = colorCode;
    ds.pointHoverBackgroundColor = colorCode;
    heroRadarChartInstance.options.plugins.tooltip.bodyColor = colorCode;
    heroRadarChartInstance.options.plugins.tooltip.borderColor = colorCode;
    heroRadarChartInstance.update();
    return;
  }

  if (heroRadarChartInstance) {
    heroRadarChartInstance.destroy();
  }

  const ctx = canvasEl.getContext('2d');
  heroRadarChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Quali', 'Racecraft', 'Tyre Mgmt', 'Consistency', 'Wet', 'Form'],
      datasets: [{
        label: fullName,
        data: statsData,
        backgroundColor: colorCode + '40',
        borderColor: colorCode,
        pointBackgroundColor: '#000',
        pointBorderColor: colorCode,
        pointHoverBackgroundColor: colorCode,
        pointHoverBorderColor: '#fff',
        borderWidth: 2,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      scales: {
        r: {
          angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          pointLabels: { color: '#94a3b8', font: { family: 'Rajdhani', size: 11, weight: 'bold' } },
          ticks: { display: false, min: 50, max: 100 }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 12, 16, 0.95)',
          titleColor: '#fff',
          bodyColor: colorCode,
          titleFont: { family: 'Rajdhani', size: 14, weight: 'bold' },
          bodyFont: { family: 'Rajdhani', size: 13, weight: 'bold' },
          borderColor: colorCode,
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label: function (context) { return context.raw + ' / 100'; }
          }
        }
      }
    }
  });
}

function getDriverStandingFromDOM(fullName) {
  let currentPts = "0";
  let currentPos = "-";
  const standingRows = document.querySelectorAll('#driverStandingsList .f1-standings-row');
  standingRows.forEach(function (row) {
    const onclickAttr = row.getAttribute('onclick') || '';
    const lastName = fullName.split(' ').slice(1).join(' ');
    if (onclickAttr.includes(fullName) || (lastName && row.innerText.includes(lastName))) {
      const ptsEl = row.querySelector('.col-pts');
      const posEl = row.querySelector('.col-pos');
      if (ptsEl) currentPts = ptsEl.innerText.trim();
      if (posEl) currentPos = posEl.innerText.trim();
    }
  });
  return { pts: currentPts, pos: currentPos };
}

function previewDriverBeforeSelect(fullName, isSwiping) {
  if (!isSwiping) triggerHaptic();
  const info = DRIVER_INFO[fullName];
  if (!info) return;

  currentHeroDriver = fullName;
  isHeroInPredictMode = true;

  const radioBtn = document.getElementById('btnTeamRadio');
  if (radioBtn) radioBtn.style.setProperty('display', 'none', 'important');

  const standing = getDriverStandingFromDOM(fullName);
  const parts = fullName.split(' ');
  document.getElementById('heroDriverFirstName').innerText = parts[0];
  document.getElementById('heroDriverLastName').innerText = parts.slice(1).join(' ');
  document.getElementById('heroTeamName').innerText = info.team;
  document.getElementById('heroTeamLogo').src = getDriveDirectLink(TEAM_LOGOS[info.team] || '');
  document.getElementById('heroDriverImg').src = getDriveDirectLink(info.heroImg || info.img);
  document.getElementById('heroBgColor').style.background = 'linear-gradient(to bottom, #0a0e1c 0%, ' + info.color + '40 15%, #0a0e1c 65%)';

  const heroPtsEl = document.getElementById('heroPoints');
  const heroPosEl = document.getElementById('heroPos');
  if (heroPosEl) heroPosEl.innerText = 'P' + standing.pos;

  const standardStatsEl = document.getElementById('heroStandardStats');
  const predictSectionEl = document.getElementById('heroPredictSection');

  if (standardStatsEl) {
    standardStatsEl.style.display = 'flex';
    standardStatsEl.style.marginTop = "35px";
    standardStatsEl.style.flexDirection = "column";
    standardStatsEl.style.alignItems = "flex-start";
    standardStatsEl.style.gap = "12px";

    if (heroPtsEl && heroPtsEl.parentElement) {
      heroPtsEl.parentElement.style.fontSize = "clamp(3.2rem, 13vw, 4.4rem)";
      heroPtsEl.parentElement.style.lineHeight = "0.9";
      heroPtsEl.parentElement.style.textAlign = "left";
    }
    if (heroPosEl) {
      heroPosEl.style.fontSize = "clamp(3.2rem, 13vw, 4.4rem)";
      heroPosEl.style.lineHeight = "0.9";
      heroPosEl.style.textAlign = "left";
    }
  }

  if (predictSectionEl) predictSectionEl.style.display = 'block';

  renderDriverRadar(fullName, info.color);
  renderHeroMultiSlotBar(fullName);

  const btn = document.getElementById('btnConfirmHeroPick');
  if (btn && currentSelectingSlot) {
    btn.onclick = function () {
      const targetSel = document.getElementById(currentSelectingSlot);
      const alreadyAssignedInTarget = targetSel && targetSel.value === currentHeroDriver;

      confirmSelectDriver(currentHeroDriver, alreadyAssignedInTarget);

      const heroModalEl = document.getElementById('driverHeroModal');
      const heroInst = bootstrap.Modal.getInstance(heroModalEl) || window.driverHeroModalInstance;
      if (heroInst) heroInst.hide();
    };
  }

  const heroModalEl = document.getElementById('driverHeroModal');
  if (!window.driverHeroModalInstance) {
    window.driverHeroModalInstance = new bootstrap.Modal(heroModalEl);
  }
  if (!heroModalEl.classList.contains('show')) {
    if (heroPtsEl) heroPtsEl.innerText = "0";
    window.driverHeroModalInstance.show();
    setTimeout(function () {
      animateCountUp(heroPtsEl, standing.pts, 1100);
    }, 100);
  } else {
    animateCountUp(heroPtsEl, standing.pts, 550);
  }
}

function openDriverHero(fullName, rowEl) {
  triggerHaptic();
  openDriverHeroByName(fullName, false, rowEl);
}

function openDriverHeroByName(fullName, isSwiping, rowEl) {
  const info = DRIVER_INFO[fullName];
  if (!info) return;

  currentHeroDriver = fullName;
  isHeroInPredictMode = false;

  const radioBtn = document.getElementById('btnTeamRadio');
  if (radioBtn) radioBtn.style.setProperty('display', 'none', 'important');

  let pts = "0";
  let pos = "-";
  if (rowEl) {
    const ptsNode = rowEl.querySelector('.col-pts');
    const posNode = rowEl.querySelector('.col-pos');
    pts = ptsNode ? ptsNode.innerText : "0";
    pos = posNode ? posNode.innerText : "-";
  } else {
    const st = getDriverStandingFromDOM(fullName);
    pts = st.pts;
    pos = st.pos;
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
    setTimeout(function () { animateCountUp(heroPtsEl, pts, 1400); }, 50);
  } else {
    animateCountUp(heroPtsEl, pts, 600);
  }
}

// =========================================================
// MODALS, AUTH & NAVIGATION
// =========================================================
function registerSecretClick() {
  triggerHaptic();
  secretClicks++;
  clearTimeout(clickTimer);
  if (secretClicks >= 5) {
    secretClicks = 0;
    openAdminModal();
  } else {
    clickTimer = setTimeout(function () { secretClicks = 0; }, 2000);
  }
}

function openAdminModal() { adminModalInstance.show(); }
function openRegisterModal() { regModalInstance.show(); }
function openLoginGateModal() { loginGateModalInstance.show(); }
function switchToRegisterFromLogin() { loginGateModalInstance.hide(); regModalInstance.show(); }

function previewTrackImageById(imgId) {
  triggerHaptic();
  const el = document.getElementById(imgId);
  if (!el || !el.src) return;
  document.getElementById('previewImageSrc').src = el.src;
  imagePreviewModalInstance.show();
}

function openMediaPreview(type) {
  triggerHaptic();
  if (!currentCenterMedia || !currentCenterMedia[type]) {
    showToast('ไม่มีรูปภาพในส่วนนี้', 'error');
    return;
  }
  document.getElementById('previewImageSrc').src = getDriveDirectLink(currentCenterMedia[type]);
  imagePreviewModalInstance.show();
}

function openMediaPreview2025(type) {
  triggerHaptic();
  if (!currentArchiveMedia || !currentArchiveMedia[type]) {
    showToast('ไม่มีรูปสถิติปีก่อนในโหมดนี้', 'error');
    return;
  }
  document.getElementById('previewImageSrc').src = getDriveDirectLink(currentArchiveMedia[type]);
  imagePreviewModalInstance.show();
}

function confirmLoginGate() {
  triggerHaptic();
  const selected = document.getElementById('loginPlayerSelect').value;
  const pinEl = document.getElementById('loginPin');
  const pin = pinEl ? pinEl.value.trim() : "";

  if (!selected) { showToast('กรุณาเลือกชื่อก่อน', 'error'); return; }
  if (pinEl && (!pin || pin.length !== 4)) { showToast('กรุณากรอก PIN 4 หลัก', 'error'); return; }

  const btn = document.querySelector('#loginGateModal .btn-race');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>ตรวจสอบ...';

  callGAS("loginPlayer", { playerName: selected, pin: pin }).then(function (res) {
    btn.disabled = false;
    btn.innerHTML = oldText;
    if (res.success) {
      const canonicalName = res.playerName || selected;
      localStorage.setItem('f1_player_name', canonicalName);
      localStorage.setItem('f1_player_pin', pin);
      syncOneSignalPlayer(canonicalName);
      if (pinEl) pinEl.value = '';
      updateUserSessionUI();
      loginGateModalInstance.hide();
      onRaceChange();
      showToast('เข้าสู่ระบบสำเร็จ!', 'success');
    } else {
      showToast(res.msg, 'error');
    }
  }).catch(function (err) {
    btn.disabled = false;
    btn.innerHTML = oldText;
    showToast('Error: ' + err, 'error');
  });
}

function showTab(tabId, el) {
  triggerHaptic();

  const openModals = document.querySelectorAll('.modal.show');
  openModals.forEach(function (modalEl) {
    if (modalEl.id === 'loginGateModal' && !localStorage.getItem('f1_player_name')) return;
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
  });

  document.querySelectorAll('.tab-pane-custom').forEach(function (p) { p.style.display = 'none'; });
  document.querySelectorAll('.f1-nav-link').forEach(function (l) { l.classList.remove('active'); });
  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.style.display = 'block';
  if (el) el.classList.add('active');

  if (tabId !== 'tab-pred') {
    closeTeamRadio();
  }
  updateRadioButtonVisibility();

  if (tabId === 'tab-schedule') {
    setTimeout(function () {
      const scheduleContainer = document.getElementById(tabId);
      if (scheduleContainer) {
        const badges = Array.from(scheduleContainer.querySelectorAll('.badge'));
        const nextBadge = badges.find(function (b) { return b.textContent.trim() === 'NEXT'; });
        if (nextBadge) {
          const cardParent = nextBadge.closest('.card');
          if (cardParent) cardParent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 150);
  }
}

// =========================================================
// DATA LOADING & LEADERBOARD RENDERING
// =========================================================
function forceRefreshData() {
  if (isRefreshing) return;
  isRefreshing = true;
  triggerHaptic();

  const refreshBtns = document.querySelectorAll('.fa-rotate');
  refreshBtns.forEach(function (btn) { btn.classList.add('fa-spin'); });
  showToast('กำลังซิงค์ข้อมูลล่าสุด...', 'success');

  callGAS("getInitData").then(function (data) {
    isRefreshing = false;
    refreshBtns.forEach(function (btn) { btn.classList.remove('fa-spin'); });
    if (!data) return;

    localStorage.setItem('f1_cached_data', JSON.stringify(data));
    renderUI(data);
    showToast('อัปเดตข้อมูลเรียบร้อย!', 'success');
  }).catch(function (err) {
    isRefreshing = false;
    refreshBtns.forEach(function (btn) { btn.classList.remove('fa-spin'); });
    showToast('Error: ' + err, 'error');
  });
}

function renderUI(data) {
  globalLeaderboard = data.leaderboard || [];
  globalPlayers = data.players || [];
  globalRaces = data.races || [];

  const pGate = document.getElementById('loginPlayerSelect');
  if (pGate) {
    pGate.innerHTML = '<option value="" disabled selected>-- เลือกชื่อ --</option>' +
      globalPlayers.map(function (p) { return '<option value="' + escapeHtml(p) + '">' + escapeHtml(p) + '</option>'; }).join('');
  }

  const savedPlayer = localStorage.getItem('f1_player_name');
  const hasMatchingPlayer = savedPlayer && globalPlayers.some(function (p) { return p.toLowerCase() === savedPlayer.toLowerCase(); });
  if (!hasMatchingPlayer) {
    const loginEl = document.getElementById('loginGateModal');
    if (loginGateModalInstance && loginEl && !loginEl.classList.contains('show') && globalPlayers.length > 0) {
      loginGateModalInstance.show();
    }
  } else if (pGate) {
    const exactName = globalPlayers.find(function (p) { return p.toLowerCase() === savedPlayer.toLowerCase(); });
    pGate.value = exactName || savedPlayer;
  }
  updateUserSessionUI();

  const openRaces = globalRaces.filter(function (r) { return r.status === 'OPEN'; });
  const selRace = document.getElementById('selRace');

  if (selRace) {
    const currentSelected = selRace.value;
    selRace.innerHTML = '<option value="" disabled selected>-- เลือกสนาม --</option>' +
      openRaces.map(function (r) {
        return '<option value="' + r.id + '" data-type="' + r.type + '" data-dl="' + r.deadline + '">🟢 ' + escapeHtml(r.name) + '</option>';
      }).join('');

    if (currentSelected && openRaces.some(function (r) { return r.id === currentSelected; })) {
      selRace.value = currentSelected;
    } else if (!currentSelected && openRaces.length >= 1) {
      selRace.value = openRaces[0].id;
      setTimeout(onRaceChange, 80);
    }
  }

  const allRaceOpts = '<option value="" disabled selected>-- เลือกสนาม --</option>' +
    globalRaces.map(function (r) {
      const icon = r.status === 'OPEN' ? '🔴' : (r.status === 'CALCULATED' ? '🏁' : '⚡');
      return '<option value="' + r.id + '" data-type="' + r.type + '">' + icon + ' ' + escapeHtml(r.name) + '</option>';
    }).join('');

  ['selCommRace', 'adminRace', 'adRaceDead', 'adRaceCheck', 'adMediaRace', 'selCenterRace', 'sel2025Race'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) {
      const prevVal = el.value;
      el.innerHTML = allRaceOpts;
      if (prevVal && globalRaces.some(function (r) { return r.id === prevVal; })) el.value = prevVal;
    }
  });

  if (globalRaces.length > 0 && !document.getElementById('adMediaRace').value) {
    document.getElementById('adMediaRace').value = globalRaces[0].id;
    onAdminMediaRaceChange();
  }

  const defaultRefRace = openRaces.length > 0 ? openRaces[0].id : (globalRaces.length > 0 ? globalRaces[0].id : '');
  if (defaultRefRace) {
    const centerSel = document.getElementById('selCenterRace');
    const archSel = document.getElementById('sel2025Race');
    if (centerSel && !centerSel.value) { centerSel.value = defaultRefRace; onCenterRaceChange(); }
    if (archSel && !archSel.value) { archSel.value = defaultRefRace; on2025RaceChange(); }
  }

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
      const carImg = carUrl ? '<img src="' + getDriveDirectLink(carUrl) + '" alt="" loading="lazy">' : '';

      podiumHtml += '<div class="premium-card king" style="--team-color: ' + teamColor + '; --border-color: #ffb703;" onclick="showPlayerStats(decodeURIComponent(\'' + encodeURIComponent(String(top1[1])) + '\'))">' +
        '<div class="bg-glow"></div>' +
        '<img src="' + getDriveDirectLink(logoUrl) + '" class="watermark-logo" alt="">' +
        '<div class="card-header">' +
        '<div class="rank-badge rank-1"><i class="fa-solid fa-crown me-1"></i>1</div>' +
        '<div class="pts-display">' + top1[2] + ' <span class="pts-label">PTS</span></div>' +
        '</div>' +
        '<div class="car-showcase">' + carImg + '</div>' +
        '<div class="card-footer">' +
        '<div class="player-name">' + escapeHtml(top1[1]) + '</div>' +
        teamIcon +
        '</div>' +
        '</div>';
    }

    if (top2 || top3) {
      podiumHtml += '<div class="princes-row">';
      [top2, top3].forEach(function (p, idx) {
        if (!p) return;
        const rank = idx + 2;
        const team = p[4] || "F1";
        const teamColor = TEAM_COLORS[team] || "#555555";
        const logoUrl = TEAM_LOGOS[team] || "";
        const carUrl = TEAM_CARS[team] || "";
        const teamIcon = logoUrl ? '<img src="' + getDriveDirectLink(logoUrl) + '" class="team-logo-small" alt="">' : '';
        const carImg = carUrl ? '<img src="' + getDriveDirectLink(carUrl) + '" alt="" loading="lazy">' : '';
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
          '<div class="player-name">' + escapeHtml(p[1]) + '</div>' +
          teamIcon +
          '</div>' +
          '</div>';
      });
      podiumHtml += '</div>';
    }
    podiumHtml += '</div>';

    if (podiumContainer) podiumContainer.innerHTML = podiumHtml;

    if (lbContainer) {
      lbContainer.innerHTML = rest.map(function (row) {
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
          (carUrl ? '<img src="' + getDriveDirectLink(carUrl) + '" class="player-list-car-img" alt="Car" loading="lazy">' : '') +
          '<div class="player-list-content">' +
          '<div class="player-list-left">' +
          '<div class="player-list-rank">' + rank + '</div>' +
          '<div class="player-list-name">' + escapeHtml(name) + '</div>' +
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

  const calcRaces = globalRaces.filter(function (r) { return r.status === 'CALCULATED'; });
  const finishedSelect = document.getElementById('selFinishedRace');
  if (finishedSelect) {
    if (calcRaces.length === 0) {
      finishedSelect.innerHTML = '<option value="" disabled selected>-- ยังไม่มีสนามที่สรุปผล --</option>';
      finishedSelect.disabled = true;
    } else {
      finishedSelect.disabled = false;
      finishedSelect.innerHTML = '<option value="" disabled selected>-- เลือกสนาม --</option>' +
        calcRaces.map(function (r) { return '<option value="' + r.id + '">🏁 ' + escapeHtml(r.name) + '</option>'; }).join('');
    }
  }

  renderScheduleTab();
}

function loadData(ignoreCache) {
  if (!ignoreCache) {
    const cachedStr = localStorage.getItem('f1_cached_data');
    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr);
        renderUI(cachedData);
        document.getElementById('globalLoader').classList.add('hidden');
      } catch (e) {}
    } else {
      document.getElementById('globalLoader').classList.remove('hidden');
    }
  }

  callGAS("getInitData").then(function (data) {
    isRefreshing = false;
    if (!data) return;
    localStorage.setItem('f1_cached_data', JSON.stringify(data));
    renderUI(data);
    document.getElementById('globalLoader').classList.add('hidden');
  }).catch(function (err) {
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

  const match = globalLeaderboard.find(function (row) { return String(row[1]).toLowerCase() === player.toLowerCase(); });
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

// =========================================================
// RACE SELECTION, TELEMETRY & ARCHIVE
// =========================================================
function onRaceChange() {
  const rSel = document.getElementById('selRace');
  if (!rSel) return;
  const opt = rSel.options[rSel.selectedIndex];
  if (!opt || !opt.value) return;
  const raceId = opt.value;
  const isSprint = opt.dataset.type === 'Sprint';
  document.getElementById('flWrapper').style.display = isSprint ? 'none' : 'block';

  const rawDl = (opt.dataset.dl || "").trim();
  currentDeadline = parseThaiDeadline(rawDl);
  startCountdown();

  const raceObj = globalRaces.find(function (r) { return r.id === raceId; });
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

  ['pos1', 'pos2', 'pos3', 'pos4', 'posFL'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
    updateCardUI(id, '');
  });

  const player = localStorage.getItem('f1_player_name');
  const histAlert = document.getElementById('savedPredAlert');
  if (player) {
    callGAS("getUserSavedPrediction", { raceId: raceId, playerName: player }).then(function (res) {
      if (res.found) {
        histAlert.style.display = 'block';
        document.getElementById('savedPredTime').innerText = 'บันทึกเมื่อ: ' + res.submittedAt;
        document.getElementById('savedPredContent').innerHTML =
          '<strong>P1:</strong> ' + escapeHtml(res.p1) + ' | <strong>P2:</strong> ' + escapeHtml(res.p2) +
          '<br><strong>P3:</strong> ' + escapeHtml(res.p3) + ' | <strong>P4:</strong> ' + escapeHtml(res.p4) +
          (res.fl ? ' | <strong>FL:</strong> ' + escapeHtml(res.fl) : '');

        const savedVals = [res.p1, res.p2, res.p3, res.p4, res.fl];
        ['pos1', 'pos2', 'pos3', 'pos4', 'posFL'].forEach(function (id, i) {
          const val = savedVals[i] || '';
          const el = document.getElementById(id);
          if (el) el.value = val;
          updateCardUI(id, val);
        });
      } else {
        histAlert.style.display = 'none';
      }
    });
  } else {
    histAlert.style.display = 'none';
  }
}

function formatPirelliTires(tireStr) {
  if (!tireStr || tireStr.trim() === '-' || tireStr.trim() === '') return '-';

  const matches = tireStr.toUpperCase().match(/C\d/g);
  if (!matches || matches.length === 0) return escapeHtml(tireStr);

  const sorted = matches.slice().sort(function (a, b) {
    return parseInt(a.replace('C', ''), 10) - parseInt(b.replace('C', ''), 10);
  });

  let html = '<div class="pirelli-compounds-wrap">';
  sorted.forEach(function (comp, idx) {
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
  const currentRace = globalRaces.find(function (r) { return r.id === raceId; });
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
      oddsBtn.onclick = function () { showToast("ยังไม่มีลิงก์อัตราต่อรองสำหรับสนามนี้", "error"); };
    }
  }

  const info = currentRace.trackInfo || {};
  document.getElementById('rcTrackType').innerText = info.trackType || '-';
  document.getElementById('rcTires').innerHTML = formatPirelliTires(info.tires || '-');
  document.getElementById('rcSafetyCar').innerText = info.safetyCar || '-';
  document.getElementById('rcWeather').innerHTML = '<span class="weather-icon-animated">' + escapeHtml(info.weather || '-') + '</span>';
  document.getElementById('rcPrevWinners').innerText = info.prevWinners || '-';
  document.getElementById('rcKeyNote').innerText = info.keyNote || '-';
  fetchLiveWeather();

  const layoutWrapper = document.getElementById('rcTrackLayoutWrapper');
  const layoutImg = document.getElementById('rcTrackLayoutImg');
  if (layoutWrapper && layoutImg) {
    const fallbackMainId = raceId.replace(/-SPRINT$/i, "-MAIN");
    const trackLayoutSrc = (typeof MODAL_TRACK_IMAGES !== 'undefined' && (MODAL_TRACK_IMAGES[raceId] || MODAL_TRACK_IMAGES[fallbackMainId]))
      ? (MODAL_TRACK_IMAGES[raceId] || MODAL_TRACK_IMAGES[fallbackMainId])
      : ((m.trackLayoutImg && m.trackLayoutImg.trim() !== "") ?
