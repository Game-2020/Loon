/*
 * Loon 脚本：IPPure 节点深度检测 (动态指定节点版)
 * 原理参考：Network-Speed 脚本
 * 功能：在节点列表中点击任意节点，即可测试该特定节点的 IP 质量，无需配置分流规则。
 */

// 1. 获取输入参数 (支持自定义标题)
let args = {};
if (typeof $argument !== 'undefined') {
    $argument.split('&').forEach(item => {
        let [key, val] = item.split('=');
        args[key] = val;
    });
}
const scriptTitle = args.title || "节点质量报告";

// 2. 准备请求信息
const timestamp = new Date().getTime();
const url = `https://my.ippure.com/v1/info?t=${timestamp}`;
const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
};

// 3. 核心逻辑：动态获取当前点击的节点名称
// Loon 在节点界面运行脚本时，会通过 $environment.params.node 传入节点名
let requestOptions = {
    url: url,
    headers: headers,
    timeout: 5000 // 5秒超时
};

if (typeof $environment !== 'undefined' && $environment.params && $environment.params.node) {
    // 关键点：将请求强行指定给当前点击的节点
    requestOptions.node = $environment.params.node;
    console.log(`[IPPure] 正在测试节点: ${requestOptions.node}`);
}

// 4. 国家代码映射表 (汉化)
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

// 5. 发起请求
$httpClient.get(requestOptions, (err, resp, data) => {
    // 错误处理
    if (err) {
        let errorMsg = "请求失败";
        if (err.error === "DNS error") errorMsg = "DNS 解析失败";
        if (err.error === "Timeout") errorMsg = "请求超时 (节点不通)";
        
        $done({ 
            title: scriptTitle, 
            content: `${errorMsg}\n请检查节点连通性`, 
            icon: "network.slash", 
            "background-color": "#FF0000" 
        });
        return;
    }

    // 数据解析
    let j;
    try {
        j = JSON.parse(data);
    } catch (e) {
        $done({ title: scriptTitle, content: "IPPure 数据解析错误", icon: "exclamationmark.triangle", "background-color": "#FF0000" });
        return;
    }

    // 格式化输出
    const flag = flagEmoji(j.countryCode);
    let cnCountry = countryMap[j.countryCode] || "";
    if(cnCountry) cnCountry = cnCountry + " ";

    const nativeText = j.isResidential ? "✅ 是 (原生)" : "🏢 否 (机房)";
    const risk = j.fraudScore;
    
    // 风险等级判断
    let riskText = `风险等级：${risk}`;
    let titleColor = "#007AFF"; // 蓝
    let icon = "checkmark.seal.fill";

    if (risk >= 80) {
        riskText = `🛑 极高风险 (${risk})`;
        titleColor = "#FF3B30"; // 红
        icon = "exclamationmark.triangle.fill";
    } else if (risk >= 70) {
        riskText = `⚠️ 高风险 (${risk})`;
        titleColor = "#FF9500"; // 橙
        icon = "exclamationmark.triangle.fill";
    } else if (risk >= 40) {
        riskText = `🔶 中等风险 (${risk})`;
        titleColor = "#FFCC00"; // 黄
    } else {
        riskText = `✅ 低风险 (${risk})`;
        titleColor = "#34C759"; // 绿
    }

    // 获取当前节点名称用于展示
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
