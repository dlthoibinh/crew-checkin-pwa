/***********************************************************************************************
 *  Front‑end PWA – Check‑in Ca trực (EVN)                                                      *
 *  - Đăng nhập bằng Google (GIS)
 *  - Khi email nằm trong sheet "nhanvien" → cho bắt đầu ca
 *  - Gửi GPS 15 s/lần vào sheet "log" (Apps Script backend)
 *  - Khôi phục ca nếu refresh / kill app
 *  - Toàn bộ lỗi → gọi action=error để ghi sheet "loi"
 *  - Dashboard (dashboard.html) cùng dùng api() JSONP nên không cần gì thêm
 **********************************************************************************************/

/* ============ CONFIG ============ */
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbykV_rM5_qD58eKqncGZam6UbEnadXWEoDVOzfQXyUtpfSp8LNXLy4c6TL0YEe4b_gBdQ/exec';
const SEND_EVERY = 15_000;                    // 15 s
const CLIENT_ID  =
  '280769604046-nq14unfhu36e1fc86vk6d3l9br5df2.apps.googleusercontent.com';

/* ============ DOM helper ============ */
const $  = id => document.getElementById(id);
const qs = o => new URLSearchParams(o).toString();

/* ============ State ============ */
let me={}, shiftActive=false, watchID=null, timer=null, map, markers=[];

/* ============ Google Identity ============ */
window.addEventListener('DOMContentLoaded', ()=>{
  google.accounts.id.initialize({ client_id:CLIENT_ID, callback:onGoogleSignIn });
  google.accounts.id.renderButton($('#gSignIn'),{theme:'outline',size:'large'});
});

async function onGoogleSignIn({credential}){
  try{
    /* 1. Giải mã JWT để lấy email */
    const payload = JSON.parse(atob(credential.split('.')[1]));
    const email   = payload.email.toLowerCase();
    window.lastJWTemail = email;

    /* 2. Gọi backend login */
    const rs = await api('login',{email});
    console.log('LOGIN RESPONSE',rs);

    if(rs.status!=='ok'){ alert('Bạn không thuộc ca trực'); return; }

    me = rs;               // comp, unit, id, name, ca, email …

    /* 3. Ẩn khối login, hiện app */
    $('#loginSec').hidden = true;
    $('#app').hidden      = false;
    $('#welcome').textContent = `Xin chào ${me.name} (${me.unit})`;

    restoreShift();        // nếu ca đang chạy dở
    initMap();
  }catch(err){
    logErr(err);
    alert('Đăng nhập lỗi');
  }
}

/* ============ Buttons ============ */
$('#btnStart').onclick  = startShift;
$('#btnEnd').onclick    = endShift;
$('#btnInfo').onclick   = ()=>alert(JSON.stringify(me,null,2));
$('#btnLogout').onclick = ()=>location.reload();

/* ============ Ca trực ============ */
function restoreShift(){
  if(localStorage.getItem('shiftActive')==='1'){
    shiftActive = true;
    uiShift();
    beginGPS();
  }
}

async function startShift(){
  try{
    const ca = $('#selCa').value;
    const rs = await api('startShift',{email:me.email, ca});
    if(rs.status==='ok'){
      shiftActive=true; uiShift(); beginGPS();
    }else alert('Không thể bắt đầu ca');
  }catch(e){ logErr(e); alert('Lỗi!'); }
}
async function endShift(){
  try{
    const rs = await api('endShift',{email:me.email});
    if(rs.status==='ok'){
      shiftActive=false; uiShift(); stopGPS();
    }else alert('Không thể kết thúc ca');
  }catch(e){logErr(e);alert('Lỗi!');}
}
function uiShift(){
  $('#btnStart').hidden = shiftActive;
  $('#btnEnd').hidden   = !shiftActive;
  $('#map').style.display = shiftActive?'block':'none';
  localStorage.setItem('shiftActive', shiftActive?'1':'0');
}

/* ============ Map ============ */
function initMap(){
  map = L.map('map').setView([16,106],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {attribution:'© OpenStreetMap'}).addTo(map);
}
/* tránh chồng label nhờ Leaflet‑offset */
function addMarker(p){
  const m = L.marker([p.lat,p.lng]).addTo(map)
      .bindTooltip(`${p.name}<br>${p.unit}<br>${p.ca}<br>${timeAgo(p.time)} trước`,{direction:'top'});
  markers.push(m);
}
function clearMarkers(){ markers.forEach(m=>map.removeLayer(m)); markers.length=0; }

function timeAgo(t){
  const d=(Date.now()-new Date(t))/1000;
  if(d<60) return d.toFixed(0)+' s';
  if(d<3600) return (d/60).toFixed(0)+' m';
  return (d/3600).toFixed(1)+' h';
}

/* ============ GPS ============ */
function beginGPS(){
  if(!navigator.geolocation){ alert('Trình duyệt không hỗ trợ GPS'); return; }
  watchID = navigator.geolocation.watchPosition(sendPos, e=>logErr(e.message),
    {enableHighAccuracy:true, maximumAge:0, timeout:10_000});
  timer   = setInterval(loadPos, SEND_EVERY);
  loadPos();
}
function stopGPS(){
  navigator.geolocation.clearWatch(watchID);
  clearInterval(timer);
  clearMarkers();
}
async function sendPos(pos){
  const {latitude:lat, longitude:lng} = pos.coords;
  await api('log',{email:me.email, lat, lng, time:new Date().toISOString()});
}
async function loadPos(){
  const rs = await api('getPositions');
  if(rs.status!=='ok') return;
  clearMarkers();
  const bounds = [];
  rs.positions.forEach(p=>{ addMarker(p); bounds.push([p.lat,p.lng]); });
  if(bounds.length) map.fitBounds(bounds,{padding:[16,16]});
}

/* ============ Share & Directions (tuỳ chọn) ============ */
function shareZalo(){
  const url = location.href;
  window.open('https://zalo.me/share?url='+encodeURIComponent(url),'_blank');
}
function navToHere(lat,lng){
  const u='https://www.google.com/maps/dir/?api=1&destination='+lat+','+lng;
  window.open(u,'_blank');
}

/* ============ Call Apps Script bằng JSONP ============ */
function api(action,payload={}){
  return new Promise((res,rej)=>{
    const cb ='cb_'+Math.random().toString(36).slice(2);
    window[cb]=d=>(delete window[cb],res(d));
    const s=document.createElement('script');
    s.src=SCRIPT_URL+'?'+qs({...payload,action,callback:cb});
    s.onerror=()=>{delete window[cb]; rej('jsonp');};
    document.head.appendChild(s);
  });
}

/* ============ Log error ============ */
function logErr(msg){
  fetch(SCRIPT_URL+'?'+qs({action:'error',email:me.email||'',message:String(msg)}))
    .catch(()=>{});
  console.error(msg);
}
