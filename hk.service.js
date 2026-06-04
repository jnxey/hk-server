const DigestFetch = require('digest-fetch').default;
const fs = require('fs');

/**
 * 海康通用工具类（动态传 config）
 * 用法：new HikCamera({ ip, user, password })
 */
class HikCamera {
    constructor(config) {
        this.ip = config.ip;
        this.user = config.name || config.user;
        this.pass = config.password;
        this.client = new DigestFetch(this.user, this.pass); // 摘要认证
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
                headers: { 'Content-Type': 'application/xml' },
                body,
            });

            return await res.text();
        } catch (err) {
            throw new Error('WebRTC 获取失败: ' + err.message);
        }
    }

    /**
     * 摄像头截图（返回 Buffer）
     * @returns Promise<Buffer>
     */
    async takeSnapshot() {
        try {
            const url = `http://${this.ip}/ISAPI/Streaming/channels/102/picture`;
            const res = await this.client.fetch(url, { method: 'GET' });
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (err) {
            throw new Error('截图失败: ' + err.message);
        }
    }
}

module.exports = HikCamera;