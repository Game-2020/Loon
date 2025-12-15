/*
 * Loon 脚本：IPPure 节点深度检测 (极简汉化版)
 * 优势：代码短，利用请求头自动申请中文数据，无需内置字典。
 */

// 1. 获取参数
let args = {};
if (typeof $argument !== 'undefined') {
    $argument.split('&').forEach(item => {
        let [key, val] = item.split('=');
        args[key] = val;
    });
}
const scriptTitle = args.title || "节点质量报告";

// 2. 准备请求
const timestamp = new Date().getTime();
const url = `https://my.ippure.com/v1/info?t=${timestamp}`;

const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    // 关键点：这行代码告诉 ippure 服务器“我是中文用户，请返回中文数据”
    // 这样就不需要我们在代码里自己写翻译列表了
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

$httpClient.get(requestOptions, (err, resp, data) => {
    // 错误处理
    if (err || resp.status !== 200) {
        $done({ title: scriptTitle, content: "检测失败或被拦截", icon: "exclamationmark.triangle", "background-color": "#FF9500" });
        return;
    }

    let j;
    try {
        j = JSON.parse(data);
    } catch (e) {
        $done({ title: scriptTitle, content: "数据解析错误", icon: "hand.raised.fill", "background-color": "#FF3B30" });
        return;
    }

    // 4. 直接使用 API 返回的数据
    // 因为加了 Accept-Language 头，j.country 大概率会直接返回中文（如“新加坡”）
    const flag = flagEmoji(j.countryCode);
    const nativeText = j.isResidential ? "✅ 是 (原生)" : "🏢 否 (机房)";
    const risk = j.fraudScore;
    
    // 风险等级
    let riskText = `风险等级：${risk}`;
    let titleColor = "#007AFF"; 
    let icon = "checkmark.seal.fill";

    if (risk >= 70) {
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

    // 获取节点名
    let nodeNameDisplay = "";
    if (typeof $environment !== 'undefined' && $environment.params && $environment.params.node) {
        nodeNameDisplay = `节点：${$environment.params.node}\n`;
    }

    $done({
        title: scriptTitle,
        content:
`${nodeNameDisplay}IP地址：${j.ip}
运营商：AS${j.asn} ${j.asOrganization}
所在地：${flag} ${j.country} ${j.city}
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
