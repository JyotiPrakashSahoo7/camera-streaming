const socket = io();

// FIXED: Admin must send role as an OBJECT
socket.emit("role", { role: "admin", name: "Admin" });

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

// =============================
// SHOW USER LIST
// =============================
socket.on("user-list", (list) => {
    usersDiv.innerHTML = "";

    if (list.length === 0) {
        usersDiv.innerHTML = "<p>No users online</p>";
        return;
    }

    list.forEach(u => {
        const div = document.createElement("div");
        div.className = "user-item";
        div.innerText = u.name + " (" + u.id + ")";
        div.onclick = () => selectUser(u.id, div);
        usersDiv.appendChild(div);
    });
});

// =============================
// SELECT USER
// =============================
function selectUser(id, div) {
    selectedUser = id;

    document.querySelectorAll(".user-item").forEach(e =>
        e.classList.remove("selected")
    );
    div.classList.add("selected");

    if (pc) pc.close();
    videoEl.srcObject = null;
}

// =============================
// RECEIVE OFFER FROM USER
// =============================
socket.on("offer", async (data) => {
    if (data.from !== selectedUser) return;

    pc = new RTCPeerConnection();

    pc.ontrack = (event) => {
        videoEl.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", {
                candidate: event.candidate,
                to: selectedUser
            });
        }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", { answer, to: selectedUser });
});

// =============================
// ADD ICE CANDIDATE
// =============================
socket.on("ice-candidate", async (data) => {
    if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
});

// =============================
// LOCATION UPDATES
// =============================
socket.on("location", (loc) => {
    if (loc.from !== selectedUser) return;

    document.getElementById("locText").innerText =
        `Lat: ${loc.lat}, Lon: ${loc.lon}`;

    if (marker) marker.remove();

    marker = L.marker([loc.lat, loc.lon]).addTo(map);
    map.setView([loc.lat, loc.lon], 13);
});

// =============================
// RECORDING CONTROLS
// =============================
document.getElementById("startRec").onclick = () => {
    if (!videoEl.srcObject) return alert("No video to record!");

    chunks = [];

    mediaRecorder = new MediaRecorder(videoEl.srcObject);

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

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
