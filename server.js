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

// Update user list and send to admin
function sendUserList() {
    const list = [];
    for (const [id, info] of users.entries()) {
        if (info.role === "user") {
            list.push({ id, name: info.name || id });
        }
    }
    io.to("admin").emit("user-list", list);
}

// SOCKET CONNECTION
io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    users.set(socket.id, { role: "unknown" });
    sendUserList();

    // User/Admin role assignment
    socket.on("role", (data) => {
        if (typeof data === "object") {
            users.set(socket.id, { role: data.role, name: data.name });
            socket.join(data.role);
        }
        sendUserList();
    });

    // ======================================================
    // FIXED SIGNALING: WebRTC OFFER from USER → ADMIN
    // ======================================================
    socket.on("offer", (data) => {
        io.to("admin").emit("offer", {
            offer: data.offer,
            from: socket.id    // ESSENTIAL
        });
    });

    // ======================================================
    // WebRTC ANSWER from ADMIN → USER
    // ======================================================
    socket.on("answer", (data) => {
        io.to(data.to).emit("answer", {
            answer: data.answer
        });
    });

    // ======================================================
    // ICE CANDIDATE exchange (Both sides)
    // ======================================================
    socket.on("ice-candidate", (data) => {
        io.to(data.to).emit("ice-candidate", {
            candidate: data.candidate,
            from: socket.id    // important for mapping
        });
    });

    // ======================================================
    // LOCATION FORWARDING
    // ======================================================
    socket.on("location", (loc) => {
        io.to("admin").emit("location", {
            lat: loc.lat,
            lon: loc.lon,
            from: socket.id
        });
    });

    socket.on("disconnect", () => {
        users.delete(socket.id);
        sendUserList();
        console.log("Disconnected:", socket.id);
    });
});

// SERVER PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
