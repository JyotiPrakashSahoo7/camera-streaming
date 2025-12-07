// ADMIN SIDE
const socket = io();

let pc = null;
let mediaRecorder = null;
let chunks = [];

const videoEl = document.getElementById("video");
const locText = document.getElementById("locText");

// Map setup
const map = L.map("map").setView([20.5937, 78.9629], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
let marker = null;

// Receive OFFER from user (AUTO, no clicking)
socket.on("offer", async (offer) => {
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", event.candidate);
    }
  };

  pc.ontrack = (event) => {
    videoEl.srcObject = event.streams[0];
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", answer);
});

// Receive ICE from user
socket.on("ice-candidate", async (candidate) => {
  if (!pc) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Error adding ICE in admin:", err);
  }
});

// Receive LOCATION from user
socket.on("location", (loc) => {
  locText.textContent = `Lat: ${loc.lat}, Lon: ${loc.lon}`;

  if (marker) marker.remove();
  marker = L.marker([loc.lat, loc.lon]).addTo(map);
  map.setView([loc.lat, loc.lon], 12);
});

// RECORDING (download to admin machine)
const startBtn = document.getElementById("startRec");
const stopBtn = document.getElementById("stopRec");

startBtn.onclick = () => {
  if (!videoEl.srcObject) return alert("No video to record");

  chunks = [];
  mediaRecorder = new MediaRecorder(videoEl.srcObject);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-recording.webm";
    a.click();
  };

  mediaRecorder.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
};
