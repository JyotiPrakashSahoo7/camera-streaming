const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static("public"));

const users = new Map();

function sendUserList() {
    const list = [];
    for (const [id, info] of users.entries()) {
        if (info.role === "user") list.push({ id, name: info.name || id });
    }
    io.to("admin").emit("user-list", list);
}

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    users.set(socket.id, { role: "unknown" });
    sendUserList();

    socket.on("role", (data) => {
        if (typeof data === "object") {
            users.set(socket.id, { role: data.role, name: data.name });
            socket.join(data.role);
        }
        sendUserList();
    });

    // WebRTC signaling
    socket.on("offer", (data) => {
        io.to("admin").emit("offer", { offer: data.offer, from: socket.id });
    });

    socket.on("answer", (data) => {
        io.to(data.to).emit("answer", { answer: data.answer });
    });

    socket.on("ice-candidate", (data) => {
        io.to(data.to).emit("ice-candidate", { candidate: data.candidate });
    });

    // Location forwarding
    socket.on("location", (loc) => {
        io.to("admin").emit("location", { ...loc, from: socket.id });
    });

    socket.on("disconnect", () => {
        users.delete(socket.id);
        sendUserList();
        console.log("Disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
