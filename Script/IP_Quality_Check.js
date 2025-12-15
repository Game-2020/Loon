/*
 * Loon 脚本：IP 质量深度检测
 * 仓库地址：请替换为您的仓库地址
 */

const url = "http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query";

$httpClient.get({ url: url }, (error, response, data) => {
    if (error) {
        $notification.post("IP 检测失败", "网络错误", "无法连接到检测服务器");
        $done();
        return;
    }

    let ipInfo = JSON.parse(data);
    if (ipInfo.status !== "success") {
        $notification.post("IP 检测失败", "接口报错", ipInfo.message);
        $done();
        return;
    }

    // --- 核心分析 ---
    let type = "未知";
    let typeIcon = "❓";
    
    if (ipInfo.hosting) {
        type = "机房 / Data Center";
        typeIcon = "🏢";
    } else if (ipInfo.mobile) {
        type = "蜂窝流量 / Mobile";
        typeIcon = "📶";
    } else {
        type = "住宅 / Residential";
        typeIcon = "🏠";
    }

    let nativeStatus = "原生 IP (Native)";
    let nativeIcon = "🟢";
    if (ipInfo.hosting) {
        nativeStatus = "广播 / 机房 IP"; 
        nativeIcon = "⚠️"; 
    }

    // 风险评分逻辑
    let riskScore = 0;
    if (ipInfo.proxy) riskScore += 40;
    if (ipInfo.hosting) riskScore += 30;
    if (ipInfo.mobile) riskScore -= 10;
    if (riskScore < 0) riskScore = 0;
    if (riskScore > 100) riskScore = 100;

    let riskLevel = "低风险";
    let riskColor = "#00FF00"; 
    if (riskScore > 30) { riskLevel = "中等风险"; riskColor = "#FFA500"; }
    if (riskScore > 60) { riskLevel = "高风险"; riskColor = "#FF0000"; }

    // --- 输出 ---
    const title = `${ipInfo.countryCode} - ${ipInfo.query}`;
    const subtitle = `${typeIcon} ${type}  |  ${nativeIcon} ${nativeStatus}`;
    const content = `城市: ${ipInfo.city}, ${ipInfo.regionName}\n` +
                    `ISP: ${ipInfo.isp}\n` +
                    `ASN: ${ipInfo.as}\n` +
                    `风险评分: ${riskScore} (${riskLevel})\n` +
                    `检测时间: ${new Date().toLocaleTimeString()}`;

    $notification.post(title, subtitle, content);
    
    $done({
        title: title,
        content: content,
        icon: typeIcon,
        "background-color": riskColor
    });
});
