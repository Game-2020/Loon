/*
 * Loon 脚本：节点质量检测 (全汉化版)
 */

// 添加随机时间戳防止缓存
const timestamp = new Date().getTime();
const url = `https://my.ippure.com/v1/info?t=${timestamp}`;

const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
};

$httpClient.get({ url: url, headers: headers }, (err, resp, data) => {
  if (err) {
    $done({ title: "节点质量报告", content: "检测失败，请检查网络", icon: "network.slash", "background-color": "#FF0000" })
    return
  }

  let j;
  try {
    j = JSON.parse(data);
  } catch (e) {
    $done({ title: "节点质量报告", content: "数据解析错误", icon: "exclamationmark.triangle", "background-color": "#FF0000" })
    return;
  }

  const flag = flagEmoji(j.countryCode);
  
  // 原生判定文案
  const nativeText = j.isResidential ? "✅ 是 (原生)" : "🏢 否 (机房)";
  
  // 风险系数逻辑
  const risk = j.fraudScore;
  let riskText = `风险等级：${risk}`;
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

  // --- 汉化修改点 ---
  // 1. IP -> IP地址
  // 2. ASN -> 运营商
  // 3. 位置 -> 所在地 (数据本身 ippure 返回的是英文，标签改为中文)
  $done({
    title: `节点质量报告`,
    content:
`IP地址：${j.ip}
运营商：AS${j.asn} ${j.asOrganization}
所在地：${flag} ${j.country} ${j.city}
IP类型：${nativeText}
${riskText}`,
    icon: icon,
    'background-color': titleColor
  })
})

function flagEmoji(code) {
  if (!code) return "🌍";
  if (code.toUpperCase() === "TW") {
    code = "CN";
  }
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt())
  )
}
