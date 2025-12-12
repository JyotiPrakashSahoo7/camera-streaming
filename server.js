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

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ADMIN READY -> ASK USERS TO SEND OFFER
  socket.on("admin-ready", () => {
    console.log("Admin is ready -> requesting offer from users");
    socket.broadcast.emit("request-offer");
  });

  // USER OFFER
  socket.on("offer", (offer) => {
    socket.broadcast.emit("offer", offer);
  });

  // ADMIN ANSWER
  socket.on("answer", (answer) => {
    socket.broadcast.emit("answer", answer);
  });

  // ICE BOTH WAYS
  socket.on("ice-candidate", (candidate) => {
    socket.broadcast.emit("ice-candidate", candidate);
  });

  // LOCATION
  socket.on("location", (loc) => {
    socket.broadcast.emit("location", loc);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
