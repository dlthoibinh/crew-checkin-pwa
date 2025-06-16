/****************  CONFIG  ****************/
const CLIENT_ID    = '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbw5dqnvTfMuMPjIkdWapz7HC9k15NiKImjhkMtPa1NymMuvtZcsf9gkfZ4BWtG2q8KkcA/exec';
const SEND_EVERY   = 15_000;          // 15 giây gửi GPS
/******************************************/

let me = {};                  // thông tin nhân viên sau khi login
let shiftActive = false;      // trạng thái ca
let watchID = null;           // geolocation.watchPosition id
let refreshTimer = null;      // setInterval tải map
let map;                      // Leaflet map instance

/* ---------- KHỞI ĐỘNG ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initAuth();                 // gắn Google Identity
  hookButtons();              // gắn sự kiện nút
});

/* ---------- GOOGLE OAUTH ---------- */
function initAuth() {
  google.accounts.id.initialize({
    client_id : CLIENT_ID,
    callback  : handleCredential
  });

  google.accounts.id.renderButton(
    document.getElementById('googleBtn'),
    { theme: 'outline', size: 'large', locale: 'vi' }
  );
}

async function handleCredential({ credential }) {
  try {
    const payload = JSON.parse(atob(credential.split('.')[1])); // decode JWT
    const email = payload.email;
    const rs = await api('login', { email });

    if (rs.status !== 'ok') {
      alert('Bạn không thuộc ca trực!');
      return;
    }

    /* --- Đăng nhập thành công --- */
    me = rs;                              // rs trả về {status:'ok',email,name,unit,...}
    qs('.auth').hidden   = true;
    qs('#app').hidden    = false;
    qs('#welcome').textContent = `Xin chào ${rs.name} – ${rs.unit}`;

    restoreShift();
    initMap();
  } catch (err) {
    logErr(err);
    alert('Đăng nhập thất bại!');
  }
}

/* ---------- NÚT & GIAO DIỆN ---------- */
function hookButtons() {
  onClick('btnStart',  startShift);
  onClick('btnEnd',    endShift);
  onClick('btnInfo',   () => alert(JSON.stringify(me, null, 2)));
  onClick('btnLogout', () => location.reload());
}

function uiShift() {
  qs('#btnStart').hidden =  shiftActive;
  qs('#btnEnd').hidden   = !shiftActive;
  qs('#mapSec').hidden   = !shiftActive;
  localStorage.setItem('shiftActive', shiftActive ? '1' : '0');
}

/* ---------- XỬ LÝ CA TRỰC ---------- */
function restoreShift() {
  shiftActive = localStorage.getItem('shiftActive') === '1';
  uiShift();
  if (shiftActive) {
    beginGeo();
  }
}

async function startShift() {
  const rs = await api('startShift', { email: me.email });
  if (rs.status === 'ok') {
    shiftActive = true;
    uiShift();
    beginGeo();
  } else { alert('Không thể bắt đầu ca'); }
}

async function endShift() {
  const rs = await api('endShift', { email: me.email });
  if (rs.status === 'ok') {
    shiftActive = false;
    uiShift();
    stopGeo();
  } else { alert('Không thể kết thúc ca'); }
}

/* ---------- GEO + BẢN ĐỒ ---------- */
function initMap() {
  map = L.map('map').setView([16, 106], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

function beginGeo() {
  if (!navigator.geolocation) {
    alert('Trình duyệt không hỗ trợ GPS'); return;
  }
  watchID = navigator.geolocation.watchPosition(
    sendPos,
    err => logErr(err.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
  );
  /* tải map đầu & set refresh */
  loadPositions();
  refreshTimer = setInterval(loadPositions, 15_000);
}

function stopGeo() {
  navigator.geolocation.clearWatch(watchID);
  clearInterval(refreshTimer);
}

async function sendPos(pos) {
  const { latitude: lat, longitude: lng } = pos.coords;
  await api('log', { email: me.email, lat, lng, time: new Date().toISOString() });
}

async function loadPositions() {
  const rs = await api('getPositions', {});
  if (rs.status !== 'ok') return;

  /* xoá marker cũ */
  map.eachLayer(l => {
    if (l.options && l.options.pane === 'markerPane') map.removeLayer(l);
  });

  const pts = [];
  rs.positions.forEach(p => {
    L.marker([p.lat, p.lng]).addTo(map)
      .bindTooltip(`${p.name}<br>${p.unit}<br>${timeAgo(p.time)}`)
      .openTooltip();
    pts.push([p.lat, p.lng]);
  });
  if (pts.length) map.fitBounds(pts, { padding: [12, 12] });
}

function timeAgo(tISO) {
  const s = (Date.now() - new Date(tISO).getTime()) / 1000;
  if (s < 60)     return `${s.toFixed(0)}s trước`;
  if (s < 3600)   return `${(s/60).toFixed(0)}m trước`;
  return `${(s/3600).toFixed(1)}h trước`;
}

/* ---------- HELPER ---------- */
async function api(action, data = {}) {
  try {
    const qs = new URLSearchParams({ ...data, action });
    const res = await fetch(`${SCRIPT_URL}?${qs}`);
    return await res.json();
  } catch (e) {
    logErr(e);
    return { status: 'err', message: String(e) };
  }
}
function logErr(msg) {
  fetch(`${SCRIPT_URL}?action=error&email=${me.email || ''}&message=${encodeURIComponent(msg)}`);
}
function qs(sel) { return document.querySelector(sel); }
function onClick(id, fn) { document.getElementById(id).addEventListener('click', fn); }
