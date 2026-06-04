const express = require('express');
const HikCamera = require('./hk.service');
const app = express();
app.use(express.json());

const PORT = 9999;

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

app.listen(PORT, () => {
    console.log('服务启动: http://127.0.0.1:9999');
});