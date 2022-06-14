const mqtt = require("mqtt");
const { WebSocketServer } = require("ws");
const wss = new WebSocketServer({ port: 9001 });
const topics = {};
wss.on("connection", (ws) => {
  console.log("conn!!");
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
      topics[json.topic] = true;
      if (ws.mqtt == undefined) ws.mqtt = {};
      ws.mqtt[json.topic] = true;
    }
    if (json.command == "publish") {
      console.log("subscribe");
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
    }
  });
});
const sub = mqtt.connect("mqtt://dev.mnemosyne.co.kr");
sub.subscribe("dangsan");
sub.on("message", (topic, message) => {
  console.log(topic.toString(), message.toString());
});