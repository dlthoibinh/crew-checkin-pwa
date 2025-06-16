/***** CONFIG *****/
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQtOhGWKhT6gEUAlBVfV9iKjqmtHXNaR_2XmkD1XSCOiuNbh6A5ulkq6PxUBWsZpbBgg/exec';
const SEND_EVERY = 15_000;  // 15 giây
const CLIENT_ID  = '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';
/******************/

let me = {},           // thông tin nhân viên
    shiftActive = false,
    watchID     = null,
    refreshTimer= null,
    map;

/* ---------- KHỞI TẠO GOOGLE SIGN-IN ---------- */
window.addEventListener('DOMContentLoaded', () => {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback : onGoogleSignIn
  });

  google.accounts.id.renderButton(
    document.getElementById('gSignIn'),
    { theme: 'outline', size: 'large', width: 260 }
  );

  // Tự ẩn app cho tới khi đăng nhập
  byId('app').hidden = true;
});
/* --------------------------------------------- */

/* ---------- CALLBACK đăng nhập ---------- */
async function onGoogleSignIn({ credential }) {
  try {
    const email = JSON.parse(atob(credential.split('.')[1])).email;
    const rs    = await api('login', { email });

    if (rs.status !== 'ok') {
      alert('Bạn không thuộc ca trực');
      google.accounts.id.disableAutoSelect();   // cho phép chọn email khác
      return;
    }

    me = rs;                             // {name, unit, email, ...}
    byId('loginSec').hidden = true;
    byId('app').hidden      = false;
    byId('welcome').textContent = `Xin chào ${rs.name} (${rs.unit})`;

    restoreShift();
    initMap();
  } catch (e) {
    logErr(e);
  }
}

/* ---------- Các nút ---------- */
byId('btnStart').onclick = startShift;
byId('btnEnd'  ).onclick = endShift;
byId('btnInfo' ).onclick = () => alert(JSON.stringify(me, null, 2));
byId('btnLogout').onclick= () => location.reload();

/* ---------- Logic ca trực ---------- */
function restoreShift() {
  if (localStorage.getItem('shiftActive') === '1') {
    shiftActive = true;
    uiShift();
    beginGeo();
  }
}

async function startShift() {
  const rs = await api('startShift', { email: me.email });
  if (rs.status === 'ok') {
    shiftActive = true;
    uiShift();
    beginGeo();
  }
}
async function endShift() {
  const rs = await api('endShift', { email: me.email });
  if (rs.status === 'ok') {
    shiftActive = false;
    uiShift();
    stopGeo();
  }
}
function uiShift() {
  byId('btnStart').hidden = shiftActive;
  byId('btnEnd'  ).hidden = !shiftActive;
  byId('mapSec'  ).hidden = !shiftActive;
  localStorage.setItem('shiftActive', shiftActive ? '1' : '0');
}

/* ---------- Bản đồ & GPS ---------- */
function initMap() {
  map = L.map('map').setView([16, 106], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

function beginGeo() {
  if (!navigator.geolocation) {
    alert('Trình duyệt không hỗ trợ GPS');
    return;
  }
  watchID = navigator.geolocation.watchPosition(
    sendPos,
    err => logErr(err.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
  );
  refreshTimer = setInterval(loadPositions, 15_000);
  loadPositions();
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

  // Xóa marker cũ
  map.eachLayer(l => {
    if (l.options && l.options.pane === 'markerPane') map.removeLayer(l);
  });

  const bounds = [];
  rs.positions.forEach(p => {
    const mk = L.marker([p.lat, p.lng]).addTo(map)
      .bindTooltip(`${p.name}<br>${p.unit}<br>${timeAgo(p.time)}`);
    bounds.push([p.lat, p.lng]);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [16, 16] });
}

function timeAgo(t) {
  const d = (Date.now() - new Date(t).getTime()) / 1000;
  if (d < 60)   return `${d.toFixed(0)} s`;
  if (d < 3600) return `${(d / 60).toFixed(0)} m`;
  return `${(d / 3600).toFixed(1)} h`;
}

/* ---------- Helper gọi Apps Script ---------- */
async function api(action, obj) {
  try {
    const q = new URLSearchParams({ ...obj, action });
    const r = await fetch(`${SCRIPT_URL}?${q}`);
    return await r.json();
  } catch (e) {
    logErr(e);
    return {};
  }
}
function logErr(msg) {
  fetch(`${SCRIPT_URL}?action=error&email=${me.email || ''}&message=${encodeURIComponent(msg)}`);
}
function byId(id) { return document.getElementById(id); }
