const video = document.getElementById("camera");
const socket = io();

// Identify this device as normal USER
socket.emit("role", "user");

navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        setInterval(() => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const frame = canvas.toDataURL("image/jpeg", 0.5);

            // Send camera frame to server
            socket.emit("camera-frame", frame);
        }, 80); // ~12 FPS
    })
    .catch(err => {
        alert("Camera permission denied!");
        console.log(err);
    });
