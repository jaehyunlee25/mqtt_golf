const mqtt = require("mqtt");
const { WebSocketServer } = require("ws");
const wss = new WebSocketServer({ port: 9001 });
const sub = mqtt.connect("mqtt://dev.mnemosyne.co.kr");
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
      if (topics[json.topic] == undefined) sub.subscribe("dangsan");
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
  console.log(topic.toString(), message.toString());
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
});
