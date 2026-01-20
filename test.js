import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const ROOT = process.cwd();
const ffmpegPath = path.join(ROOT, "bin", "ffmpeg"); // Windows 用 ffmpeg.exe
const outDir = path.join(ROOT, "public/hls/test");
fs.mkdirSync(outDir, { recursive: true });

// 替换成你的 RTSP
const rtspUrl =
  "rtsp://admin:Xch2025@@192.168.1.108:554/Streaming/Channels/102";

const args = [
  "-rtsp_transport",
  "tcp",
  "-i",
  rtspUrl,
  "-an",
  "-c:v",
  "copy",
  "-f",
  "hls",
  "-hls_time",
  "2",
  "-hls_list_size",
  "5",
  "-hls_flags",
  "delete_segments+omit_endlist",
  path.join(outDir, "index.m3u8"),
];

const ffmpeg = spawn(ffmpegPath, args);

ffmpeg.stderr.on("data", (d) => console.log(d.toString()));
ffmpeg.on("exit", (code) => console.log("ffmpeg exit", code));
