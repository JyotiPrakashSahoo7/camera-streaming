// ADMIN SIDE
const socket = io();
let pc = null;
let mediaRecorder = null;
let chunks = [];

const videoEl = document.getElementById("video");
const locText = document.getElementById("locText");

// MAP
let map = L.map("map").setView([20.5937, 78.9629], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
let marker = null;

// TELL SERVER ADMIN IS READY
socket.emit("admin-ready");
console.log("Admin ready sent");

// CREATE ADMIN PEER CONNECTION
function createAdminPC() {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("ice-candidate", e.candidate);
  };

  pc.ontrack = (event) => {
    console.log("TRACK RECEIVED");
    videoEl.srcObject = event.streams[0];
  };

  return pc;
}

// WHEN OFFER COMES FROM USER
socket.on("offer", async (offer) => {
  if (pc) {
    try { pc.close(); } catch (e) {}
  }

  pc = createAdminPC();

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("answer", answer);
  console.log("Answer sent");
});

// ICE
socket.on("ice-candidate", async (candidate) => {
  if (pc) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){}
  }
});

// LOCATION
socket.on("location", (loc) => {
  locText.textContent = `Lat: ${loc.lat}, Lon: ${loc.lon}`;

  if (marker) marker.remove();
  marker = L.marker([loc.lat, loc.lon]).addTo(map);
  map.setView([loc.lat, loc.lon], 12);
});

// RECORDING
const startBtn = document.getElementById("startRec");
const stopBtn = document.getElementById("stopRec");

startBtn.onclick = () => {
  if (!videoEl.srcObject) return alert("No video stream");

  chunks = [];
  mediaRecorder = new MediaRecorder(videoEl.srcObject);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recorded.webm";
    a.click();
  };

  mediaRecorder.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  if (mediaRecorder) mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};
