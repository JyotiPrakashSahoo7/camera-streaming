const img = document.getElementById("liveFeed");
const socket = io();

// Identify this socket as ADMIN
socket.emit("role", "admin");

// Receive only admin stream
socket.on("stream", (data) => {
    img.src = data;
});
