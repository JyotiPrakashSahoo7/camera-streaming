const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

// IMPORTANT: Allow CORS for Socket.io on Render
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

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

// FIXED: Render requires dynamic PORT
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
