const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

// Setup multer to save uploaded recordings to ./recordings
const uploadDir = path.join(__dirname, "recordings");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Endpoint to accept recording uploads (from admin)
app.post("/upload-recording", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  return res.json({ ok: true, path: `/recordings/${req.file.filename}` });
});

// Serve recordings directory (optional; careful with access)
app.use("/recordings", express.static(uploadDir));

// Keep lists of connected sockets by role
const users = new Map();  // socketId -> { role: 'user'|'admin', name? }

function broadcastUserList() {
  // Provide simplified user list to admins
  const list = [];
  for (const [id, info] of users.entries()) {
    if (info.role === "user") list.push({ id, name: info.name || id });
  }
  io.to("admin").emit("user-list", list);
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // initial default
  users.set(socket.id, { role: "unknown" });
  broadcastUserList();

  socket.on("role", (data) => {
    // data can be "admin" or "user" or { role, name }
    if (typeof data === "string") {
      users.set(socket.id, { role: data });
      socket.join(data);
    } else if (typeof data === "object") {
      users.set(socket.id, { role: data.role, name: data.name });
      socket.join(data.role);
    }
    console.log(`${socket.id} set role`, users.get(socket.id));
    broadcastUserList();
  });

  // WebRTC signaling
  // user sends offer -> forwarded to admin(s) with from id
  socket.on("offer", (payload) => {
    // payload: { offer }
    io.to("admin").emit("offer", { ...payload, from: socket.id });
  });

  // admin sends answer to a specific user
  socket.on("answer", (payload) => {
    // payload: { answer, to } where to is user socket id
    if (payload && payload.to) {
      io.to(payload.to).emit("answer", { answer: payload.answer, from: socket.id });
    }
  });

  // ICE candidates: { candidate, to } where to optional; if omitted broadcast appropriately
  socket.on("ice-candidate", (payload) => {
    // payload: { candidate, to }
    if (payload && payload.to) {
      io.to(payload.to).emit("ice-candidate", { candidate: payload.candidate, from: socket.id });
    } else {
      // if no target, broadcast to other side(s)
      io.emit("ice-candidate", { candidate: payload.candidate, from: socket.id });
    }
  });

  // Admin can instruct a specific user to switch mode: audio or video
  // payload: { to: userSocketId, mode: "audio"|"video"|"both" }
  socket.on("set-mode", (payload) => {
    if (payload && payload.to && payload.mode) {
      io.to(payload.to).emit("set-mode", { mode: payload.mode, from: socket.id });
    }
  });

  // forward location updates from user to admin
  socket.on("location", (loc) => {
    // loc: { lat, lon, ... }
    io.to("admin").emit("location", { ...loc, from: socket.id });
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    console.log("Disconnected:", socket.id);
    broadcastUserList();
  });
});

// Render PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
