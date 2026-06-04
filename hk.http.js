const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const HikCamera = require('./hk.service');

const app = express();
app.use(express.json());

const PORT = Number(process.env.HTTPS_PORT) || 9999;

const CERT_DIR = path.join(__dirname, 'certs');
const CERT_PATH = process.env.HTTPS_CERT || path.join(CERT_DIR, 'localhost.pem');
const KEY_PATH = process.env.HTTPS_KEY || path.join(CERT_DIR, 'localhost-key.pem');

function loadTlsOptions() {
    if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
        throw new Error(
            `TLS 证书不存在，请将证书放入 ./certs 或通过 HTTPS_CERT / HTTPS_KEY 指定路径:\n  ${CERT_PATH}\n  ${KEY_PATH}`,
        );
    }
    return {
        cert: fs.readFileSync(CERT_PATH),
        key: fs.readFileSync(KEY_PATH),
    };
}

// 截图接口（动态传 ip/user/password）
app.post('/snapshot', async (req, res) => {
    try {
        const cam = new HikCamera(req.body);
        const buf = await cam.takeSnapshot();
        res.set('Content-Type', 'image/jpeg');
        res.send(buf);
    } catch (e) {
        res.status(500).send({ err: e.message });
    }
});

// WebRTC 接口（动态传配置）
app.post('/webrtc', async (req, res) => {
    try {
        const cam = new HikCamera(req.body);
        const data = await cam.getWebRTC();
        res.send({ code: 200, data });
    } catch (e) {
        res.status(500).send({ err: e.message });
    }
});

const httpsServer = https.createServer(loadTlsOptions(), app);
httpsServer.listen(PORT, () => {
    console.log(`服务启动: https://127.0.0.1:${PORT}`);
});
