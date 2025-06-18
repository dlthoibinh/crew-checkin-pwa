/**************************************************************
 *  app.js  –  Front-end Nhân viên
 **************************************************************/
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykV_rM5_qD58eKqncGZam6UbEnadXWEoDVOzfQXyUtpfSp8LNXLy4c6TL0YEe4b_gBdQ/exec';   // ← thay
const CLIENT_ID  = '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';                // ← thay
const SEND_EVERY = 15_000;

/* ===== Helpers ===== */
const $ = id => document.getElementById(id);
const qs= o=>new URLSearchParams(o).toString();
const api = (act,p={}) => fetch(SCRIPT_URL+'?'+qs({action:act,...p})).then(r=>r.json())
               .catch(err=>{console.error(err);api('error',{message:err})});
/* Thời gian “x phút trước” – dùng cho dashboard nếu cần */
const timeAgo = t => {const d=(Date.now()-new Date(t))/1000;
  return d<60?d.toFixed(0)+'s':d<3600?(d/60).toFixed(0)+'m':(d/3600).toFixed(1)+'h'};

/* ===== State ===== */
let me={}, shift=false, watchID=0, map;

/* ===== Google Sign-In ===== */
window.addEventListener('DOMContentLoaded',()=>{
  google.accounts.id.initialize({client_id:CLIENT_ID,callback:onGoogle});
  google.accounts.id.renderButton($('gSignIn'),{theme:'outline',size:'large',width:270});
});
async function onGoogle({credential}){
  try{
    /* 1. lấy email */
    const email = JSON.parse(
      atob(credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))
    ).email.toLowerCase();
    console.log('jwt-email', email);
    /* 2. gửi backend kiểm */
    const rs = await api('login', { email });
    console.log('LOGIN RESPONSE', rs);
    if(rs.status!=='ok'){ alert('Bạn không thuộc ca trực'); return; }
    /* 3. hiển thị giao diện */
    me=rs; $('login').hidden=true; $('app').hidden=false;
    $('welcome').textContent=`Xin chào ${rs.name} (${rs.unit})`;
    restoreShift(); initMap();
  }catch(e){api('error',{email:'',message:e});alert('Đăng nhập lỗi');}
}

/* ===== Nút ===== */
$('btnStart').onclick = startShift;
$('btnEnd').onclick   = endShift;
$('btnInfo').onclick  = ()=>alert(JSON.stringify(me,null,2));
$('btnLogout').onclick= ()=>location.reload();

function ui(){ $('btnStart').hidden=shift; $('btnEnd').hidden=!shift;
  $('map').style.display=shift?'block':'none'; localStorage.shift=shift?'1':'0';}
function restoreShift(){ if(localStorage.shift==='1'){shift=true;ui();beginGPS();} }

/* ===== Ca ===== */
async function startShift(){
  const ca=$('selCa').value;
  const rs=await api('startShift',{email:me.email,ca});
  if(rs.status==='ok'){shift=true; ui(); beginGPS();}
  else alert('Không bắt đầu ca được');
}
async function endShift(){
  const rs=await api('endShift',{email:me.email});
  if(rs.status==='ok'){shift=false;ui();stopGPS();}
  else alert('Không kết thúc ca được');
}

/* ===== GPS & Bản đồ ===== */
function initMap(){
  map=L.map('map').setView([16,106],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {attribution:'© OpenStreetMap'}).addTo(map);
}
function beginGPS(){
  if(!navigator.geolocation){alert('Trình duyệt không hỗ trợ GPS');return;}
  watchID = navigator.geolocation.watchPosition(pos=>{
    api('log',{email:me.email,lat:pos.coords.latitude,lng:pos.coords.longitude,
               time:new Date().toISOString()});
  },err=>api('error',{email:me.email,message:err.message}),
    {enableHighAccuracy:true,timeout:10000,maximumAge:0});
}
function stopGPS(){ navigator.geolocation.clearWatch(watchID); }

/* ===== Nhắc sắp hết ca (tùy chọn) ===== */
// có thể gọi remindBefore('2025-06-18T17:00:00')
function remindBefore(endISO){
  if(Notification.permission!=='granted') Notification.requestPermission();
  const t=new Date(endISO)-5*60*1000-Date.now();
  if(t>0)setTimeout(()=>new Notification('Sắp hết ca – 5 phút nữa!'),t);
}
