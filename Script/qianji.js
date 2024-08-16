/*************************************

项目名称：钱迹  解锁终身会员
下载地址：https://apps.apple.com/cn/app/id1473785373
电报频道：https://t.me/pdx318
更新日期：2024-03-06
脚本作者：派大星 @pdx6318
使用声明：⚠️仅供参考，🈲转载与售卖！

**************************************

[rewrite_local]
^https:\/\/api\.qianjiapp\.com\/vip\/configios url script-response-body https://raw.githubusercontent.com/pdx6318/QuantumultX/main/Scripts/Crack/qianji.js

[mitm]
hostname = api.qianjiapp.com

*************************************/


var pdx = JSON.parse($response.body);

pdx.data.config.userinfo.vipend = 209909099999;  //会员到期时间
pdx.data.config.userinfo.vipstart = 2024-03-05;  

pdx.data.config.userinfo.viptype =100;//永久会员

pdx.data.config.userinfo.name = "派大星ViP";



$done({body : JSON.stringify(pdx)});
