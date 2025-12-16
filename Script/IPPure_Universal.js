/*
 * Loon 脚本：IPPure 全能合并版 (弹窗修复版)
 * 功能：
 * 1. 节点列表点击：测试独立节点质量 (强制弹窗)
 * 2. 首页卡片：测试当前选中节点 (强制弹窗)
 * 3. 后台监控：Cron/网络变动触发 (仅 IP 变动时弹窗)
 */

// --- 1. 环境与参数识别 ---
let args = {};
if (typeof $argument !== 'undefined') {
    $argument.split('&').forEach(item => {
        let [key, val] = item.split('=');
        args[key] = val;
    });
}

// 判定当前运行模式
// 模式 A: 节点列表点击
const isNodeClick = (typeof $environment !== 'undefined' && $environment.params && $environment.params.node);
// 模式 B: 静默监控
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

// 核心逻辑：如果是节点点击模式，强制指定出口节点
let nodeNameDisplay = "";
if (isNodeClick) {
    requestOptions.node = $environment.params.node;
    nodeNameDisplay = `节点：${$environment.params.node}\n`;
    console.log(`[IPPure] 测试独立节点: ${requestOptions.node}`);
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
    // A. 错误处理
    if (err) {
        if (isMonitor) {
            $done();
        } else {
            let errorMsg = "请求失败";
            if (err.error === "DNS error") errorMsg = "DNS 解析失败";
            if (err.error === "Timeout") errorMsg = "请求超时";
            $notification.post("IPPure检测失败", errorMsg, "请检查网络或更换节点");
            $done({ title: "检测失败", content: errorMsg, icon: "network.slash", "background-color": "#FF0000" });
        }
        return;
    }

    // B. WAF/防火墙拦截检查
    if (resp.status !== 200) {
        let msg = `服务器返回状态码: ${resp.status}`;
        if (resp.status === 403) msg = "🛑 访问被拒绝 (403)";
        if (resp.status === 503) msg = "🚧 服务不可用 (503)";
        
        // 只有非监控模式才弹窗报错
        if (!isMonitor) {
            $notification.post("IPPure检测失败", msg, "可能被防火墙拦截");
            $done({ title: "检测失败", content: msg, icon: "exclamationmark.triangle", "background-color": "#FF9500" });
        } else {
            $done();
        }
        return;
    }

    let j;
    try {
        j = JSON.parse(data);
    } catch (e) {
        if (!isMonitor) {
            let errorReason = "数据解析错误";
            if (data.includes("Cloudflare") || data.includes("html")) {
                errorReason = "🚫 触发 WAF 防火墙拦截";
            }
            $notification.post("IPPure检测失败", errorReason, "该节点可能被认为是爬虫");
            $done({ title: "检测失败", content: errorReason, icon: "hand.raised.fill", "background-color": "#FF3B30" });
        } else {
            $done();
        }
        return;
    }

    // --- 5. 监控模式逻辑 ---
    // 只有在“非节点列表点击”时才记录 IP，防止测某个特定节点时打乱全局监控记录
    if (!isNodeClick) {
        const currentIP = j.ip;
        const lastIP = $persistentStore.read("Loon_IPPure_Last_IP");

        if (isMonitor) {
            // 监控模式下：如果 IP 没变，直接结束，不弹窗
            if (lastIP === currentIP) {
                $done();
                return;
            }
            console.log(`[IPPure监控] IP变动: ${lastIP} -> ${currentIP}`);
        }
        $persistentStore.write(currentIP, "Loon_IPPure_Last_IP");
    }

    // --- 6. 结果构建 ---
    const flag = flagEmoji(j.countryCode);
    let cnCountry = countryMap[j.countryCode] || "";
    if(cnCountry) cnCountry = cnCountry + " ";

    const nativeText = j.isResidential ? "✅ 是 (原生)" : "🏢 否 (机房)";
    const risk = j.fraudScore;
    
    let riskText = `风险等级：${risk}`;
    let titleColor = "#007AFF"; 
    let icon = "checkmark.seal.fill";

    if (risk >= 80) {
        riskText = `🛑 极高风险 (${risk})`;
        titleColor = "#FF3B30"; 
        icon = "exclamationmark.triangle.fill";
    } else if (risk >= 70) {
        riskText = `⚠️ 高风险 (${risk})`;
        titleColor = "#FF9500"; 
        icon = "exclamationmark.triangle.fill";
    } else if (risk >= 40) {
        riskText = `🔶 中等风险 (${risk})`;
        titleColor = "#FFCC00"; 
    } else {
        riskText = `✅ 低风险 (${risk})`;
        titleColor = "#34C759"; 
    }

    // 标题处理
    let title = "IPPure 质量报告";
    if (isMonitor) {
        title = "🔔 IP已变动";
    }

    // 内容构建
    const content = 
`${nodeNameDisplay}IP地址：${j.ip}
运营商：AS${j.asn} ${j.asOrganization}
所在地：${flag} ${cnCountry}${j.country} ${j.city}
IP类型：${nativeText}`;

    // --- 关键修改：恢复强制弹窗 ---
    // 只要代码运行到这里（说明不是监控模式的静默退出），就发送弹窗
    $notification.post(title, riskText, content);
    
    // 返回给 Loon 界面 (Loon 弹窗UI)
    $done({
        title: title,
        content: content + `\n${riskText}`,
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
