const socket = io.connect();

let bufferSize = 2048,
  AudioContext,
  context,
  processor,
  input,
  globalStream;

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
}

function microphoneProcess(buffer) {
  socket.emit("binaryData", buffer);
}

var startButton = document.getElementById("startRecButton");
startButton.addEventListener("click", startRecording);

var stopButton = document.getElementById("stopRecButton");
stopButton.addEventListener("click", stopRecording);

var recordingStatus = document.getElementById("recordingStatus");

function startRecording() {
  startButton.style.display = "none";
  stopButton.style.display = "block";
  recordingStatus.style.display = "flex";
  initRecording();
}

function stopRecording() {
  startButton.style.display = "block";
  stopButton.style.display = "none";
  recordingStatus.style.display = "none";
  streamStreaming = false;
  socket.emit("endGoogleCloudStream", "");

  let track = globalStream.getTracks()[0];
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
