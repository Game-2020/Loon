/*
 * Loon 脚本：节点质量检测 (中英双语地名版)
 */

// 添加随机时间戳防止缓存
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
    // 如遇生僻国家，脚本会自动显示为空，仅保留英文，不影响使用
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
  
  // --- 核心修改：获取中文国家名 ---
  // 如果映射表里有这个代码，就取中文；如果没有，就留空
  let cnCountry = countryMap[j.countryCode] || "";
  // 加上一个空格方便排版
  if(cnCountry) cnCountry = cnCountry + " ";

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

  // --- 构建输出 ---
  // 格式：🇮🇳 印度 India Mumbai
  $done({
    title: `节点质量报告`,
    content:
`IP地址：${j.ip}
运营商：AS${j.asn} ${j.asOrganization}
所在地：${flag} ${cnCountry}${j.country} ${j.city}
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
