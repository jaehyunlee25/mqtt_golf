const mqtt = require("mqtt");
const { WebSocketServer } = require("ws");
const wss = new WebSocketServer({ port: 9001 });
const sub = mqtt.connect("mqtt://dev.mnemosyne.co.kr");
const topics = {};
const request = require("request");
const fs = require("fs");

const slacktoken = fs.readFileSync("slacktoken").toString("utf-8").trim();

sub.subscribe("TZLOG");
sub.subscribe("TZ_ANDROID_LOG");
sub.subscribe("TZ_APPLE_LOG");
sub.on("message", mqttonmessage);
wss.on("connection", (ws) => {
  console.log("conn!!");
  ws.on("open", () => {
    console.log("socket open!");
    ws.send(Date.now());
  });
  ws.on("close", (e) => {
    console.log("disconnected");
    console.log(e);
  });
  ws.on("message", onmessage);
});

function sendslackmessage(message) {
  request(
    {
      url: "https://slack.com/api/chat.postMessage",
      method: "POST",
      headers: { Authorization: "Bearer " + slacktoken },
      body: {
        channel: "#app_result",
        text: message,
      },
      json: true,
    },
    function (error, response, body) {
      if (error) console.log(error);
      else console.log(body);
    }
  );
}
function onmessage(data) {
  let json;
  try {
    json = JSON.parse(data);
  } catch (e) {
    console.log(e);
    console.log(data.toString("utf-8"));
    return;
  }
  if (json.command == "subscribe") wssub(json);
  if (json.command == "publish") wspub(json);
}
function wspub(json) {
  console.log("publish");
  wss.clients.forEach((client) => {
    if (client.mqtt == undefined) return;
    if (client.mqtt[json.topic])
      client.send(
        JSON.stringify({
          topic: json.topic,
          message: json.message,
        })
      );
  });
  sub.publish(json.topic, json.message, { qos: 0 });
}
function wssub(json) {
  console.log("subscribe");
  if (topics[json.topic] == undefined) sub.subscribe(json.topic);
  topics[json.topic] = true;
  if (ws.mqtt == undefined) ws.mqtt = {};
  ws.mqtt[json.topic] = true;
}
function mqttonmessage(topic, message) {
  const strTopic = topic.toString("utf-8");
  const strMessage = message.toString("utf-8");
  wss.clients.forEach((client) => {
    if (client.mqtt == undefined) return;
    if (client.mqtt[strTopic])
      client.send(
        JSON.stringify({
          topic: strTopic,
          message: strMessage,
        })
      );
  });
  procMsg(strTopic, strMessage);
  setLog(strTopic, strMessage);
}
function procMsg(topic, message) {
  let json;
  try {
    json = JSON.parse(message);
    if (json.message.indexOf("app_result") != -1) proAppResult(json.message);
  } catch (e) {
    console.log(message);
    console.log(e);
    return;
  }
}
function proAppResult(msg) {
  try {
    const jsonMsg = JSON.parse(msg);
    sendslackmessage(msg);
    console.dir(jsonMsg);
  } catch (e) {
    console.log(msg);
  }
}
function setLog(topic, message) {
  let json;
  try {
    json = JSON.parse(message);
    if (!json.parameter)
      json.parameter = JSON.stringify({
        LOGID: new Date().getTime().toString(),
      });
    if (!json.timestamp) json.timestamp = new Date().getTime();
    if (json.timestamp == "undefined") json.timestamp = new Date().getTime();
    if (typeof json.timestamp == "string")
      json.timestamp = new Date().getTime();
    const logParam = {
      type: "command",
      sub_type: json.subType || "",
      device_id: json.deviceId || "",
      device_token: "noToken",
      golf_club_id: json.clubId || "",
      message: message.replace(/\'/g, "\\'"),
      parameter: json.parameter || {},
      timestamp: json.timestamp,
      noPub: true,
    };
    TZLOG(logParam);
  } catch (e) {
    console.log(message);
    console.log(e);
    return;
  }
}
function TZLOG(param, callback) {
  const OUTER_ADDR_HEADER = "https://dev.mnemosyne.co.kr";
  const addr = OUTER_ADDR_HEADER + "/api/reservation/newLog";
  // console.log(new Date().getTime(), param);
  request.post(addr, { json: param }, function (error, response, body) {
    if (error) {
      console.log("\n\n\n\n\n");
      console.log(new Date().getTime(), error);
      console.log(new Date().getTime(), param);
      console.log("\n\n\n\n\n");
    }
    if (callback) callback(data);
  });
}
