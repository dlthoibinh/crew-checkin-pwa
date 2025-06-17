/******************************************************************
 *  Check-in Ca trực – Front-end PWA (fix CORS bằng JSONP)
 ******************************************************************/

const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby3V7ojn7qWvxUds2r4f5mxb96mi3_9nUhp1u5lrOKhYuNlTMcrjKJo7kUbhcwxP--87Q/exec';
const SEND_EVERY = 15_000;
const CLIENT_ID  =
  '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';

/* ---------- Helpers ---------- */
const $  = id => document.getElementById(id);
const qs = o  => new URLSearchParams(o).toString();
function decodeJwt(t){
  const b=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(decodeURIComponent(atob(b).split('')
    .map(c=>'%' + ('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
}

/* ---------- State ---------- */
let me={}, shiftActive=false, watchID=null, pingTimer=null, map;

/* ---------- GIS ---------- */
window.addEventListener('DOMContentLoaded', ()=>{
  google.accounts.id.initialize({client_id:CLIENT_ID,callback:onGoogleSignIn});
  google.accounts.id.renderButton($('gSignIn'),
    {theme:'outline',size:'large',width:260});
});

/* -----------------------------------------------------------
 *  Callback Google Identity Services
 *  – Nhận `response.credential` (JWT)  →  lấy email  →  gọi API “login”
 * ----------------------------------------------------------- */
async function onGoogleSignIn(response) {
  try {
    /* 1. Giải mã phần payload của JWT (base64url) để lấy email */
    const base64   = response.credential           // id-token JWT
                          .split('.')[1]           // phần payload
                          .replace(/-/g, '+')      // base64url → base64
                          .replace(/_/g, '/');
    const payload  = JSON.parse(atob(base64));
    const email    = (payload.email || '').trim().toLowerCase();
    window.lastJWTemail = email;                   // 👉 tiện debug

    /* 2. Gọi back-end kiểm tra tài khoản */
    const rs = await api('login', { email });
    console.log('LOGIN RESPONSE', rs);             // 👉 xem nhanh

    if (rs.status !== 'ok') {                      // email không hợp lệ
      alert('Bạn không thuộc ca trực');
      google.accounts.id.disableAutoSelect();
      return;
    }

    /* 3. Lưu info, cập nhật giao diện */
    me = rs;                                       // {name, unit, comp, …}
    byId('loginSec').hidden = true;
    byId('app').hidden      = false;
    byId('welcome').textContent =
      `Xin chào ${rs.name} (${rs.unit})`;

    /* 4. Khôi phục ca chưa kết thúc & khởi tạo bản đồ */
    restoreShift();
    initMap();

  } catch (err) {                                  // mọi lỗi khác
    logErr(err);
    alert('Đăng nhập thất bại – thử lại!');
  }
}


/* ---------- Nút ---------- */
$('btnStart').onclick=startShift; $('btnEnd').onclick=endShift;
$('btnInfo').onclick = ()=>alert(JSON.stringify(me,null,2));
$('btnLogout').onclick=()=>location.reload();

/* ---------- Ca trực ---------- */
function restoreShift(){
  if(localStorage.getItem('shiftActive')==='1'){shiftActive=true;uiShift();beginGPS();}
}
async function startShift(){
  try{
    const ca=$('selCa').value||me.ca||'';
    const rs=await api('startShift',{email:me.email,ca});
    if(rs.status==='ok'){me.ca=ca;shiftActive=true;uiShift();beginGPS();}
    else alert('Không thể bắt đầu ca!');
  }catch(e){logErr(e);alert('Lỗi bắt đầu ca!');}
}
async function endShift(){
  const rs=await api('endShift',{email:me.email});
  if(rs.status==='ok'){shiftActive=false;uiShift();stopGPS();}
  else alert('Không thể kết thúc ca!');
}
function uiShift(){
  $('btnStart').hidden= shiftActive;
  $('btnEnd').hidden  =!shiftActive;
  $('map').style.display = shiftActive?'block':'none';
  localStorage.setItem('shiftActive',shiftActive?'1':'0');
}

/* ---------- Map & GPS ---------- */
function initMap(){
  map=L.map('map').setView([16,106],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {attribution:'© OpenStreetMap'}).addTo(map);
}
function beginGPS(){
  if(!navigator.geolocation){alert('Trình duyệt không hỗ trợ GPS');return;}
  watchID=navigator.geolocation.watchPosition(pushPos,e=>logErr(e.message),
           {enableHighAccuracy:true,maximumAge:0,timeout:10_000});
  pingTimer=setInterval(loadLatest,SEND_EVERY); loadLatest();
}
function stopGPS(){
  navigator.geolocation.clearWatch(watchID); clearInterval(pingTimer);
}
async function pushPos(p){
  const {latitude:lat,longitude:lng}=p.coords;
  await api('log',{email:me.email,lat,lng,time:new Date().toISOString()});
}
async function loadLatest(){
  const rs=await api('getPositions'); if(rs.status!=='ok')return;
  map.eachLayer(l=>{if(l.options&&l.options.pane==='markerPane')map.removeLayer(l);});
  const b=[];
  rs.positions.forEach(p=>{
    L.marker([p.lat,p.lng]).addTo(map)
      .bindTooltip(`${p.name}<br>${p.unit}<br>${p.ca}<br>${ago(p.time)} trước`);
    b.push([p.lat,p.lng]);
  });
  if(b.length) map.fitBounds(b,{padding:[16,16]});
}
const ago=t=>{const s=(Date.now()-new Date(t))/1000;if(s<60)return s|0+' s';
              if(s<3600)return (s/60)|0+' m';return (s/3600).toFixed(1)+' h';};

/* ---------- CALL GAS  (pure JSONP → không còn CORS) ---------- */
function api(action,payload={}){
  return new Promise((res,rej)=>{
    const cb='cb_'+Date.now().toString(36)+Math.random().toString(36).slice(2);
    window[cb]=d=>{delete window[cb];script.remove();res(d);};
    const script=document.createElement('script');
    script.src=SCRIPT_URL+'?'+qs({...payload,action,callback:cb});
    script.onerror=()=>{delete window[cb];script.remove();rej('jsonp error');};
    document.head.appendChild(script);
  });
}

/* ---------- Log lỗi nhẹ ---------- */
const logErr = msg =>
  api('error',{email:me.email||'',message:String(msg)}).catch(()=>{});
