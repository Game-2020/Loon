/*
 * Loon 脚本：IPPure 深度检测 (去重版)
 * 功能：修复了通知栏中风险等级重复显示的问题
 */

// 1. 获取输入参数
let args = {};
if (typeof $argument !== 'undefined') {
    $argument.split('&').forEach(item => {
        let [key, val] = item.split('=');
        args[key] = val;
    });
}
// 判断是否为监控模式
const isMonitor = args.mode === "monitor";

const timestamp = new Date().getTime();
const url = `https://my.ippure.com/v1/info?t=${timestamp}`;

const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
};

// 常用国家代码汉化映射表
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

$httpClient.get({ url: url, headers: headers }, (err, resp, data) => {
    // 错误处理
    if (err) {
        if (!isMonitor) $notification.post("IPPure检测失败", "网络错误", "无法连接服务器");
        $done();
        return;
    }

    let j;
    try {
        j = JSON.parse(data);
    } catch (e) {
        if (!isMonitor) {
             let msg = "数据解析错误";
             if(data && (data.includes("Cloudflare") || data.includes("html"))) msg = "触发 WAF 防火墙拦截";
             $notification.post("IPPure检测失败", msg, "请尝试切换节点");
        }
        $done();
        return;
    }

    // --- 核心逻辑：智能静默检测 ---
    const currentIP = j.ip;
    const lastIP = $persistentStore.read("Loon_IPPure_Last_IP");

    if (isMonitor) {
        if (lastIP === currentIP) {
            $done();
            return;
        }
        console.log(`[IPPure监控] 检测到变动: ${lastIP} -> ${currentIP}`);
    }
    
    $persistentStore.write(currentIP, "Loon_IPPure_Last_IP");

    // --- 显示逻辑 ---
    const flag = flagEmoji(j.countryCode);
    
    let cnCountry = countryMap[j.countryCode] || "";
    if(cnCountry) cnCountry = cnCountry + " ";

    const nativeText = j.isResidential ? "✅ 是 (原生)" : "🏢 否 (机房)";
    const risk = j.fraudScore;
    
    // 风险文案
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

    // 标题前缀
    let titlePrefix = "";
    if (isMonitor) {
        titlePrefix = "🔔 IP已变动: ";
    }

    const title = `${titlePrefix}IPPure 质量报告`;
    
    // 【修改点】在这里去掉了 ${riskText}，因为它已经作为副标题传递给 $notification.post 的第二个参数了
    const content = 
`IP地址：${j.ip}
运营商：AS${j.asn} ${j.asOrganization}
所在地：${flag} ${cnCountry}${j.country} ${j.city}
IP类型：${nativeText}`;

    // 发送通知：(标题, 副标题/风险提示, 内容)
    $notification.post(title, riskText, content);
    
    $done({
        title: title,
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
