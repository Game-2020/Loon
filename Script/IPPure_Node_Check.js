/*
 * Loon 脚本：IPPure 节点深度检测 (防报错优化版)
 * 更新内容：增加对 Cloudflare WAF 拦截的智能识别，修复“数据解析错误”的误报。
 */

// 1. 获取输入参数
let args = {};
if (typeof $argument !== 'undefined') {
    $argument.split('&').forEach(item => {
        let [key, val] = item.split('=');
        args[key] = val;
    });
}
const scriptTitle = args.title || "IP 质量报告";

// 2. 准备请求
const timestamp = new Date().getTime();
const url = `https://my.ippure.com/v1/info?t=${timestamp}`;
const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};

// 3. 动态指定节点
let requestOptions = {
    url: url,
    headers: headers,
    timeout: 5000 
};

if (typeof $environment !== 'undefined' && $environment.params && $environment.params.node) {
    requestOptions.node = $environment.params.node;
}

// 4. 国家名称汉化表
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

$httpClient.get(requestOptions, (err, resp, data) => {
    // A. 网络层面错误处理
    if (err) {
        let errorMsg = "请求失败";
        if (err.error === "DNS error") errorMsg = "DNS 解析失败";
        if (err.error === "Timeout") errorMsg = "请求超时 (节点不通)";
        
        $done({ title: scriptTitle, content: `${errorMsg}\n建议检查节点连通性`, icon: "network.slash", "background-color": "#FF0000" });
        return;
    }

    // B. HTTP 状态码检查 (处理 403 Forbidden 等)
    if (resp.status !== 200) {
        let msg = `服务器返回状态码: ${resp.status}`;
        if (resp.status === 403) msg = "🛑 访问被拒绝 (403)\n该节点 IP 可能已被 ippure 拉黑";
        if (resp.status === 429) msg = "⚠️ 请求过于频繁 (429)\n请稍后再试";
        if (resp.status === 503) msg = "🚧 服务不可用 (503)\n可能是 Cloudflare 盾牌拦截";

        $done({ title: scriptTitle, content: msg, icon: "exclamationmark.triangle", "background-color": "#FF9500" });
        return;
    }

    // C. 数据解析
    let j;
    try {
        j = JSON.parse(data);
    } catch (e) {
        // 智能判断：如果解析失败，检查是不是 HTML 网页（盾牌/验证码）
        let errorReason = "返回数据非 JSON 格式";
        if (data.includes("<!DOCTYPE html>") || data.includes("Cloudflare") || data.includes("challenge")) {
            errorReason = "🚫 触发防火墙拦截 (WAF)\nippure 认为该节点是爬虫，拒绝访问。";
        }
        
        $done({ title: scriptTitle, content: errorReason, icon: "hand.raised.fill", "background-color": "#FF3B30" });
        return;
    }

    // D. 正常输出
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
        icon = "checkmark.seal.fill"; // 中风险也给个勾，稍微温和点
    } else {
        riskText = `✅ 低风险 (${risk})`;
        titleColor = "#34C759"; 
    }

    let nodeNameDisplay = "";
    if (typeof $environment !== 'undefined' && $environment.params && $environment.params.node) {
        nodeNameDisplay = `节点：${$environment.params.node}\n`;
    }

    $done({
        title: scriptTitle,
        content:
`${nodeNameDisplay}IP地址：${j.ip}
运营商：AS${j.asn} ${j.asOrganization}
所在地：${flag} ${cnCountry}${j.country} ${j.city}
IP类型：${nativeText}
${riskText}`,
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
