// public/admin.js  (ADMIN)
const socket = io();
let pc = null;
let mediaRecorder = null;
let chunks = [];

const videoEl = document.getElementById("video");
const locText = document.getElementById("locText");

// map init
const map = L.map("map").setView([20.5937, 78.9629], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
let marker = null;

// Tell server (and thus users) that admin is ready to receive offers
socket.emit("admin-ready");
console.log("Admin: signalled admin-ready to server");

// Create PeerConnection factory for admin
function createAdminPC() {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("ice-candidate", e.candidate);
      console.log("Admin: emitted ICE candidate");
    }
  };

  pc.ontrack = (event) => {
    console.log("Admin: track received");
    videoEl.srcObject = event.streams[0];
  };

  return pc;
}

// When an offer arrives from a user, simply answer and attach tracks
socket.on("offer", async (offer) => {
  try {
    // close previous pc if any
    if (pc) {
      try { pc.close(); } catch(e) {}
      pc = null;
      videoEl.srcObject = null;
    }

    pc = createAdminPC();

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", answer);
    console.log("Admin: answer sent");
  } catch (err) {
    console.error("Admin: error handling offer:", err);
  }
});

// ICE from user
socket.on("ice-candidate", async (candidate) => {
  try {
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("Admin: added remote ICE");
    }
  } catch (err) {
    console.warn("Admin addIceCandidate failed", err);
  }
});

// location updates
socket.on("location", (loc) => {
  locText.textContent = `Lat: ${loc.lat}, Lon: ${loc.lon}`;
  if (marker) marker.remove();
  marker = L.marker([loc.lat, loc.lon]).addTo(map);
  map.setView([loc.lat, loc.lon], 12);
});

// Recording controls (download to admin machine)
const startBtn = document.getElementById("startRec");
const stopBtn = document.getElementById("stopRec");

startBtn.onclick = () => {
  if (!videoEl.srcObject) return alert("No video to record");
  chunks = [];
  mediaRecorder = new MediaRecorder(videoEl.srcObject);
  mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
  };
  mediaRecorder.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};
