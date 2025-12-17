/*
 * Loon 脚本：Scamalytics 全能版 (ipapi.co + 中文优化)
 * 功能：
 * 1. 基础数据源更换为 ipapi.co (HTTPS)
 * 2. 内置汉化映射，保持中文国家显示
 * 3. Scamalytics 抓取核心风险评分
 * 4. 兼容节点点击与后台监控
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

// --- 2. 汉化映射表 (弥补 ipapi.co 只有英文的缺憾) ---
const countryMap = {
    "CN": "中国", "HK": "香港", "MO": "澳门", "TW": "台湾",
    "US": "美国", "JP": "日本", "KR": "韩国", "SG": "新加坡",
    "GB": "英国", "FR": "法国", "DE": "德国", "NL": "荷兰",
    "RU": "俄罗斯", "IN": "印度", "CA": "加拿大", "AU": "澳大利亚",
    "MY": "马来西亚", "TH": "泰国", "VN": "越南", "PH": "菲律宾",
    "ID": "印尼", "TR": "土耳其", "IT": "意大利", "ES": "西班牙",
    "BR": "巴西", "AR": "阿根廷", "MX": "墨西哥", "ZA": "南非",
    "CH": "瑞士", "SE": "瑞典", "AE": "阿联酋", "IL": "以色列"
};

// --- 3. 核心执行逻辑 ---

// 步骤 A: 获取基础 IP 信息 (ipapi.co)
// ipapi.co 不需要时间戳参数，默认 HTTPS
const ipApiUrl = `https://ipapi.co/json/`;

let ipApiOptions = { 
    url: ipApiUrl, 
    timeout: 8000,
    headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }
};

let nodeNameDisplay = "";
if (isNodeClick) {
    ipApiOptions.node = $environment.params.node;
    nodeNameDisplay = `节点：${$environment.params.node}\n`;
}

$httpClient.get(ipApiOptions, (err, resp, data) => {
    // A1. 错误处理
    if (err || resp.status !== 200) {
        handleError("基础数据失败", "无法连接 ipapi.co");
        return;
    }
    
    let ipInfo;
    try {
        const raw = JSON.parse(data);
        if (raw.error) {
            handleError("API 限制", raw.reason || "请求过快");
            return;
        }
        
        // 数据映射与汉化
        let cnCountry = countryMap[raw.country_code] || raw.country_name;
        
        ipInfo = {
            query: raw.ip,
            isp: raw.org,     // ipapi.co 的运营商
            country: cnCountry, // 使用汉化后的国家名
            countryCode: raw.country_code,
            city: raw.city,   // 城市名保持英文 (ipapi.co 不支持中文城市)
            isHosting: false, // ipapi.co 免费版不直接提供 hosting 字段，暂默认 false
        };
    } catch (e) {
        handleError("解析失败", "数据格式异常");
        return;
    }

    // A2. 监控模式逻辑
    const currentIP = ipInfo.query;
    if (!isNodeClick) {
        const lastIP = $persistentStore.read("Loon_Scamalytics_Last_IP");
        if (isMonitor) {
            if (lastIP === currentIP) { $done(); return; }
            console.log(`[监控] IP变动: ${lastIP} -> ${currentIP}`);
        }
        $persistentStore.write(currentIP, "Loon_Scamalytics_Last_IP");
    }

    // 步骤 B: Scamalytics 查分
    const scamUrl = `https://scamalytics.com/ip/${currentIP}`;
    const scamHeaders = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };
    
    let scamOptions = { url: scamUrl, headers: scamHeaders, timeout: 8000 };
    if (isNodeClick) scamOptions.node = $environment.params.node;

    $httpClient.get(scamOptions, (sErr, sResp, sData) => {
        // B1. 提取分数
        let score = 0;
        let scoreFound = false;

        if (!sErr && sResp.status === 200) {
            // 正则匹配分数
            const scoreRegex = /Fraud Score\s*<\/div>\s*<div[^>]*>\s*(\d+)\s*<\/div>/i;
            const match = sData.match(scoreRegex);
            
            if (match && match[1]) {
                score = parseInt(match[1]);
                scoreFound = true;
            } else {
                const altRegex = /"score":"?(\d+)"?/;
                const altMatch = sData.match(altRegex);
                if (altMatch && altMatch[1]) {
                    score = parseInt(altMatch[1]);
                    scoreFound = true;
                }
            }
        }

        if (!scoreFound) console.log("Scamalytics 抓取失败，显示基础信息");

        // B2. 渲染 UI
        renderUI(ipInfo, score, scoreFound);
    });
});

// --- 4. 辅助函数 ---

function renderUI(ipInfo, score, scoreFound) {
    // 风险评级
    let riskLevel = "低风险";
    let titleColor = "#34C759"; // 绿
    let icon = "checkmark.seal.fill";
    let riskBar = "🟩🟩🟩🟩🟩";
    
    if (!scoreFound) {
        riskLevel = "无评分";
        titleColor = "#8E8E93"; // 灰
        icon = "questionmark.circle.fill";
        riskBar = "⬜️⬜️⬜️⬜️⬜️";
    } else if (score >= 70) {
        riskLevel = "高风险";
        titleColor = "#FF3B30"; // 红
        icon = "exclamationmark.triangle.fill";
        riskBar = "🟥🟥🟥🟥🟥";
    } else if (score >= 30) {
        riskLevel = "中等风险";
        titleColor = "#FFCC00"; // 黄
        icon = "exclamationmark.triangle.fill";
        riskBar = "🟨🟨🟨⬜️⬜️";
    }

    // 来源/属性标签 (ipapi.co 免费版不提供详细类型，此处做简化处理)
    // 如果 Scamalytics 分数很高，大概率是机房
    let propertyLabel = "互联网服务提供商"; 
    if (score > 50) propertyLabel = "数据中心(疑似)";

    // 构建文本
    const flag = flagEmoji(ipInfo.countryCode);
    const displayScore = scoreFound ? `${score}分` : "无评分";
    
    let title = "Scamalytics 质量报告";
    if (isMonitor) title = "Scamalytics🔔 IP已变动";

    // 副标题：国旗 国家 ｜ XX分
    const subtitle = `${flag} ${ipInfo.country} ｜ ${displayScore}`;

    const content = 
`${nodeNameDisplay}IP：${ipInfo.query}
ISP：${ipInfo.isp}
位置：${flag} ${ipInfo.country} ${ipInfo.city}
属性：${propertyLabel}
欺诈分数：${score}% ${riskLevel}
${riskBar}`;

    // 发送通知 (强制弹窗)
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
