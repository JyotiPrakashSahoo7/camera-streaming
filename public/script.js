const socket = io();
socket.emit("role", { role: "user", name: "user-" + Math.floor(Math.random() * 9999) });

let pc = null;
let localStream = null;

async function startConnection() {
    if (pc) pc.close();
    pc = new RTCPeerConnection();

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", { candidate: event.candidate, to: "admin" });
        }
    };

    // Only video (NO AUDIO)
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
    });

    document.getElementById("camera").srcObject = localStream;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", { offer });
}

socket.on("answer", async (data) => {
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on("ice-candidate", async (data) => {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
});

// Send location repeatedly
setInterval(() => {
    navigator.geolocation.getCurrentPosition(pos => {
        socket.emit("location", {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
        });
    });
}, 5000);

startConnection();
