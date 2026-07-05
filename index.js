#!/usr/bin/env node

const http = require("http");
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const OFFICIAL_DOWNLOADS = {
  amd: {
    web: {
      fileUrl: 'https://github.com/XTLS/Xray-core/releases/download/v24.11.21/Xray-linux-64.zip',
      sha256: '084bf895408cbd872f4973c73f6b9f84e8e4f819b9152edb19adf721446aee28',
      archiveEntry: 'xray'
    },
    bot: {
      fileUrl: 'https://github.com/cloudflare/cloudflared/releases/download/2025.11.1/cloudflared-linux-amd64',
      sha256: '991dffd8889ee9f0147b6b48933da9e4407e68ea8c6d984f55fa2d3db4bb431d'
    },
    nezhaV0: {
      fileUrl: 'https://github.com/nezhahq/agent/releases/download/v0.20.5/nezha-agent_linux_amd64.zip',
      sha256: '487fcf698c0c4764f9821407096c7d32651f7fa579e6f18f4fc818ba5f39575c',
      archiveEntry: 'nezha-agent'
    },
    nezhaV1: {
      fileUrl: 'https://github.com/nezhahq/agent/releases/download/v1.0.1/nezha-agent_linux_amd64.zip',
      sha256: 'd8df0b700139eb8539d59710db6c2e848b522d7d69d581be14badff37b71f72e',
      archiveEntry: 'nezha-agent'
    }
  },
  arm: {
    web: {
      fileUrl: 'https://github.com/XTLS/Xray-core/releases/download/v24.11.21/Xray-linux-arm64-v8a.zip',
      sha256: '8369d4ffc27640369646d860af9b2681319858ca3b3534409c875c1518acaa92',
      archiveEntry: 'xray'
    },
    bot: {
      fileUrl: 'https://github.com/cloudflare/cloudflared/releases/download/2025.11.1/cloudflared-linux-arm64',
      sha256: '9979dc152097a29b6de4d1ef13e2f1821c67a6f096f88cc18f0fd25106305d3a'
    },
    nezhaV0: {
      fileUrl: 'https://github.com/nezhahq/agent/releases/download/v0.20.5/nezha-agent_linux_arm64.zip',
      sha256: '1d841f85e1864f6f9c92914df73a047e83f01f0cc084fa45df9b59669193ae1f',
      archiveEntry: 'nezha-agent'
    },
    nezhaV1: {
      fileUrl: 'https://github.com/nezhahq/agent/releases/download/v1.0.1/nezha-agent_linux_arm64.zip',
      sha256: '913c41c52a9699665247e1aa4c5e27c7702a0905cad60519fb221b199a14c885',
      archiveEntry: 'nezha-agent'
    }
  }
};
const UPLOAD_URL = process.env.UPLOAD_URL || '';      // 节点或订阅自动上传地址,需填写部署Merge-sub项目后的首页地址,例如：https://merge.xxx.com
const PROJECT_URL = process.env.PROJECT_URL || '';    // 需要上传订阅或保活时需填写项目分配的url,例如：https://google.com
const AUTO_ACCESS = process.env.AUTO_ACCESS || false; // false关闭自动保活，true开启,需同时填写PROJECT_URL变量
const FILE_PATH = process.env.FILE_PATH || '.tmp';   // 运行目录,sub节点文件保存目录
const SUB_PATH = process.env.SUB_PATH || 'sub';       // 订阅路径
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;        // http服务订阅端口
const UUID = process.env.UUID || '9afd1239-b893-40c1-84dd-51e7ce204913'; // 使用哪吒v1,在不同的平台运行需修改UUID,否则会覆盖
const NEZHA_SERVER = process.env.NEZHA_SERVER || '';        // 哪吒v1填写形式: nz.abc.com:8008  哪吒v0填写形式：nz.abc.com
const NEZHA_PORT = process.env.NEZHA_PORT || '';            // 使用哪吒v1请留空，哪吒v0需填写
const NEZHA_KEY = process.env.NEZHA_KEY || '';              // 哪吒v1的NZ_CLIENT_SECRET或哪吒v0的agent密钥
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'free.catking.de5.net';          // 固定隧道域名,留空即启用临时隧道
const ARGO_AUTH = process.env.ARGO_AUTH || 'eyJhIjoiNWY2OGYxMDZmMzBlMjQ1N2IwZmQ1Y2Y1OGM3YjQxODciLCJ0IjoiODAyNzE5MmUtZjZiYS00Y2NkLWE3YzEtOThmYjAwOTBjYzEzIiwicyI6Ik9HVXlNamt6Tm1RdFl6RmlOUzAwT1dZd0xUa3haak10TWpCbVpEQTNabVJqTURnMSJ9';              // 固定隧道密钥json或token,留空即启用临时隧道,json获取地址：https://json.zone.id
const ARGO_PORT = process.env.ARGO_PORT || 8001;            // 固定隧道端口,使用token需在cloudflare后台设置和这里一致
const CFIP = process.env.CFIP || '162.159.44.2';                       // 节点优选域名或优选ip  
const CFPORT = process.env.CFPORT || 443;                   // 节点优选域名或优选ip对应的端口
const NAME = process.env.NAME || '';                        // 节点名称

// 创建运行文件夹
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH);
  console.log(`${FILE_PATH} is created`);
} else {
  console.log(`${FILE_PATH} already exists`);
}

// 生成随机6位字符
function generateRandomName() {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// 全局常量
let subContent = null;
const npmName = generateRandomName();
const webName = generateRandomName();
const botName = generateRandomName();
const phpName = generateRandomName();
let npmPath = path.join(FILE_PATH, npmName);
let phpPath = path.join(FILE_PATH, phpName);
let webPath = path.join(FILE_PATH, webName);
let botPath = path.join(FILE_PATH, botName);
let subPath = path.join(FILE_PATH, 'sub.txt');
let listPath = path.join(FILE_PATH, 'list.txt');
let bootLogPath = path.join(FILE_PATH, 'boot.log');
let configPath = path.join(FILE_PATH, 'config.json');

// 如果订阅器上存在历史运行节点则先删除
function deleteNodes() {
  try {
    if (!UPLOAD_URL) return;
    if (!fs.existsSync(subPath)) return;

    let fileContent;
    try {
      fileContent = fs.readFileSync(subPath, 'utf-8');
    } catch {
      return null;
    }

    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
    const nodes = decoded.split('\n').filter(line =>
      /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
    );

    if (nodes.length === 0) return;

    axios.post(`${UPLOAD_URL}/api/delete-nodes`,
      JSON.stringify({ nodes }),
      { headers: { 'Content-Type': 'application/json' } }
    ).catch((error) => {
      return null;
    });
    return null;
  } catch (err) {
    return null;
  }
}

// 清理历史文件
function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(FILE_PATH);
    files.forEach(file => {
      const filePath = path.join(FILE_PATH, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        // 忽略所有错误，不记录日志
      }
    });
  } catch (err) {
    // 忽略所有错误，不记录日志
  }
}

// 生成xr-ay配置文件
async function generateConfig() {
  const config = {
    log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
    inbounds: [
      { port: ARGO_PORT, protocol: 'vless', settings: { clients: [{ id: UUID, flow: 'xtls-rprx-vision' }], decryption: 'none', fallbacks: [{ dest: PORT }, { path: `/${SUB_PATH}`, dest: PORT }, { path: "/vless-argo", dest: 3002 }, { path: "/vmess-argo", dest: 3003 }, { path: "/trojan-argo", dest: 3004 }] }, streamSettings: { network: 'tcp' } },
      { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
      { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID, level: 0 }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
      { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: UUID, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
      { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: UUID }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
    ],
    dns: { servers: ["https+local://8.8.8.8/dns-query"] },
    outbounds: [{ protocol: "freedom", tag: "direct" }, { protocol: "blackhole", tag: "block" }]
  };
  fs.writeFileSync(path.join(FILE_PATH, 'config.json'), JSON.stringify(config, null, 2));
}

// 判断系统架构
function getSystemArchitecture() {
  const arch = os.arch();
  if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
    return 'arm';
  } else {
    return 'amd';
  }
}

function normalizeHostname(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
}

function calculateSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function extractZipEntry(zipPath, entryName, outputPath) {
  const zip = fs.readFileSync(zipPath);
  let eocdOffset = -1;
  const searchStart = Math.max(0, zip.length - 0xffff - 22);

  for (let i = zip.length - 22; i >= searchStart; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid zip archive: EOCD not found');
  }

  const entries = zip.readUInt16LE(eocdOffset + 10);
  let offset = zip.readUInt32LE(eocdOffset + 16);
  let target = null;

  for (let i = 0; i < entries; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid zip archive: central directory is corrupt');
    }

    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const archivedName = zip.slice(offset + 46, offset + 46 + fileNameLength).toString();

    if (archivedName === entryName || path.basename(archivedName) === entryName) {
      target = { method, compressedSize, uncompressedSize, localHeaderOffset, archivedName };
      break;
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  if (!target) {
    throw new Error(`Archive entry ${entryName} not found`);
  }

  const localOffset = target.localHeaderOffset;
  if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error(`Invalid local header for ${target.archivedName}`);
  }

  const localFileNameLength = zip.readUInt16LE(localOffset + 26);
  const localExtraLength = zip.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + localFileNameLength + localExtraLength;
  const compressed = zip.slice(dataStart, dataStart + target.compressedSize);
  let content;

  if (target.method === 0) {
    content = compressed;
  } else if (target.method === 8) {
    content = zlib.inflateRawSync(compressed);
  } else {
    throw new Error(`Unsupported zip compression method ${target.method} for ${target.archivedName}`);
  }

  if (content.length !== target.uncompressedSize) {
    throw new Error(`Extracted ${target.archivedName} size mismatch`);
  }

  fs.writeFileSync(outputPath, content);
}

function prepareDownloadedFile(fileInfo, downloadPath, finalPath) {
  if (fileInfo.sha256) {
    const actualSha256 = calculateSha256(downloadPath);
    if (actualSha256 !== fileInfo.sha256) {
      throw new Error(`SHA256 mismatch for ${path.basename(finalPath)}: expected ${fileInfo.sha256}, got ${actualSha256}`);
    }
  }

  if (fileInfo.archiveEntry) {
    extractZipEntry(downloadPath, fileInfo.archiveEntry, finalPath);
    fs.unlink(downloadPath, () => {});
  }
}

// 下载对应系统架构的依赖文件
function downloadFile(fileInfo, callback) {
  const filePath = fileInfo.fileName;
  const downloadPath = fileInfo.archiveEntry ? `${filePath}.zip` : filePath;

  if (!fs.existsSync(FILE_PATH)) {
    fs.mkdirSync(FILE_PATH, { recursive: true });
  }

  const writer = fs.createWriteStream(downloadPath);

  axios({
    method: 'get',
    url: fileInfo.fileUrl,
    responseType: 'stream',
  })
    .then(response => {
      response.data.pipe(writer);

      writer.on('finish', () => {
        writer.close();
        try {
          prepareDownloadedFile(fileInfo, downloadPath, filePath);
          console.log(`Download ${path.basename(filePath)} successfully`);
          callback(null, filePath);
        } catch (err) {
          fs.unlink(downloadPath, () => {});
          if (downloadPath !== filePath) {
            fs.unlink(filePath, () => {});
          }
          const errorMessage = `Download ${path.basename(filePath)} failed: ${err.message}`;
          console.error(errorMessage);
          callback(errorMessage);
        }
      });

      writer.on('error', err => {
        fs.unlink(downloadPath, () => {});
        const errorMessage = `Download ${path.basename(filePath)} failed: ${err.message}`;
        console.error(errorMessage);
        callback(errorMessage);
      });
    })
    .catch(err => {
      fs.unlink(downloadPath, () => {});
      const errorMessage = `Download ${path.basename(filePath)} failed: ${err.message}`;
      console.error(errorMessage);
      callback(errorMessage);
    });
}

// 下载并运行依赖文件
async function downloadFilesAndRun() {
  const architecture = getSystemArchitecture();
  const filesToDownload = getFilesForArchitecture(architecture);

  if (filesToDownload.length === 0) {
    console.log(`Can't find a file for the current architecture`);
    return;
  }

  const downloadPromises = filesToDownload.map(fileInfo => {
    return new Promise((resolve, reject) => {
      downloadFile(fileInfo, (err, filePath) => {
        if (err) {
          reject(err);
        } else {
          resolve(filePath);
        }
      });
    });
  });

  try {
    await Promise.all(downloadPromises);
  } catch (err) {
    console.error('Error downloading files:', err);
    return;
  }

  function authorizeFiles(filePaths) {
    const newPermissions = 0o775;
    filePaths.forEach(absoluteFilePath => {
      if (fs.existsSync(absoluteFilePath)) {
        try {
          fs.chmodSync(absoluteFilePath, newPermissions);
          console.log(`Empowerment success for ${absoluteFilePath}: ${newPermissions.toString(8)}`);
        } catch (err) {
          console.error(`Empowerment failed for ${absoluteFilePath}: ${err}`);
        }
      }
    });
  }
  const filesToAuthorize = NEZHA_PORT ? [npmPath, webPath, botPath] : [phpPath, webPath, botPath];
  authorizeFiles(filesToAuthorize);

  // 运行ne-zha
  if (NEZHA_SERVER && NEZHA_KEY) {
    if (!NEZHA_PORT) {
      const port = NEZHA_SERVER.includes(':') ? NEZHA_SERVER.split(':').pop() : '';
      const tlsPorts = new Set(['443', '8443', '2096', '2087', '2083', '2053']);
      const nezhatls = tlsPorts.has(port) ? 'true' : 'false';
      const configYaml = `
client_secret: ${NEZHA_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: true
ip_report_period: 1800
report_delay: 4
server: ${NEZHA_SERVER}
skip_connection_count: true
skip_procs_count: true
temperature: false
tls: ${nezhatls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${UUID}`;

      fs.writeFileSync(path.join(FILE_PATH, 'config.yaml'), configYaml);

      const command = `nohup ${phpPath} -c "${FILE_PATH}/config.yaml" >/dev/null 2>&1 &`;
      try {
        await exec(command);
        console.log(`${phpName} is running`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`php running error: ${error}`);
      }
    } else {
      let NEZHA_TLS = '';
      const tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
      if (tlsPorts.includes(NEZHA_PORT)) {
        NEZHA_TLS = '--tls';
      }
      const command = `nohup ${npmPath} -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${NEZHA_TLS} --disable-auto-update --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &`;
      try {
        await exec(command);
        console.log(`${npmName} is running`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`npm running error: ${error}`);
      }
    }
  } else {
    console.log('NEZHA variable is empty,skip running');
  }

  // 运行xr-ay
  const command1 = `nohup ${webPath} -c ${FILE_PATH}/config.json >/dev/null 2>&1 &`;
  try {
    await exec(command1);
    console.log(`${webName} is running`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`web running error: ${error}`);
  }

  // 运行cloud-fared
  if (fs.existsSync(botPath)) {
    let args;

    if (ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
      args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${ARGO_AUTH}`;
    } else if (ARGO_AUTH.match(/TunnelSecret/)) {
      args = `tunnel --edge-ip-version auto --config ${FILE_PATH}/tunnel.yml run`;
    } else {
      args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${ARGO_PORT}`;
    }

    try {
      await exec(`nohup ${botPath} ${args} >/dev/null 2>&1 &`);
      console.log(`${botName} is running`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error executing command: ${error}`);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

// 根据系统架构返回对应的url
function getFilesForArchitecture(architecture) {
  const downloads = OFFICIAL_DOWNLOADS[architecture] || OFFICIAL_DOWNLOADS.amd;
  const baseFiles = [
    { fileName: webPath, ...downloads.web },
    { fileName: botPath, ...downloads.bot }
  ];

  if (NEZHA_SERVER && NEZHA_KEY) {
    if (NEZHA_PORT) {
      baseFiles.unshift({ fileName: npmPath, ...downloads.nezhaV0 });
    } else {
      baseFiles.unshift({ fileName: phpPath, ...downloads.nezhaV1 });
    }
  }

  return baseFiles;
}

// 获取固定隧道json
function argoType() {
  if (!ARGO_AUTH || !ARGO_DOMAIN) {
    console.log("ARGO_DOMAIN or ARGO_AUTH is empty, use quick tunnels");
    return;
  }
  const argoDomain = normalizeHostname(ARGO_DOMAIN);

  if (ARGO_AUTH.includes('TunnelSecret')) {
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.json'), ARGO_AUTH);
    const tunnelYaml = `
  tunnel: ${ARGO_AUTH.split('"')[11]}
  credentials-file: ${path.join(FILE_PATH, 'tunnel.json')}
  protocol: http2
  
  ingress:
    - hostname: ${argoDomain}
      service: http://localhost:${ARGO_PORT}
      originRequest:
        noTLSVerify: true
    - service: http_status:404
  `;
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.yml'), tunnelYaml);
  } else {
    console.log(`Using token connect to tunnel, please set ${ARGO_PORT} in clouudflare`);
  }
}

// 获取临时隧道domain
async function extractDomains() {
  let argoDomain;

  if (ARGO_AUTH && ARGO_DOMAIN) {
    argoDomain = normalizeHostname(ARGO_DOMAIN);
    console.log('ARGO_DOMAIN:', argoDomain);
    await generateLinks(argoDomain);
  } else {
    try {
      const fileContent = fs.readFileSync(path.join(FILE_PATH, 'boot.log'), 'utf-8');
      const lines = fileContent.split('\n');
      const argoDomains = [];
      lines.forEach((line) => {
        const domainMatch = line.match(/https?:\/\/([^ ]*trycloudflare\.com)\/?/);
        if (domainMatch) {
          const domain = domainMatch[1];
          argoDomains.push(domain);
        }
      });

      if (argoDomains.length > 0) {
        argoDomain = argoDomains[0];
        console.log('ArgoDomain:', argoDomain);
        await generateLinks(argoDomain);
      } else {
        console.log('ArgoDomain not found, re-running bot to obtain ArgoDomain');
        fs.unlinkSync(path.join(FILE_PATH, 'boot.log'));
        async function killBotProcess() {
          try {
            if (process.platform === 'win32') {
              await exec(`taskkill /f /im ${botName}.exe > nul 2>&1`);
            } else {
              await exec(`pkill -f "[${botName.charAt(0)}]${botName.substring(1)}" > /dev/null 2>&1`);
            }
          } catch (error) {
            // 忽略输出
          }
        }
        killBotProcess();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${ARGO_PORT}`;
        try {
          await exec(`nohup ${botPath} ${args} >/dev/null 2>&1 &`);
          console.log(`${botName} is running`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          await extractDomains();
        } catch (error) {
          console.error(`Error executing command: ${error}`);
        }
      }
    } catch (error) {
      console.error('Error reading boot.log:', error);
    }
  }
}

// 获取isp信息
async function getMetaInfo() {
  try {
    const response1 = await axios.get('https://api.ip.sb/geoip', { headers: { 'User-Agent': 'Mozilla/5.0', timeout: 3000 } });
    if (response1.data && response1.data.country_code && response1.data.isp) {
      return `${response1.data.country_code}-${response1.data.isp}`.replace(/\s+/g, '_');
    }
  } catch (error) {
    try {
      const response2 = await axios.get('http://ip-api.com/json', { headers: { 'User-Agent': 'Mozilla/5.0', timeout: 3000 } });
      if (response2.data && response2.data.status === 'success' && response2.data.countryCode && response2.data.org) {
        return `${response2.data.countryCode}-${response2.data.org}`.replace(/\s+/g, '_');
      }
    } catch (error) {
      // console.error('Backup API also failed');
    }
  }
  return 'Unknown';
}

// 生成 list 和 sub 信息
async function generateLinks(argoDomain) {
  argoDomain = normalizeHostname(argoDomain);
  const nodeAddress = normalizeHostname(CFIP) || argoDomain;
  const ISP = await getMetaInfo();
  const nodeName = NAME ? `${NAME}-${ISP}` : ISP;
  return new Promise((resolve) => {
    setTimeout(() => {
      const VMESS = { v: '2', ps: `${nodeName}`, add: nodeAddress, port: CFPORT, id: UUID, aid: '0', scy: 'auto', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, alpn: '', fp: 'firefox' };
      const subTxt = `
vless://${UUID}@${nodeAddress}:${CFPORT}?encryption=none&security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${nodeName}

vmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}

trojan://${UUID}@${nodeAddress}:${CFPORT}?security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${nodeName}
    `;
      console.log(Buffer.from(subTxt).toString('base64'));
      fs.writeFileSync(subPath, Buffer.from(subTxt).toString('base64'));
      console.log(`${FILE_PATH}/sub.txt saved successfully`);
      // 将订阅内容保存到全局变量，供 http 服务器使用
      subContent = Buffer.from(subTxt).toString('base64');
      uploadNodes();
      resolve(subTxt);
    }, 2000);
  });
}

// 自动上传节点或订阅
async function uploadNodes() {
  if (UPLOAD_URL && PROJECT_URL) {
    const subscriptionUrl = `${PROJECT_URL}/${SUB_PATH}`;
    const jsonData = {
      subscription: [subscriptionUrl]
    };
    try {
      const response = await axios.post(`${UPLOAD_URL}/api/add-subscriptions`, jsonData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response && response.status === 200) {
        console.log('Subscription uploaded successfully');
        return response;
      } else {
        return null;
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 400) {
          // console.error('Subscription already exists');
        }
      }
    }
  } else if (UPLOAD_URL) {
    if (!fs.existsSync(listPath)) return;
    const content = fs.readFileSync(listPath, 'utf-8');
    const nodes = content.split('\n').filter(line => /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line));

    if (nodes.length === 0) return;

    const jsonData = JSON.stringify({ nodes });

    try {
      const response = await axios.post(`${UPLOAD_URL}/api/add-nodes`, jsonData, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response && response.status === 200) {
        console.log('Nodes uploaded successfully');
        return response;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  } else {
    // console.log('Skipping upload nodes');
    return;
  }
}

// 90s后删除相关文件
function cleanFiles() {
  setTimeout(() => {
    const filesToDelete = [bootLogPath, configPath, webPath, botPath];

    if (NEZHA_PORT) {
      filesToDelete.push(npmPath);
    } else if (NEZHA_SERVER && NEZHA_KEY) {
      filesToDelete.push(phpPath);
    }

    if (process.platform === 'win32') {
      exec(`del /f /q ${filesToDelete.join(' ')} > nul 2>&1`, (error) => {
        console.clear();
        console.log('App is running');
        console.log('Thank you for using this script, enjoy!');
      });
    } else {
      exec(`rm -rf ${filesToDelete.join(' ')} >/dev/null 2>&1`, (error) => {
        console.clear();
        console.log('App is running');
        console.log('Thank you for using this script, enjoy!');
      });
    }
  }, 90000);
}
cleanFiles();

// 自动访问项目URL
async function AddVisitTask() {
  if (!AUTO_ACCESS || !PROJECT_URL) {
    console.log("Skipping adding automatic access task");
    return;
  }

  try {
    const response = await axios.post('https://oooo.serv00.net/add-url', {
      url: PROJECT_URL
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`automatic access task added successfully`);
    return response;
  } catch (error) {
    console.error(`Add automatic access task faild: ${error.message}`);
    return null;
  }
}

// 主运行逻辑
async function startserver() {
  try {
    argoType();
    deleteNodes();
    cleanupOldFiles();
    await generateConfig();
    await downloadFilesAndRun();
    await extractDomains();
    await AddVisitTask();
  } catch (error) {
    console.error('Error in startserver:', error);
  }
}
startserver().catch(error => {
  console.error('Unhandled error in startserver:', error);
});

// 创建 http 服务器
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // 订阅路由
  if (urlPath === `/${SUB_PATH}`) {
    if (subContent) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(subContent);
    } else {
      // 订阅内容尚未生成，尝试从文件读取
      try {
        const fileContent = fs.readFileSync(subPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(fileContent);
      } catch (err) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Subscription content not yet available, please try again later.');
      }
    }
    return;
  }

  // 根路由: /
  if (urlPath === '/') {
    try {
      const filePath = path.join(__dirname, 'index.html');
      const data = await fs.promises.readFile(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end("Hello world!<br><br>You can access /{SUB_PATH}(Default: /sub) to get your nodes!");
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, () => console.log(`http server is running on port:${PORT}!`));
