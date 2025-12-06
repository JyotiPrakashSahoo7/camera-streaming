const socket = io();
socket.emit("role", { role: "admin", name: "Admin" });

let pc = null;
let currentUser = null;
let mediaRecorder = null;
let chunks = [];

const videoEl = document.getElementById("video");

// Map setup
const map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker = null;

// AUTO-SELECT THE ONLY USER
socket.on("user-list", (list) => {
    if (list.length === 0) {
        currentUser = null;
        videoEl.srcObject = null;
        return;
    }

    // Always auto-connect to the FIRST USER
    currentUser = list[0].id;
});

// RECEIVE OFFER AUTOMATICALLY (NO CLICK REQUIRED)
socket.on("offer", async (data) => {
    if (data.from !== currentUser) return;

    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    pc.ontrack = (event) => {
        videoEl.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", {
                candidate: event.candidate,
                to: currentUser
            });
        }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", { answer, to: currentUser });
});

// ADD ICE CANDIDATE
socket.on("ice-candidate", async (data) => {
    if (pc && data.from === currentUser) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// LOCATION UPDATE WITHOUT CLICK
socket.on("location", (loc) => {
    if (loc.from !== currentUser) return;

    document.getElementById("locText").innerText =
        `Lat: ${loc.lat}, Lon: ${loc.lon}`;

    if (marker) marker.remove();
    marker = L.marker([loc.lat, loc.lon]).addTo(map);
    map.setView([loc.lat, loc.lon], 14);
});

// RECORDING
document.getElementById("startRec").onclick = () => {
    if (!videoEl.srcObject) return alert("No video available!");

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
    if (mediaRecorder) mediaRecorder.stop();
    document.getElementById("startRec").disabled = false;
    document.getElementById("stopRec").disabled = true;
};
