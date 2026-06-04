const HikCamera = require('./hk.service');

const cam = new HikCamera({ ip: '192.168.1.4', name: 'admin', password: 'qwer1122' });

(async () => {
  try {
    const init = await cam.getWebRTC();
    console.log('getWebRTC', init);
  } catch (e) {
    console.log('getWebRTC ERR', e.message);
  }
  try {
    const ans = await cam.negotiateWebRTC('v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n', 'offer');
    console.log('negotiate OK', ans.slice(0, 80));
  } catch (e) {
    console.log('negotiate ERR', e.message);
  }
  try {
    const buf = await cam.takeSnapshot();
    console.log('snapshot OK', buf.length);
  } catch (e) {
    console.log('snapshot ERR', e.message);
  }
})();
