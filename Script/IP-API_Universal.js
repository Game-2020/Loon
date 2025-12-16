/*
 * Loon 脚本：IP-API 全能合并版 (弹窗修复版)
 * 集成功能：节点点击独立测试 + 首页卡片 + 后台监控
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
const scriptTitle = args.title || "IP-API 质量报告";

// --- 2. 准备请求 ---
const timestamp = new Date().getTime();
const url = `http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query&t=${timestamp}`;

const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
};

let requestOptions = {
    url: url,
    headers: headers,
    timeout: 5000
};

// 核心逻辑：如果是节点点击模式，强制指定出口节点
let nodeNameDisplay = "";
if (isNodeClick) {
    requestOptions.node = $environment.params.node;
    nodeNameDisplay = `节点：${$environment.params.node}\n`;
}

// --- 3. 发起请求 ---
$httpClient.get(requestOptions, (err, resp, data) => {
    // A. 错误处理
    if (err) {
        if (isMonitor) {
            $done();
        } else {
            let errorMsg = "请求失败";
            if (err.error === "DNS error") errorMsg = "DNS 解析失败";
            if (err.error === "Timeout") errorMsg = "请求超时";
            $notification.post("检测失败", errorMsg, "请检查网络");
            $done({ title: scriptTitle, content: errorMsg, icon: "network.slash", "background-color": "#FF0000" });
        }
        return;
    }

    if (resp.status !== 200) {
        if (!isMonitor) {
            $done({ title: scriptTitle, content: `服务器错误 (状态码 ${resp.status})`, icon: "exclamationmark.triangle", "background-color": "#FF9500" });
        } else {
            $done();
        }
        return;
    }

    let ipInfo;
    try {
        ipInfo = JSON.parse(data);
    } catch (e) {
        if (!isMonitor) {
            $done({ title: scriptTitle, content: "返回数据非 JSON 格式", icon: "hand.raised.fill", "background-color": "#FF3B30" });
        } else {
            $done();
        }
        return;
    }

    if (ipInfo.status !== "success") {
        if (!isMonitor) {
            $done({ title: scriptTitle, content: `接口报错: ${ipInfo.message}`, icon: "exclamationmark.triangle", "background-color": "#FF3B30" });
        } else {
            $done();
        }
        return;
    }

    // --- 4. 监控模式逻辑 ---
    if (!isNodeClick) {
        const currentIP = ipInfo.query;
        const lastIP = $persistentStore.read("Loon_IP_Check_Last_IP");

        if (isMonitor) {
            if (lastIP === currentIP) {
                $done();
                return;
            }
            console.log(`[IP-API监控] IP变动: ${lastIP} -> ${currentIP}`);
        }
        $persistentStore.write(currentIP, "Loon_IP_Check_Last_IP");
    }

    // --- 5. 数据计算 ---
    let type = "✅ 是 (原生/家宽)";
    if (ipInfo.hosting) {
        type = "🏢 否 (机房/托管)";
    } else if (ipInfo.mobile) {
        type = "📶 是 (移动流量)";
    }

    let riskScore = 0;
    if (ipInfo.proxy) riskScore += 40;
    if (ipInfo.hosting) riskScore += 30;
    if (ipInfo.mobile) riskScore -= 10;
    if (riskScore < 0) riskScore = 0;
    if (riskScore > 100) riskScore = 100;

    let riskText = `风险等级：${riskScore} (参考)`;
    let titleColor = "#007AFF"; 
    let icon = "checkmark.seal.fill";

    if (riskScore > 60) {
        riskText = `⚠️ 高风险 (${riskScore})`;
        titleColor = "#FF3B30"; 
        icon = "exclamationmark.triangle.fill";
    } else if (riskScore > 30) {
        riskText = `🔶 中等风险 (${riskScore})`;
        titleColor = "#FFCC00"; 
    } else {
        riskText = `✅ 低风险 (${riskScore})`;
        titleColor = "#34C759"; 
    }

    // --- 6. 构建输出 ---
    let finalTitle = scriptTitle;
    let titlePrefix = "";
    if (isMonitor) {
        titlePrefix = "🔔 IP已变动: ";
        finalTitle = `${titlePrefix}${ipInfo.country}`;
    }

    const flag = flagEmoji(ipInfo.countryCode);
    const subtitle = `${flag} ${ipInfo.country} | ${riskScore}分`;

    const content = 
`${nodeNameDisplay}IP地址：${ipInfo.query}
运营商：${ipInfo.isp}
所在地：${flag} ${ipInfo.country} ${ipInfo.city}
IP类型：${type}
${riskText}`;

    // --- 关键修改：恢复强制弹窗 ---
    $notification.post(finalTitle, subtitle, content);
    
    $done({
        title: finalTitle,
        content: content,
        icon: icon,
        'background-color': titleColor
    });
});

function flagEmoji(code) {
    if (!code) return "🌍";
    if (code.toUpperCase() === "TW") {
        code = "CN";
    }
    return String.fromCodePoint(
        ...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt())
    )
}
