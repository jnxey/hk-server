import express from "express";
import tools from "./tools.js";
import url from "url";
import {
  heartbeat,
  snapshotStream,
  startStream,
  stopStream,
} from "./streams.js";
import path from "path";
import fs from "fs";

const PORT = 9996;

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
const HLS_ROOT = path.resolve("./public/hls");
tools.clearDir(HLS_ROOT); // 先清空
app.get(/^\/hls\/(.+)$/, async (req, res) => {
  try {
    const reqPath = req.params[0];
    const filePath = path.join(HLS_ROOT, reqPath);
    // 防目录穿越
    if (!filePath.startsWith(HLS_ROOT)) return res.status(403).end();
    // 没有找到文件，等待
    if (!fs.existsSync(filePath)) {
      await tools.waitForFile(filePath);
    }
    // Content-Type
    if (filePath.endsWith(".m3u8")) {
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    } else if (filePath.endsWith(".ts")) {
      res.setHeader("Content-Type", "video/mp2t");
    }
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    if (range) {
      const [startStr, endStr] = range.replace("bytes=", "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", end - start + 1);
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", stat.size);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

// 获取设备信息
app.get("/getDeviceInfo", async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    const deviceInfo = await tools.getDeviceInfo(query);
    return res.json(deviceInfo);
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

// 获取通道
app.get("/getIpcChannels", async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    const channels = await tools.getIpcChannels(query);
    return res.json(channels);
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

// 获取通道及名称
app.get("/getIpcChannelsName", async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    const channels = await tools.getIpcChannelsName(query);
    return res.json(channels);
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

// 获取设备端口
app.get("/getDevicePorts", async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    const ports = await tools.getDevicePorts(query);
    return res.json(ports);
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

// 截图
app.get("/captureSnapshot", async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    const imgData = await snapshotStream(query);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", imgData.length);
    return res.end(imgData);
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

// 开始播放
app.get("/streamStart", async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    const { deviceId, channel, rtsp } = query;
    startStream(deviceId, channel, rtsp);
    res.json({ ok: true, m3u8: `/hls/${deviceId}_${channel}/index.m3u8` });
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

// 停止播放
app.get("/streamStop", async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    const { deviceId, channel } = query;
    stopStream(deviceId, channel);
    res.json({ ok: true });
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

// 心跳处理
app.get("/streamHeartbeat", async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    const { deviceId, channel } = query;
    heartbeat(deviceId, channel);
    res.json({ ok: true });
  } catch (e) {
    console.log(e);
    return res.status(500).end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
