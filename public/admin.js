const img = document.getElementById("liveFeed");
const socket = io();
socket.on("stream", (data) => {
    img.src = data;
});