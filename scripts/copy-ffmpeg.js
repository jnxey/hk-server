const fs = require('fs');
const path = require('path');
const ffmpegStatic = require('ffmpeg-static');

const targetDir = path.join(__dirname, '..', '..', 'gv-web-electron');
const targetPath = path.join(targetDir, 'ffmpeg.exe');

if (!ffmpegStatic || !fs.existsSync(ffmpegStatic)) {
    throw new Error('ffmpeg-static 未安装或二进制不存在');
}

fs.copyFileSync(ffmpegStatic, targetPath);
console.log(`已复制 ffmpeg 到 ${targetPath}`);
