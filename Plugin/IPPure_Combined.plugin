/*
 * Loon 脚本：IPPure 全能复刻版
 * 功能：
 * 1. 深度复刻 IPPure 网页版 UI 风格 (来源/属性/系数)
 * 2. 节点列表点击：测试独立节点 (强制弹窗)
 * 3. 首页卡片：手动刷新 (强制弹窗)
 * 4. 后台监控：仅 IP 变动时弹窗
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

// --- 2. 准备请求 ---
const timestamp = new Date().getTime();
const url = `https://my.ippure.com/v1/info?t=${timestamp}`;
const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};

let requestOptions = {
    url: url,
    headers: headers,
    timeout: 8000
};

// 节点点击模式：劫持流量
let nodeNameDisplay = "";
if (isNodeClick) {
    requestOptions.node = $environment.params.node;
    nodeNameDisplay = `节点：${$environment.params.node}\n`;
}

// --- 3. 辅助数据 (汉化表) ---
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

// --- 4. 发起请求 ---
$httpClient.get(requestOptions, (err, resp, data) => {
    // 错误处理
    if (err) {
        if (isMonitor) { $done(); } 
        else {
            $notification.post("IPPure检测失败", "网络错误", "无法连接服务器");
            $done({ title: "检测失败", content: "网络错误", icon: "network.slash", "background-color": "#FF0000" });
        }
        return;
    }

    if (resp.status !== 200) {
        let msg = `服务器状态码: ${resp.status}`;
        if (resp.status === 403) msg = "🛑 访问被拒 (WAF拦截)";
        if (!isMonitor) {
            $notification.post("IPPure检测失败", msg, "请切换节点重试");
            $done({ title: "检测失败", content: msg, icon: "exclamationmark.triangle", "background-color": "#FF9500" });
        } else { $done(); }
        return;
    }

    let j;
    try {
        j = JSON.parse(data);
    } catch (e) {
        if (!isMonitor) {
            let reason = "数据解析错误";
            if (data.includes("Cloudflare") || data.includes("html")) reason = "🚫 触发官网 WAF 拦截";
            $notification.post("IPPure检测失败", reason, "该节点被识别为爬虫");
            $done({ title: "检测失败", content: reason, icon: "hand.raised.fill", "background-color": "#FF3B30" });
        } else { $done(); }
        return;
    }

    // --- 5. 监控模式逻辑 ---
    if (!isNodeClick) {
        const currentIP = j.ip;
        const lastIP = $persistentStore.read("Loon_IPPure_Last_IP");
        if (isMonitor) {
            if (lastIP === currentIP) { $done(); return; }
            console.log(`[IPPure监控] IP变动: ${lastIP} -> ${currentIP}`);
        }
        $persistentStore.write(currentIP, "Loon_IPPure_Last_IP");
    }

    // --- 6. 数据可视化构建 (复刻网页版) ---
    
    // 位置处理
    const flag = flagEmoji(j.countryCode);
    let cnCountry = countryMap[j.countryCode] || "";
    if(cnCountry) cnCountry = cnCountry + " ";
    
    // 风险处理 (模拟网页版百分比)
    const risk = j.fraudScore;
    let riskLevel = "低风险";
    let titleColor = "#34C759"; // 绿
    let icon = "checkmark.seal.fill";
    let riskBar = "🟩🟩🟩🟩🟩"; // 简单的进度条模拟

    if (risk >= 80) {
        riskLevel = "极高风险";
        titleColor = "#FF3B30"; // 红
        icon = "exclamationmark.triangle.fill";
        riskBar = "🟥🟥🟥🟥🟥";
    } else if (risk >= 70) {
        riskLevel = "高风险";
        titleColor = "#FF9500"; // 橙
        icon = "exclamationmark.triangle.fill";
        riskBar = "🟧🟧🟧🟧⬜️";
    } else if (risk >= 40) {
        riskLevel = "中等风险";
        titleColor = "#FFCC00"; // 黄
        riskBar = "🟨🟨🟨⬜️⬜️";
    }

    // 来源与属性 (模拟网页版标签)
    // API 只有 isResidential，我们通过它来生成两个标签
    let sourceLabel = "";
    let propertyLabel = "";
    
    if (j.isResidential) {
        sourceLabel = "原生 IP";
        propertyLabel = "住宅网络";
    } else {
        sourceLabel = "非原生/广播";
        propertyLabel = "数据中心(机房)";
    }

    // 标题
    let title = "IPPure 质量报告";
    if (isMonitor) title = "🔔 IP已变动";

    // 内容排版 (尽量对齐截图风格)
    const content = 
`${nodeNameDisplay}IP：${j.ip}
ASN：${j.asOrganization} (AS${j.asn})
位置：${flag} ${cnCountry}${j.country} ${j.city}
IP来源：${sourceLabel}
IP属性：${propertyLabel}
IPPure系数：${risk}% ${riskLevel}
${riskBar}`;

    // 发送通知 (强制弹窗)
    // 副标题显示最关键的风险信息
    const subtitle = `${flag} ${risk}% ${riskLevel} | ${sourceLabel}`;
    $notification.post(title, subtitle, content);
    
    $done({
        title: title,
        content: content,
        icon: icon,
        'background-color': titleColor
    });
});

function flagEmoji(code) {
    if (!code) return "🌍";
    if (code.toUpperCase() === "TW") { code = "CN"; }
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
}
