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

// Simple signaling and request-offer flow:
// - user: sends 'offer' (on start or when requested)
// - admin: when ready, emits 'admin-ready' -> server broadcasts 'request-offer'
// - server forwards offer/answer/ice between peers using broadcast (except sender)

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // When admin is ready, tell users to send an offer (so admin won't miss it)
  socket.on("admin-ready", () => {
    console.log("Admin ready -> ask users to send offers");
    // Tell all other clients (users) to create & send a fresh offer
    socket.broadcast.emit("request-offer");
  });

  // User (or any client) sends an offer
  socket.on("offer", (offer) => {
    // forward to everyone except sender (admin will receive it)
    socket.broadcast.emit("offer", offer);
  });

  // Admin (or any client) sends answer
  socket.on("answer", (answer) => {
    socket.broadcast.emit("answer", answer);
  });

  // ICE candidates (both ways)
  socket.on("ice-candidate", (candidate) => {
    socket.broadcast.emit("ice-candidate", candidate);
  });

  // Location messages (user -> admin)
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
