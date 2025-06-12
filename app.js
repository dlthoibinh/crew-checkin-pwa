const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw5dqnvTfMuMPjIkdWapz7HC9k15NiKImjhkMtPa1NymMuvtZcsf9gkfZ4BWtG2q8KkcA/exec';

let isOnDuty = false, timerId = null;

function sendLocation(email, shift, lat, lon) {
  // Tạo URL với query-string
  const url = `${WEB_APP_URL}`
    + `?email=${encodeURIComponent(email)}`
    + `&shift=${encodeURIComponent(shift)}`
    + `&lat=${encodeURIComponent(lat)}`
    + `&lon=${encodeURIComponent(lon)}`;
  console.log('→ Gọi GET:', url);
  // no-cors optional, GET simple không cần preflight
  return fetch(url, { mode: 'no-cors' })
    .then(() => ({ status: 'OK' }))
    .catch(err => ({ status: 'ERROR', message: err.message }));
}

document.getElementById('btn').onclick = async () => {
  const email = document.getElementById('email').value.trim();
  const shift = document.getElementById('shift').value;
  const status = document.getElementById('status');
  if (!email) {
    alert('Vui lòng nhập email.');
    return;
  }

  let lat, lon;
  try {
    status.textContent = '⏳ Lấy vị trí…';
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout:10000 })
    );
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    console.log('→ GPS:', lat, lon);
  } catch (e) {
    console.error('🚨 Lỗi GPS:', e);
    status.textContent = '❌ Lỗi GPS: '+e.message;
    return;
  }

  if (!isOnDuty) {
    isOnDuty = true;
    document.getElementById('btn').textContent = 'Kết thúc ca';
    status.textContent = '✅ Bắt đầu ca…';
    const res = await sendLocation(email, shift, lat, lon);
    status.textContent = res.status === 'OK'
      ? '✅ Check-in thành công!'
      : '❌ Lỗi gửi check-in';
    timerId = setInterval(() => sendLocation(email, shift, lat, lon), 15*60*1000);
  } else {
    isOnDuty = false;
    document.getElementById('btn').textContent = 'Bắt đầu ca';
    status.textContent = '✅ Kết thúc ca…';
    clearInterval(timerId);
    const res = await sendLocation(email, shift, lat, lon);
    status.textContent = res.status === 'OK'
      ? '✅ Check-out thành công!'
      : '❌ Lỗi gửi check-out';
  }
};
