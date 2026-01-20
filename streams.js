import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const BASE_DIR = path.resolve("./public/hls");
const streamMap = new Map();
const TIMEOUT = 15 * 1000; // 15秒无人观看自动回收

// https://www.gyan.dev/ffmpeg/builds/
const ffmpegPath = path.resolve(
  process.cwd(),
  "bin",
  os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg",
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// 启动或增加观看
export function startStream(deviceId, channel, rtspUrl) {
  const key = `${deviceId}_${channel}`;
  const now = Date.now();

  if (streamMap.has(key)) {
    const s = streamMap.get(key);
    s.watchCount++;
    s.lastActive = now;
    return;
  }

  const outDir = path.join(BASE_DIR, key);
  ensureDir(outDir);

  const args = [
    "-rtsp_transport",
    "tcp", // RTSP TCP 方式，稳定
    "-i",
    rtspUrl, // 输入 RTSP
    "-an", // 不推音频
    "-c:v",
    "copy", // 视频直接拷贝，不解码
    "-f",
    "hls", // HLS 输出
    "-hls_time",
    "2", // 每个 ts 文件 2 秒
    "-hls_list_size",
    "5", // m3u8 保留最近 5 个 ts
    "-hls_flags",
    "delete_segments+omit_endlist", // 自动删除旧 ts，不写 ENDLIST
    path.join(outDir, "index.m3u8"),
  ];

  const proc = spawn(ffmpegPath, args, { stdio: "ignore" });

  const stream = { proc, dir: outDir, watchCount: 1, lastActive: now };
  proc.on("exit", () => streamMap.delete(key));
  streamMap.set(key, stream);
}

// 心跳更新
export function heartbeat(deviceId, channel) {
  const key = `${deviceId}_${channel}`;
  const stream = streamMap.get(key);
  if (stream) stream.lastActive = Date.now();
}

// 定时清理
setInterval(() => {
  const now = Date.now();
  for (const [key, stream] of streamMap.entries()) {
    if (stream.watchCount <= 0 || now - stream.lastActive > TIMEOUT) {
      stream.proc.kill("SIGKILL");
      fs.rmSync(stream.dir, { recursive: true, force: true });
      streamMap.delete(key);
      console.log("Auto stop stream:", key);
    }
  }
}, 5000); // 每5秒检查一次

// 停止流（用户手动退出，可选）
export function stopStream(deviceId, channel) {
  const key = `${deviceId}_${channel}`;
  const stream = streamMap.get(key);
  if (!stream) return;
  stream.watchCount--;
}
