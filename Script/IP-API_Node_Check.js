/*
 * Loon 脚本：IP-API 节点深度检测 (独立版)
 * 功能：在节点列表中点击任意节点，即可测试该特定节点的 IP 详情。
 * 优势：速度快，支持中文城市名，无需配置分流规则。
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

// 2. 准备请求 (使用 HTTP 协议，因为 ip-api 免费版不支持 HTTPS)
const timestamp = new Date().getTime();
// 直接请求中文结果 (lang=zh-CN)
const url = `http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query&t=${timestamp}`;

const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
};

// 3. 动态指定节点
let requestOptions = {
    url: url,
    headers: headers,
    timeout: 5000
};

// 关键逻辑：劫持请求到当前点击的节点
if (typeof $environment !== 'undefined' && $environment.params && $environment.params.node) {
    requestOptions.node = $environment.params.node;
}

$httpClient.get(requestOptions, (err, resp, data) => {
    // A. 错误处理
    if (err) {
        let errorMsg = "请求失败";
        if (err.error === "DNS error") errorMsg = "DNS 解析失败";
        if (err.error === "Timeout") errorMsg = "请求超时";
        $done({ title: scriptTitle, content: `${errorMsg}\n请检查节点连通性`, icon: "network.slash", "background-color": "#FF0000" });
        return;
    }

    if (resp.status !== 200) {
        $done({ title: scriptTitle, content: `服务器错误 (状态码 ${resp.status})`, icon: "exclamationmark.triangle", "background-color": "#FF9500" });
        return;
    }

    // B. 数据解析
    let ipInfo;
    try {
        ipInfo = JSON.parse(data);
    } catch (e) {
        $done({ title: scriptTitle, content: "返回数据非 JSON 格式", icon: "hand.raised.fill", "background-color": "#FF3B30" });
        return;
    }

    if (ipInfo.status !== "success") {
        $done({ title: scriptTitle, content: `接口报错: ${ipInfo.message}`, icon: "exclamationmark.triangle", "background-color": "#FF3B30" });
        return;
    }

    // C. 数据计算与格式化
    // 1. 类型识别
    let type = "✅ 是 (原生/家宽)";
    if (ipInfo.hosting) {
        type = "🏢 否 (机房/托管)";
    } else if (ipInfo.mobile) {
        type = "📶 是 (移动流量)";
    }

    // 2. 风险评分模拟 (IP-API 不直接提供分数，我们根据属性计算一个参考值)
    let riskScore = 0;
    if (ipInfo.proxy) riskScore += 40;
    if (ipInfo.hosting) riskScore += 30;
    if (ipInfo.mobile) riskScore -= 10;
    if (riskScore < 0) riskScore = 0;
    if (riskScore > 100) riskScore = 100;

    let riskText = `风险等级：${riskScore} (参考)`;
    let titleColor = "#007AFF"; // 蓝
    let icon = "checkmark.seal.fill";

    if (riskScore > 60) {
        riskText = `⚠️ 高风险 (${riskScore})`;
        titleColor = "#FF3B30"; // 红
        icon = "exclamationmark.triangle.fill";
    } else if (riskScore > 30) {
        riskText = `🔶 中等风险 (${riskScore})`;
        titleColor = "#FFCC00"; // 黄
    } else {
        riskText = `✅ 低风险 (${riskScore})`;
        titleColor = "#34C759"; // 绿
    }

    // 3. 获取节点名称
    let nodeNameDisplay = "";
    if (typeof $environment !== 'undefined' && $environment.params && $environment.params.node) {
        nodeNameDisplay = `节点：${$environment.params.node}\n`;
    }

    // 4. 构建输出 (ip-api 已经返回了中文的 country/city)
    const flag = flagEmoji(ipInfo.countryCode);
    
    $done({
        title: scriptTitle,
        content:
`${nodeNameDisplay}IP地址：${ipInfo.query}
运营商：${ipInfo.isp}
所在地：${flag} ${ipInfo.country} ${ipInfo.city}
IP类型：${type}
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
