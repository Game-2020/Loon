/*
 * IPPure 节点 IP 纯净度 - Loon 优化版
 */

const url = "https://my.ippure.com/v1/info";

$httpClient.get(url, function(error, response, data) {
  if (error || !response || response.status !== 200) {
    $done({
      title: "节点 IP 纯净度",
      content: "请求失败，请检查网络",
      icon: "network.slash",
      "background-color": "#FF3B30"
    });
    return;
  }

  let j;
  try {
    j = JSON.parse(data);
  } catch (e) {
    $done({
      title: "节点 IP 纯净度",
      content: "数据解析失败",
      icon: "exclamationmark.triangle.fill",
      "background-color": "#FF9500"
    });
    return;
  }

  const flag = flagEmoji(j.countryCode || "UN");
  const nativeText = j.isResidential ? "✅ 是（原生住宅）" : "🏢 否（机房/商业）";
  const risk = j.fraudScore || 0;

  let riskText = "";
  let icon = "checkmark.seal.fill";
  let bgColor = "#34C759"; // 默认绿色

  if (risk >= 80) {
    riskText = `🛑 极高风险 (${risk})`;
    icon = "exclamationmark.triangle.fill";
    bgColor = "#FF3B30";
  } else if (risk >= 70) {
    riskText = `⚠️ 高风险 (${risk})`;
    icon = "exclamationmark.triangle.fill";
    bgColor = "#FF3B30";
  } else if (risk >= 40) {
    riskText = `🔶 中等风险 (${risk})`;
    icon = "exclamationmark.triangle";
    bgColor = "#FFCC00";
  } else {
    riskText = `✅ 低风险 (${risk})`;
  }

  const content = `IP：${j.ip || "未知"}
ASN：AS${j.asn || "未知"} ${j.asOrganization || ""}
位置：${flag} ${j.country || "未知"} ${j.city || ""}
原生 IP：${nativeText}
${riskText}`;

  $done({
    title: "节点 IP 纯净度",
    content: content,
    icon: icon,
    "background-color": bgColor
  });
});

function flagEmoji(code) {
  if (!code || code.length !== 2) return "🌍";
  if (code.toUpperCase() === "TW") code = "CN";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt()));
}