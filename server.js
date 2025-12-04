const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("A user connected: " + socket.id);
    socket.on("camera-frame", (data) => {
        io.emit("stream", data);
    });
    socket.on("disconnect", () => {
        console.log("User disconnected: " + socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
