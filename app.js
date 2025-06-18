// 1. Thay URL & Client ID của bạn vào đây
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykV_rM5_qD58eKqncGZam6UbEnadXWEoDVOzfQXyUtpfSp8LNXLy4c6TL0YEe4b_gBdQ/exec';
const CLIENT_ID  = '280769604046-nq14unfhiu36e1fc86vk6d6qj9br5df2.apps.googleusercontent.com';

let me = {};

// 2. Khởi tạo Google Sign-in
window.addEventListener('DOMContentLoaded', ()=>{
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: onGoogleSignIn
  });
  google.accounts.id.renderButton(
    document.getElementById('gSignIn'),
    { theme:'outline', size:'large', width:260 }
  );
});

// 3. Giải mã JWT để lấy email
function decodeJwt(t){
  const b = t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(atob(b));
}

// 4. JSONP wrapper
function callServer(params, cb){
  const callbackName = 'cb_' + Date.now();
  window[callbackName] = data => {
    delete window[callbackName];
    document.body.removeChild(script);
    cb(data);
  };
  const q = new URLSearchParams(params);
  q.set('callback', callbackName);
  const script = document.createElement('script');
  script.src = SCRIPT_URL + '?' + q.toString();
  document.body.appendChild(script);
}

// 5. Khi Google Sign-in thành công
function onGoogleSignIn(resp){
  const pl = decodeJwt(resp.credential);
  const email = pl.email.toLowerCase();
  console.log('JWT email:', email);
  callServer({ action:'login', email }, rs=>{
    console.log('LOGIN RESPONSE', rs);
    if(rs.status==='ok'){
      me = rs;
      showApp();
    } else {
      alert('Bạn không thuộc ca trực');
    }
  });
}

// 6. Hiển thị UI chính sau login
function showApp(){
  document.getElementById('loginSec').hidden = true;
  document.getElementById('app').hidden      = false;
  document.getElementById('welcome').textContent =
    `Xin chào ${me.name} (${me.unit})`;

  document.getElementById('btnStart').onclick  = startShift;
  document.getElementById('btnEnd').onclick    = endShift;
  document.getElementById('btnInfo').onclick   = showInfo;
  document.getElementById('btnLogout').onclick = logout;
}

// 7. Bắt đầu ca
function startShift(){
  callServer({ action:'startShift', email:me.email, ca:me.ca }, rs=>{
    if(rs.status==='ok'){
      alert('Bắt đầu ca thành công');
      btnStart.hidden = true;
      btnEnd.hidden   = false;
    } else {
      alert('Lỗi khi bắt đầu ca');
    }
  });
}

// 8. Kết thúc ca
function endShift(){
  callServer({ action:'endShift', email:me.email }, rs=>{
    if(rs.status==='ok'){
      alert('Kết thúc ca thành công');
      btnStart.hidden = false;
      btnEnd.hidden   = true;
    } else {
      alert('Lỗi khi kết thúc ca');
    }
  });
}

// 9. Thông tin nhân viên
function showInfo(){
  alert(`Thông tin nhân viên:\n
    Tên: ${me.name}\n
    Đơn vị: ${me.unit}\n
    Mã NV: ${me.id}\n
    Ca: ${me.ca}
  `);
}

// 10. Đăng xuất
function logout(){
  me = {};
  document.getElementById('app').hidden      = true;
  document.getElementById('loginSec').hidden = false;
  google.accounts.id.disableAutoSelect();
}
