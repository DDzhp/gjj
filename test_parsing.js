// 测试入库参数生成器放水时间解析逻辑
const testData = `高密市泉碧然供水有限公司 	 高密泉碧然智慧净水    	 1028 	 翔东卡 	 跃龙公有售水机 	 WSSJ2-A1   流量滤芯  放水时间冷2路6， 检修720，大/1通道/热水费率[元/升]0.3，小/2通道/冷水费率[元/升]0.3，限制流量7500,浮球7，单次限制300   入IMEI号 
 898604C6062290468922到898604C6062290468933   (12张)`;

console.log('=== 测试入库参数生成器放水时间解析 ===');
console.log('测试数据:', testData);
console.log('\n=== 解析结果 ===');

// 解析阀2放水时间[冷、小]：匹配多种格式
let valve2Time = '';
const valve2TimeMatch = testData.match(/放水时间冷2路(\d+)/i);
if (valve2TimeMatch && valve2TimeMatch[1]) {
    valve2Time = valve2TimeMatch[1];
}
console.log('阀2放水时间[冷、小]：', valve2Time);

// 解析阀1放水时间[罐装、大、热]：匹配多种格式
const valve1TimeMatch = testData.match(/(?:放水时间|阀1放水时间)?热1路(\d+)/i);
let valve1Time = '未匹配到';
if (valve1TimeMatch && valve1TimeMatch[1]) {
    valve1Time = valve1TimeMatch[1];
} else {
    // 如果没有找到热1路参数，使用冷2路的参数值作为默认值
    if (valve2Time) {
        valve1Time = valve2Time;
    }
}
console.log('阀1放水时间[罐装、大、热]：', valve1Time);

// 测试另一种格式：热1路6
const testData2 = `高密市泉碧然供水有限公司 	 高密泉碧然智慧净水    	 1028 	 翔东卡 	 跃龙公有售水机 	 WSSJ2-A1   流量滤芯  放水时间冷2路6，热1路8， 检修720，大/1通道/热水费率[元/升]0.3，小/2通道/冷水费率[元/升]0.3，限制流量7500,浮球7，单次限制300   入IMEI号 `;
console.log('\n=== 测试另一种格式 ===');
console.log('测试数据2:', testData2);

// 解析阀2放水时间[冷、小]：匹配多种格式
let valve2Time2 = '';
const valve2TimeMatch2 = testData2.match(/放水时间冷2路(\d+)/i);
if (valve2TimeMatch2 && valve2TimeMatch2[1]) {
    valve2Time2 = valve2TimeMatch2[1];
}
console.log('阀2放水时间[冷、小]：', valve2Time2);

// 解析阀1放水时间[罐装、大、热]：匹配多种格式
const valve1TimeMatch2 = testData2.match(/(?:放水时间|阀1放水时间)?热1路(\d+)/i);
let valve1Time2 = '未匹配到';
if (valve1TimeMatch2 && valve1TimeMatch2[1]) {
    valve1Time2 = valve1TimeMatch2[1];
} else {
    // 如果没有找到热1路参数，使用冷2路的参数值作为默认值
    if (valve2Time2) {
        valve1Time2 = valve2Time2;
    }
}
console.log('阀1放水时间[热1路8]：', valve1Time2);

console.log('\n=== 测试完成 ===');