
var Transmission = require("transmission-promise");
var AWS = require("aws-sdk");
var sns = new AWS.SNS();
const parseTorrent = require('parse-torrent')

const transmission = new Transmission({
  host: process.env.TRANSMISSION_HOST,
  port: process.env.TRANSMISSION_PORT,
  username: process.env.TRANSMISSION_USER,
  password: process.env.TRANSMISSION_PASSWORD,
  ssl: true,
  url: process.env.TRANSMISSION_URL_RPC
});

exports.lambdaHandler = async (event, context) => {
  console.log("Request que ha llegado -> ");
  console.log(event);
  var body = event.Records[0].body;
  console.log("Body del request")
  console.log(body)
  var url = JSON.parse(body).torrent;
  console.log("Torrent url")
  console.log(url)
  checkHttp(url);
  let magnetUri = await convertTorrent(url);
  let result = await sendTorrent(magnetUri);
  if (result.name) {
    await publishSNS("Torrent " + result.name + " downloading", process.env.TOPIC_ARN);
  }
  else {
    await publishSNS("Torrent " + url + " not downloaded by error: " + result, process.env.TOPIC_ARN);
  }
};

function checkHttp(url) {
  if (url && !url.startsWith("http")) {
    console.log("Not start with HTTP");
    throw "Not is a torrent . Not start with HTTP"
  }
}

function sendTorrent(magnet) {
  console.log("On the function sendTorrent")
  console.log(magnet)
  return transmission.add(magnet).then(
    response => response,
    error => error
  )
}

function convertTorrent(uri) {
  return new Promise(function (resolve, reject) {
    parseTorrent.remote(
      uri, { timeout: 60 * 1000 }, (err, parsedTorrent) => {
        if (err) {
          throw err
        }
        else {
          resolve(parseTorrent.toMagnetURI(parsedTorrent));
        }
      })
  })
}
async function publishSNS(payload, topicArn) {
  // Message: JSON.stringify(payload),
  await sns.publish({
    Message: payload,
    TargetArn: topicArn
  }).promise().then((data) => {
    console.log('SNS push succeeded: ', data);
  }).catch((err) => {
    console.error(err);
  });
}