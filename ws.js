const mqtt = require("mqtt");
const { WebSocketServer } = require("ws");
const wss = new WebSocketServer({ port: 9001 });
const sub = mqtt.connect("mqtt://dev.mnemosyne.co.kr");
const topics = {};
const request = require("request");
sub.subscribe("TZLOG");
sub.subscribe("TZ_ANDROID_LOG");
sub.subscribe("TZ_APPLE_LOG");
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
  ws.on("message", (data) => {
    let json;
    try {
      json = JSON.parse(data);
    } catch (e) {
      console.log(e);
      console.log(data.toString("utf-8"));
      return;
    }
    if (json.command == "subscribe") {
      console.log("subscribe");
      if (topics[json.topic] == undefined) sub.subscribe(json.topic);
      topics[json.topic] = true;
      if (ws.mqtt == undefined) ws.mqtt = {};
      ws.mqtt[json.topic] = true;
    }
    if (json.command == "publish") {
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
  });
});

sub.on("message", (topic, message) => {
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
  setLog(strTopic, strMessage);
});
function setLog(topic, message) {
  let json;
  try {
    json = JSON.parse(message);
    if (!json.parameter)
      json.parameter = JSON.stringify({
        LOGID: new Date().getTime().toString(),
      });
    const logParam = {
      type: "command",
      sub_type: json.subType || "",
      device_id: json.deviceId || "",
      device_token: "noToken",
      golf_club_id: json.clubId || "",
      message: message.replace(/\'/g, "\\'"),
      parameter: json.parameter || {},
      timestamp: json.timestamp || new Date().getTime(),
      noPub: true,
    };
    TZLOG(logParam);
  } catch (e) {
    console.log(message);
    console.log(e);
    const logParam = {
      type: "command",
      sub_type: "temp",
      device_id: json.deviceId || "",
      device_token: "noToken",
      golf_club_id: json.clubId || "",
      message: message.replace(/\'/g, "\\'"),
      parameter: JSON.parse(json.parameter) || {},
      noPub: true,
    };
    TZLOG(logParam);
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
