const socket = io.connect();

let bufferSize = 2048,
  AudioContext,
  context,
  processor,
  input,
  globalStream,
  blob,
  data,
  url;

let resultText = document.getElementById("ResultText"),
  translatedText = document.getElementById("TranslatedText"),
  streamStreaming = false;

const constraints = {
  audio: true,
  video: false,
};

async function initRecording() {
  socket.emit("startGoogleCloudStream", "");
  streamStreaming = true;
  AudioContext = window.AudioContext || window.webkitAudioContext;
  context = new AudioContext({
    latencyHint: "interactive",
  });

  await context.audioWorklet.addModule(
    "./assets/js/recorderWorkletProcessor.js"
  );
  context.resume();

  globalStream = await navigator.mediaDevices.getUserMedia(constraints);
  input = context.createMediaStreamSource(globalStream);
  processor = new window.AudioWorkletNode(context, "recorder.worklet");
  processor.connect(context.destination);
  context.resume();
  input.connect(processor);
  processor.port.onmessage = (e) => {
    const audioData = e.data;
    microphoneProcess(audioData);
  };

  const handleSuccess = function (stream) {
    const options = { mimeType: "audio/webm" };
    const recordedChunks = [];
    const mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.addEventListener("dataavailable", function (e) {
      if (e.data.size > 0) recordedChunks.push(e.data);
    });

    mediaRecorder.addEventListener("stop", function () {
      blob = new Blob(recordedChunks, { type: "audio/wav" });
      console.log(blob);
      socket.emit("saveData", blob);
    });

    stopButton.addEventListener("click", function () {
      try {
        mediaRecorder.stop();
      } catch (e) {
        console.log(e);
      }
    });

    mediaRecorder.start();
  };

  navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then(handleSuccess);
}

function microphoneProcess(buffer) {
  socket.emit("binaryData", buffer);
}

var startButton = document.getElementById("startRecButton");
startButton.addEventListener("click", startRecording);

var stopButton = document.getElementById("stopRecButton");
stopButton.addEventListener("click", stopRecording);

var scoreButton = document.getElementById("score-button");
scoreButton.addEventListener("click", returnScore);

var recordingStatus = document.getElementById("recordingStatus");

function startRecording() {
  startButton.style.display = "none";
  stopButton.style.display = "block";
  recordingStatus.style.display = "flex";
  initRecording();
  resultText.lastElementChild.innerText = "Processing...";
  translatedText.lastElementChild.innerText = "Processing...";
}

function stopRecording() {
  startButton.style.display = "block";
  stopButton.style.display = "none";
  recordingStatus.style.display = "none";
  streamStreaming = false;
  socket.emit("endGoogleCloudStream", "");
  scoreButton.disabled = false;

  let track = globalStream.getTracks()[0];
  // console.log(track);
  track.stop();

  input.disconnect(processor);
  processor.disconnect(context.destination);
  context.close().then(function () {
    input = null;
    processor = null;
    context = null;
    AudioContext = null;
    startButton.disabled = false;
  });
}

function returnScore() {
  document.getElementById("score-output").innerHTML = "...";
  if (streamStreaming) stopRecording();
  // console.log(url);
  socket.emit("returnScore", "");
}

socket.on("publishScore", function (data) {
  document.getElementById("score-output").innerHTML = data;
});

socket.on("connect", function (data) {
  socket.emit("join", "Server Connected to Client");
});

socket.on("speechData", function (data) {
  let wholeString = data.results[0].alternatives[0].transcript;
  resultText.lastElementChild.innerText = wholeString;
});

socket.on("translatedData", function (text) {
  translatedText.lastElementChild.innerText = text;
});

window.onbeforeunload = function () {
  if (streamStreaming) {
    socket.emit("endGoogleCloudStream", "");
  }
};

function convertFloat32ToInt16(buffer) {
  let l = buffer.length;
  let buf = new Int16Array(l / 3);

  while (l--) {
    if (l % 3 == 0) {
      buf[l / 3] = buffer[l] * 0xffff;
    }
  }
  return buf.buffer;
}
