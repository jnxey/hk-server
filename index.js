import express from "express";
import tools from "./tools.js";
import url from "url";
import { heartbeat, startStream, stopStream } from "./streams.js";
import path from "path";

const PORT = 9968;

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// 静态 HLS
app.use("/hls", express.static(path.resolve("./public/hls")));

// 获取设备信息
app.get("/getDeviceInfo", async (req, res) => {
  const { query } = url.parse(req.url, true);
  const deviceInfo = await tools.getDeviceInfo(query);
  return res.json(deviceInfo);
});

// 获取通道
app.get("/getIpcChannels", async (req, res) => {
  const { query } = url.parse(req.url, true);
  const channels = await tools.getIpcChannels(query);
  return res.json(channels);
});

// 获取通道及名称
app.get("/getIpcChannelsName", async (req, res) => {
  const { query } = url.parse(req.url, true);
  const channels = await tools.getIpcChannelsName(query);
  return res.json(channels);
});

// 获取设备端口
app.get("/getDevicePorts", async (req, res) => {
  const { query } = url.parse(req.url, true);
  const ports = await tools.getDevicePorts(query);
  return res.json(ports);
});

// 截图
app.get("/captureSnapshot", async (req, res) => {
  const { query } = url.parse(req.url, true);
  const imgData = await tools.captureSnapshot(query);
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", imgData.length);
  return res.end(imgData);
});

// 开始播放
app.get("/streamStart", async (req, res) => {
  const { query } = url.parse(req.url, true);
  const { deviceId, channel, rtsp } = query;
  startStream(deviceId, channel, rtsp);
  res.json({ ok: true, m3u8: `/hls/${deviceId}_${channel}/index.m3u8` });
});

// 停止播放
app.get("/streamStop", async (req, res) => {
  const { query } = url.parse(req.url, true);
  const { deviceId, channel } = query;
  stopStream(deviceId, channel);
  res.json({ ok: true });
});

// 心跳处理
app.get("/streamHeartbeat", async (req, res) => {
  const { query } = url.parse(req.url, true);
  const { deviceId, channel } = query;
  heartbeat(deviceId, channel);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
