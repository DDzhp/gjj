function analysis(msg){

    console.log(msg,'logDecode ->>> msg');
    console.log(msg.length,'msg.length');

    replaceMsg = msg.replace(/\s*/g,'').replace(/\-/g,'');

    console.log(replaceMsg,'replace ->>> replaceMsg');
    console.log(replaceMsg.length,'replaceMsg.length');

    switch(replaceMsg.length){
        case 116:{
            var mode = parseInt(replaceMsg.substring(8,10),16);
            var decodeList = {
                deviceid:'设备ID：'+parseInt(replaceMsg.substring(0,8),16),
                mode:'计费模式：' + (mode==0?'时长':mode==1?'流量':mode==2?'滤芯':mode==3?'买断':mode==4?'套餐':'共享'),
                instructions:'指令：' + instructions(replaceMsg.substring(10,12)),
                deviceid_state:'设备状态：' + deviceid_state(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(12,14),16)),
                current_flow:current_flow(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(14,18),16)),
                recharge_flow:recharge_flow(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(18,26),16),replaceMsg.substring(12,14)),
                recharge_days:recharge_days(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(26,30),16)),
                residual_flow:residual_flow(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(30,38),16)),
                residual_days:residual_days(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(38,42),16)),
                used_flow:used_flow(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(42,50),16)),
                used_days:used_days(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(50,54),16)),
                pure_tds:pure_tds(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(54,58),16)),
                raw_tds:raw_tds(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(58,62),16)),
                one_actual:one_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(62,66),16)),
                two_actual:two_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(66,70),16)),
                three_actual:three_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(70,74),16)),
                four_actual:four_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(74,78),16)),
                five_actual:five_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(78,82),16)),
                one_maximum:one_maximum(replaceMsg.substring(10,12),replaceMsg.substring(82,86)),
                two_maximum:two_maximum(replaceMsg.substring(10,12),replaceMsg.substring(86,90)),
                three_maximum:three_maximum(replaceMsg.substring(10,12),replaceMsg.substring(90,94)),
                four_maximum:four_maximum(replaceMsg.substring(10,12),replaceMsg.substring(94,98)),
                five_maximum:five_maximum(replaceMsg.substring(10,12),replaceMsg.substring(98,102)),
                time:time(parseInt(replaceMsg.substring(102,110),16)),
                tap:tap(parseInt(replaceMsg.substring(110,112),16)),
            };
            return decodeList;
        }
        case 104:{
            var mode = parseInt(replaceMsg.substring(8,10),16);
            var decodeList = {
                deviceid:'设备ID：'+parseInt(replaceMsg.substring(0,8),16),
                mode:'计费模式：' + (mode==0?'时长':mode==1?'流量':mode==2?'滤芯':mode==3?'买断':mode==4?'套餐':'共享'),
                instructions:'指令：' + instructions(replaceMsg.substring(10,12)),
                deviceid_state:'设备状态：' + deviceid_state(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(12,14),16)),
                current_flow:current_flow(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(14,18),16)),
                recharge_flow:recharge_flow(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(18,22),16),replaceMsg.substring(12,14)),
                recharge_days:recharge_days(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(22,26),16)),
                residual_flow:residual_flow(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(26,30),16)),
                residual_days:residual_days(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(30,34),16)),
                used_flow:used_flow(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(34,38),16)),
                used_days:used_days(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(38,42),16)),
                pure_tds:pure_tds(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(42,46),16)),
                raw_tds:raw_tds(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(46,50),16)),
                one_actual:one_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(50,54),16)),
                two_actual:two_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(54,58),16)),
                three_actual:three_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(58,62),16)),
                four_actual:four_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(62,66),16)),
                five_actual:five_actual(replaceMsg.substring(10,12),parseInt(replaceMsg.substring(66,70),16)),
                one_maximum:one_maximum(replaceMsg.substring(10,12),replaceMsg.substring(70,74)),
                two_maximum:two_maximum(replaceMsg.substring(10,12),replaceMsg.substring(74,78)),
                three_maximum:three_maximum(replaceMsg.substring(10,12),replaceMsg.substring(78,82)),
                four_maximum:four_maximum(replaceMsg.substring(10,12),replaceMsg.substring(82,86)),
                five_maximum:five_maximum(replaceMsg.substring(10,12),replaceMsg.substring(86,90)),
                time:time(parseInt(replaceMsg.substring(90,98),16)),
                tap:tap(parseInt(replaceMsg.substring(98,100),16)),
            };
            return decodeList;
        }
        default:{
            layer.msg('数据格式暂不支持解析');
        }
    }
}
function instructions(string){
    switch(string.toLowerCase()){
        case '00':{return '心跳数据';}
        case '01':{return '关机命令';}
        case '11':{return '关机命令回执';}
        case '02':{return '开机命令';}
        case '22':{return '开机命令回执';}
        case '03':{return '强冲命令';}
        case '33':{return '强冲命令回执';}
        case '04':{return 'ID编码/设置机器参数';}
        case '44':{return 'ID编码回执';}
        case '05':{return '充值命令';}
        case '55':{return '充值命令回执';}
        case '06':{return '用水同步命令';}
        case '07':{return '滤芯复位';}
        case '77':{return '滤芯复位回执';}
        case '08':{return '模式切换';}
        case '88':{return '模式切换回执';}
        case '09':{return '激活';}
        case '99':{return '激活回执';}
        case '0a':{return '恢复出厂设置';}
        case 'aa':{return '恢复出厂设置回执';}
        case '0b':{return '用时同步';}
        case 'bb':{return '用时同步回执';}
        case '0c':{return '设备状态变更';}
        case '0d':{return '查询设备信息';}
        case 'dd':{return '查询设备信息回执';}
        case '0e':{return '获取信号，ICCID，机器配置参数';}
        case 'ee':{return '获取设备信息回执';}
        case '0f':{return '机器锁定解锁命令';}
        case 'ff':{return '机器锁定解锁回执';}
        case '80':{return '机器取水指令';}
        case '90':{return '机器取水指令回执';}
        case 'cc':{return '错误包上报';}
        case 'a0':{return 'Ic卡识别请求指令';}
        case 'b0':{return 'Ic卡余额同步指令/卡状态切换';}
        case 'b1':{return 'Ic卡余额同步指令回执';}
        case '2b':{return '广告机刷新广告指令';}
        case 'b2':{return '广告机刷新广告回执指令';}
        case '2a':{return '广告机下载日志指令';}
        default:{
            return '暂未解析该指令';
        }
    }
}
function deviceid_state(string,number){
    if (string == 'EE') {
        if (number == 0) {
            return '滤芯寿命类型:时常';
        }else{
            return '滤芯寿命类型:流量';
        }

    }else{
        switch(number){
            case 0:{return '出厂';}
            case 1:{return '正常';}
            case 2:{return '欠费';}
            case 3:{return '制水故障';}
            case 4:{return '关机';}
            case 5:{return '漏水';}
            case 6:{return '待激活';}
            case 7:{return '补计（无流量计时也为正常状态）';}
            case 8:{return '频发数据';}
            case 9:{return '制水';}
            case 10:{return '冲洗';}
            case 11:{return '缺水';}
            case 12:{return '锁定';}
            case 14:{return '本次消费纯水溢出';}
            case 30:{return '水箱纯水溢出';}
            case 31:{return '浮球异常';}
            case 32:{return '加热超时';}
            case 35:{return '热水温度传感器故障';}
            case 36:{return '加热管故障';}
            case 37:{return '原水温度传感器故障';}
            case 38:{return '强排';}
            case 39:{return '放水泵故障';}
            case 41:{return '出水NTC故障';}
            case 42:{return '抽水泵故障';}
            case 43:{return '纯水液位开关故障';}
            case 44:{return '热水流量计故障';}
            case 45:{return '原水tds报警';}
            case 46:{return '超温故障';}
            case 47:{return '加热传感器故障';}
            case 48:{return '拆机故障';}
            case 49:{return '放水阀故障';}
            case 50:{return '制水流量计1故障';}
            case 51:{return '制水流量计2故障';}
            case 53:{return '消毒中···';}
            case 54:{return '废水高压故障';}
            case 55:{return '补水阀故障';}
            case 56:{return '制水压力报警';}
            case 57:{return '制氢压力报警';}
            case 58:{return '灌装压力报警';}
            case 59:{return '制氢电流报警';}
            case 60:{return '氢水tds报警';}
            case 61:{return '氢水液位过低';}
            case 62:{return '制氢电流过低报警';}
            default:{
                return '暂未解析该指令';
            }

        }
    }
}
function current_flow(string,number){//本次消费总流量
    switch(string.toLowerCase()){
        // case '04':{return '冷水流量计：'+number;}
        case '84':{return '自动校准的流量：'+number;}//58
        // case '44':{return '冷水流量计 回执：'+number;}
        case '80':{return '';}
        case '06':{return '本次消费总流量：'+number+' ml';}//58
        case '0c':{return '本次消费总流量：'+number+' ml';}
        case 'dd':{return '本次消费总流量：'+number+' ml';}
        default:{
            return '';
        }
    }
}
function recharge_flow(string,number,device_state){//充值流量
    switch(string.toLowerCase()){
        case '04':{return '冷水流量计脉冲：'+number;}//58
        case '44':{return '冷水流量计脉冲回执：'+number;}//58
        case 'ee':{return '冷水流量计脉冲：'+number;}//58
        case '80':{return '本次允许最大取水量：'+number+' ml';}//58
        case '90':{return '本次允许最大取水量 回执：'+number+' ml';}//58
        case '06':{return '本次出热水水量：'+number+' ml';}
        case 'a0':{return '';}
        case '0c':{return device_state==1?('流速：'+number+' ml/分'):'';}//58
        case '05':{return '充值流量：'+number+' L';}//58
        case '55':{return '剩余流量 回执：'+number+' L';}
        case '82':{return '节能的时间:'+number;}//58
        case '92':{return '节能的时间 回执:'+number;}//58
        case '83':{return '广告灯开启时间:'+number;}//58
        case '93':{return '广告灯开启时间: 回执'+number;}//58
        case '5E':{return '自动校准的冷水流量计:'+number;}//58
        default:{
            return '';
        }
    }
}
function recharge_days(string,number){//充值天数
    switch(string.toLowerCase()){
        case '04':{return '冷水阀时间：'+number+'秒/L';}
        case '44':{return '冷水阀时间 回执：'+number+'秒/L';}
        case '80':{return '本次取水等待时间：'+number+' 秒';}
        case '90':{return '本次取水等待时间 回执：'+number+' 秒';}
        case '06':{return '本次出冷水水量：'+number+' ml';}
        case '05':{return '充值天数：'+number+' 天';}
        case '55':{return '剩余天数 回执：'+number+' 天';}
        case '82':{return '加热系统启停温差：'+number;}
        case '92':{return '加热系统启停温差 回执:'+number;}//58
        default:{
            return '';
        }
    }
}
function residual_flow(string,number){//剩余流量
    switch(string.toLowerCase()){
        case '04':{return '制水时间：'+number+"分钟/L";}
        case '44':{return '制水时间 回执：'+number+"分钟/L";}
        case '80':{return '连续出水最大时间：'+number;}
        case '90':{return '连续出水最大时间 回执：'+number;}
        case '06':{return '本次消费金额：'+number/100+'元';}
        case '55':{return '剩余流量：'+number+' L';}
        case '0c':{return '剩余流量：'+number+' L';}
        case 'dd':{return '剩余流量：'+number+' L';}
        case '09':{return '剩余流量：'+number+' L';}
        case '99':{return '剩余流量 回执：'+number+' L';}
        case '82':{return '浴霸1启动的温度：'+number;}
        case '92':{return '浴霸1启动的温度 回执:'+number;}//58
        case 'a0':{ return '离线消费金额：'+number/100+'元';}
        default:{
            return '';
        }
    }
}
function residual_days(string,number){//剩余天数
    switch(string.toLowerCase()){
        case '04':{return '检修时间：'+number;}
        case '44':{return '检修时间 回执：'+number;}
        case '80':{return '取水暂停时间：'+number;}
        case '90':{return '取水暂停时间 回执：'+number;}
        case '06':{return '';}
        case 'ee':{return '检修时间：'+number;}
        case '55':{return '剩余时间：'+number+' 天';}

        case '0b':{return '剩余时间：'+number+' 天';}
        case 'bb':{return '剩余时间 回执：'+number+' 天';}
        case '09':{return '剩余时间：'+number+' 天';}
        case 'dd':{return '剩余时间：'+number+' 天';}
        case '99':{return '剩余时间 回执：'+number+' 天';}
        case '82':{return '浴霸2启动的温度：'+number;}
        case '92':{return '浴霸2启动的温度 回执:'+number;}//58
        default:{
            return '';
        }
    }
}
function used_flow(string,number){//已用流量
    switch(string.toLowerCase()){
        case '04':{return '加热最高温度值：'+number;}
        case '44':{return '加热最高温度值 回执：'+number;}
        case '80':{return '出水热水温度值：'+number;}
        case '90':{return '出水热水温度值 回执：'+number;}
        case '06':{return '已用流量：'+number+' L';}
        case '09':{return '已用流量：'+number+' L';}
        case '99':{return '已用流量： 回执：'+number+' L';}
        case '0c':{return '已用流量：'+number+' L';}
        case 'dd':{return '已用流量：'+number+' L';}
        case '82':{return '浴霸1关闭的温度差：'+number;}
        case '92':{return '浴霸1关闭的温度差 回执:'+number;}//58
        default:{
            return '';
        }
    }
}
function used_days(string,number){//已用天数
    switch(string.toLowerCase()){
        case '04':{return '设备制冷最低温度值：'+number;}
        case '44':{return '设备制冷最低温度值 回执：'+number;}
        case '80':{return '';}
        case '06':{return '';}
        case '09':{return '已用天数：'+number;}
        case '99':{return '已用天数 回执：'+number;}
        case '0b':{return '已用天数：'+number;}
        case 'bb':{return '已用天数 回执：'+number;}
        case '82':{return '浴霸2关闭的温度差：'+number;}
        case '92':{return '浴霸2关闭的温度差 回执:'+number;}//58
        default:{
            return '';
        }
    }
}
function pure_tds(string,number){//纯水TDS
    switch(string.toLowerCase()){
        case '04':{return '热水费率：'+ number*10 + '升/元';}
        case '44':{return '热水费率 回执：'+ number*10 + '升/元';}
        case '80':{ return '';}
        case '06':{ return '';}
        case '0c':{return '纯水tds：'+number;}
        case 'dd':{return '纯水tds：'+number;}
        default:{
            return '';
        }
    }
}
function raw_tds(string,number){//原水TDS
    switch(string.toLowerCase()){
        case '04':{return '冷水费率：'+ number*10 + '升/元';}
        case '44':{return '冷水费率 回执：'+ number*10 + '升/元';}
        case '80':{ return '';}
        case '06':{ return '';}
        case '0c':{return '原水tds：'+number;}
        case 'dd':{return '原水tds：'+number;}
        default:{
            return '';
        }
    }
}
function one_actual(string,number){//第一滤芯寿命实时值
    switch(string.toLowerCase()){
        case '04':{return '屏蔽水路：'+ number;}
        case '44':{return '屏蔽水路 回执：'+ number;}
        case '80':{ return '';}// 与下一字节同步
        case '06':{ return '';}// 与下一字节同步
        case 'a0':{ return '';}// 与下一字节同步
        case '07':{return '滤芯1实时：'+ number;}
        case '77':{return '滤芯1实时 回执：'+ number;}
        case '0c':{return '滤芯1实时：'+number;}
        case 'dd':{return '滤芯1实时：'+number;}
        case '09':{return '滤芯1实时：'+number;}
        case '99':{return '滤芯1实时 回执：'+number;}
        case '82':{return '臭氧工作周期：'+number;}
        case '92':{return '臭氧工作周期： 回执:'+number;}//58
        default:{
            return '';
        }
    }
}
function two_actual(string,number){//第二滤芯寿命实时值
    switch(string.toLowerCase()){
        case '04':{return '单次最大用量:'+ number;+"/ml"}
        case '44':{return '单次最大用量 回执:'+ number+"/ml";}
        case '80':{ return '剩余金额：'+ parseInt(replaceMsg.length == 116?replaceMsg.substring(62,70):replaceMsg.substring(50,58),16)/100 + '/元';}
        case '90':{ return '剩余金额 回执：'+ parseInt(replaceMsg.length == 116?replaceMsg.substring(62,70):replaceMsg.substring(50,58),16)/100 + '/元';}
        case '06':{ return '剩余金额：'+ parseInt(replaceMsg.length == 116?replaceMsg.substring(62,70):replaceMsg.substring(50,58),16)/100 + '/元';}
        case 'a0':{ return '剩余金额：'+ parseInt(replaceMsg.length == 116?replaceMsg.substring(62,70):replaceMsg.substring(50,58),16)/100 + '/元';}
        case '07':{return '滤芯2实时：'+ number;}
        case '77':{return '滤芯2实时 回执：'+ number;}
        case '0c':{return '滤芯2实时：'+number;}
        case 'dd':{return '滤芯2实时：'+number;}
        case '09':{return '滤芯2实时'+number;}
        case '99':{return '滤芯2实时 回执：'+number;}
        case '82':{return '臭氧工作周期内的启动时间：'+number;}
        case '92':{return '臭氧工作周期内的启动时间： 回执:'+number;}//58
        default:{
            return '';
        }
    }
}
function three_actual(string,number){//第三滤芯寿命实时值
    switch(string.toLowerCase()){
        case '04':{return '热水流量计脉冲数：'+ number;}
        case '44':{return '热水流量计脉冲数 回执：'+ number;}
        case 'ee':{return '热水流量计脉冲数：'+ number;}
        case '80':{ return '';}
        case '06':{ return '';}
        case '07':{return '滤芯3实时：'+ number;}
        case '77':{return '滤芯3实时 回执：'+ number;}
        case '0c':{return '滤芯3实时：'+number;}
        case 'dd':{return '滤芯3实时：'+number;}
        case '09':{return '滤芯3实时：'+number;}
        case '99':{return '滤芯3实时： 回执：'+number;}
        default:{
            return '';
        }
    }
}
function four_actual(string,number){//第四滤芯寿命实时值
    switch(string.toLowerCase()){
        case '04':{return '热水费率金额：'+number+'分'}
        case '44':{return '热水费率金额(新)：'+number+'分'}
        case '80':{ return '';}
        case '06':{ return '';}
        case '07':{return '滤芯4实时：'+ number;}
        case '77':{return '滤芯4实时 回执：'+ number;}
        case '0c':{return '滤芯4实时：'+number;}
        case 'dd':{return '滤芯4实时：'+number;}
        case '09':{return '滤芯4实时'+number;}
        case '99':{return '滤芯4实时 回执：'+number;}
        default:{
            return '';
        }
    }
}
function five_actual(string,number){//第五滤芯寿命实时值
    switch(string.toLowerCase()){
        case '04':{return '热水费率流量：'+number+'ml'}
        case '44':{return '热水费率流量(新)：'+number+'ml'}
        case '80':{ return '';}
        case '06':{ return '';}
        case 'ee':{ return '当前信号值 回执：'+number;}
        case '07':{return '滤芯5实时：'+ number;}
        case '77':{return '滤芯5实时 回执：'+ number;}
        case '0c':{return '滤芯5实时：'+number;}
        case 'dd':{return '滤芯5实时：'+number;}
        case '09':{return '滤芯5实时：'+number;}
        case '99':{return '滤芯5实时： 回执：'+number;}
        default:{
            return '';
        }
    }
}
function one_maximum(string,number){//第一滤芯寿命最大值
    switch(string.toLowerCase()){
        case '04':{return 'iccid：'+number + '（最大放水时间：'+parseInt(number,16)+'）';}
        case '44':{return 'iccid：'+number + '（最大放水时间 回执：'+parseInt(number,16)+'）';}
        case '80':{ return '';}
        case '06':{ return ''}
        case 'a0':{ return '';}// 与下一字节同步
        case '07':{return '滤芯1最大：'+ parseInt(number,16);}
        case '77':{return '滤芯1最大 回执：'+ parseInt(number,16);}
        case '09':{return '滤芯1最大'+parseInt(number,16);}
        case '99':{return '滤芯1最大 回执：'+parseInt(number,16);}
        default:{
            return '';
        }
    }
}
function two_maximum(string,number){//第二滤芯寿命最大值
    switch(string.toLowerCase()){
        case '04':{return 'iccid：'+number+'(热水阀时间:'+parseInt(number,16)+'秒/L）';}
        case '44':{return 'iccid：'+number+'(热水阀时间 回执:'+parseInt(number,16)+'秒/L）';}
        case '80':{ return 'IC卡号：' + (replaceMsg.length == 116?replaceMsg.substring(82,90):replaceMsg.substring(70,78));}
        case '90':{ return 'IC卡号 回执：' + (replaceMsg.length == 116?replaceMsg.substring(82,90):replaceMsg.substring(70,78));}
        case '06':{ return 'IC卡号：' + (replaceMsg.length == 116?replaceMsg.substring(82,90):replaceMsg.substring(70,78));}
        case 'a0':{ return 'IC卡号：' + (replaceMsg.length == 116?replaceMsg.substring(82,90):replaceMsg.substring(70,78));}
        case '07':{return '滤芯2最大：'+ parseInt(number,16);}
        case '77':{return '滤芯2最大 回执：'+ parseInt(number,16);}
        case '09':{return '滤芯2最大'+parseInt(number,16);}
        case '99':{return '滤芯2最大 回执：'+parseInt(number,16);}
        default:{
            return '';
        }
    }
}
function three_maximum(string,number){//第三滤芯寿命最大值
    switch(string.toLowerCase()){

        case '04':{return '冷水费率金额(新)：'+parseInt(number,16)+'分';}
        case '44':{return '冷水费率金额(新)：'+parseInt(number,16)+'分';}
        case '80':{ return '剩余流量：'+number;}
        case '90':{ return '剩余流量 回执：'+number;}
        case '06':{ return '';}
        case '07':{return '滤芯3最大：'+ parseInt(number,16);}
        case '77':{return '滤芯3最大 回执：'+ parseInt(number,16);}
        case '09':{return '滤芯3最大'+parseInt(number,16);}
        case '99':{return '滤芯3最大 回执：'+parseInt(number,16);}
        default:{
            return '';
        }
    }
}
function four_maximum(string,number){//第四滤芯寿命最大值
    switch(string.toLowerCase()){
        case '04':{return 'iccid：'+number;}
        case '44':{return '';}
        case '80':{ return '剩余天数：'+number;}
        case '90':{ return '剩余天数 回执：'+number;}
        case '06':{ return '';}
        case '07':{return '滤芯4最大：'+ parseInt(number,16);}
        case '77':{return '滤芯4最大 回执：'+ parseInt(number,16);}
        case '09':{return '滤芯4最大'+parseInt(number,16);}
        case '99':{return '滤芯4最大 回执：'+parseInt(number,16);}
        default:{
            return '';
        }
    }
}
function five_maximum(string,number){//第五滤芯寿命最大值
    switch(string.toLowerCase()){
        case '04':{return '冷水费率流量(新)：'+parseInt(number,16)+'ml';}
        case '44':{return '冷水费率流量(新)：'+parseInt(number,16)+'ml';}
        case '80':{ return '';}
        case '06':{ return '';}
        case 'ee':{ return 'ICCID 号:'+(replaceMsg.length == 116?replaceMsg.substring(82,102):replaceMsg.substring(70,90));}
        case '07':{return '滤芯5最大：'+ parseInt(number,16);}
        case '77':{return '滤芯5最大 回执：'+ parseInt(number,16);}
        case '09':{return '滤芯5最大：'+parseInt(number,16);}
        case '99':{return '滤芯5最大 回执：'+parseInt(number,16);}
        default:{
            return '';
        }
    }
}
function time(number){//北京时间
    switch(number){
        case '09':{return '北京时间：'+number;}
        case '99':{return '北京时间 回执：'+number;}
        case '0b':{return '北京时间：'+number;}
        case 'bb':{return '北京时间 回执：'+number;}
        default:{
            return '';
        }
    }
}
function tap(number){//机器类型码
    switch(number){
        case 0:{return '机器类型：'+'家用机，商务机';}
        case 1:{return '机器类型：'+'台面机';}
        case 2:{ return '机器类型：'+'管线机';}
        case 3:{ return '机器类型：'+'售水机，校园机，医院机';}
        default:{
            return '';
        }
    }
}
