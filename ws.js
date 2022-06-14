const mqtt = require("mqtt");
const { WebSocketServer } = require("ws");
const wss = new WebSocketServer({ port: 9001 });
wss.on("connection", ws => {
	console.log("conn!!");
	ws.on("message", data => {
		console.log(data.toString("utf-8"));
		wss.clients.forEach(client => {
			client.send("hi, there!!");
		});
	});
});
const sub = mqtt.connect("mqtt://dev.mnemosyne.co.kr");
sub.subscribe("dangsan");
sub.on("message", (topic, message) => {
	console.log(topic.toString(), message.toString());
});
