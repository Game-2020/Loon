/*
 * Loon 脚本：Scamalytics 全能版 (混合接口)
 * 核心逻辑：
 * 1. 使用 IP-API 获取基础信息 (IP/中文城市/ISP/类型)
 * 2. 使用 Scamalytics 抓取核心风险评分 (Fraud Score)
 * 3. 完美复刻 IPPure UI 风格
 */

// --- 1. 环境与参数识别 ---
let args = {};
if (typeof $argument !== 'undefined') {
    $argument.split('&').forEach(item => {
        let [key, val] = item.split('=');
        args[key] = val;
    });
}

// 判定模式
const isNodeClick = (typeof $environment !== 'undefined' && $environment.params && $environment.params.node);
const isMonitor = args.mode === "monitor";

// --- 2. 核心执行逻辑 ---

// 步骤 A: 获取基础 IP 信息 (利用 IP-API 的中文能力)
const ipApiTimestamp = new Date().getTime();
const ipApiUrl = `http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,countryCode,regionName,city,isp,org,as,mobile,proxy,hosting,query&t=${ipApiTimestamp}`;

// 如果是节点点击模式，指定节点
let ipApiOptions = { url: ipApiUrl, timeout: 5000 };
let nodeNameDisplay = "";
if (isNodeClick) {
    ipApiOptions.node = $environment.params.node;
    nodeNameDisplay = `节点：${$environment.params.node}\n`;
}

$httpClient.get(ipApiOptions, (err, resp, data) => {
    // A1. IP-API 错误处理
    if (err || resp.status !== 200) {
        handleError("基础数据获取失败", "无法连接 IP-API");
        return;
    }
    
    let ipInfo;
    try {
        ipInfo = JSON.parse(data);
    } catch (e) {
        handleError("解析失败", "IP-API 数据异常");
        return;
    }

    if (ipInfo.status !== "success") {
        handleError("API 错误", ipInfo.message);
        return;
    }

    // A2. 监控模式逻辑 (IP 变动检测)
    const currentIP = ipInfo.query;
    if (!isNodeClick) {
        const lastIP = $persistentStore.read("Loon_Scamalytics_Last_IP");
        if (isMonitor) {
            // 如果 IP 没变，静默退出
            if (lastIP === currentIP) { $done(); return; }
            console.log(`[监控] IP变动: ${lastIP} -> ${currentIP}`);
        }
        $persistentStore.write(currentIP, "Loon_Scamalytics_Last_IP");
    }

    // 步骤 B: 去 Scamalytics 查分 (核心)
    // 构造 Scamalytics 查询链接
    const scamUrl = `https://scamalytics.com/ip/${currentIP}`;
    // 必须模拟浏览器 UA，否则会被 Scamalytics 拦截
    const scamHeaders = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };
    
    let scamOptions = { url: scamUrl, headers: scamHeaders, timeout: 8000 };
    if (isNodeClick) scamOptions.node = $environment.params.node;

    $httpClient.get(scamOptions, (sErr, sResp, sData) => {
        // B1. Scamalytics 错误处理
        let score = 0;
        let riskLevel = "未知";
        let scoreFound = false;

        if (!sErr && sResp.status === 200) {
            // B2. 正则提取分数 (HTML Parsing)
            // 查找类似: "Fraud Score</div> <div ...> 0 </div>" 的结构
            // 或者 JSON 结构: "score":"0"
            const scoreRegex = /Fraud Score\s*<\/div>\s*<div[^>]*>\s*(\d+)\s*<\/div>/i;
            const match = sData.match(scoreRegex);
            
            if (match && match[1]) {
                score = parseInt(match[1]);
                scoreFound = true;
            } else {
                // 备用正则，防止网页结构微调
                const altRegex = /"score":"(\d+)"/;
                const altMatch = sData.match(altRegex);
                if (altMatch && altMatch[1]) {
                    score = parseInt(altMatch[1]);
                    scoreFound = true;
                }
            }
        }

        // 如果没抓到分数 (可能被 WAF 拦截)，降级显示
        if (!scoreFound) {
            // 保持静默或者显示警告，这里选择显示警告但继续展示基础信息
            console.log("Scamalytics 抓取失败或被拦截，仅显示基础信息");
            riskLevel = "检测失败";
        }

        // B3. 渲染 UI
        renderUI(ipInfo, score, scoreFound);
    });
});

// --- 3. 辅助函数 ---

function renderUI(ipInfo, score, scoreFound) {
    // 1. 风险评级 (Scamalytics 标准更严)
    // 0-20: Low, 21-40: Medium, 41-60: High, 61+: Very High
    let riskLevel = "低风险";
    let titleColor = "#34C759"; // 绿
    let icon = "checkmark.seal.fill";
    let riskBar = "🟩🟩🟩🟩🟩";
    
    if (!scoreFound) {
        riskLevel = "无评分(拦截)";
        titleColor = "#8E8E93"; // 灰
        icon = "questionmark.circle.fill";
        riskBar = "⬜️⬜️⬜️⬜️⬜️";
    } else if (score >= 75) {
        riskLevel = "极高风险";
        titleColor = "#FF3B30"; // 红
        icon = "exclamationmark.triangle.fill";
        riskBar = "🟥🟥🟥🟥🟥";
    } else if (score >= 50) {
        riskLevel = "高风险";
        titleColor = "#FF9500"; // 橙
        icon = "exclamationmark.triangle.fill";
        riskBar = "🟧🟧🟧🟧⬜️";
    } else if (score >= 25) {
        riskLevel = "中等风险";
        titleColor = "#FFCC00"; // 黄
        riskBar = "🟨🟨🟨⬜️⬜️";
    }

    // 2. 标签处理 (基于 IP-API 数据)
    // IP-API 的 hosting=true 对应 "机房"，mobile=true 对应 "流量"
    let sourceLabel = "原生 IP";
    let propertyLabel = "住宅网络";

    if (ipInfo.hosting) {
        sourceLabel = "非原生/广播";
        propertyLabel = "数据中心(机房)";
    } else if (ipInfo.mobile) {
        propertyLabel = "移动网络";
    }

    // 3. 构建文本
    const flag = flagEmoji(ipInfo.countryCode);
    const country = ipInfo.country; // 中文国家
    const city = ipInfo.city;       // 中文城市
    
    let title = "Scamalytics 质量报告";
    if (isMonitor) title = "Scamalytics🔔 IP已变动";

    // 副标题：国旗 国家 ｜ XX分
    const displayScore = scoreFound ? `${score}分` : "无评分";
    const subtitle = `${flag} ${country} ｜ ${displayScore}`;

    const content = 
`${nodeNameDisplay}IP：${ipInfo.query}
ISP：${ipInfo.isp}
位置：${flag} ${country} ${city}
IP来源：${sourceLabel}
IP属性：${propertyLabel}
欺诈分数：${score}% ${riskLevel}
${riskBar}`;

    // 4. 发送通知 (强制弹窗)
    $notification.post(title, subtitle, content);
    
    $done({
        title: title,
        content: content,
        icon: icon,
        'background-color': titleColor
    });
}

function handleError(title, msg) {
    if (isMonitor) {
        $done();
    } else {
        $notification.post("检测失败", title, msg);
        $done({ title: "检测失败", content: msg, icon: "network.slash", "background-color": "#FF0000" });
    }
}

function flagEmoji(code) {
    if (!code) return "🌍";
    if (code.toUpperCase() === "TW") { code = "CN"; }
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
}
