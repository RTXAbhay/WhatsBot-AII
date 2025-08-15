const socket = io('https://whatsbot-aii.onrender.com', {
  transports: ["websocket", "polling"]
});


// Elements
const authContainer = document.getElementById('auth-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const regUsername = document.getElementById('reg-username');
const regPassword = document.getElementById('reg-password');
const regSecret = document.getElementById('reg-secret');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const authMsg = document.getElementById('auth-msg');

const dashboard = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logout-btn');
const whatsappLogoutBtn = document.getElementById('whatsapp-logout-btn'); // New button
const qrCanvas = document.getElementById('qr-canvas');
const reloadQR = document.getElementById('reload-qr');
const qrStatus = document.getElementById('qr-status');
const aiInstructions = document.getElementById('ai-instructions');
const toggleNew = document.getElementById('toggle-new');
const togglePrev = document.getElementById('toggle-prev');
const saveSettings = document.getElementById('save-settings');
const aiLogs = document.getElementById('ai-logs');

let currentUser = null;
let qrInterval = null;

// Toggle auth forms
showRegister.addEventListener('click', () => {
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  authMsg.textContent='';
});
showLogin.addEventListener('click', () => {
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  authMsg.textContent='';
});

// Login
loginBtn.addEventListener('click', async () => {
  const res = await fetch('/login', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
  });
  const data = await res.json();
  if(data.success){
    currentUser = usernameInput.value;
    authContainer.classList.add('hidden');
    dashboard.classList.remove('hidden');
    initSocket();
  } else { authMsg.textContent = data.msg; }
});

// Register
registerBtn.addEventListener('click', async () => {
  const res = await fetch('/register', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ username: regUsername.value, password: regPassword.value, secret: regSecret.value })
  });
  const data = await res.json();
  if(data.success){
    authMsg.textContent = 'Registered! Please login.';
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  } else { authMsg.textContent = data.msg; }
});

// App Logout
logoutBtn.addEventListener('click', () => {
  currentUser=null;
  dashboard.classList.add('hidden');
  authContainer.classList.remove('hidden');
  clearInterval(qrInterval);
});

// WhatsApp Logout
whatsappLogoutBtn.addEventListener('click', async () => {
  if(!currentUser) return alert('No user logged in!');
  const res = await fetch('/logoutWhatsApp', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ username: currentUser })
  });
  const data = await res.json();
  if(data.success){
    qrStatus.textContent = 'WhatsApp session logged out. Scan a new QR to login.';
    alert('WhatsApp session logged out successfully!');
    qrCanvas.getContext('2d').clearRect(0,0,qrCanvas.width, qrCanvas.height);
    clearInterval(qrInterval);
  } else {
    alert('Failed to logout WhatsApp session: '+data.msg);
  }
});

// Reload QR manually
reloadQR.addEventListener('click', () => {
  if(!currentUser) return alert('Login first to reload QR');
  socket.emit('init-client',{ username: currentUser });
});

// Socket Init
function initSocket(){
  socket.emit('init-client',{ username: currentUser });

  // QR
  socket.on('qr', data => {
    qrStatus.textContent='Scan QR with WhatsApp';
    const ctx = qrCanvas.getContext('2d');
    const img = new Image();
    img.src = data.qr;
    img.onload = ()=>{ qrCanvas.width=img.width; qrCanvas.height=img.height; ctx.drawImage(img,0,0); };
  });

  socket.on('ready', ()=>{ qrStatus.textContent='WhatsApp Ready'; });
  socket.on('login-successful', data => { qrStatus.textContent=`Logged in as ${data.name}`; });

  // AI Replies
  socket.on('ai-reply', msg => {
    const p = document.createElement('p');
    p.textContent = msg;
    aiLogs.prepend(p);
  });

  // Auto-refresh QR every 5 minutes
  qrInterval = setInterval(() => {
    if(currentUser) socket.emit('init-client',{ username: currentUser });
  }, 5*60*1000);
}

// Save Settings
saveSettings.addEventListener('click', async () => {
  const toggles = { current: toggleNew.checked, previous: togglePrev.checked };
  const instructions = aiInstructions.value;
  await fetch('/saveInstructions',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username: currentUser, instructions }) });
  await fetch('/saveToggles',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username: currentUser, toggles }) });
  alert('Settings saved!');
});
