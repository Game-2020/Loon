/*
 * Loon 脚本：IP 质量深度检测 (自动变动提醒版)
 * 功能：支持手动测试 + IP变动自动推送
 */

// 获取外部参数，判断是否为监控模式
let isMonitor = typeof $argument !== "undefined" && $argument.includes("mode=monitor");

// 添加时间戳防止缓存
const timestamp = new Date().getTime();
// 请求中文数据
const url = `http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query&t=${timestamp}`;

$httpClient.get({ url: url }, (error, response, data) => {
    if (error) {
        // 监控模式下，如果网络不通（比如刚切换瞬间），保持静默不报错，以免刷屏
        if (!isMonitor) {
            $notification.post("检测失败", "网络错误", "无法连接到检测服务器");
        }
        $done();
        return;
    }

    let ipInfo;
    try {
        ipInfo = JSON.parse(data);
    } catch (e) {
        if (!isMonitor) $notification.post("检测失败", "数据解析错误", "");
        $done();
        return;
    }

    if (ipInfo.status !== "success") {
        if (!isMonitor) $notification.post("检测失败", "接口报错", ipInfo.message);
        $done();
        return;
    }

    // --- 核心逻辑：IP 变动检测 ---
    const currentIP = ipInfo.query;
    // 读取上一次保存的 IP
    const lastIP = $persistentStore.read("Loon_IP_Check_Last_IP");

    // 如果是监控模式，且 IP 没变，直接结束（不弹窗）
    if (isMonitor && lastIP === currentIP) {
        console.log("IP 未发生变化，保持静默");
        $done();
        return;
    }

    // 如果 IP 变了，或者不是监控模式（手动测），保存新的 IP
    $persistentStore.write(currentIP, "Loon_IP_Check_Last_IP");

    // --- 以下为原有的显示逻辑 ---

    // 1. 类型识别
    let type = "家庭宽带";
    let typeIcon = "🏠";
    if (ipInfo.hosting) {
        type = "数据中心/机房";
        typeIcon = "🏢";
    } else if (ipInfo.mobile) {
        type = "移动网络";
        typeIcon = "📶";
    }

    // 2. 原生/广播判定
    let nativeStatus = "原生 IP";
    if (ipInfo.hosting) {
        nativeStatus = "广播/机房 IP"; 
    }

    // 3. 风险评分 (0-100)
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

    // 4. 构建输出
    // 标题增加变化提示
    let titlePrefix = "";
    if (isMonitor && lastIP !== currentIP && lastIP) {
        titlePrefix = "🔔 IP已变动: ";
    }
    
    const title = `${titlePrefix}${ipInfo.country} - ${ipInfo.query}`;
    const subtitle = `${typeIcon} ${type}  |  ${riskScore}分`;
    
    const content = `位置: ${ipInfo.regionName} ${ipInfo.city}\n` +
                    `运营商: ${ipInfo.isp}\n` +
                    `类型: ${nativeStatus} (${riskLevel})\n` +
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
