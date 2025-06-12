// 1) Dán chính xác URL từ Apps Script Web App vào đây:
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw5dqnvTfMuMPjIkdWapz7HC9k15NiKImjhkMtPa1NymMuvtZcsf9gkfZ4BWtG2q8KkcA/exec';

let isOnDuty = false, timerId = null;

// Hàm gửi vị trí và show status / debug
async function sendLocation(email, shift) {
  try {
    console.log('→ Gửi toạ độ:', email, shift);
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, shift, lat, lon })
    });
    console.log('← Response status:', response.status);
    const json = await response.json();
    console.log('← Response JSON:', json);
    return json;
  } catch (err) {
    console.error('🚨 Fetch error:', err);
    throw err;
  }
}

document.getElementById('btn').onclick = async () => {
  const email = document.getElementById('email').value.trim();
  const shift = document.getElementById('shift').value;
  const status = document.getElementById('status');
  if (!email) return alert('Vui lòng nhập email.');

  // Lấy toạ độ mới mỗi lần click
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
    status.textContent = '✅ Đã bắt đầu ca. Gửi vị trí…';
    try {
      const res = await sendLocation(email, shift, lat, lon);
      status.textContent = res.status==='OK'
        ? '✅ Check-in thành công!'
        : '❌ Lỗi server: '+(res.message||'');
    } catch (e) {
      status.textContent = '❌ Lỗi gửi check-in';
    }
    // Bật interval
    timerId = setInterval(async ()=>{
      try {
        const res = await sendLocation(email, shift, lat, lon);
        console.log('*Periodic send*', res);
      } catch {}
    }, 15*60*1000);

  } else {
    // Kết thúc ca
    isOnDuty = false;
    document.getElementById('btn').textContent = 'Bắt đầu ca';
    status.textContent = '✅ Đã kết thúc ca. Gửi vị trí…';
    clearInterval(timerId);
    try {
      const res = await sendLocation(email, shift, lat, lon);
      status.textContent = res.status==='OK'
        ? '✅ Check-out thành công!'
        : '❌ Lỗi server: '+(res.message||'');
    } catch (e) {
      status.textContent = '❌ Lỗi gửi check-out';
    }
  }
};
