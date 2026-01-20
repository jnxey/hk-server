import DigestClient from "digest-fetch";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false });

// 获取设备信息
async function getDeviceInfo({ ip, admin, password }) {
  const client = new DigestClient(admin, password);
  const res = await client.fetch(`http://${ip}/ISAPI/System/deviceInfo`);
  const xml = await res.text();
  const info = parser.parse(xml);
  return info?.DeviceInfo;
}

// 获取通道
async function getIpcChannels({ ip, admin, password }) {
  const client = new DigestClient(admin, password);
  const res = await client.fetch(`http://${ip}/ISAPI/Streaming/channels`);
  const xml = await res.text();
  const obj = parser.parse(xml);
  return obj?.StreamingChannelList?.StreamingChannel ?? [];
}

// 获取通道
async function getIpcChannelsName({ ip, admin, password }) {
  const client = new DigestClient(admin, password);
  const res = await client.fetch(
    `http://${ip}/ISAPI/ContentMgmt/InputProxy/channels`,
  );
  const xml = await res.text();
  const obj = parser.parse(xml);
  return obj?.InputProxyChannelList?.InputProxyChannel ?? [];
}

// 获取设备端口
async function getDevicePorts({ ip, admin, password }) {
  const client = new DigestClient(admin, password);
  const res = await client.fetch(
    `http://${ip}/ISAPI/System/Network/interfaces`,
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  const obj = parser.parse(xml);

  // 确保有 NetworkInterfaceList
  const networkList = obj?.NetworkInterfaceList;
  if (!networkList) {
    console.error("NetworkInterfaceList 未找到，返回值:", xml);
    return null;
  }

  // 支持单对象或数组
  let interfaces = networkList.NetworkInterface;
  if (!interfaces) {
    // 某些老设备用 <Interface> 标签
    interfaces = networkList.Interface;
  }

  if (!interfaces) {
    console.error("NetworkInterface / Interface 未找到，返回值:", xml);
    return null;
  }

  // 保证是数组
  interfaces = Array.isArray(interfaces) ? interfaces : [interfaces];

  const iface = interfaces[0];

  const ports = {
    webPort: parseInt(iface.httpPort || "80", 10),
    httpsPort: parseInt(iface.httpsPort || "443", 10),
    rtspPort: parseInt(iface.rtspPort || "554", 10),
    devicePort: parseInt(iface.devicePort || "8000", 10),
  };

  console.log(ports);
  return ports;
}

/**
 * 抓当前画面截图
 * @param {number} channelId - 通道号，默认 1
 * @param {boolean} subStream - 是否抓子码流 "02": 是 : "01": 不是
 * @param {object} digest
 * @returns {Buffer} - JPEG 图片 Buffer
 */
async function captureSnapshot({
  channelId = 1,
  stream = "01",
  ip,
  admin,
  password,
}) {
  const client = new DigestClient(admin, password);
  const res = await client.fetch(
    `http://${ip}/ISAPI/Streaming/channels/${channelId}${stream}/picture`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`抓图失败 HTTP ${res.status}: ${text}`);
  }

  // 返回 Buffer
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}

// getDeviceInfo({ ip: '192.168.10.2', admin: 'admin', password: 'ac125689' });
// getIpcChannels({ ip: '192.168.10.2', admin: 'admin', password: 'ac125689' });
// getDevicePorts({ ip: '192.168.10.2', admin: 'admin', password: 'ac125689' });
// captureSnapshot(1, false, { ip: '192.168.10.2', admin: 'admin', password: 'ac125689' });

export default {
  getDeviceInfo,
  getIpcChannels,
  getIpcChannelsName,
  getDevicePorts,
  captureSnapshot,
};
