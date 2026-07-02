const DigestFetch = require('digest-fetch').default;
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RTSP_PORT = 554;
const STREAM_CHANNEL_MAIN = 101;
const SNAPSHOT_BIG_WIDTH = 1920;
const SNAPSHOT_BIG_HEIGHT = 1080;

function getFfmpegPath() {
    if (process.env.FFMPEG_PATH) {
        return process.env.FFMPEG_PATH;
    }
    const localFfmpeg = path.join(__dirname, 'ffmpeg.exe');
    if (fs.existsSync(localFfmpeg)) {
        return localFfmpeg;
    }
    try {
        const ffmpegStatic = require('ffmpeg-static');
        if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
            return ffmpegStatic;
        }
    } catch (err) {}
    return 'ffmpeg';
}

/**
 * 海康摄像头（动态传 config：ip、name、password）
 */
class HikCamera {
    constructor(config) {
        this.ip = config.ip;
        this.user = config.name || config.user || config.username;
        this.pass = config.password;
        this.type = config.type || config.brand || '';
        this.client = new DigestFetch(this.user, this.pass);
        this.basicClient = new DigestFetch(this.user, this.pass, {basic: true});
    }

    _normalizeCameraType() {
        return String(this.type || '')
            .toLowerCase()
            .replace(/-/g, '');
    }

    /**
     * 检测账号密码是否有效（海康 ISAPI）
     * @returns {Promise<{ valid: boolean }>}
     */
    async checkCredentialsHik() {
        const url = `http://${this.ip}/ISAPI/System/deviceInfo`;
        const clients = [this.client, this.basicClient];
        let lastErr;
        let authFailed = false;

        for (const client of clients) {
            try {
                const res = await client.fetch(url, {method: 'GET'});
                if (res.status === 401 || res.status === 403) {
                    authFailed = true;
                    continue;
                }
                if (res.status === 404) {
                    throw new Error('HIK_NOT_SUPPORTED');
                }
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} ${res.statusText}`);
                }
                return {valid: true};
            } catch (err) {
                lastErr = err;
            }
        }

        if (authFailed) {
            return {valid: false};
        }
        throw new Error('账号检测失败: ' + lastErr.message);
    }

    /**
     * 检测账号密码是否有效（邦世）
     * @returns {Promise<{ valid: boolean }>}
     */
    async checkCredentialsBangShi() {
        const url = `http://${this.ip}/Snapshot/1/RemoteImageCapture?ImageFormat=2`;
        const clients = [this.client, this.basicClient];
        let lastErr;
        let authFailed = false;

        for (const client of clients) {
            try {
                const res = await client.fetch(url, {method: 'GET'});
                if (res.status === 401 || res.status === 403) {
                    authFailed = true;
                    continue;
                }
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} ${res.statusText}`);
                }
                const buf = Buffer.from(await res.arrayBuffer());
                if (buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) {
                    const preview = buf.toString('utf8', 0, 200).replace(/\s+/g, ' ').trim();
                    throw new Error(preview ? `响应非 JPEG: ${preview}` : '响应为空或非 JPEG');
                }
                return {valid: true};
            } catch (err) {
                lastErr = err;
            }
        }

        if (authFailed) {
            return {valid: false};
        }
        throw new Error('账号检测失败: ' + lastErr.message);
    }

    /**
     * 检测账号密码是否有效
     * @returns {Promise<{ valid: boolean }>}
     */
    async checkCredentials() {
        const type = this._normalizeCameraType();
        if (type === 'bangshi' || type === '邦世') {
            return this.checkCredentialsBangShi();
        }
        if (type === 'hik' || type === 'hikvision' || type === '海康') {
            return this.checkCredentialsHik();
        }

        try {
            return await this.checkCredentialsHik();
        } catch (err) {
            if (err.message === 'HIK_NOT_SUPPORTED' || err.message.includes('HIK_NOT_SUPPORTED')) {
                return this.checkCredentialsBangShi();
            }
            throw err;
        }
    }

    /**
     * 获取海康 WebRTC 播放地址
     * @returns Promise<string> WebRTC 信息
     */
    async getWebRTC() {
        try {
            const url = `http://${this.ip}/ISAPI/Streaming/Channels/101/WSStream`;
            const body = `
        <StreamingChannel>
          <transport>
            <wsTransport>
              <streamingProtocol>WebRTC</streamingProtocol>
            </wsTransport>
          </transport>
        </StreamingChannel>
      `;

            const res = await this.client.fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/xml'},
                body,
            });

            return await res.text();
        } catch (err) {
            throw new Error('WebRTC 获取失败: ' + err.message);
        }
    }

    /**
     * 摄像头抓图（返回 JPEG Buffer）
     * @returns {Promise<Buffer>}
     */
    async takeSnapshotSmall() {
        try {
            const url = `http://${this.ip}/ISAPI/Streaming/channels/102/picture`;
            const res = await this.client.fetch(url, {method: 'GET'});
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (err) {
            throw new Error('截图失败: ' + err.message);
        }
    }

    /**
     * 摄像头抓图（返回 JPEG Buffer）
     * @returns {Promise<Buffer>}
     */
    async takeSnapshotBangShi() {
        const url = `http://${this.ip}/Snapshot/1/RemoteImageCapture?ImageFormat=2`;
        const clients = [this.client, this.basicClient];
        let lastErr;

        for (const client of clients) {
            try {
                const res = await client.fetch(url, {method: 'GET'});
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} ${res.statusText}`);
                }
                const buf = Buffer.from(await res.arrayBuffer());
                if (buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) {
                    const preview = buf.toString('utf8', 0, 200).replace(/\s+/g, ' ').trim();
                    throw new Error(preview ? `响应非 JPEG: ${preview}` : '响应为空或非 JPEG');
                }
                return buf;
            } catch (err) {
                lastErr = err;
            }
        }

        throw new Error('截图失败: ' + lastErr.message);
    }

    /**
     * 摄像头抓图（HTTP 101 主码流，返回 JPEG Buffer）
     * @returns {Promise<Buffer>}
     */
    async takeSnapshotBigHttp() {
        try {
            const url = `http://${this.ip}/ISAPI/Streaming/channels/${STREAM_CHANNEL_MAIN}/picture`;
            const res = await this.client.fetch(url, {method: 'GET'});
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (err) {
            throw new Error('截图失败: ' + err.message);
        }
    }

    /**
     * 摄像头抓图（返回 JPEG Buffer）
     * @returns {Promise<Buffer>}
     */
    async takeSnapshotBig() {
        try {
            const user = encodeURIComponent(this.user);
            const pass = encodeURIComponent(this.pass);
            const rtspUrl = `rtsp://${user}:${pass}@${this.ip}:${RTSP_PORT}/Streaming/Channels/${STREAM_CHANNEL_MAIN}`;
            const ffmpegCmd = getFfmpegPath();
            const buf = await new Promise((resolve, reject) => {
                const ffmpeg = spawn(
                    ffmpegCmd,
                    [
                        '-probesize',
                        '32',
                        '-analyzeduration',
                        '0',
                        '-fflags',
                        'nobuffer',
                        '-flags',
                        'low_delay',
                        '-rtsp_transport',
                        'tcp',
                        '-i',
                        rtspUrl,
                        '-vf',
                        `scale=${SNAPSHOT_BIG_WIDTH}:${SNAPSHOT_BIG_HEIGHT}`,
                        '-frames:v',
                        '1',
                        '-q:v',
                        '2',
                        '-f',
                        'image2pipe',
                        '-vcodec',
                        'mjpeg',
                        'pipe:1',
                    ],
                    {stdio: ['ignore', 'pipe', 'pipe']},
                );
                const chunks = [];
                let stderr = '';

                ffmpeg.stdout.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                ffmpeg.stderr.on('data', (chunk) => {
                    stderr += chunk.toString();
                });
                ffmpeg.on('error', (err) => {
                    if (err.code === 'ENOENT') {
                        reject(new Error('未找到 ffmpeg，请安装 ffmpeg 或设置 FFMPEG_PATH'));
                        return;
                    }
                    reject(err);
                });
                ffmpeg.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(stderr || `ffmpeg exit ${code}`));
                        return;
                    }
                    const imageBuf = Buffer.concat(chunks);
                    if (imageBuf.length < 2 || imageBuf[0] !== 0xff || imageBuf[1] !== 0xd8) {
                        reject(new Error('响应为空或非 JPEG'));
                        return;
                    }
                    resolve(imageBuf);
                });
            });
            return buf;
        } catch (err) {
            throw new Error('截图失败: ' + err.message);
        }
    }
}

module.exports = HikCamera;
