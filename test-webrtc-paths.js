const HikCamera = require('./hk.service');

const cam = new HikCamera({ ip: '192.168.1.4', name: 'admin', password: 'qwer1122' });
const legacyBody = `
        <StreamingChannel>
          <transport>
            <wsTransport>
              <streamingProtocol>WebRTC</streamingProtocol>
            </wsTransport>
          </transport>
        </StreamingChannel>
      `;

const paths = [
  '/ISAPI/Streaming/Channels/101/WSStream',
  '/ISAPI/Streaming/channels/101/webrtc',
  '/ISAPI/Streaming/channels/101/WSStream',
];

(async () => {
  for (let i = 0; i < paths.length; i += 1) {
    const p = paths[i];
    const r = await cam.postXmlToDevice(p, legacyBody);
    console.log('---', p);
    console.log('status', r.status, 'ok', r.ok);
    console.log((r.text || '').slice(0, 300));
  }
  try {
    const info = await cam.getWebRTC();
    console.log('getWebRTC OK', info.slice(0, 200));
  } catch (e) {
    console.log('getWebRTC ERR', e.message);
  }
})();
