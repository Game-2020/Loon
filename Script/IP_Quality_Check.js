/*
 * Loon 脚本：IP 质量深度检测 (全中文版)
 * 更新：支持返回中文城市名，所有标签中文化
 */

// 添加时间戳防止缓存
const timestamp = new Date().getTime();
// 关键修改：添加 &lang=zh-CN 让 API 返回中文城市和国家名
const url = `http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query&t=${timestamp}`;

$httpClient.get({ url: url }, (error, response, data) => {
    if (error) {
        $notification.post("检测失败", "网络错误", "无法连接到检测服务器");
        $done();
        return;
    }

    let ipInfo = JSON.parse(data);
    if (ipInfo.status !== "success") {
        $notification.post("检测失败", "接口报错", ipInfo.message);
        $done();
        return;
    }

    // --- 1. 类型识别 (汉化) ---
    let type = "家庭宽带";
    let typeIcon = "🏠";
    
    if (ipInfo.hosting) {
        type = "数据中心/机房";
        typeIcon = "🏢";
    } else if (ipInfo.mobile) {
        type = "移动网络";
        typeIcon = "📶";
    }

    // --- 2. 原生/广播判定 ---
    let nativeStatus = "原生 IP";
    let nativeIcon = "🟢";
    if (ipInfo.hosting) {
        nativeStatus = "广播/机房 IP"; 
        nativeIcon = "⚠️"; 
    }

    // --- 3. 风险评分 (0-100) ---
    let riskScore = 0;
    if (ipInfo.proxy) riskScore += 40;
    if (ipInfo.hosting) riskScore += 30;
    if (ipInfo.mobile) riskScore -= 10;
    
    if (riskScore < 0) riskScore = 0;
    if (riskScore > 100) riskScore = 100;

    let riskLevel = "低风险";
    let riskColor = "#00FF00"; // 绿
    if (riskScore > 30) { riskLevel = "中等风险"; riskColor = "#FFA500"; } // 橙
    if (riskScore > 60) { riskLevel = "高风险"; riskColor = "#FF0000"; } // 红

    // --- 4. 构建中文输出 ---
    const title = `${ipInfo.country} - ${ipInfo.query}`; // 这里 country 会自动变成中文
    const subtitle = `${typeIcon} ${type}  |  ${riskIcon(riskScore)} ${riskScore}分`;
    
    // 这里的标签全部改为中文，且 city/regionName 也会由 API 返回中文
    const content = `位置: ${ipInfo.regionName} ${ipInfo.city}\n` +
                    `运营商: ${ipInfo.isp}\n` +
                    `网络组织: ${ipInfo.as}\n` +
                    `IP类型: ${nativeStatus}\n` +
                    `风险等级: ${riskLevel} (${riskScore})\n` +
                    `检测时间: ${new Date().toLocaleTimeString()}`;

    // 发送通知
    $notification.post(title, subtitle, content);
    
    // Loon 卡片显示
    $done({
        title: title,
        content: content,
        icon: typeIcon,
        "background-color": riskColor
    });
});

function riskIcon(score) {
    if(score < 30) return "✅";
    if(score < 60) return "⚠️";
    return "🚫";
}
