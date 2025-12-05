const socket = io();
socket.emit("role", "admin");

let pc = null;
let selectedUser = null;
let mediaRecorder = null;
let chunks = [];

const usersDiv = document.getElementById("users");
const videoEl = document.getElementById("video");

// Map setup
const map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker = null;

// Show users
socket.on("user-list", (list) => {
    usersDiv.innerHTML = "";
    list.forEach(u => {
        const div = document.createElement("div");
        div.className = "user-item";
        div.innerText = u.name + " (" + u.id + ")";
        div.onclick = () => selectUser(u.id, div);
        usersDiv.appendChild(div);
    });
});

function selectUser(id, div) {
    selectedUser = id;

    document.querySelectorAll(".user-item").forEach(e => e.classList.remove("selected"));
    div.classList.add("selected");

    if (pc) pc.close();
    videoEl.srcObject = null;
}

// user offer
socket.on("offer", async (data) => {
    if (data.from !== selectedUser) return;

    pc = new RTCPeerConnection();

    pc.ontrack = (event) => {
        videoEl.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", { candidate: event.candidate, to: selectedUser });
        }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", { answer, to: selectedUser });
});

// ICE
socket.on("ice-candidate", async (data) => {
    if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
});

// location
socket.on("location", (loc) => {
    document.getElementById("locText").innerText =
        `Lat: ${loc.lat}, Lon: ${loc.lon}`;

    if (marker) marker.remove();
    marker = L.marker([loc.lat, loc.lon]).addTo(map);
    map.setView([loc.lat, loc.lon], 12);
});

// RECORDING
document.getElementById("startRec").onclick = () => {
    if (!videoEl.srcObject) return alert("No video");

    chunks = [];
    mediaRecorder = new MediaRecorder(videoEl.srcObject);

    mediaRecorder.ondataavailable = e => chunks.push(e.data);

    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "user-recording.webm";
        a.click();
    };

    mediaRecorder.start();
    document.getElementById("startRec").disabled = true;
    document.getElementById("stopRec").disabled = false;
};

document.getElementById("stopRec").onclick = () => {
    mediaRecorder.stop();
    document.getElementById("startRec").disabled = false;
    document.getElementById("stopRec").disabled = true;
};
