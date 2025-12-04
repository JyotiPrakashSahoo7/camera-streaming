const socket = io();
socket.emit("role", "admin");

let pc = null;
let selectedUser = null;
let mediaRecorder = null;
let recordedChunks = [];

// UI elements
const usersDiv = document.getElementById("users");
const videoEl = document.getElementById("video");
const btnAudioOnly = document.getElementById("btn-audio-only");
const btnVideoAudio = document.getElementById("btn-video-audio");
const startRecBtn = document.getElementById("startRec");
const stopRecBtn = document.getElementById("stopRec");
const locText = document.getElementById("locText");

// Map (Leaflet)
const map = L.map('map').setView([20.5937, 78.9629], 4); // India center initial
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);
let userMarker = null;

// Update user list from server
socket.on("user-list", (list) => {
  usersDiv.innerHTML = "";
  if (!list || list.length === 0) {
    usersDiv.innerHTML = "<em>No users</em>";
    return;
  }
  list.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerText = `${u.name} (${u.id})`;
    div.onclick = () => selectUser(u.id, div);
    usersDiv.appendChild(div);
  });
});

function selectUser(id, elem) {
  selectedUser = id;
  // highlight
  Array.from(usersDiv.children).forEach(ch => ch.classList.remove("selected"));
  elem.classList.add("selected");
  // reset existing peer and video
  if (pc) { try { pc.close(); } catch(e){} pc = null; }
  videoEl.srcObject = null;
  // Ask user to start (if needed) - actually user auto-offers on connect; admin waits for offer event
  console.log("Selected user:", selectedUser);
}

// When a user sends an offer (they usually do on connect or on mode change)
socket.on("offer", async (data) => {
  // data: { offer, from }
  // If no selected user or different user, ignore unless admin wants to view
  if (!selectedUser) {
    console.log("Offer received but no user selected; ignoring. from:", data.from);
    return;
  }
  if (data.from !== selectedUser) {
    console.log("Offer from other user:", data.from, "selected:", selectedUser);
    return;
  }

  // create new peer connection
  pc = new RTCPeerConnection();

  pc.ontrack = (event) => {
    videoEl.srcObject = event.streams[0];
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { candidate: event.candidate, to: selectedUser });
    }
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    // send answer to the user
    socket.emit("answer", { answer, to: data.from });
    console.log("Sent answer to user:", data.from);
  } catch (err) {
    console.error("Error handling offer:", err);
  }
});

// ICE candidate from user
socket.on("ice-candidate", async (data) => {
  if (!pc) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (err) {
    console.warn("Error adding ICE candidate (admin):", err);
  }
});

// Location updates from user
socket.on("location", (data) => {
  // data: { lat, lon, from }
  locText.innerText = `User ${data.from}: lat ${data.lat}, lon ${data.lon}`;
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([data.lat, data.lon]).addTo(map).bindPopup(`User: ${data.from}`).openPopup();
  map.setView([data.lat, data.lon], 13);
});

// Buttons: set modes
btnAudioOnly.onclick = () => {
  if (!selectedUser) return alert("Select a user first");
  socket.emit("set-mode", { to: selectedUser, mode: "audio" });
};
btnVideoAudio.onclick = () => {
  if (!selectedUser) return alert("Select a user first");
  socket.emit("set-mode", { to: selectedUser, mode: "both" });
};

// Recording functions (record remote stream shown in videoEl)
startRecBtn.onclick = () => {
  if (!videoEl.srcObject) return alert("No stream to record");
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(videoEl.srcObject);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    // send to server via fetch (FormData)
    const form = new FormData();
    const filename = `recording-${selectedUser || "unknown"}-${Date.now()}.webm`;
    form.append("file", blob, filename);
    try {
      const res = await fetch("/upload-recording", { method: "POST", body: form });
      const data = await res.json();
      if (data && data.ok) {
        alert("Saved recording on server: " + data.path);
      } else {
        alert("Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload error");
    }
  };
  mediaRecorder.start();
  startRecBtn.disabled = true;
  stopRecBtn.disabled = false;
};

stopRecBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  startRecBtn.disabled = false;
  stopRecBtn.disabled = true;
};
