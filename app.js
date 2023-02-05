require("dotenv").config();

const express = require("express");
const speech = require("@google-cloud/speech");
const { Translate } = require("@google-cloud/translate").v2;

const app = express();
try {
  var server = app.listen(process.env.PORT, () => {
    console.log("Connected to the server on port", process.env.PORT);
  });
} catch (e) {
  console.log(e);
}

const speechClient = new speech.SpeechClient();
const translate = new Translate();
var io = require("socket.io")(server);

app.use("/assets", express.static("public"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index", {});
});

app.use("/", function (req, res, next) {
  next();
});

io.on("connection", function (client) {
  console.log("Client Connected to server");
  let recognizeStream = null;

  client.on("join", function () {
    client.emit("messages", "Socket Connected to Server");
  });

  client.on("messages", function (data) {
    client.emit("broad", data);
  });

  client.on("startGoogleCloudStream", function (data) {
    startRecognitionStream(this, data);
  });

  client.on("endGoogleCloudStream", function () {
    stopRecognitionStream();
  });

  client.on("binaryData", function (data) {
    if (recognizeStream !== null) {
      recognizeStream.write(data);
    }
  });

  function startRecognitionStream(client) {
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on("error", console.error)
      .on("data", (data) => {
        (text = data.results[0].alternatives[0].transcript),
          // process.stdout.write(
          //   data.results[0] && data.results[0].alternatives[0]
          //     ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
          //     : "\n\nReached transcription time limit, press Ctrl+C\n"
          // );
          translateText(client);
        client.emit("speechData", data);

        if (data.results[0] && data.results[0].isFinal) {
          stopRecognitionStream();
          startRecognitionStream(client);
        }
      });
  }

  function stopRecognitionStream() {
    if (recognizeStream) {
      recognizeStream.end();
    }
    recognizeStream = null;
  }
});

const encoding = "LINEAR16";
const sampleRateHertz = 16000;
const languageCode = "en-US";

const request = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
    enableWordTimeOffsets: true,
  },
  interimResults: false,
};

var text = "";
const target = "hi";

async function translateText(client) {
  let [translations] = await translate.translate(text, target);
  translations = Array.isArray(translations) ? translations : [translations];
  client.emit("translatedData", translations);
  console.log("Translations:");
  translations.forEach((translation, i) => {
    console.log(`${text} => (${target}) ${translation}`);
  });
}
