/*  app.js – v2 (5 giây)  */
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwkHtj3CD_QGhPmxZ7H8uYYgnDZIgOYAp84DyoCetV4UdRe8XXOu015U2nLd0h7csUgCw/exec';          // 👈

/* ─────────── DOM helper ─────────── */
const $ = id => document.getElementById(id);
const status = msg => $('status').textContent = msg;

/* ─────────── 1. Tải danh sách đơn vị & nhân viên ─────────── */
function jsonp(url, cb){
  const s  = document.createElement('script');
  const fn = '_cb'+Date.now()+Math.random().toString(36).slice(2);
  window[fn] = res => { delete window[fn]; s.remove(); cb(res); };
  s.src = url + (url.includes('?')?'&':'?') + 'callback='+fn;
  s.dataset.jsonp = 1;
  document.body.appendChild(s);
}
function loadUnits(){
  jsonp(WEB_APP_URL+'?list=units', res=>{
    if (res.status!=='OK') return alert('API units lỗi');    // đơn giản
    $('unit').innerHTML = '<option value="">— Đơn vị —</option>'
      + res.rows.map(u=>`<option>${u}</option>`).join('');
  });
}
function loadEmployees(unit){
  $('emp').innerHTML = '<option value="">Đang tải…</option>';
  jsonp(WEB_APP_URL+`?list=employees&unit=${encodeURIComponent(unit)}`, res=>{
    if (res.status!=='OK') return alert('API employees lỗi');
    $('emp').innerHTML = '<option value="">— Nhân viên —</option>'
      + res.rows.map(e=>`<option>${e}</option>`).join('');
  });
}

/* ─────────── 2. Gửi vị trí ─────────── */
function sendLocation(unit, emp, shift, lat, lon){
  jsonp(
    WEB_APP_URL
    + `?unit=${encodeURIComponent(unit)}`
    + `&emp=${encodeURIComponent(emp)}`
    + `&shift=${encodeURIComponent(shift)}`
    + `&lat=${lat}&lon=${lon}`,
    res=>{
      console.log('←',res);
      status(res.status==='OK' ? '✅ Đã gửi' : '❌ Server lỗi');
    }
  );
}

/* ─────────── 3. Logic Start/Stop ─────────── */
let isOn = false, timerId = null;

async function sendOnce(){
  try{
    status('⏳ GPS…');
    const pos = await new Promise((ok,err)=>
      navigator.geolocation.getCurrentPosition(ok,err,{timeout:10000})
    );
    const {latitude:lat, longitude:lon} = pos.coords;
    sendLocation($('unit').value,$('emp').value,$('shift').value,lat,lon);
  }catch(e){ status('❌ GPS lỗi: '+e.message); }
}

$('btn').onclick = async ()=>{
  if (!isOn){
    isOn = true;
    $('btn').textContent = 'Kết thúc ca';
    status('🚀 Bắt đầu ca…');
    await sendOnce();                               // gửi ngay
    timerId = setInterval(sendOnce, 5000);          // 5 giây
  }else{
    isOn = false;
    $('btn').textContent = 'Bắt đầu ca';
    clearInterval(timerId);
    await sendOnce();                               // gửi lượt cuối
    status('🏁 Đã kết thúc ca');
  }
};

/* ─────────── 4. Khởi tạo ─────────── */
window.addEventListener('load', ()=>{
  loadUnits();
  $('unit').onchange = e=>{
    const u = e.target.value;
    $('btn').disabled = !u;
    if (u) loadEmployees(u);
    else $('emp').innerHTML = '<option value="">— Nhân viên —</option>';
  };
});
