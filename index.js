import http from "http";
import url from "url";
import tools from "./tools.js";

const PORT = 3000;

function getParams(value) {
  return JSON.stringify(value);
}

const server = http.createServer(async (req, res) => {
  const { pathname, query } = url.parse(req.url, true);

  // 允许跨域
  res.setHeader("Access-Control-Allow-Origin", "*");
  // 统一返回 JSON
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // 测试
  if (req.method === "GET" && pathname === "/") {
    return res.end(getParams({ code: 0, msg: "" }));
  }

  // 获取设备信息
  if (req.method === "GET" && pathname === "/getDeviceInfo") {
    const deviceInfo = await tools.getDeviceInfo(query);
    return res.end(getParams(deviceInfo));
  }

  // 获取通道
  if (req.method === "GET" && pathname === "/getIpcChannels") {
    const channels = await tools.getIpcChannels(query);
    return res.end(getParams(channels));
  }

  // 获取设备端口
  if (req.method === "GET" && pathname === "/getDevicePorts") {
    const ports = await tools.getDevicePorts(query);
    return res.end(getParams(ports));
  }

  // 获取设备端口
  if (req.method === "GET" && pathname === "/captureSnapshot") {
    const imgData = await tools.captureSnapshot(query);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", imgData.length);
    return res.end(imgData);
  }

  // 404
  res.statusCode = 404;
  res.end(JSON.stringify({ msg: "Not Found" }));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
