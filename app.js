/******************************************************************
 *  Check-in Ca trực – Front-end PWA  (GPS + JSONP, v2024-06-17)
 ******************************************************************/

/* 1️⃣ CẤU HÌNH */
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykV_rM5_qD58eKqncGZam6UbEnadXWEoDVOzfQXyUtpfSp8LNXLy4c6TL0YEe4b_gBdQ/exec';
const CLIENT_ID  = '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';
const SEND_EVERY = 15_000;

/* 2️⃣ BIẾN TOÀN CỤC */
let me={}, shiftActive=false, watchID=null, timer=null, map;

/* 3️⃣ HELPER DOM & LOG */
const $ = sel => document.querySelector(sel);
function logErr(msg){
  fetch(`${SCRIPT_URL}?action=error&email=${encodeURIComponent(me.email||'')}`
        +`&message=${encodeURIComponent(msg)}`).catch(()=>{});
  console.error(msg);
}

/* 4️⃣ ĐỢI DOMContentLoaded – đảm bảo #gSignIn tồn tại */
document.addEventListener('DOMContentLoaded', () => {
  if(!$('#gSignIn')) return logErr('#gSignIn not found');

  /* 5️⃣ KHỞI TẠO Google Identity */
  google.accounts.id.initialize({ client_id:CLIENT_ID, callback:onGoogleSignIn });
  google.accounts.id.renderButton($('#gSignIn'),
    { theme:'outline', size:'large', width:240 });

  /* 6️⃣ GẮN SỰ KIỆN NÚT; kiểm tra null để tránh lỗi */
  $('#btnStart')?.addEventListener('click', startShift);
  $('#btnEnd')  ?.addEventListener('click',  endShift);
  $('#btnInfo') ?.addEventListener('click', () => alert(JSON.stringify(me,null,2)));
  $('#btnLogout')?.addEventListener('click', () => location.reload());

  /* 7️⃣ PHỤC HỒI CA NẾU LOCALSTORAGE CÓ */
  if(localStorage.getItem('shiftActive')==='1'){
    shiftActive=true;
    beginGPS();
  }
});

/* 8️⃣ LOGIN GOOGLE */
async function onGoogleSignIn({credential}){
  try{
    const email = JSON.parse(atob(credential.split('.')[1])).email.toLowerCase();
    const rs = await api('login',{email});
    console.log('LOGIN RESPONSE', rs);

    if(rs.status!=='ok') return alert('Bạn không thuộc ca trực');

    /* thành công */
    me = rs;
    $('#loginSec').hidden=true;
    $('#app').hidden=false;
    $('#welcome').textContent = `Xin chào ${me.name} (${me.unit})`;

  }catch(e){ logErr(e); alert('Đăng nhập lỗi'); }
}

/* 9️⃣ SHIFT */
async function startShift(){
  try{
    const ca = $('#selCa')?.value || me.ca || '';
    const rs = await api('startShift',{email:me.email, ca});
    if(rs.status==='ok'){
      shiftActive=true; localStorage.setItem('shiftActive','1');
      $('#btnStart').hidden=true; $('#btnEnd').hidden=false;
      beginGPS();
    }
  }catch(e){ logErr(e); alert('Không thể bắt đầu ca'); }
}
async function endShift(){
  try{
    const rs = await api('endShift',{email:me.email});
    if(rs.status==='ok'){
      shiftActive=false; localStorage.removeItem('shiftActive');
      $('#btnStart').hidden=false; $('#btnEnd').hidden=true;
      stopGPS();
    }
  }catch(e){ logErr(e); alert('Không thể kết thúc ca'); }
}

/* 🔟 MAP & GPS */
function initMap(){
  map = L.map('map').setView([16,106],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {attribution:'© OpenStreetMap'}).addTo(map);
}
function beginGPS(){
  if(!navigator.geolocation){ alert('Trình duyệt không hỗ trợ GPS'); return; }
  $('#map').style.display='block'; if(!map) initMap();

  watchID = navigator.geolocation.watchPosition(
    pos => api('log',{email:me.email,
                      lat:pos.coords.latitude,
                      lng:pos.coords.longitude,
                      time:new Date().toISOString()}),
    err => logErr(err.message),
    {enableHighAccuracy:true, maximumAge:0, timeout:10_000}
  );
  timer = setInterval(loadPos, SEND_EVERY);
  loadPos();
}
function stopGPS(){ navigator.geolocation.clearWatch(watchID); clearInterval(timer); }

async function loadPos(){
  const rs = await api('getPositions');
  if(rs.status!=='ok') return;
  /* xoá marker cũ */
  map.eachLayer(l=>{ if(l.options && l.options.pane==='markerPane') map.removeLayer(l); });
  const b=[];
  rs.positions.forEach(p=>{
    L.marker([p.lat,p.lng]).addTo(map)
     .bindTooltip(`${p.name}<br>${p.unit}<br>${p.ca}`);
    b.push([p.lat,p.lng]);
  });
  if(b.length) map.fitBounds(b,{padding:[24,24]});
}

// Hàm gọi JSONP chung
function callJSONP(params, onDone){
  const cb = 'cb_' + Date.now();
  window[cb] = d => { delete window[cb]; onDone(d); };
  const s   = document.createElement('script');
  s.src     = `${SCRIPT_URL}?${params}&callback=${cb}`;
  s.onerror = () => { alert('jsonp error'); };
  document.body.appendChild(s);
}

// Đăng nhập
function tryLogin(email){
  callJSONP(`action=login&email=${encodeURIComponent(email)}`, rs=>{
    console.log('LOGIN RESPONSE', rs);
    if(rs.status==='ok'){
        // hiển thị lời chào + show form ca trực
    }else alert('Bạn không phải nhân viên ca trực');
  });
}
