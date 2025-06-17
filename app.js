/***** CONFIG *****/
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby3V7ojn7qWvxUds2r4f5mxb96mi3_9nUhp1u5lrOKhYuNlTMcrjKJo7kUbhcwxP--87Q/exec';
const SEND_EVERY = 15_000;                                // 15 giây
const CLIENT_ID  =
  '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';
/******************/

/* ===== helper sớm để tránh hoisting ===== */
function byId(id){ return document.getElementById(id); }

/* ---------- Biến trạng thái ---------- */
let me = {};               // thông tin nhân viên
let shiftActive = false;
let watchID     = null;
let refreshTimer= null;
let map;

/* ---------- KHỞI TẠO GOOGLE SIGN-IN ---------- */
window.addEventListener('DOMContentLoaded', () => {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback : onGoogleSignIn
  });

  google.accounts.id.renderButton(
    byId('gSignIn'),
    { theme:'outline', size:'large', width:260 }
  );
});
/* --------------------------------------------- */

/* ---------- CALLBACK đăng nhập ---------- */
async function onGoogleSignIn({ credential }){
  try{
    const email = JSON.parse(atob(credential.split('.')[1])).email;
    const rs    = await api('login', { email });

    if(rs.status!=='ok'){
      alert('Bạn không thuộc ca trực');            // email không có trong sheet
      google.accounts.id.disableAutoSelect();
      return;
    }

    me = rs;                                       // {name, unit, email,…}
    byId('loginSec').hidden  = true;
    byId('app').hidden       = false;
    byId('welcome').textContent = `Xin chào ${rs.name} (${rs.unit})`;

    restoreShift();   // tự khôi phục ca nếu đang chạy dở
    initMap();
  }catch(e){
    logErr(e);
    alert('Đăng nhập thất bại, thử lại sau!');
  }
}

/* ---------- Các nút ---------- */
byId('btnStart').onclick  = startShift;
byId('btnEnd').onclick    = endShift;
byId('btnInfo').onclick   = () => alert(JSON.stringify(me,null,2));
byId('btnLogout').onclick = () => location.reload();

/* ---------- Logic ca trực ---------- */
function restoreShift(){
  if(localStorage.getItem('shiftActive')==='1'){
    shiftActive = true;
    uiShift();
    beginGeo();
  }
}

async function startShift(){
  const rs = await api('startShift', { email:me.email });
  if(rs.status==='ok'){
    shiftActive = true;
    uiShift();
    beginGeo();
  }else alert('Không thể bắt đầu ca!');
}

async function endShift(){
  const rs = await api('endShift', { email:me.email });
  if(rs.status==='ok'){
    shiftActive = false;
    uiShift();
    stopGeo();
  }else alert('Không thể kết thúc ca!');
}

function uiShift(){
  byId('btnStart').hidden =  shiftActive;
  byId('btnEnd').hidden   = !shiftActive;
  byId('map').style.display = shiftActive ? 'block':'none';
  localStorage.setItem('shiftActive', shiftActive?'1':'0');
}

/* ---------- Bản đồ & GPS ---------- */
function initMap(){
  map = L.map('map').setView([16,106],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution:'© OpenStreetMap' }).addTo(map);
}

function beginGeo(){
  if(!navigator.geolocation){
    alert('Trình duyệt không hỗ trợ GPS'); return;
  }
  watchID = navigator.geolocation.watchPosition(
    sendPos,
    err=>logErr(err.message),
    { enableHighAccuracy:true, maximumAge:0, timeout:10_000 }
  );
  refreshTimer = setInterval(loadPositions, SEND_EVERY);
  loadPositions();
}

function stopGeo(){
  navigator.geolocation.clearWatch(watchID);
  clearInterval(refreshTimer);
}

async function sendPos(pos){
  const { latitude:lat, longitude:lng } = pos.coords;
  await api('log',{
    email:me.email, lat, lng, time:new Date().toISOString()
  });
}

async function loadPositions(){
  const rs = await api('getPositions', {});
  if(rs.status!=='ok') return;

  // xoá marker cũ
  map.eachLayer(l=>{
    if(l.options && l.options.pane==='markerPane') map.removeLayer(l);
  });

  const bounds = [];
  rs.positions.forEach(p=>{
    L.marker([p.lat,p.lng])
      .addTo(map)
      .bindTooltip(`${p.name}<br>${p.unit}<br>${timeAgo(p.time)}`);
    bounds.push([p.lat,p.lng]);
  });
  if(bounds.length) map.fitBounds(bounds,{padding:[16,16]});
}

function timeAgo(t){
  const d = (Date.now()-new Date(t).getTime())/1000;
  if(d<60)   return `${d.toFixed(0)} s trước`;
  if(d<3600) return `${(d/60).toFixed(0)} m trước`;
  return `${(d/3600).toFixed(1)} h trước`;
}

/* ---------- Helper gọi Apps Script ---------- */
async function api(action, payload={}){
  const url = SCRIPT_URL + '?' + new URLSearchParams({ ...payload, action });
  const r   = await fetch(url, { redirect:'follow', cache:'no-store' });
  if(!r.ok) throw new Error(`${action} → ${r.status}`);

  let txt = await r.text();

  /* Cắt mọi ký tự trước dấu { hoặc [ (Google thêm tiền tố chống-XSSI) */
  const iBrace   = txt.indexOf('{');
  const iBracket = txt.indexOf('[');
  const pos = (iBrace>=0 && iBracket>=0) ? Math.min(iBrace,iBracket)
           : (iBrace>=0 ? iBrace : iBracket);
  if(pos>0) txt = txt.slice(pos);

  return JSON.parse(txt);
}

function logErr(msg){
  const sep = SCRIPT_URL.includes('?') ? '&':'?';
  fetch(`${SCRIPT_URL}${sep}action=error&email=${encodeURIComponent(me.email||'')}`
        +`&message=${encodeURIComponent(msg)}`).catch(()=>{});
}
