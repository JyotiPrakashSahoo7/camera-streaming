const video = document.getElementById("camera");
const socket = io();

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
            socket.emit("camera-frame", frame);
        }, 80);
    })
    .catch(err => {
        alert("Camera permission denied!");
        console.log(err);
    });
