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
    "tcp",
    "-i",
    rtspUrl,
    "-an", // 去掉音频
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-profile:v",
    "baseline",
    "-level",
    "3.1",
    "-x264opts",
    "keyint=5:min-keyint=5:no-scenecut", // 每 25 帧强制关键帧
    "-flags",
    "low_delay", // 降低编码延迟
    "-fflags",
    "nobuffer", // 避免缓冲
    "-flags",
    "+global_header", // 兼容 HLS
    "-f",
    "hls",
    "-hls_time",
    "0.2", // 每个 TS 1 秒
    "-hls_list_size",
    "3", // 保留最新 5 个片段
    "-hls_flags",
    "delete_segments+append_list+omit_endlist",
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

// 抓图片
export function snapshotStream({ rtspUrl }) {
  return new Promise((resolve, reject) => {
    try {
      const ffmpeg = spawn(ffmpegPath, [
        "-rtsp_transport",
        "tcp",
        "-i",
        rtspUrl,
        "-vframes",
        "1", // 只抓一帧
        "-f",
        "image2",
        "-q:v",
        "2", // 高质量 JPEG
        "pipe:1", // 输出到 stdout
      ]);

      let imageBuffer = Buffer.alloc(0);

      ffmpeg.stdout.on("data", (chunk) => {
        imageBuffer = Buffer.concat([imageBuffer, chunk]);
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve(imageBuffer);
        } else {
          reject();
        }
      });

      ffmpeg.on("error", (err) => {
        console.error(err);
        reject();
      });
    } catch (err) {
      console.error(err);
      reject();
    }
  });
}
