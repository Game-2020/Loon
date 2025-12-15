/*
 * Loon 脚本：IPPure 节点 IP 纯净度检测
 * 对应插件：IPPure.plugin
 */

const url = "https://my.ippure.com/v1/info"

$httpClient.get(url, (err, resp, data) => {
  if (err) {
    $done({ title: "IP 纯净度", desc: "请求失败，请检查网络", icon: "network.slash", 'icon-color': "#FF3B30" })
    return
  }

  let j;
  try {
    j = JSON.parse(data)
  } catch (e) {
    $done({ title: "IP 纯净度", desc: "数据解析失败", icon: "exclamationmark.triangle", 'icon-color': "#FF9500" })
    return
  }

  const flag = flagEmoji(j.countryCode)
  const nativeText = j.isResidential ? "✅ 是（原生）" : "🏢 否（机房/商业）"
  const risk = j.fraudScore

  // 根据风险系数判断等级和图标颜色
  let riskText = `风险系数：${risk}`
  let iconColor = "#007AFF" // 默认蓝色
  let iconName = "checkmark.seal.fill"

  if (risk >= 80) {
    riskText = `🛑 极高风险 (${risk})`
    iconColor = "#FF3B30" // 红色
    iconName = "exclamationmark.triangle.fill"
  } else if (risk >= 70) {
    riskText = `⚠️ 高风险 (${risk})`
    iconColor = "#FF9500" // 橙色
    iconName = "exclamationmark.triangle.fill"
  } else if (risk >= 40) {
    riskText = `🔶 中等风险 (${risk})`
    iconColor = "#FFCC00" // 黄色
  } else {
    riskText = `✅ 低风险 (${risk})`
    iconColor = "#34C759" // 绿色
  }

  // Loon 输出格式
  $done({
    title: "节点 IP 纯净度",
    desc: `IP：${j.ip}\nASN：AS${j.asn} ${j.asOrganization}\n位置：${flag} ${j.country} ${j.city}\n原生：${nativeText}\n${riskText}`, 
    icon: iconName,
    'icon-color': iconColor
  })
})

function flagEmoji(code) {
  if (!code) return "🏳️";
  if (code.toUpperCase() === "TW") {
    code = "CN"
  }
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt())
  )
}