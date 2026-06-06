// rollup.config.js
import resolve from "@rollup/plugin-node-resolve"; // 解析node_modules中的第三方模块
import babel from "@rollup/plugin-babel"; // 使用Babel转换JavaScript代码
import { terser } from "rollup-plugin-terser"; // 压缩JavaScript代码
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

const nodeBuiltins = [
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "dns",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "zlib",
];

export default {
  external: (id) => nodeBuiltins.includes(id) || id.startsWith("node:"),
  // 入口文件路径
  input: "./hk.http.js",
  // 输出配置
  output: [
    {
      file: "../gv-web-electron/hk.http.js", // 输出文件路径
      format: "cjs", // ES模块格式，适合现代打包工具
      exports: "auto",
      sourcemap: false, // 生成sourcemap便于调试
      inlineDynamicImports: true,
    },
  ],
  // 插件配置
  plugins: [
    // 解析node_modules中的模块
    resolve({
      browser: false,
      preferBuiltins: true,
    }),
    commonjs({
      include: [/node_modules/, /hk\.(http|service)\.js/],
    }),
    json(),
    // Babel转换，确保代码浏览器兼容性
    babel({
      babelHelpers: "bundled",
      exclude: "node_modules/**", // 排除node_modules
      extensions: [".js", ".jsx", ".ts", ".tsx"], // 支持的文件扩展名
      presets: [
        [
          "@babel/preset-env",
          {
            targets: { node: "18" },
            modules: false,
          },
        ],
      ],
    }),
    // 生产环境代码压缩
    terser(),
  ],
};
