require("dotenv").config();

const express = require("express");
const speech = require("@google-cloud/speech");
const { Translate } = require("@google-cloud/translate").v2;
const axios = require("axios");
const { Storage } = require("@google-cloud/storage");
const { v4: uuidv4 } = require("uuid");

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
const storage = new Storage();
const myBucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

var post_id = "";
var publicUrl = "";
var options = {};

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
  client.on("returnScore", function () {
    returnScore(client);
    console.log("returnScore");
    console.log("PUBLIC", publicUrl);
    // client.emit("publishScore", (98.9192).toFixed(2));
  });
  client.on("saveData", function (data) {
    var uuid = uuidv4();
    const file = myBucket.file(`${uuid}.wav`);
    const stream = file
      .createWriteStream({
        metadata: {
          contentType: "audio/wav",
        },
      })
      .on("finish", () => {
        // publicUrl = `https://storage.googleapis.com/${myBucket.name}/${uuid}.wav`;
        publicUrl =
          "https://storage.googleapis.com/thefluentme01.appspot.com/audio/test/example_user_recording.wav";
      });
    stream.write(data);
    stream.end();
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
        options = {
          method: "POST",
          url: "https://thefluentme.p.rapidapi.com/post",
          headers: {
            "content-type": "application/json",
            "X-RapidAPI-Key": process.env.API_KEY,
            "X-RapidAPI-Host": "thefluentme.p.rapidapi.com",
          },
          data: {
            post_language_id: "20",
            post_title: "Test case",
            post_content: `${text}`,
          },
        };
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

function returnScore(client) {
  axios
    .request(options)
    .then(function (response) {
      console.log("TEXT", text);
      post_id = response.data.post_id;
      console.log(response.data.post_id);
      const score = {
        method: "POST",
        url: `https://thefluentme.p.rapidapi.com/score/${post_id}`,
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Key": process.env.API_KEY,
          "X-RapidAPI-Host": "thefluentme.p.rapidapi.com",
        },
        data: { audio_provided: `${publicUrl}` },
      };
      axios
        .request(score)
        .then(function (response) {
          pub =
            response.data[1].overall_result_data[0].overall_points.toFixed(2);
          console.log(
            "POINTS",
            response.data[1].overall_result_data[0].overall_points
          );
          client.emit("publishScore", pub);
        })
        .catch(function (error) {
          console.error(error);
        });
    })
    .catch(function (error) {
      console.log("TEXT", text);
      console.error(error);
    });
}
