// Paste URL Web App ở đây
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw5dqnvTfMuMPjIkdWapz7HC9k15NiKImjhkMtPa1NymMuvtZcsf9gkfZ4BWtG2q8KkcA/exec';

// callback toàn cục
function _jsonpHandler(res) {
  console.log('← JSONP response:', res);
  // cập nhật status UI
  const status = document.getElementById('status');
  status.textContent = res.status==='OK'
    ? '✅ Gửi thành công!'
    : '❌ Lỗi server: ' + (res.message||'');
  // xoá tag <script> sau khi chạy
  document.getElementById('_jsonpScript').remove();
}

// Hàm khởi tạo JSONP request
function sendLocation(email, shift, lat, lon) {
  // build URL with callback param
  const url = `${WEB_APP_URL}`
    + `?email=` + encodeURIComponent(email)
    + `&shift=` + encodeURIComponent(shift)
    + `&lat=`   + encodeURIComponent(lat)
    + `&lon=`   + encodeURIComponent(lon)
    + `&callback=_jsonpHandler`;

  console.log('→ JSONP src:', url);

  // Tạo script tag
  const s = document.createElement('script');
  s.src = url;
  s.id = '_jsonpScript';
  document.body.appendChild(s);
}

let isOnDuty = false, timerId = null;

document.getElementById('btn').onclick = async () => {
  const email = document.getElementById('email').value.trim();
  const shift = document.getElementById('shift').value;
  const status = document.getElementById('status');
  if (!email) {
    alert('Vui lòng nhập email.'); return;
  }

  // Lấy vị trí
  let lat, lon;
  try {
    status.textContent = '⏳ Lấy vị trí…';
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej,{timeout:10000})
    );
    lat = pos.coords.latitude; lon = pos.coords.longitude;
    console.log('→ GPS:', lat, lon);
  } catch (e) {
    console.error('🚨 GPS error:', e);
    status.textContent = '❌ Lỗi GPS: '+e.message;
    return;
  }

  if (!isOnDuty) {
    isOnDuty = true;
    btn.textContent = 'Kết thúc ca';
    status.textContent = '✅ Bắt đầu ca…';
    sendLocation(email, shift, lat, lon);
    timerId = setInterval(()=> sendLocation(email, shift, lat, lon),15*60*1000);
  } else {
    isOnDuty = false;
    btn.textContent = 'Bắt đầu ca';
    status.textContent = '✅ Kết thúc ca…';
    clearInterval(timerId);
    sendLocation(email, shift, lat, lon);
  }
};
