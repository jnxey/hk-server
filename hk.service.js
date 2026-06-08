const DigestFetch = require('digest-fetch').default;

/**
 * 海康摄像头（动态传 config：ip、name、password）
 */
class HikCamera {
    constructor(config) {
        this.ip = config.ip;
        this.user = config.name || config.user || config.username;
        this.pass = config.password;
        this.client = new DigestFetch(this.user, this.pass);
        this.basicClient = new DigestFetch(this.user, this.pass, {basic: true});
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
     * 摄像头抓图（返回 JPEG Buffer）
     * @returns {Promise<Buffer>}
     */
    async takeSnapshotBig() {
        try {
            const url = `http://${this.ip}/ISAPI/Streaming/channels/101/picture?videoResolutionWidth=1920&videoResolutionHeight=1080&compressionRate=95`;
            const res = await this.client.fetch(url, {method: 'GET'});
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (err) {
            throw new Error('截图失败: ' + err.message);
        }
    }
}

module.exports = HikCamera;
