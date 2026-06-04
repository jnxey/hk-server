const DigestFetch = require('digest-fetch').default;
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');

const HK_STREAM_CHANNEL_ID = '101';
/** 与截图接口一致，使用小写 channels */
const HK_STREAM_CHANNELS_PREFIX = '/ISAPI/Streaming/channels';
const HK_WEBRTC_PATH = `${HK_STREAM_CHANNELS_PREFIX}/${HK_STREAM_CHANNEL_ID}/webrtc`;
const HK_WEBRTC_PATH_CAP = `/ISAPI/Streaming/Channels/${HK_STREAM_CHANNEL_ID}/webrtc`;
const HK_WS_STREAM_PATH = `${HK_STREAM_CHANNELS_PREFIX}/${HK_STREAM_CHANNEL_ID}/WSStream`;
/** 部分型号仅大写 Channels 的 WSStream 可用 */
const HK_WS_STREAM_PATH_CAP = `/ISAPI/Streaming/Channels/${HK_STREAM_CHANNEL_ID}/WSStream`;
/** 设备无 WSStream 时跳过初始化，由 SDP 协商继续（部分型号仅支持 negotiate） */
const HK_WEBRTC_INIT_SKIPPED_JSON = '{"error_code":0}';
const CT_XML = 'application/xml; charset=UTF-8';
const CT_SDP = 'application/sdp';
const SDP_TYPE_OFFER = 'offer';
const SDP_TYPE_ANSWER = 'answer';

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
});

function escapeSdpForCdata(sdp) {
    return String(sdp ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
}

/** 与 hk-server 最初 WSStream 请求体一致（部分型号仅认此格式） */
function buildWebRtcEnableXmlLegacy() {
    return `
        <StreamingChannel>
          <transport>
            <wsTransport>
              <streamingProtocol>WebRTC</streamingProtocol>
            </wsTransport>
          </transport>
        </StreamingChannel>
      `;
}

function buildWebRtcEnableXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<StreamingChannel version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <id>${HK_STREAM_CHANNEL_ID}</id>
  <transport>
    <wsTransport>
      <streamingProtocol>WebRTC</streamingProtocol>
    </wsTransport>
  </transport>
</StreamingChannel>`;
}

function isWebRtcInitSuccess(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return false;
    if (raw.indexOf('"error_code":0') >= 0 || raw.indexOf('error_code":0') >= 0) return true;
    if (raw.indexOf('v=0') >= 0) return true;
    try {
        const parsed = xmlParser.parse(raw);
        const status = parsed?.ResponseStatus || parsed?.responseStatus;
        if (status && String(status.statusCode) === '1') return true;
    } catch {
        /* ignore */
    }
    return false;
}

function buildWebRtcNegotiateXml(sdp, sdpType) {
    const sdpTag = sdpType === SDP_TYPE_ANSWER ? 'remoteSDP' : 'localSDP';
    const safeSdp = escapeSdpForCdata(sdp);
    return `<?xml version="1.0" encoding="UTF-8"?>
<StreamingChannel version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <id>${HK_STREAM_CHANNEL_ID}</id>
  <transport>
    <wsTransport>
      <streamingProtocol>WebRTC</streamingProtocol>
      <${sdpTag}><![CDATA[${safeSdp}]]></${sdpTag}>
    </wsTransport>
  </transport>
</StreamingChannel>`;
}

function buildWebRtcNegotiateXmlSimple(sdp, sdpType) {
    const sdpTag = sdpType === SDP_TYPE_ANSWER ? 'remoteSDP' : 'localSDP';
    const safeSdp = escapeSdpForCdata(sdp);
    return `<?xml version="1.0" encoding="UTF-8"?>
<WebRTC version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <${sdpTag}><![CDATA[${safeSdp}]]></${sdpTag}>
</WebRTC>`;
}

function isHttpNotFound(text, status) {
    if (status === 404) return true;
    const raw = String(text ?? '');
    return raw.indexOf('404') >= 0 && raw.indexOf('Not Found') >= 0;
}

function pickSdpFromObject(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const keys = ['remoteSDP', 'localSDP', 'sdp', 'SDP', 'offer', 'Offer', 'answer', 'Answer'];
    for (let i = 0; i < keys.length; i += 1) {
        const val = obj[keys[i]];
        if (typeof val === 'string' && val.indexOf('v=0') >= 0) return val.trim();
        if (val && typeof val === 'object' && typeof val['#text'] === 'string' && val['#text'].indexOf('v=0') >= 0) {
            return val['#text'].trim();
        }
    }
    const childKeys = Object.keys(obj);
    for (let j = 0; j < childKeys.length; j += 1) {
        const nested = pickSdpFromObject(obj[childKeys[j]]);
        if (nested) return nested;
    }
    return '';
}

function parseSdpFromDeviceResponse(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return '';
    if (raw.indexOf('v=0') >= 0) return raw;
    try {
        const parsed = xmlParser.parse(raw);
        return pickSdpFromObject(parsed);
    } catch {
        return '';
    }
}

function parseDeviceErrorMessage(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return '';
    if (raw.indexOf('<!DOCTYPE html>') >= 0 || raw.indexOf('<html>') >= 0) {
        const match = raw.match(/<p>([^<]+)<\/p>/i);
        if (match && match[1]) return String(match[1]).trim();
        if (raw.indexOf('404') >= 0) return '404 Not Found';
        return raw.slice(0, 200);
    }
    if (raw.indexOf('<') < 0) return raw.slice(0, 200);
    try {
        const parsed = xmlParser.parse(raw);
        const status = parsed?.ResponseStatus || parsed?.responseStatus;
        if (status) {
            const code = status.statusCode ?? status.StatusCode;
            const str = status.statusString ?? status.StatusString;
            const sub = status.subStatusCode ?? status.SubStatusCode;
            const parts = [];
            if (str) parts.push(String(str));
            if (sub) parts.push(String(sub));
            if (code !== undefined && code !== '') parts.push(`statusCode=${code}`);
            if (parts.length) return parts.join(', ');
        }
    } catch {
        /* ignore */
    }
    return raw.slice(0, 200);
}

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

    async postToDevice(path, body, contentType) {
        const url = `http://${this.ip}${path}`;
        const res = await this.client.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': contentType },
            body,
        });
        const text = await res.text();
        return { ok: res.ok, status: res.status, text };
    }

    async postXmlToDevice(path, body) {
        return this.postToDevice(path, body, CT_XML);
    }

    /**
     * 获取海康 WebRTC 播放地址
     * @returns Promise<string> WebRTC 信息
     */
    async getWebRTC() {
        try {
            const attempts = [
                { path: HK_WS_STREAM_PATH_CAP, body: buildWebRtcEnableXmlLegacy() },
                { path: HK_WEBRTC_PATH, body: buildWebRtcEnableXmlLegacy() },
                { path: HK_WEBRTC_PATH_CAP, body: buildWebRtcEnableXmlLegacy() },
                { path: HK_WEBRTC_PATH, body: buildWebRtcEnableXml() },
                { path: HK_WS_STREAM_PATH, body: buildWebRtcEnableXmlLegacy() },
            ];
            let lastErr = '';
            let allNotFound = true;
            for (let i = 0; i < attempts.length; i += 1) {
                const item = attempts[i];
                const result = await this.postXmlToDevice(item.path, item.body);
                if (result.ok || isWebRtcInitSuccess(result.text)) return result.text;
                lastErr = parseDeviceErrorMessage(result.text) || result.text || String(result.status);
                if (!isHttpNotFound(result.text, result.status)) {
                    allNotFound = false;
                    break;
                }
            }
            if (allNotFound) return HK_WEBRTC_INIT_SKIPPED_JSON;
            throw new Error(lastErr || 'webrtc_init_failed');
        } catch (err) {
            throw new Error('WebRTC 获取失败: ' + err.message);
        }
    }

    /**
     * WebRTC SDP 协商（代浏览器向设备提交 offer/answer）
     * @param {string} sdp
     * @param {string} sdpType offer | answer
     */
    async negotiateWebRTC(sdp, sdpType) {
        try {
            const type = sdpType === SDP_TYPE_ANSWER ? SDP_TYPE_ANSWER : SDP_TYPE_OFFER;
            const sdpBody = String(sdp ?? '').trim();
            const attempts = [
                { path: HK_WEBRTC_PATH, body: buildWebRtcNegotiateXml(sdpBody, type), contentType: CT_XML },
                { path: HK_WEBRTC_PATH_CAP, body: buildWebRtcNegotiateXml(sdpBody, type), contentType: CT_XML },
                { path: HK_WEBRTC_PATH, body: buildWebRtcNegotiateXmlSimple(sdpBody, type), contentType: CT_XML },
                { path: HK_WEBRTC_PATH, body: sdpBody, contentType: CT_SDP },
                { path: HK_WEBRTC_PATH_CAP, body: sdpBody, contentType: CT_SDP },
            ];
            let lastErr = '';
            for (let i = 0; i < attempts.length; i += 1) {
                const item = attempts[i];
                const result = await this.postToDevice(item.path, item.body, item.contentType);
                const text = result.text;
                if (result.ok) {
                    const answerSdp = parseSdpFromDeviceResponse(text);
                    if (answerSdp) return answerSdp;
                    const errMsg = parseDeviceErrorMessage(text);
                    if (errMsg) lastErr = errMsg;
                    else lastErr = 'webrtc_no_sdp_answer';
                    continue;
                }
                lastErr = parseDeviceErrorMessage(text) || result.text || String(result.status);
                if (isHttpNotFound(text, result.status)) continue;
            }
            throw new Error(lastErr || 'webrtc_negotiate_failed');
        } catch (err) {
            throw new Error('WebRTC 协商失败: ' + err.message);
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