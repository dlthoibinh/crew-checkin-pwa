// ← Paste URL từ Apps Script Web App vào đây:
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw5dqnvTfMuMPjIkdWapz7HC9k15NiKImjhkMtPa1NymMuvtZcsf9gkfZ4BWtG2q8KkcA/exec';

let isOnDuty = false, timerId = null;

async function sendLocation(email, shift, lat, lon) {
  try {
    console.log('→ Gửi toạ độ:', {email, shift, lat, lon});
    // Chế độ no-cors để vượt CORS preflight
    await fetch(WEB_APP_URL, {
      mode: 'no-cors',
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({email, shift, lat, lon})
    });
    console.log('← Đã gửi (no-cors)');
    return {status:'OK'};
  } catch (err) {
    console.error('🚨 Fetch error:', err);
    return {status:'ERROR', message: err.message};
  }
}

document.getElementById('btn').onclick = async () => {
  const email = document.getElementById('email').value.trim();
  const shift = document.getElementById('shift').value;
  const status = document.getElementById('status');
  if (!email) {
    alert('Vui lòng nhập email.');
    return;
  }

  // Lấy tọa độ
  let lat, lon;
  try {
    status.textContent = '⏳ Lấy vị trí…';
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, {timeout:10000})
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
    // Bắt đầu ca
    isOnDuty = true;
    document.getElementById('btn').textContent = 'Kết thúc ca';
    status.textContent = '✅ Đang bắt đầu ca…';
    const res = await sendLocation(email, shift, lat, lon);
    status.textContent = res.status==='OK'
      ? '✅ Check-in thành công!'
      : '❌ Lỗi gửi check-in';
    // Gửi định kỳ 15′
    timerId = setInterval(()=>{
      sendLocation(email, shift, lat, lon);
    }, 15*60*1000);
  } else {
    // Kết thúc ca
    isOnDuty = false;
    document.getElementById('btn').textContent = 'Bắt đầu ca';
    status.textContent = '✅ Đang kết thúc ca…';
    clearInterval(timerId);
    const res = await sendLocation(email, shift, lat, lon);
    status.textContent = res.status==='OK'
      ? '✅ Check-out thành công!'
      : '❌ Lỗi gửi check-out';
  }
};
