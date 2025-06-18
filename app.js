/***********************************************************************************************
 *  Front-end PWA – Check-in Ca trực (EVN)                                                      *
 *  - Đăng nhập bằng Google (GIS)
 *  - Khi email nằm trong sheet "nhanvien" → cho bắt đầu ca
 *  - Gửi GPS 15 s/lần vào sheet "log" (Apps Script backend)
 *  - Khôi phục ca nếu refresh / kill app
 *  - Toàn bộ lỗi → gọi action=error để ghi sheet "loi"
 *  - Dashboard (dashboard.html) cùng dùng api() JSONP nên không cần gì thêm
 **********************************************************************************************/

/* ============ CONFIG ============ */
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbykV_rM5_qD58eKqncGZam6UbEnadXWEoDVOzfQXyUtpfSp8LNXLy4c6TL0YEe4b_gBdQ/exec';
const SEND_EVERY = 15_000;                    // 15 s
const CLIENT_ID  =
  '280769604046-nq14unfhu36e1fc86vk6d3l9br5df2.apps.googleusercontent.com';

/* ============ DOM helper ============ */
const $  = id => document.getElementById(id);
const qs = o => new URLSearchParams(o).toString();

/* ============ State ============ */
let me={}, shiftActive=false, watchID=null, timer=null, map, markers=[];

/*
════════════════════════════════════════════════════════════════════
  1️⃣  CHẠY SAU KHI DOM HOÀN TẤT
════════════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded',()=>{
  /* 1. Khởi tạo Google Identity */
  const signDiv = $('#gSignIn');
  if(signDiv){
    google.accounts.id.initialize({client_id:CLIENT_ID,callback:onGoogleSignIn});
    google.accounts.id.renderButton(signDiv,{theme:'outline',size:'large'});
  }else console.error('#gSignIn not found');

  /* 2. Gắn các sự kiện nút – đảm bảo lúc này phần tử đã có */
  $('#btnStart') && ($('#btnStart').onclick  = startShift);
  $('#btnEnd')   && ($('#btnEnd').onclick    = endShift);
  $('#btnInfo')  && ($('#btnInfo').onclick   = ()=>alert(JSON.stringify(me,null,2)));
  $('#btnLogout')&& ($('#btnLogout').onclick = ()=>location.reload());

  /* 3. Khôi phục ca & bản đồ (nếu đã từng đăng nhập và có shiftActive) */
  if(localStorage.getItem('shiftActive')==='1'){
    shiftActive=true; uiShift();
  }
});

/*
════════════════════════════════════════════════════════════════════
  2️⃣  GOOGLE SIGN-IN
════════════════════════════════════════════════════════════════════ */
async function onGoogleSignIn({credential}){
  try{
    /* Giải mã JWT */
    const email = JSON.parse(atob(credential.split('.')[1])).email.toLowerCase();

    /* Gọi backend */
    const rs = await api('login',{email});
    console.log('LOGIN RESPONSE',rs);

    if(rs.status!=='ok') return alert('Bạn không thuộc ca trực');

    me = rs;  // lưu thông tin nhân viên
    $('#loginSec').hidden = true;
    $('#app').hidden      = false;
    $('#welcome').textContent = `Xin chào ${me.name} (${me.unit})`;

    /* Bản đồ & ca trực */
    initMap();
    restoreShift();
  }catch(err){ logErr(err); alert('Đăng nhập lỗi'); }
}

/*
════════════════════════════════════════════════════════════════════
  3️⃣  CA TRỰC – START / END / KHÔI PHỤC
════════════════════════════════════════════════════════════════════ */
function restoreShift(){
  if(shiftActive){ beginGPS(); return; }
  if(localStorage.getItem('shiftActive')==='1'){
    shiftActive=true; uiShift(); beginGPS();
  }
}
async function startShift(){
  try{
    const ca=$('#selCa').value;
    const rs=await api('startShift',{email:me.email,ca});
    if(rs.status==='ok'){ shiftActive=true; uiShift(); beginGPS(); }
    else alert('Không thể bắt đầu ca');
  }catch(e){logErr(e); alert('Lỗi!');}
}
async function endShift(){
  try{
    const rs=await api('endShift',{email:me.email});
    if(rs.status==='ok'){ shiftActive=false; uiShift(); stopGPS(); }
    else alert('Không thể kết thúc ca');
  }catch(e){logErr(e); alert('Lỗi!');}
}
function uiShift(){
  if(!$('#btnStart')) return;               // an toàn nếu DOM chưa có
  $('#btnStart').hidden = shiftActive;
  $('#btnEnd').hidden   = !shiftActive;
  $('#map').style.display = shiftActive?'block':'none';
  localStorage.setItem('shiftActive', shiftActive?'1':'0');
}

/*
════════════════════════════════════════════════════════════════════
  4️⃣  BẢN ĐỒ (Leaflet) + MARKERS
════════════════════════════════════════════════════════════════════ */
function initMap(){
  if(map) return;                           // tránh khởi tạo 2 lần
  map = L.map('map').setView([16,106],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {attribution:'© OpenStreetMap'}).addTo(map);
}
function addMarker(p){
  const m=L.marker([p.lat,p.lng]).addTo(map)
      .bindTooltip(`${p.name}<br>${p.unit}<br>${p.ca}<br>${timeAgo(p.time)} trước`,{direction:'top'});
  markers.push(m);
}
function clearMarkers(){ markers.forEach(m=>map.removeLayer(m)); markers.length=0; }
function timeAgo(t){const d=(Date.now()-new Date(t))/1000;return d<60?d.toFixed(0)+' s':d<3600?(d/60).toFixed(0)+' m':(d/3600).toFixed(1)+' h';}

/*
════════════════════════════════════════════════════════════════════
  5️⃣  GPS: GỬI & TẢI VỊ TRÍ
════════════════════════════════════════════════════════════════════ */
function beginGPS(){
  if(!navigator.geolocation){alert('Trình duyệt không hỗ trợ GPS'); return;}
  watchID=navigator.geolocation.watchPosition(sendPos,e=>logErr(e.message),{enableHighAccuracy:true,maximumAge:0,timeout:10_000});
  timer=setInterval(loadPos,SEND_EVERY);
  loadPos();
}
function stopGPS(){ navigator.geolocation.clearWatch(watchID); clearInterval(timer); clearMarkers(); }
async function sendPos(pos){
  const {latitude:lat,longitude:lng}=pos.coords;
  await api('log',{email:me.email,lat,lng,time:new Date().toISOString()});
}
async function loadPos(){
  const rs = await api('getPositions'); if(rs.status!=='ok') return;
  clearMarkers(); const b=[];
  rs.positions.forEach(p=>{addMarker(p); b.push([p.lat,p.lng]);});
  if(b.length) map.fitBounds(b,{padding:[16,16]});
}

/*
════════════════════════════════════════════════════════════════════
  6️⃣  Chia sẻ & Dẫn đường – tuỳ chọn
════════════════════════════════════════════════════════════════════ */
function shareZalo(){ window.open('https://zalo.me/share?url='+encodeURIComponent(location.href),'_blank'); }
function navToHere(lat,lng){ window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,'_blank'); }

/*
════════════════════════════════════════════════════════════════════
  7️⃣  JSONP CALLER + GHI LOG LỖI
════════════════════════════════════════════════════════════════════ */
function api(action,payload={}){
  return new Promise((res,rej)=>{
    const cb='cb_'+Math.random().toString(36).slice(2);
    window[cb]=d=>{delete window[cb]; res(d);}  // clean up
    const s=document.createElement('script');
    s.src=SCRIPT_URL+'?'+qs({...payload,action,callback:cb});
    s.onerror=()=>{delete window[cb]; rej('jsonp');};
    document.head.appendChild(s);
  });
}
function logErr(msg){
  fetch(SCRIPT_URL+'?'+qs({action:'error',email:me.email||'',message:String(msg)})).catch(()=>{});
  console.error(msg);
}
