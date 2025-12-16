/*
 * Loon 脚本：IPPure 全能复刻版 (自定义通知版)
 * 功能：
 * 1. 深度复刻 IPPure 网页版 UI
 * 2. 通知栏副标题：显示 [国旗 国家 | 风险分]
 * 3. 兼容所有模式 (节点点击/卡片/监控)
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
            $notification.post("IPPure检测失败", "", "网络错误，无法连接服务器");
            $done({ title: "检测失败", content: "网络错误", icon: "network.slash", "background-color": "#FF0000" });
        }
        return;
    }

    if (resp.status !== 200) {
        let msg = `服务器状态码: ${resp.status}`;
        if (resp.status === 403) msg = "🛑 访问被拒 (WAF拦截)";
        if (!isMonitor) {
            $notification.post("IPPure检测失败", "", msg);
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
            $notification.post("IPPure检测失败", "", reason);
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

    // --- 6. 数据可视化构建 ---
    
    // 位置与国旗
    const flag = flagEmoji(j.countryCode);
    let cnCountry = countryMap[j.countryCode] || ""; // 获取中文名
    let displayCountry = cnCountry ? cnCountry : j.country; // 用于副标题：有中文显中文，没中文显英文
    if(cnCountry) cnCountry = cnCountry + " "; // 用于正文排版，加空格
    
    // 风险等级
    const risk = j.fraudScore;
    let riskLevel = "低风险";
    let titleColor = "#34C759"; 
    let icon = "checkmark.seal.fill";
    let riskBar = "🟩🟩🟩🟩🟩";

    if (risk >= 80) {
        riskLevel = "极高风险";
        titleColor = "#FF3B30"; 
        icon = "exclamationmark.triangle.fill";
        riskBar = "🟥🟥🟥🟥🟥";
    } else if (risk >= 70) {
        riskLevel = "高风险";
        titleColor = "#FF9500"; 
        icon = "exclamationmark.triangle.fill";
        riskBar = "🟧🟧🟧🟧⬜️";
    } else if (risk >= 40) {
        riskLevel = "中等风险";
        titleColor = "#FFCC00"; 
        riskBar = "🟨🟨🟨⬜️⬜️";
    }

    // 标签
    let sourceLabel = j.isResidential ? "原生 IP" : "非原生/广播";
    let propertyLabel = j.isResidential ? "住宅网络" : "数据中心(机房)";

    // 标题
    let title = "IPPure 质量报告";
    if (isMonitor) title = "IPPure🔔 IP已变动";

    // 【修改点】构建自定义副标题：国旗 国家 ｜ 风险系数
    // 例如：🇺🇸 美国 ｜ 42% 中等风险
    const subtitle = `${flag} ${displayCountry} ｜ ${risk}% ${riskLevel}`;

    // 正文内容
    const content = 
`${nodeNameDisplay}IP：${j.ip}
ASN：${j.asOrganization} (AS${j.asn})
位置：${flag} ${cnCountry}${j.country} ${j.city}
IP来源：${sourceLabel}
IP属性：${propertyLabel}
IPPure系数：${risk}% ${riskLevel}
${riskBar}`;

    // 发送通知
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
