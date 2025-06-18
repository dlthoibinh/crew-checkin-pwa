/***************************************************************
 *    Check-in Ca trực — Front-end PWA  (JSONP + GIS v2)       *
 ***************************************************************/
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykV_rM5_qD58eKqncGZam6UbEnadXWEoDVOzfQXyUtpfSp8LNXLy4c6TL0YEe4b_gBdQ/exec';
const SEND_EVERY = 15_000;        // ping GPS 15 s
const CLIENT_ID  = '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';

/* ---------- tiện ích DOM ngắn gọn ---------- */
const $ = q => document.querySelector(q);
const qs = o => Object.keys(o).map(k=>`${k}=${encodeURIComponent(o[k])}`).join('&');

/* ---------- State ---------- */
let   me = null;                  // thông tin nhân viên
let   shiftActive = false;
let   pingTimer   = null;
let   map, marker;

/* ---------- JSONP helper ---------- */
function callJSONP(params, onDone){
  const cb = 'cb' + Date.now();
  window[cb] = d => { delete window[cb]; onDone(d); };
  const s = document.createElement('script');
  s.src   = `${SCRIPT_URL}?${params}&callback=${cb}`;
  s.onerror = () => logErr('jsonp error');
  document.body.appendChild(s);
}

/* ---------- Google Identity Services ---------- */
window.onload = () => {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback : handleCredential,
    auto_select: false
  });
  google.accounts.id.prompt();          // hiển thị pop-up OneTap
  google.accounts.id.renderButton($('#gSignIn'), { theme:'outline', size:'large' });
};

function decodeJwt(token){           // lấy email ra từ JWT
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  return payload.email || '';
}

function handleCredential(response){
  const email = decodeJwt(response.credential).toLowerCase();
  if(!email) return alert('Không lấy được email!');
  login(email);
}

/* ---------- Login ---------- */
function login(email){
  callJSONP(qs({action:'login', email}), rs=>{
    console.log('LOGIN RESPONSE', rs);
    if(rs.status!=='ok'){ alert('Bạn không thuộc ca trực'); return; }
    me = rs; $('#loginSec').hidden = true;
    $('#welcome').textContent = `Xin chào ${me.name} (${me.unit})`;
    $('#app').hidden = false;
    restoreShift();                              // xem thử ca còn mở không
  });
}

/* ---------- Bắt / kết thúc ca ---------- */
$('#btnStart').onclick = async ()=>{
  const ca = $('#selCa').value;
  callJSONP(qs({action:'startShift', email:me.email, ca}), rs=>{
    if(rs.status==='ok'){ shiftActive=true; saveState(); uiShift(); beginGPS(); }
    else alert('Không thể bắt đầu ca');
  });
};

$('#btnEnd').onclick = ()=> endShift();

function endShift(){
  callJSONP(qs({action:'endShift', email:me.email}), rs=>{
    if(rs.status==='ok'){ shiftActive=false; saveState(); uiShift(); stopGPS(); }
    else alert('Kết thúc ca thất bại');
  });
}

/* ---------- Gửi GPS ---------- */
function beginGPS(){
  if(pingTimer) return;
  pingOnce();                       // gửi ngay 1 gói đầu tiên
  pingTimer = setInterval(pingOnce, SEND_EVERY);
}
function stopGPS(){ clearInterval(pingTimer); pingTimer=null; }

function pingOnce(){
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude:lat, longitude:lng} = pos.coords;
    callJSONP(qs({action:'log', email:me.email, lat, lng, time:Date.now()}), _=>{});
    showSelf(lat,lng);
  }, e=>logErr(e.message), {enableHighAccuracy:true});
}

/* ---------- Leaflet Map ---------- */
function initMap(){
  map = L.map('map').setView([16,108], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
     maxZoom:18, attribution:'©OpenStreetMap'}).addTo(map);
}
function showSelf(lat,lng){
  if(!map) initMap();
  if(!marker) marker = L.marker([lat,lng]).addTo(map);
  marker.setLatLng([lat,lng]);
  map.setView([lat,lng], 15);
}

/* ---------- Ghi lỗi ---------- */
function logErr(msg){
  console.error(msg);
  if(me) callJSONP(qs({action:'error', email:me.email, message:msg}), _=>{});
  else   callJSONP(qs({action:'error', message:msg}), _=>{});
}

/* ---------- Lưu / khôi phục state ---------- */
function saveState(){
  localStorage.setItem('shiftActive', JSON.stringify({on:shiftActive, ca:$('#selCa').value}));
}
function restoreShift(){
  const st = JSON.parse(localStorage.getItem('shiftActive')||'null');
  if(st?.on){ $('#selCa').value=st.ca; shiftActive=true; uiShift(); beginGPS(); }
}

/* ---------- UI nhỏ gọn ---------- */
function uiShift(){
  $('#btnStart').hidden = shiftActive;
  $('#btnEnd').hidden   = !shiftActive;
  $('#selCa').disabled  = shiftActive;
}

/* ---------- Nút bổ trợ ---------- */
$('#btnInfo').onclick = ()=> alert(JSON.stringify(me,null,2));
$('#btnLogout').onclick = ()=>{
  google.accounts.id.disableAutoSelect();
  location.reload();
};

/***************************************************************
 *            Khởi chạy ngay khi file được load                *
 ***************************************************************/
document.addEventListener('DOMContentLoaded', ()=>{
  // phần tử map ẩn tới khi đăng nhập OK
  $('#map').style.display='none';
});
