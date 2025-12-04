const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.static("public"));

// When a user connects
io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    // User identifies as admin or normal user
    socket.on("role", (roleType) => {
        socket.join(roleType);  // user joins "admin" or "user"
        console.log(socket.id, "joined role:", roleType);
    });

    // User sends camera frame → Send ONLY to admin
    socket.on("camera-frame", (data) => {
        io.to("admin").emit("stream", data);  
    });

    socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);
    });
});

// Required for Render (dynamic port)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
