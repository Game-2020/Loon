/*
 * Loon 脚本：IPPure 深度检测 (防缓存版)
 * 来源：基于您的提供代码修改，增加随机时间戳适配多节点切换
 */

// 添加随机时间戳，强制不走缓存，确保切换节点后能测到新数据
const timestamp = new Date().getTime();
const url = `https://my.ippure.com/v1/info?t=${timestamp}`;

const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
};

$httpClient.get({ url: url, headers: headers }, (err, resp, data) => {
  if (err) {
    $done({ title: "IP 纯净度", content: "检测失败，请检查网络或节点连通性", icon: "network.slash", "background-color": "#FF0000" })
    return
  }

  let j;
  try {
    j = JSON.parse(data);
  } catch (e) {
    $done({ title: "IP 纯净度", content: "解析数据失败", icon: "exclamationmark.triangle", "background-color": "#FF0000" })
    return;
  }

  const flag = flagEmoji(j.countryCode);
  
  // 判定原生/机房
  const nativeText = j.isResidential ? "✅ 是 (原生/家庭)" : "🏢 否 (机房/托管)";
  
  // 风险系数逻辑
  const risk = j.fraudScore;
  let riskText = `风险系数：${risk}`;
  let titleColor = "#007AFF"; // 默认蓝
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

  $done({
    title: `IP 纯净度检测`,
    content:
`IP：${j.ip}
ASN：AS${j.asn} ${j.asOrganization}
位置：${flag} ${j.country} ${j.city}
类型：${nativeText}
${riskText}`,
    icon: icon,
    'background-color': titleColor // Loon 卡片背景色
  })
})

function flagEmoji(code) {
  if (!code) return "🌍";
  if (code.toUpperCase() === "TW") {
    code = "CN"; // 按照您原脚本的逻辑保留
  }
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt())
  )
}
