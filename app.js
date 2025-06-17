/******************************************************************
 *  Check-in Ca trực – Front-end PWA
 *  File: app.js  |  Cập nhật: 17-06-2025
 ******************************************************************/

/* ===== CONFIG ===== */
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby3V7ojn7qWvxUds2r4f5mxb96mi3_9nUhp1u5lrOKhYuNlTMcrjKJo7kUbhcwxP--87Q/exec';
const SEND_EVERY = 15_000;                 // 15 giây gửi GPS
const CLIENT_ID  =
  '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';

/* ===== Helpers ===== */
const $  = id => document.getElementById(id);
const qs = o  => new URLSearchParams(o).toString();

/** Giải mã JWT (base64-URL → JSON) */
function decodeJwt(t){
  const b = t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(decodeURIComponent(atob(b).split('')
           .map(c=>'%' + ('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
}

/* ===== State ===== */
let me = {};                 // thông tin nhân viên
let shiftActive = false;     // đang trong ca?
let watchID      = null;     // geolocation watcher
let pingTimer    = null;     // setInterval id
let map;                     // Leaflet map instance

/* ------------------------------------------------------------------
 * 1. Khởi tạo Google Identity Services (GIS)
 *    GIS (defer) luôn nạp trước file này → google.accounts sẵn sàng.
 * -----------------------------------------------------------------*/
window.addEventListener('DOMContentLoaded', initSignin);

function initSignin(){
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onGoogleSignIn });
  google.accounts.id.renderButton(
    $('gSignIn'),
    { theme: 'outline', size: 'large', width: 260 }
  );
}

/* ------------------------------------------------------------------
 * 2. Callback đăng nhập
 * -----------------------------------------------------------------*/
async function onGoogleSignIn({ credential }){
  try{
    const email = decodeJwt(credential).email;         // ✅ fix base64-URL
    const rs    = await api('login', { email });

    if(rs.status !== 'ok'){
      alert('Bạn không thuộc ca trực'); return;
    }

    me = rs;                                           // {name, unit, comp, …}
    $('loginSec').hidden = true;
    $('app').hidden      = false;
    $('welcome').textContent = `Xin chào ${me.name} (${me.unit})`;

    initMap();
    restoreShift();                                    // khôi phục nếu F5
  }catch(e){
    logErr(e); alert('Đăng nhập thất bại – thử lại!');
  }
}

/* ------------------------------------------------------------------
 * 3. Xử lý nút bấm
 * -----------------------------------------------------------------*/
$('btnStart').onclick  = startShift;
$('btnEnd').onclick    = endShift;
$('btnInfo').onclick   = () => alert(JSON.stringify(me, null, 2));
$('btnLogout').onclick = () => location.reload();

/* ------------------------------------------------------------------
 * 4. Logic Ca trực
 * -----------------------------------------------------------------*/
function restoreShift(){
  if(localStorage.getItem('shiftActive') === '1'){
    shiftActive = true; uiShift(); beginGPS();
  }
}

async function startShift(){
  try{
    const ca   = $('selCa').value || me.ca || '';
    const rs   = await api('startShift', { email: me.email, ca });

    if(rs.status === 'ok'){
      me.ca = ca; shiftActive = true; uiShift(); beginGPS();
    }else alert('Không thể bắt đầu ca!');
  }catch(e){ logErr(e); alert('Lỗi bắt đầu ca!'); }
}

async function endShift(){
  const rs = await api('endShift', { email: me.email });
  if(rs.status === 'ok'){ shiftActive = false; uiShift(); stopGPS(); }
  else alert('Không thể kết thúc ca!');
}

function uiShift(){
  $('btnStart').hidden =  shiftActive;
  $('btnEnd').hidden   = !shiftActive;
  $('map').style.display = shiftActive ? 'block' : 'none';
  localStorage.setItem('shiftActive', shiftActive ? '1' : '0');
}

/* ------------------------------------------------------------------
 * 5. Bản đồ & GPS
 * -----------------------------------------------------------------*/
function initMap(){
  map = L.map('map').setView([16,106], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap' }).addTo(map);
}

function beginGPS(){
  if(!navigator.geolocation){
    alert('Trình duyệt không hỗ trợ GPS'); return;
  }
  watchID = navigator.geolocation.watchPosition(
    pushPos,
    e => logErr(e.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
  );
  pingTimer = setInterval(loadLatest, SEND_EVERY);
  loadLatest();                                     // lần đầu
}

function stopGPS(){
  navigator.geolocation.clearWatch(watchID);
  clearInterval(pingTimer);
}

async function pushPos(pos){
  const { latitude: lat, longitude: lng } = pos.coords;
  await api('log', {
    email: me.email,
    lat, lng,
    time: new Date().toISOString()
  });
}

async function loadLatest(){
  const rs = await api('getPositions');
  if(rs.status !== 'ok') return;

  // xoá marker cũ
  map.eachLayer(l => {
    if(l.options && l.options.pane === 'markerPane') map.removeLayer(l);
  });

  const bounds = [];
  rs.positions.forEach(p => {
    L.marker([p.lat, p.lng]).addTo(map)
      .bindTooltip(`${p.name}<br>${p.unit}<br>${p.ca}<br>${ago(p.time)} trước`);
    bounds.push([p.lat, p.lng]);
  });
  if(bounds.length) map.fitBounds(bounds, { padding: [16,16] });
}

const ago = t => {
  const s = (Date.now() - new Date(t)) / 1000;
  if(s <   60) return s|0      + ' s';
  if(s < 3600) return (s/60)|0 + ' m';
  return (s/3600).toFixed(1)   + ' h';
};

/* ------------------------------------------------------------------
 * 6. Gọi Apps Script (XSSI-safe)
 * -----------------------------------------------------------------*/
async function api(action, payload = {}){
  const r = await fetch(`${SCRIPT_URL}?${qs({...payload, action})}`, { cache: 'no-store' });
  if(!r.ok) throw `${action} → ${r.status}`;

  let txt = await r.text();

  // cắt XSSI prefix
  const iBrace = txt.indexOf('{'), iBrack = txt.indexOf('[');
  const i = (iBrace > -1 && iBrack > -1) ? Math.min(iBrace, iBrack) : Math.max(iBrace, iBrack);
  if(i > 0) txt = txt.slice(i);

  return JSON.parse(txt);
}

/* ------------------------------------------------------------------
 * 7. Báo lỗi nhẹ tới GAS (không chặn luồng chính)
 * -----------------------------------------------------------------*/
const logErr = msg =>
  fetch(`${SCRIPT_URL}?action=error&email=${encodeURIComponent(me.email||'')}&message=${encodeURIComponent(msg)}`)
  .catch(()=>{});
