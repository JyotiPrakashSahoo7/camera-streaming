// USER SIDE
const socket = io();
let pc = null;

function createUserPC(stream) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("ice-candidate", e.candidate);
  };

  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  return pc;
}

async function sendOffer() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  document.getElementById("camera").srcObject = stream;

  pc = createUserPC(stream);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", offer);
  console.log("Offer sent");
}

// ADMIN ASKS FOR OFFER
socket.on("request-offer", () => {
  console.log("Admin requested offer");
  sendOffer();
});

// ADMIN ANSWER
socket.on("answer", async (answer) => {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// ICE
socket.on("ice-candidate", async (candidate) => {
  if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

// LOCATION SEND
setInterval(() => {
  navigator.geolocation.getCurrentPosition((pos) => {
    socket.emit("location", {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude
    });
  });
}, 5000);

// INITIAL OFFER
sendOffer();
