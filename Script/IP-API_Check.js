/*
 * Loon 脚本：IP 质量检测 (智能监控版)
 * 功能：手动测试强制弹窗；自动监控只有 IP 变动才弹窗
 */

// 1. 获取输入参数
let args = {};
if (typeof $argument !== 'undefined') {
    $argument.split('&').forEach(item => {
        let [key, val] = item.split('=');
        args[key] = val;
    });
}
// 判断是否为监控模式 (cron 或 network-changed 触发时会有这个参数)
const isMonitor = args.mode === "monitor";

const timestamp = new Date().getTime();
const url = `http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query&t=${timestamp}`;

$httpClient.get({ url: url }, (error, response, data) => {
    // 错误处理：监控模式下保持静默，避免刷屏
    if (error) {
        if (!isMonitor) $notification.post("检测失败", "网络错误", "无法连接服务器");
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

    // --- 核心逻辑：智能静默检测 ---
    const currentIP = ipInfo.query;
    // 读取上一次记录的 IP
    const lastIP = $persistentStore.read("Loon_IP_Check_Last_IP");

    if (isMonitor) {
        // 如果是监控模式，且 IP 没变，直接退出，不打扰用户
        if (lastIP === currentIP) {
            $done();
            return;
        }
        // 如果 IP 变了，继续执行，并更新记录
        console.log(`[IP监控] 检测到变动: ${lastIP} -> ${currentIP}`);
    }
    
    // 保存当前 IP 为“上一次 IP”
    $persistentStore.write(currentIP, "Loon_IP_Check_Last_IP");

    // --- 以下为正常的显示逻辑 ---

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

    // 2. 风险评分
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

    // 3. 构建标题 (如果是自动监测到的，加个🔔提醒)
    let titlePrefix = "";
    if (isMonitor) {
        titlePrefix = "🔔 IP已变动: ";
    }
    
    const title = `${titlePrefix}${ipInfo.country} - ${ipInfo.query}`;
    const subtitle = `${typeIcon} ${type}  |  ${riskScore}分`;
    
    const content = `位置: ${ipInfo.regionName} ${ipInfo.city}\n` +
                    `运营商: ${ipInfo.isp}\n` +
                    `类型: ${ipInfo.hosting ? "广播/机房" : "原生"} (${riskLevel})\n` +
                    `检测时间: ${new Date().toLocaleTimeString()}`;

    // 发送通知
    $notification.post(title, subtitle, content);
    
    $done({
        title: title,
        content: content,
        icon: typeIcon,
        "background-color": riskColor
    });
});
