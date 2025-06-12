const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw5dqnvTfMuMPjIkdWapz7HC9k15NiKImjhkMtPa1NymMuvtZcsf9gkfZ4BWtG2q8KkcA/exec';
let checkingIn = false, watchIntervalId = null;

function sendLocation(email, shift) {
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude: lat, longitude: lon} = pos.coords;
    fetch(WEB_APP_URL, {
      method:'POST',
      body: JSON.stringify({email, shift, lat, lon})
    });
  }, err => console.warn('GPS error:', err));
}

document.getElementById('btn').addEventListener('click', () => {
  const email = document.getElementById('email').value.trim();
  const shift = document.getElementById('shift').value;
  const status = document.getElementById('status');
  if (!email) return alert('Nhập email.');
  if (!checkingIn) {
    checkingIn = true;
    document.getElementById('btn').textContent = 'Kết thúc ca';
    status.textContent = '✅ Đã bắt đầu ca. Theo dõi vị trí...';
    sendLocation(email, shift);
    watchIntervalId = setInterval(() => sendLocation(email, shift), 15*60*1000);
  } else {
    checkingIn = false;
    document.getElementById('btn').textContent = 'Bắt đầu ca';
    status.textContent = '✅ Đã kết thúc ca.';
    sendLocation(email, shift);
    clearInterval(watchIntervalId);
    watchIntervalId = null;
  }
});
