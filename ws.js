const mqtt = require("mqtt");
const nodemailer = require("nodemailer");
const { WebSocketServer } = require("ws");
const wss = new WebSocketServer({ port: 9001 });
const sub = mqtt.connect("mqtt://dev.mnemosyne.co.kr");
const topics = {};
const request = require("request");
const fs = require("fs");
const mysql = require("mysql");

String.prototype.add = function add(str) {
  return [this, str].join("");
};
String.prototype.dp = function (param) {
  let self = this;
  const keys = Object.keys(param);
  keys.forEach((key) => {
    const regex = new RegExp("\\$\\{".add(key).add("\\}"), "g");
    const val = param[key];
    self = self.replace(regex, val);
  });
  return self;
};
String.prototype.gfdp = function (param) {
  console.log(this.toString().gf().dp(param));
  return this.toString().gf().dp(param);
};
String.prototype.jp = function () {
  return JSON.parse(this);
};
String.prototype.gf = function () {
  const path = this.toString();
  return fs.readFileSync(path, "utf-8");
};
String.prototype.gfjp = function () {
  return this.toString().gf().jp();
};
String.prototype.query = function (callback) {
  try {
    const sql = this.toString();
    const dbconf = "db.json";
    const connection = mysql.createConnection(dbconf.gfjp());
    connection.connect();
    connection.query(sql, callback);
    connection.end();
  } catch (e) {
    console.error(e);
  }
};

const slacktoken = fs.readFileSync("slacktoken").toString("utf-8").trim();

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
    onmessage(ws, data);
  });
});

sub.subscribe("TZLOG");
sub.subscribe("TZ_ANDROID_LOG");
sub.subscribe("TZ_APPLE_LOG");
sub.subscribe("TZ_MACRO_LOG");
sub.on("message", mqttonmessage);

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
      /* if (error) console.log(error);
      else console.log(body); */
    }
  );
}
function onmessage(ws, data) {
  let json;
  try {
    json = JSON.parse(data);
  } catch (e) {
    console.log(e);
    console.log(data.toString("utf-8"));
    return;
  }
  if (json.command == "subscribe") wssub(ws, json);
  if (json.command == "publish") wspub(ws, json);
}
function wspub(ws, json) {
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
function wssub(ws, json) {
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
  if (message.indexOf("script_error_in_ajax_callback") != -1)
    procScriptError(message);
  if (message.indexOf("script_error_in_system") != -1) procScriptError(message);
  if (topic == "TZ_APPLE_LOG") console.log(message);

  if (topic != "TZ_MACRO_LOG") return;
  console.log(topic);
  let json;
  try {
    json = JSON.parse(message);
    if (json.message.indexOf("app_result") != -1) procAppResult(json);
  } catch (e) {
    console.log(message);
    console.log(e);
    return;
  }
}
function procScriptError(msg) {
  const json = JSON.parse(msg);
  const clubId = json.clubId || json.golfClubId || json.golf_club_id;
  const deviceId = json.deviceId || json.device_id;
  const macroId = json.macro_id || "";
  const { message, parameter, responseText } = json;
  console.log(message);
  const [address, stack] = message;
  const { LOGID } = JSON.parse(parameter);
  console.log(LOGID);

  setLogReport(
    macroId,
    deviceId,
    clubId,
    "LOGID: " + LOGID,
    address,
    stack,
    responseText
  );
  "sql/getclub.sql".gfdp({ clubId }).query((err, [club], fields) => {
    if (err) return;
    if (!club) return;
    const clubname = [club.name, "(", clubId, ")"].join("");
    sendSlackMessage(
      deviceId,
      clubname,
      "LOGID: " + LOGID,
      address,
      stack,
      responseText
    );
    sendEmail(
      deviceId,
      clubname,
      "LOGID: " + LOGID,
      address,
      stack,
      responseText
    );
  });
}
function procAppResult(json) {
  try {
    const jsonMsg = JSON.parse(json.message);
    sendMessage(json, jsonMsg);
  } catch (e) {
    const [a, result] = msg.split(":");
    const [device, , type] = a.split(" ");
    console.log("normal pass", device, type, result);
    sendslackmessage([device, type, result.trim()].join("/"));
  }
}

function sendMessage(json, jsonMsg) {
  const { app_result } = jsonMsg;
  const { deviceId, clubId, macro_id: macroId } = json;
  const { device, type, result } = app_result;

  setLogReport(macroId, deviceId, clubId, device, type, result, "");
  "sql/getclub.sql".gfdp({ clubId }).query((err, [club], fields) => {
    if (err) return;
    if (!club) return;
    const clubname = [club.name, "(", clubId, ")"].join("");
    sendSlackMessage(deviceId, clubname, device, type, result);
    sendEmail(deviceId, clubname, device, type, result);
  });
}
function setLogReport(macroId, deviceId, clubId, device, type, result, others) {
  const param = { macroId, deviceId, clubId, device, type, result, others };
  "sql/setLogReport.sql".gfdp(param).query((err, result, fields) => {
    if (err) {
      console.log(err);
      console.log("sql/setLogReport.sql".gfdp(param));
    }
  });
}
function sendSlackMessage(deviceId, clubId, device, type, result, others) {
  if (result == "normal") {
    console.log("normal pass", deviceId, clubId, device, type, result);
    return;
  }
  const arr = [
    "< 데이터 조회 결과입니다. >",
    "디바이스: \t" + deviceId,
    "클럽번호: \t" + clubId,
    "기기종류: \t" + device,
    "검색종류: \t" + type,
    "검색결과: \t" + result,
  ];
  if (others) arr.push(["기타사항: \t" + others]);
  const str = arr.join("\n");
  sendslackmessage(str);
}
function sendEmail(deviceId, clubId, device, type, result, others) {
  if (result == "normal") {
    console.log("normal pass", deviceId, clubId, device, type, result);
    return;
  }
  const arr = [
    "<h3> 데이터 조회 결과입니다. </h3>",
    "<table>",
    "<tr><td><b>디바이스: </b></td><td>" + deviceId + "</td></tr>",
    "<tr><td><b>클럽번호: </b></td><td>" + clubId + "</td></tr>",
    "<tr><td><b>기기종류: </b></td><td>" + device + "</td></tr>",
    "<tr><td><b>검색종류: </b></td><td>" + type + "</td></tr>",
    "<tr><td><b>검색결과: </b></td><td>" + result + "</td></tr>",
  ];
  if (others)
    arr.push(["<tr><td><b>검색결과: </b></td><td>" + result + "</td></tr>"]);
  arr.push(["</table>"]);
  const html = arr.join("<br>");

  const mails = fs.readFileSync("email").toString("utf-8").split("\n");
  exec();

  function exec() {
    const [mailname, mailaddress] = mails.pop().split(",");
    console.log(mailname, mailaddress);
    if (!mailaddress) {
      return;
    }
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "tzzim.cs@gmail.com",
        pass: "zuilsgtrsbcqeose",
      },
    });
    const mailOptions = {
      from: "티찜관리자<tzzim.cs@gmail.com>",
      to: mailname + "<" + mailaddress + ">",
      subject: "데이터 조회 결과입니다.",
      html,
      //text:"test",
      /* attachments:[
        {
          filename:"test.csv",
          path:"emails.txt"
        }
      ] */
    };
    transporter.sendMail(mailOptions, (err, data) => {
      if (err) console.log(err);
      else console.log("Email sent: " + data.response);
      exec();
    });
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
