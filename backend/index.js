require('dotenv').config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs-extra");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { initWhatsAppClient, clients } = require("./whatsappClient");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Absolute paths
const USERS_FILE = path.join(__dirname, "users.json");
const AI_REPLIES_FILE = path.join(__dirname, "ai-replies.json");

// Ensure files exist
if (!fs.existsSync(USERS_FILE)) fs.writeJsonSync(USERS_FILE, {});
if (!fs.existsSync(AI_REPLIES_FILE)) fs.writeJsonSync(AI_REPLIES_FILE, []);

// Load users and AI replies
let users = fs.readJsonSync(USERS_FILE);
let aiReplies = fs.readJsonSync(AI_REPLIES_FILE);

// Helper to save AI replies
function saveAIReplies() {
  fs.writeJsonSync(AI_REPLIES_FILE, aiReplies);
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Handle favicon
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '../frontend', 'favicon.ico')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// --- AUTH ---
app.post("/register", (req, res) => {
  const { username, password, secret } = req.body;
  if (secret !== process.env.REGISTER_SECRET) {
    return res.json({ success: false, msg: "Invalid secret code" });
  }
  if (users[username]) return res.json({ success: false, msg: "User exists" });

  users[username] = { password, instructions: "", toggles: { current: true, previous: true } };
  fs.writeJsonSync(USERS_FILE, users);
  res.json({ success: true });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!users[username] || users[username].password !== password) {
    return res.json({ success: false, msg: "Invalid credentials" });
  }
  res.json({ success: true, user: username });
});

app.post("/saveInstructions", (req, res) => {
  const { username, instructions } = req.body;
  if (users[username]) {
    users[username].instructions = instructions;
    fs.writeJsonSync(USERS_FILE, users);
    return res.json({ success: true });
  }
  res.json({ success: false });
});

app.post("/saveToggles", (req, res) => {
  const { username, toggles } = req.body;
  if (users[username]) {
    users[username].toggles = toggles;
    fs.writeJsonSync(USERS_FILE, users);
    return res.json({ success: true });
  }
  res.json({ success: false });
});

// --- LOGOUT WhatsApp ---
app.post("/logoutWhatsApp", async (req, res) => {
  const { username } = req.body;
  if (clients[username]) {
    try {
      await clients[username].destroy();
      delete clients[username];
      return res.json({ success: true });
    } catch (err) {
      return res.json({ success: false, msg: err.message });
    }
  }
  res.json({ success: false, msg: "No active session" });
});

// --- SOCKET.IO ---
io.on("connection", (socket) => {
  console.log("New socket connected");

  socket.on("init-client", async ({ username }) => {
    // Destroy previous client if exists
    if (clients[username]) {
      try {
        await clients[username].destroy();
        delete clients[username];
      } catch (err) {
        console.error("Error destroying previous client:", err);
      }
    }
    await initWhatsAppClient(username, socket);
    socket.emit("load-ai-replies", aiReplies);
  });

  socket.on("ai-reply", (msg) => {
    aiReplies.push(msg);
    saveAIReplies();
    io.emit("ai-reply", msg);
  });
});

// ✅ Render dynamic port or fallback to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
