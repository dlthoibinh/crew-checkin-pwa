/***** CONFIG *****/
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw5dqnvTfMuMPjIkdWapz7HC9k15NiKImjhkMtPa1NymMuvtZcsf9gkfZ4BWtG2q8KkcA/exec';
const SEND_EVERY = 15_000;          // 15 giây
/******************/

let me={}, shiftActive=false, watchID=null, refreshTimer=null;
let map;

/* ---------- Google OAuth ---------- */
window.onGoogleSignIn = async ({credential})=>{
  const email = JSON.parse(atob(credential.split('.')[1])).email;
  const rs = await api('login',{email});
  if(rs.status!=='ok'){ alert('Bạn không thuộc ca trực'); return;}
  me = rs;
  document.querySelector('.g_id_signin').hidden=true;
  document.getElementById('app').hidden=false;
  document.getElementById('welcome').textContent=`Xin chào ${rs.name} (${rs.unit})`;
  restoreShift();
  initMap();
};

/* ---------- Buttons ---------- */
byId('btnStart').onclick = startShift;
byId('btnEnd'  ).onclick = endShift;
byId('btnInfo' ).onclick = ()=>alert(JSON.stringify(me,null,2));
byId('btnLogout').onclick= ()=>location.reload();

/* ---------- Shift logic ---------- */
async function restoreShift(){
  const s = localStorage.getItem('shiftActive');
  if(s==='1'){ shiftActive=true; uiShift(); beginGeo(); }
}

async function startShift(){
  const rs=await api('startShift',{email:me.email});
  if(rs.status==='ok'){
    shiftActive=true; uiShift(); beginGeo();
  }
}
async function endShift(){
  const rs=await api('endShift',{email:me.email});
  if(rs.status==='ok'){
    shiftActive=false; uiShift(); stopGeo();
  }
}
function uiShift(){
  byId('btnStart').hidden=shiftActive;
  byId('btnEnd'  ).hidden=!shiftActive;
  byId('mapSec'  ).hidden=!shiftActive;
  localStorage.setItem('shiftActive',shiftActive?'1':'0');
}

/* ---------- Geo + Map ---------- */
function initMap(){
  map=L.map('map').setView([16,106],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'© OpenStreetMap'}).addTo(map);
}

function beginGeo(){
  if(!navigator.geolocation){ alert('Không hỗ trợ GPS');return;}
  watchID=navigator.geolocation.watchPosition(sendPos,err=>logErr(err.message),
   {enableHighAccuracy:true,maximumAge:0,timeout:10000});
  refreshTimer=setInterval(loadPositions,15000); loadPositions();
}
function stopGeo(){
  navigator.geolocation.clearWatch(watchID);
  clearInterval(refreshTimer);
}

async function sendPos(pos){
  const {latitude:lat,longitude:lng}=pos.coords;
  await api('log',{email:me.email,lat,lng,time:new Date().toISOString()});
}

async function loadPositions(){
  const rs=await api('getPositions',{});
  if(rs.status!=='ok') return;
  map.eachLayer(l=>{if(l.options&&l.options.pane==='markerPane')map.removeLayer(l);});
  const pts=[];
  rs.positions.forEach(p=>{
    const m=L.marker([p.lat,p.lng]).addTo(map)
      .bindTooltip(`${p.name}<br>${p.unit}<br>${timeAgo(p.time)}`);
    pts.push([p.lat,p.lng]);
  });
  if(pts.length) map.fitBounds(pts,{padding:[12,12]});
}

function timeAgo(t){
  const d=(Date.now()-new Date(t).getTime())/1000;
  if(d<60)return d.toFixed(0)+'s';
  if(d<3600)return (d/60).toFixed(0)+'m';
  return (d/3600).toFixed(1)+'h';
}

/* ---------- API helper ---------- */
async function api(action,obj){
  try{
    const q=new URLSearchParams({...obj,action});  
    const r=await fetch(`${SCRIPT_URL}?${q}`);
    return await r.json();
  }catch(e){ logErr(e); return{};}
}
function logErr(msg){ fetch(`${SCRIPT_URL}?action=error&email=${me.email||''}&message=${encodeURIComponent(msg)}`); }
function byId(id){return document.getElementById(id);}
