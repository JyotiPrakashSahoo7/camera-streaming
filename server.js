// server.js
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

// Very simple signaling: broadcast to everyone except sender
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // WebRTC offer from USER -> broadcast (ADMIN will listen)
  socket.on("offer", (offer) => {
    socket.broadcast.emit("offer", offer);
  });

  // WebRTC answer from ADMIN -> broadcast (USER will listen)
  socket.on("answer", (answer) => {
    socket.broadcast.emit("answer", answer);
  });

  // ICE candidates both ways
  socket.on("ice-candidate", (candidate) => {
    socket.broadcast.emit("ice-candidate", candidate);
  });

  // Location from user -> admin
  socket.on("location", (loc) => {
    socket.broadcast.emit("location", loc);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
