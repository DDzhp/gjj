/* 由 工具集.html 原样抽离，逻辑未作任何修改 —— 重构 v2 */

            // ===== 日志解析功能 logDecode.js =====
            // 数据类型定义
            const dataTypes = {
                type1: {
                    name: "数据类型1 (52字节)",
                    fields: [
                        {name: "设备ID", start: 0, end: 3},
                        {name: "计费模式", start: 4, end: 4},
                        {name: "命令", start: 5, end: 5},
                        {name: "设备状态", start: 6, end: 6},
                        {name: "本次消费", start: 7, end: 8},
                        {name: "充值流量", start: 9, end: 10},
                        {name: "充值天数", start: 11, end: 12},
                        {name: "剩余流量", start: 13, end: 14},
                        {name: "剩余天数", start: 15, end: 16},
                        {name: "已用流量", start: 17, end: 18},
                        {name: "已用天数", start: 19, end: 20},
                        {name: "纯水TDS", start: 21, end: 22},
                        {name: "原水TDS", start: 23, end: 24},
                        {name: "1级", start: 25, end: 26},
                        {name: "2级", start: 27, end: 28},
                        {name: "3级", start: 29, end: 30},
                        {name: "4级", start: 31, end: 32},
                        {name: "5级", start: 33, end: 34},
                        {name: "大1", start: 35, end: 36},
                        {name: "大2", start: 37, end: 38},
                        {name: "大3", start: 39, end: 40},
                        {name: "大4", start: 41, end: 42},
                        {name: "大5", start: 43, end: 44},
                        {name: "北京时间", start: 45, end: 48},
                        {name: "机器类型", start: 49, end: 49},
                        {name: "校验码", start: 50, end: 51}
                    ]
                },
                type2: {
                    name: "数据类型2 (52字节)",
                    fields: [
                        {name: "设备ID", start: 0, end: 3},
                        {name: "计费模式", start: 4, end: 4},
                        {name: "命令", start: 5, end: 5},
                        {name: "设备状态", start: 6, end: 6},
                        {name: "本次消费", start: 7, end: 8},
                        {name: "充值流量", start: 9, end: 10},
                        {name: "充值天数", start: 11, end: 12},
                        {name: "剩余流量", start: 13, end: 14},
                        {name: "剩余天数", start: 15, end: 16},
                        {name: "已用流量", start: 17, end: 18},
                        {name: "已用天数", start: 19, end: 20},
                        {name: "纯水TDS", start: 21, end: 22},
                        {name: "原水TDS", start: 23, end: 24},
                        {name: "1级", start: 25, end: 26},
                        {name: "2级", start: 27, end: 28},
                        {name: "3级", start: 29, end: 30},
                        {name: "4级", start: 31, end: 32},
                        {name: "5级", start: 33, end: 34},
                        {name: "大1", start: 35, end: 36},
                        {name: "大2", start: 37, end: 38},
                        {name: "大3", start: 39, end: 40},
                        {name: "大4", start: 41, end: 42},
                        {name: "大5", start: 43, end: 44},
                        {name: "北京时间", start: 45, end: 48},
                        {name: "机器类型", start: 49, end: 49},
                        {name: "校验码", start: 50, end: 51}
                    ]
                },
                type3: {
                    name: "数据类型3 (52字节)",
                    fields: [
                        {name: "设备ID", start: 0, end: 3},
                        {name: "计费模式", start: 4, end: 4},
                        {name: "命令", start: 5, end: 5},
                        {name: "设备状态", start: 6, end: 6},
                        {name: "本次消费", start: 7, end: 8},
                        {name: "充值流量", start: 9, end: 12},
                        {name: "充值天数", start: 13, end: 14},
                        {name: "剩余流量", start: 15, end: 18},
                        {name: "剩余天数", start: 19, end: 20},
                        {name: "已用流量", start: 21, end: 24},
                        {name: "已用天数", start: 25, end: 26},
                        {name: "纯水TDS", start: 27, end: 28},
                        {name: "原水TDS", start: 29, end: 30},
                        {name: "1级", start: 31, end: 32},
                        {name: "2级", start: 33, end: 34},
                        {name: "3级", start: 35, end: 36},
                        {name: "4级", start: 37, end: 38},
                        {name: "5级", start: 39, end: 40},
                        {name: "大1", start: 41, end: 42},
                        {name: "大2", start: 43, end: 44},
                        {name: "大3", start: 45, end: 46},
                        {name: "大4", start: 47, end: 48},
                        {name: "大5", start: 49, end: 50},
                        {name: "北京时间", start: 51, end: 54},
                        {name: "机器类型", start: 55, end: 55},
                        {name: "校验码", start: 56, end: 57}
                    ]
                },
                type4: {
                    name: "数据类型4 (58字节)",
                    fields: [
                        {name: "设备ID", start: 0, end: 3},
                        {name: "计费模式", start: 4, end: 4},
                        {name: "命令", start: 5, end: 5},
                        {name: "设备状态", start: 6, end: 6},
                        {name: "本次消费", start: 7, end: 8},
                        {name: "充值流量", start: 9, end: 12},
                        {name: "充值天数", start: 13, end: 14},
                        {name: "剩余流量", start: 15, end: 18},
                        {name: "剩余天数", start: 19, end: 20},
                        {name: "已用流量", start: 21, end: 24},
                        {name: "已用天数", start: 25, end: 26},
                        {name: "纯水TDS", start: 27, end: 28},
                        {name: "原水TDS", start: 29, end: 30},
                        {name: "1级", start: 31, end: 32},
                        {name: "2级", start: 33, end: 34},
                        {name: "3级", start: 35, end: 36},
                        {name: "4级", start: 37, end: 38},
                        {name: "5级", start: 39, end: 40},
                        {name: "大1", start: 41, end: 42},
                        {name: "大2", start: 43, end: 44},
                        {name: "大3", start: 45, end: 46},
                        {name: "大4", start: 47, end: 48},
                        {name: "大5", start: 49, end: 50},
                        {name: "北京时间", start: 51, end: 54},
                        {name: "机器类型", start: 55, end: 55},
                        {name: "校验码", start: 56, end: 57}
                    ]
                }
            };

            // 清理十六进制数据
            function cleanHexData(data) {
                return data.replace(/[\s\-\r\n]/g, '').toUpperCase();
            }

            // 十六进制转十进制
            function hexToDec(hex) {
                return parseInt(hex, 16);
            }

            // 提取字节范围
            function extractBytes(data, start, end) {
                const startPos = start * 2;
                const endPos = (end + 1) * 2;
                const hex = data.substring(startPos, endPos);
                // 直接返回，不添加空格
                return hex;
            }

            // 判断数据类型
            function detectDataType(cleanData) {
                const byteLength = cleanData.length / 2;
                
                if (byteLength === 52) {
                    // 根据数据特征进一步判断是type1、type2还是type3
                    return 'type1'; // 默认返回type1，实际应用中可以根据更多特征判断
                } else if (byteLength === 58) {
                    return 'type4';
                }
                
                return 'type1'; // 默认类型
            }

            // 解析单行数据
            function parseData(rawData) {
                const cleanData = cleanHexData(rawData);
                const dataType = detectDataType(cleanData);
                const typeConfig = dataTypes[dataType];
                
                if (!typeConfig) {
                    throw new Error('未知的数据类型');
                }

                const result = {
                    type: typeConfig.name,
                    originalData: rawData,
                    cleanData: cleanData,
                    fields: []
                };

                typeConfig.fields.forEach(field => {
                    const hexValue = extractBytes(cleanData, field.start, field.end);
                    const decValue = hexToDec(hexValue);
                    
                    // 简化字节范围显示
                    let rangeText;
                    if (field.start === field.end) {
                        rangeText = `${field.start + 1}`;
                    } else {
                        rangeText = `${field.start + 1}~${field.end + 1}`;
                    }
                    
                    result.fields.push({
                        name: field.name,
                        hexValue: hexValue,
                        decValue: decValue,
                        range: rangeText
                    });
                });

                // 添加校验码验证
                try {
                    // 计算校验和：除去最后4个数字(2个字节)外，其余所有数字，每2个数字相加组成的和
                    const dataWithoutChecksum = cleanData.substring(0, cleanData.length - 4);
                    let checksum = 0;
                    
                    // 每2个字符（1个字节）相加
                    for (let i = 0; i < dataWithoutChecksum.length; i += 2) {
                        if (i + 1 < dataWithoutChecksum.length) {
                            const byte = dataWithoutChecksum.substring(i, i + 2);
                            checksum += parseInt(byte, 16);
                        }
                    }
                    
                    // 取后两位字节（校验码）
                    const actualChecksumHex = cleanData.substring(cleanData.length - 4);
                    const actualChecksum = parseInt(actualChecksumHex, 16);
                    
                    // 取校验和的低16位（因为校验码是2字节）
                    const calculatedChecksum = checksum & 0xFFFF;
                    
                    // 验证结果
                    const isValid = calculatedChecksum === actualChecksum;
                    
                    // 添加校验信息到结果
                    result.checksum = {
                        calculated: calculatedChecksum,
                        actual: actualChecksum,
                        isValid: isValid
                    };
                } catch (e) {
                    // 如果计算出错，添加错误信息
                    result.checksum = {
                        error: e.message
                    };
                }
                
                return result;
            }

            // 分析数据
            function analyzeData() {
                const rawInput = document.getElementById('logInput').value.trim();
                const resultSection = document.querySelector('.result-content');
                const statusSection = document.getElementById('statusSection');
                
                if (!rawInput) {
                    statusSection.className = 'status-section error';
                    statusSection.textContent = '❌ 请输入原始数据';
                    return;
                }

                const lines = rawInput.split('\n').filter(line => line.trim());
                
                // 清空现有结果
                resultSection.innerHTML = '';
                
                if (lines.length === 0) {
                    statusSection.className = 'status-section error';
                    statusSection.textContent = '❌ 没有找到有效的数据行';
                    return;
                }

                let successCount = 0;
                let errorCount = 0;
                
                // 为每条数据创建独立的解析结果块
                lines.forEach((line, index) => {
                    try {
                        const parsedData = parseData(line.trim());
                        createResultBlock(parsedData, index);
                        successCount++;
                    } catch (error) {
                        // 创建错误结果块
                        const errorBlock = document.createElement('div');
                        errorBlock.className = 'result-item error';
                        errorBlock.innerHTML = `
                            <div class="result-header">
                                📊 解析结果 (第${index + 1}条) - 解析失败
                            </div>
                            <div class="status-section error">
                                ❌ 解析失败: ${error.message}
                            </div>
                            <div class="error-raw-data">
                                <strong>原始日志:</strong> ${line}
                            </div>
                        `;
                        resultSection.appendChild(errorBlock);
                        errorCount++;
                    }
                });
                
                // 更新状态区域显示统计信息
                statusSection.className = 'status-section info';
                statusSection.innerHTML = `
                    📊 解析完成！成功解析 ${successCount} 条数据，失败 ${errorCount} 条数据。
                `;
            }

            // 创建结果块
            function createResultBlock(parsedData, index) {
                const resultSection = document.querySelector('.result-content');
                
                // 创建结果容器
                const resultBlock = document.createElement('div');
                resultBlock.className = 'result-item';
                resultBlock.style.marginBottom = '20px';
                resultBlock.style.border = '1px solid #e1e5e9';
                resultBlock.style.borderRadius = '10px';
                resultBlock.style.overflow = 'hidden';
                
                // 创建标题栏
                const header = document.createElement('div');
                header.className = 'result-header';
                header.innerHTML = `
                    📊 解析结果 (第${index + 1}条) - ${parsedData.type}
                `;
                resultBlock.appendChild(header);
                
                // 创建原始日志显示区域
                const rawDataDiv = document.createElement('div');
                rawDataDiv.style.padding = '10px';
                rawDataDiv.style.backgroundColor = '#f8f9fa';
                rawDataDiv.style.borderBottom = '1px solid #e1e5e9';
                rawDataDiv.innerHTML = `<strong>原始日志:</strong> ${parsedData.originalData}`;
                resultBlock.appendChild(rawDataDiv);
                
                // 创建表格容器
                const tableContainer = document.createElement('div');
                tableContainer.style.overflowX = 'auto';
                tableContainer.style.width = '100%';
                
                // 创建表格
                const table = document.createElement('table');
                table.className = 'data-table';
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th class="row-label">数据类型</th>
                        </tr>
                        <tr>
                            <th class="row-label">范围</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="row-label"><strong>数值</strong></td>
                        </tr>
                    </tbody>
                `;
                
                // 更新表格内容
                const thead = table.querySelector('thead');
                const tbody = table.querySelector('tbody');
                const titleRow = thead.children[0];
                const rangeRow = thead.children[1];
                const valueRow = tbody.children[0];
                
                parsedData.fields.forEach(field => {
                    // 添加字段标题
                    const th = document.createElement('th');
                    th.title = field.name;
                    th.textContent = field.name;
                    titleRow.appendChild(th);
                    
                    // 添加字节范围
                    const rangeTh = document.createElement('th');
                    rangeTh.className = 'range-cell';
                    rangeTh.textContent = field.range;
                    rangeRow.appendChild(rangeTh);
                    
                    // 添加数值
                    const td = document.createElement('td');
                    td.className = 'data-cell';
                    td.title = `十进制: ${field.decValue}, 十六进制: ${field.hexValue}`;
                    // 优化16进制数值显示：最少保留2位数，00显示为00
                    let formattedHex;
                    if (field.hexValue === '00') {
                        formattedHex = '00'; // 当是00时，保持显示00
                    } else {
                        // 去除前导零
                        const trimmed = field.hexValue.replace(/^0+/, '') || '0';
                        // 确保最少保留2位数
                        formattedHex = trimmed.padStart(2, '0');
                    }
                    td.innerHTML = `<span class="dec-value">${field.decValue}</span><br><span class="hex-value">「${formattedHex}」</span>`;
                    valueRow.appendChild(td);
                });
                
                // 添加校验码验证结果列
                if (parsedData.checksum && !parsedData.checksum.error) {
                    // 添加校验结果标题
                    const checksumTitleTh = document.createElement('th');
                    checksumTitleTh.title = '校验码验证';
                    checksumTitleTh.textContent = '校验验证';
                    titleRow.appendChild(checksumTitleTh);
                    
                    // 添加空的范围单元格
                    const checksumRangeTh = document.createElement('th');
                    checksumRangeTh.className = 'range-cell';
                    checksumRangeTh.textContent = '-';
                    rangeRow.appendChild(checksumRangeTh);
                    
                    // 添加校验结果
                    const checksumTd = document.createElement('td');
                    checksumTd.className = 'data-cell';
                    checksumTd.style.fontWeight = 'bold';
                    checksumTd.style.color = parsedData.checksum.isValid ? '#28a745' : '#dc3545';
                    
                    // 格式化计算出的校验和为16进制，确保4位
                    const calculatedHex = parsedData.checksum.calculated.toString(16).toUpperCase().padStart(4, '0');
                    checksumTd.innerHTML = `${calculatedHex}「${parsedData.checksum.isValid ? '✅' : '❌'}」`;
                    valueRow.appendChild(checksumTd);
                }
                
                tableContainer.appendChild(table);
                resultBlock.appendChild(tableContainer);
                
                // 添加到结果区域
                resultSection.appendChild(resultBlock);
            }

            // 清空数据
            function clearLogData() {
                document.getElementById('logInput').value = '';
                document.getElementById('statusSection').innerHTML = '';
                document.querySelector('.result-content').innerHTML = '';
            }

            // 绑定事件
            document.getElementById('analyzeBtn').addEventListener('click', analyzeData);
            document.getElementById('clearLogBtn').addEventListener('click', clearLogData);

            // 回车键快捷分析
            document.getElementById('logInput').addEventListener('keydown', function(e) {
                if (e.ctrlKey && e.key === 'Enter') {
                    analyzeData();
                }
            });
            
            // 日志解析界面功能
            function analyzeLog() {
                const logInput = document.getElementById('logInput').value.trim();
                const logResult = document.getElementById('logResult');
                
                if (!logInput) {
                    logResult.textContent = '请输入日志数据';
                    return;
                }
                
                try {
                    console.log('开始解析日志:', logInput); // 调试信息
                    
                    const result = analysis(logInput);
                    
                    if (result && result.error) {
                        logResult.textContent = '解析失败：' + result.error;
                        return;
                    }
                    
                    if (result) {
                        let output = '📊 日志解析结果：\n';
                        output += '═'.repeat(50) + '\n\n';
                        
                        // 格式化输出结果
                        for (const [key, value] of Object.entries(result)) {
                            if (value && value.toString().trim()) {
                                output += `${value}\n`;
                            }
                        }
                        
                        output += '\n' + '═'.repeat(50);
                        output += '\n解析完成 ✓';
                        
                        logResult.textContent = output;
                        console.log('解析成功:', result); // 调试信息
                    } else {
                        logResult.textContent = '解析失败：无法识别的数据格式';
                    }
                } catch (error) {
                    logResult.textContent = '解析出错：' + error.message;
                    console.error('日志解析错误:', error);
                }
            }
            
            function clearLogData() {
                document.getElementById('logInput').value = '';
                document.getElementById('logResult').textContent = '等待输入日志数据...';
            }
            
            // 处理回车键自动解析
            function handleLogInputKeydown(event) {
                // 检测回车键（Enter键，keyCode为13）
                if (event.key === 'Enter' || event.keyCode === 13) {
                    // 阻止默认的换行行为
                    event.preventDefault();
                    
                    // 获取输入框的值
                    const logInput = document.getElementById('logInput').value.trim();
                    
                    // 如果有内容则自动开始解析
                    if (logInput) {
                        console.log('🔍 检测到回车键，自动开始解析日志');
                        analyzeLog();
                    } else {
                        console.log('⚠️ 输入框为空，无法解析');
                    }
                }
            }
            class QRGenerator {
                constructor() {
                    this.generatedBlobs = []; // 存储生成的blob对象
                    this.initEventListeners();
                }

                initEventListeners() {
                    document.getElementById('qrGenerateBtn').addEventListener('click', () => this.generateQRCodes());
                    document.getElementById('qrDownloadBtn').addEventListener('click', () => this.downloadZip());
                }

                showError(message) {
                    const errorDiv = document.getElementById('qrErrorMessage');
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 5000);
                }

                showSuccess(message) {
                    const successDiv = document.getElementById('qrSuccessMessage');
                    successDiv.textContent = message;
                    successDiv.style.display = 'block';
                    setTimeout(() => {
                        successDiv.style.display = 'none';
                    }, 3000);
                }

                updateProgress(current, total, text) {
                    const progressContainer = document.getElementById('qrProgressContainer');
                    const progressFill = document.getElementById('qrProgressFill');
                    const progressText = document.getElementById('qrProgressText');
                    
                    progressContainer.style.display = 'block';
                    const percentage = (current / total) * 100;
                    progressFill.style.width = percentage + '%';
                    progressText.textContent = text || `正在生成 ${current}/${total} (${Math.round(percentage)}%)`;
                }

                hideProgress() {
                    document.getElementById('qrProgressContainer').style.display = 'none';
                }

                updateApiStatus(message, show = true) {
                    const apiStatus = document.getElementById('qrApiStatus');
                    const apiStatusText = document.getElementById('qrApiStatusText');
                    
                    if (show) {
                        apiStatus.style.display = 'block';
                        apiStatusText.textContent = message;
                    } else {
                        apiStatus.style.display = 'none';
                    }
                }

                setGenerateButtonState(loading) {
                    const btn = document.getElementById('qrGenerateBtn');
                    const btnText = document.getElementById('qrGenerateBtnText');
                    const btnLoading = document.getElementById('qrGenerateBtnLoading');
                    
                    btn.disabled = loading;
                    btnText.style.display = loading ? 'none' : 'inline';
                    btnLoading.style.display = loading ? 'inline-block' : 'none';
                }

                // 生成带自适应IMEI文字的二维码（带重试机制）
                async generateQRCode(text, imei, retryCount = 0) {
                    const encodedText = encodeURIComponent(text);
                    const maxRetries = 2;
                    
                    // 多个备选API，提高成功率
                    const apis = [
                        `https://api.qrserver.com/v1/create-qr-code/?size=280x280&format=png&data=${encodedText}`,
                        `https://chart.googleapis.com/chart?chs=280x280&cht=qr&chl=${encodedText}`,
                        `https://quickchart.io/qr?text=${encodedText}&size=280`
                    ];
                    
                    const currentApi = apis[retryCount % apis.length];
                    console.log(`🔄 ${imei} 尝试API ${retryCount + 1}/${maxRetries + 1}:`, currentApi);
                    
                    try {
                        // 创建带自适应IMEI文字的二维码图片
                        return await this.addTextToQRCode(currentApi, imei);
                    } catch (error) {
                        console.log(`❌ ${imei} API失败 (${retryCount + 1}/${maxRetries + 1}):`, error.message);
                        
                        if (retryCount < maxRetries) {
                            console.log(`🔄 ${imei} 重试中...`);
                            await new Promise(resolve => setTimeout(resolve, 200)); // 短暂延迟
                            return await this.generateQRCode(text, imei, retryCount + 1);
                        } else {
                            throw new Error(`所有API都失败: ${error.message}`);
                        }
                    }
                }

                // 在二维码图片上添加自适应IMEI文字
                async addTextToQRCode(qrUrl, imei) {
                    console.log(`🖼️ 开始处理: ${imei}`);
                    
                    // 尝试多种方法获取图片
                    const methods = [
                        // 方法1: 使用代理服务器
                        async () => {
                            const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(qrUrl)}`);
                            if (!response.ok) throw new Error(`代理服务器错误: ${response.status}`);
                            return await response.blob();
                        },
                        // 方法2: 使用另一个代理
                        async () => {
                            const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(qrUrl)}`);
                            if (!response.ok) throw new Error(`代理服务器错误: ${response.status}`);
                            return await response.blob();
                        },
                        // 方法3: 直接尝试（可能会有跨域问题，但有些浏览器允许）
                        async () => {
                            const response = await fetch(qrUrl);
                            if (!response.ok) throw new Error(`直接请求错误: ${response.status}`);
                            return await response.blob();
                        }
                    ];
                    
                    let imageBlob = null;
                    let lastError = null;
                    
                    // 尝试每种方法
                    for (let i = 0; i < methods.length; i++) {
                        try {
                            console.log(`🔄 ${imei} 尝试方法 ${i + 1}/${methods.length}`);
                            imageBlob = await methods[i]();
                            console.log(`✅ ${imei} 方法 ${i + 1} 成功获取图片`);
                            break;
                        } catch (error) {
                            console.log(`❌ ${imei} 方法 ${i + 1} 失败:`, error.message);
                            lastError = error;
                            continue;
                        }
                    }
                    
                    if (!imageBlob) {
                        throw new Error(`所有获取图片的方法都失败: ${lastError?.message}`);
                    }
                    
                    const imageUrl = URL.createObjectURL(imageBlob);
                    
                    return new Promise((resolve, reject) => {
                        const img = new Image();
                        
                        const timeout = setTimeout(() => {
                            console.log(`⏰ ${imei} 处理超时`);
                            URL.revokeObjectURL(imageUrl);
                            reject(new Error('处理超时'));
                        }, 10000);
                        
                        img.onload = () => {
                            clearTimeout(timeout);
                            console.log(`✅ ${imei} 图片加载成功`);
                            
                            try {
                                // 创建canvas
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                
                                if (!ctx) {
                                    throw new Error('无法创建Canvas上下文');
                                }
                                
                                // 设置画布尺寸为正方形
                                const qrSize = 280;
                                const textHeight = 80;
                                const totalSize = qrSize + textHeight;
                                
                                canvas.width = totalSize;
                                canvas.height = totalSize;
                                
                                // 填充白色背景
                                ctx.fillStyle = '#ffffff';
                                ctx.fillRect(0, 0, totalSize, totalSize);
                                
                                // 绘制二维码（居中上方）
                                const qrX = (totalSize - qrSize) / 2;
                                const qrY = 10;
                                ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
                                
                                // 自适应文字大小到二维码宽度
                                const maxWidth = qrSize - 20;
                                let fontSize = 50;
                                const minFontSize = 24;
                                
                                // 设置文字样式
                                ctx.fillStyle = '#333333';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                
                                // 动态调整字体大小
                                do {
                                    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                                    const textWidth = ctx.measureText(imei).width;
                                    
                                    if (textWidth <= maxWidth || fontSize <= minFontSize) {
                                        break;
                                    }
                                    fontSize -= 1;
                                } while (fontSize > minFontSize);
                                
                                fontSize = Math.max(fontSize, minFontSize);
                                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                                
                                // 绘制IMEI文字
                                const textY = qrY + qrSize + textHeight / 2;
                                ctx.fillText(imei, totalSize / 2, textY);
                                
                                console.log(`📏 ${imei} 字体: ${fontSize}px`);
                                
                                // 转换为blob
                                canvas.toBlob((resultBlob) => {
                                    if (resultBlob) {
                                        const url = URL.createObjectURL(resultBlob);
                                        this.generatedBlobs.push({ blob: resultBlob, filename: `${imei}.png` });
                                        console.log(`🎉 ${imei} 处理完成`);
                                        
                                        // 清理临时URL
                                        URL.revokeObjectURL(imageUrl);
                                        resolve(url);
                                    } else {
                                        URL.revokeObjectURL(imageUrl);
                                        reject(new Error('Canvas转换失败'));
                                    }
                                }, 'image/png');
                                
                            } catch (error) {
                                console.error(`❌ ${imei} Canvas处理失败:`, error);
                                URL.revokeObjectURL(imageUrl);
                                reject(error);
                            }
                        };
                        
                        img.onerror = (error) => {
                            clearTimeout(timeout);
                            console.error(`❌ ${imei} 图片加载失败:`, error);
                            URL.revokeObjectURL(imageUrl);
                            reject(new Error('图片加载失败'));
                        };
                        
                        img.src = imageUrl;
                    });
                }

                async generateQRCodes() {
                    const prefix = document.getElementById('qrPrefix').value.trim();
                    const imeiText = document.getElementById('qrImeiList').value.trim();
                    
                    if (!prefix) {
                        this.showError('请输入二维码前缀');
                        return;
                    }
                    
                    if (!imeiText) {
                        this.showError('请输入IMEI列表');
                        return;
                    }

                    const imeiList = imeiText.split('\n').filter(imei => imei.trim()).map(imei => imei.trim());
                    
                    if (imeiList.length === 0) {
                        this.showError('请输入有效的IMEI列表');
                        return;
                    }

                    this.setGenerateButtonState(true);
                    this.generatedBlobs = [];
                    document.getElementById('qrGrid').innerHTML = '';
                    document.getElementById('qrDownloadBtn').disabled = true;
                    this.updateApiStatus('使用QR-Server.com API生成二维码...');

                    let successCount = 0;
                    let failCount = 0;

                    for (let i = 0; i < imeiList.length; i++) {
                        const imei = imeiList[i];
                        const qrText = prefix + imei;
                        
                        this.updateProgress(i + 1, imeiList.length, `正在生成 ${i + 1}/${imeiList.length}: ${imei}`);
                        
                        try {
                            const qrUrl = await this.generateQRCode(qrText, imei);
                            await this.displayQRCode(qrUrl, imei, qrText);
                            successCount++;
                            
                            // 减少延迟时间，提高生成速度
                            if (i < imeiList.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        } catch (error) {
                            console.error(`生成 ${imei} 的二维码失败:`, error);
                            failCount++;
                            this.displayErrorQR(imei, error.message);
                        }
                    }

                    this.hideProgress();
                    this.setGenerateButtonState(false);
                    
                    if (successCount > 0) {
                        document.getElementById('qrDownloadBtn').disabled = false;
                        this.updateApiStatus(`✅ 成功生成 ${successCount} 个二维码${failCount > 0 ? `，失败 ${failCount} 个` : ''}`);
                        this.showSuccess(`成功生成 ${successCount} 个二维码${failCount > 0 ? `，失败 ${failCount} 个` : ''}`);
                    } else {
                        this.updateApiStatus('❌ 所有二维码生成失败');
                        this.showError('所有二维码生成失败，请检查网络连接或稍后重试');
                    }
                }

                async displayQRCode(qrUrl, imei, qrText) {
                    return new Promise((resolve, reject) => {
                        const qrItem = document.createElement('div');
                        qrItem.className = 'qr-item';
                        
                        // 创建图片元素并等待加载
                        const img = new Image();
                        img.onload = () => {
                            qrItem.innerHTML = `
                                <img src="${qrUrl}" alt="QR Code for ${imei}">
                                <div class="qr-label">${imei}</div>
                                <div class="qr-label" style="font-size: 0.7em; color: #999; margin-top: 5px;">${qrText}</div>
                                <div class="qr-label" style="font-size: 0.6em; color: #4facfe; margin-top: 3px;">API: QR-Server.com</div>
                            `;
                            
                            document.getElementById('qrGrid').appendChild(qrItem);
                            resolve();
                        };
                        
                        img.onerror = () => {
                            reject(new Error('二维码图片加载失败'));
                        };
                        
                        img.src = qrUrl;
                    });
                }

                displayErrorQR(imei, errorMsg) {
                    const qrItem = document.createElement('div');
                    qrItem.className = 'qr-item';
                    qrItem.style.background = '#ffe6e6';
                    qrItem.innerHTML = `
                        <div style="padding: 20px; color: #d63031;">
                            <div style="font-size: 2em; margin-bottom: 10px;">❌</div>
                            <div class="qr-label">${imei}</div>
                            <div style="font-size: 0.8em; margin-top: 5px;">${errorMsg}</div>
                        </div>
                    `;
                    
                    document.getElementById('qrGrid').appendChild(qrItem);
                }

                async downloadZip() {
                    if (this.generatedBlobs.length === 0) {
                        this.showError('没有可下载的二维码');
                        return;
                    }

                    const zip = new JSZip();
                    const downloadBtn = document.getElementById('qrDownloadBtn');
                    const originalText = downloadBtn.textContent;
                    
                    downloadBtn.disabled = true;
                    downloadBtn.innerHTML = '<span class="loading"></span> 正在打包...';

                    try {
                        // 处理生成的图片
                        for (let i = 0; i < this.generatedBlobs.length; i++) {
                            const item = this.generatedBlobs[i];
                            zip.file(item.filename, item.blob);
                            downloadBtn.textContent = `正在打包 ${i + 1}/${this.generatedBlobs.length}`;
                        }

                        downloadBtn.textContent = '正在生成压缩包...';
                        const content = await zip.generateAsync({type: 'blob'});
                        
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(content);
                        link.download = `二维码_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
                        link.click();
                        
                        URL.revokeObjectURL(link.href);
                        this.showSuccess('二维码打包下载成功！');
                        
                    } catch (error) {
                        console.error('打包下载失败:', error);
                        this.showError('打包下载失败: ' + error.message);
                    } finally {
                        downloadBtn.disabled = false;
                        downloadBtn.textContent = originalText;
                    }
                }
            }

            // 初始化二维码生成器
            let qrGenerator = null;
            function initQRGenerator() {
                if (!qrGenerator) {
                    qrGenerator = new QRGenerator();
                }
            }

            // 生成当日日期+001的默认值
            function getDefaultSerialNumber() {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                return `${year}${month}${day}001`;
            }
            
            // 初始化生成流水号工具
            function initSerialNumberTool() {
                document.getElementById('startSerialNumber').value = getDefaultSerialNumber();
                document.getElementById('serialNumberCount').value = 10;// 设置默认数量为10
            }
            
            // 当前激活的工具ID
            let currentActiveTool = null;
            let mobileMenuOpen = false;
            
            // 切换移动端菜单显示状态
            function toggleMobileMenu() {
                const mobileMenu = document.getElementById('mobileMenu');
                const mobileMenuBtn = document.getElementById('mobileMenuBtn');
                
                if (mobileMenuOpen) {
                    mobileMenu.style.display = 'none';
                    mobileMenuBtn.textContent = '☰';
                    mobileMenuBtn.style.borderRadius = '12px 12px 0 0'; // 恢复底部圆角
                } else {
                    mobileMenu.style.display = 'block';
                    mobileMenuBtn.textContent = '✕';
                    mobileMenuBtn.style.borderRadius = '12px 12px 0 0'; // 确保底部无圆角
                }
                
                mobileMenuOpen = !mobileMenuOpen;
            }
            
            // 在显示工具时初始化
            function showTool(toolId) {
                // 隐藏所有工具
                document.querySelectorAll('.calculator').forEach(tool => {
                    tool.style.display = 'none';
                });
                
                // 显示选中的工具
                const selectedTool = document.getElementById(toolId);
                if (selectedTool) {
                    selectedTool.style.display = 'block';
                    currentActiveTool = toolId; // 记录当前激活的工具ID
                    
                    // 如果是二维码生成器，初始化它
                    if (toolId === 'qrGeneratorTool') {
                        initQRGenerator();
                    }
                    
                    // 如果是生成流水号工具，初始化它
                    if (toolId === 'serialNumberTool') {
                        initSerialNumberTool();
                    }
                    
                    // 如果是日志分析器，可以做一些初始化
                    if (toolId === 'logAnalysisTool') {
                        // 这里可以添加日志分析器的初始化逻辑
                        console.log('日志分析器已激活');
                    }
                }
                
                // 更新按钮激活状态
                document.querySelectorAll('.tool-switcher button').forEach(btn => {
                    btn.classList.remove('active');
                });
                const activeBtn = document.querySelector(`.tool-switcher button[onclick="showTool('${toolId}')"]`);
                if (activeBtn) {
                    activeBtn.classList.add('active');
                }
                
                // 在移动端设备上，切换工具后关闭菜单
                if (window.innerWidth < 768 && mobileMenuOpen) {
                    toggleMobileMenu();
                }
            }
            
            // 响应窗口大小变化
            function handleResize() {
                const mobileMenuBtn = document.getElementById('mobileMenuBtn');
                const toolSwitcher = document.querySelector('.tool-switcher');
                const mobileMenu = document.getElementById('mobileMenu');
                
                // 在小屏幕设备上显示移动端菜单按钮，隐藏桌面端工具导航
                if (window.innerWidth < 768) {
                    mobileMenuBtn.style.display = 'block';
                    toolSwitcher.style.display = 'none';
                    mobileMenu.style.display = mobileMenuOpen ? 'block' : 'none';
                } else {
                    // 在大屏幕设备上隐藏移动端菜单按钮，显示桌面端工具导航
                    mobileMenuBtn.style.display = 'none';
                    toolSwitcher.style.display = 'flex';
                    mobileMenu.style.display = 'none';
                    mobileMenuOpen = false;
                }
            }
            
            // 绑定窗口大小变化事件
            window.addEventListener('resize', handleResize);
            
            // 页面加载完成后初始化
            document.addEventListener('DOMContentLoaded', function() {
                handleResize();
            });
            
            // 显示消息提示函数
            function showMessage(message, type = 'info') {
                // 查找或创建当前激活工具页面中的提示元素
                let messageElement;
                
                // 如果有当前激活的工具
                if (currentActiveTool) {
                    const activeToolElement = document.getElementById(currentActiveTool);
                    if (activeToolElement) {
                        // 先在当前工具页面中查找现有的提示元素
                        messageElement = activeToolElement.querySelector('.toolMessage');
                        
                        // 如果没有找到，创建一个新的提示元素
                        if (!messageElement) {
                            messageElement = document.createElement('div');
                            messageElement.className = 'toolMessage';
                            messageElement.style.padding = '10px';
                            messageElement.style.marginBottom = '10px';
                            messageElement.style.borderRadius = '5px';
                            messageElement.style.backgroundColor = '#f8f9fa';
                            messageElement.style.display = 'none';
                            
                            // 将新元素插入到工具页面的第一个子元素之前
                            if (activeToolElement.firstChild) {
                                activeToolElement.insertBefore(messageElement, activeToolElement.firstChild);
                            } else {
                                activeToolElement.appendChild(messageElement);
                            }
                        }
                    }
                }
                
                // 如果没有找到或创建成功，回退到全局的提示元素
                if (!messageElement) {
                    messageElement = document.getElementById('toolMessage') || document.querySelector('.toolMessage');
                    
                    // 如果仍然没有找到，创建一个全局的提示元素
                    if (!messageElement) {
                        messageElement = document.createElement('div');
                        messageElement.className = 'toolMessage';
                        messageElement.id = 'toolMessage';
                        messageElement.style.padding = '10px';
                        messageElement.style.marginBottom = '10px';
                        messageElement.style.borderRadius = '5px';
                        messageElement.style.backgroundColor = '#f8f9fa';
                        messageElement.style.display = 'none';
                        
                        // 将全局提示元素添加到body
                        document.body.appendChild(messageElement);
                    }
                }
                
                // 设置消息内容和样式
                messageElement.textContent = message;
                
                // 设置不同类型消息的样式
                if (type === 'success') {
                    messageElement.style.backgroundColor = '#d4edda';
                    messageElement.style.color = '#155724';
                    messageElement.style.border = '1px solid #c3e6cb';
                } else if (type === 'error') {
                    messageElement.style.backgroundColor = '#f8d7da';
                    messageElement.style.color = '#721c24';
                    messageElement.style.border = '1px solid #f5c6cb';
                } else {
                    messageElement.style.backgroundColor = '#d1ecf1';
                    messageElement.style.color = '#0c5460';
                    messageElement.style.border = '1px solid #bee5eb';
                }
                
                messageElement.style.display = 'block';
                
                // 10秒后自动隐藏消息
                setTimeout(() => {
                    if (messageElement && messageElement.style.display === 'block') {
                        messageElement.style.display = 'none';
                    }
                }, 10000);
            }
            
            // 生成流水号函数
            function generateSerialNumbers() {
                const startSerial = document.getElementById('startSerialNumber').value.trim();
                const count = parseInt(document.getElementById('serialNumberCount').value.trim()) || 0;
                const endSerial = document.getElementById('endSerialNumber').value.trim();
                
                // 验证输入
                if (!startSerial) {
                    showMessage('请输入起始流水号', 'error');
                    return;
                }
                
                if (count === 0 && !endSerial) {
                    showMessage('请输入数量或结束流水号', 'error');
                    return;
                }
                
                if (count > 0 && endSerial) {
                    showMessage('数量和结束流水号只能选择一个输入', 'error');
                    return;
                }
                
                const results = [];
                
                try {
                    // 尝试提取起始流水号中的数字后缀
                    const numericMatch = startSerial.match(/(\d+)$/);
                    const prefix = startSerial.replace(/\d+$/, '');
                    const startNumber = numericMatch ? parseInt(numericMatch[1]) : 1;
                    
                    // 根据数量生成
                    if (count > 0) {
                        for (let i = 0; i < count; i++) {
                            const numberPart = String(startNumber + i).padStart(numericMatch ? numericMatch[1].length : 3, '0');
                            results.push(prefix + numberPart);
                        }
                    } 
                    // 根据结束流水号生成
                    else if (endSerial) {
                        const endNumericMatch = endSerial.match(/(\d+)$/);
                        if (!endNumericMatch) {
                            showMessage('结束流水号格式不正确', 'error');
                            return;
                        }
                        
                        const endNumber = parseInt(endNumericMatch[1]);
                        if (endNumber < startNumber) {
                            showMessage('结束流水号必须大于起始流水号', 'error');
                            return;
                        }
                        
                        for (let i = 0; i <= endNumber - startNumber; i++) {
                            const numberPart = String(startNumber + i).padStart(numericMatch ? numericMatch[1].length : 3, '0');
                            results.push(prefix + numberPart);
                        }
                    }
                    
                    // 显示结果
                    document.getElementById('serialNumberResult').value = results.join('\n');
                    showMessage('流水号生成成功，共生成 ' + results.length + ' 个流水号', 'success');
                    
                } catch (error) {
                    console.error('生成流水号失败:', error);
                    showMessage('生成流水号失败: ' + error.message, 'error');
                }
            }
            
            // 复制流水号结果
            function copySerialNumbers() {
                const resultText = document.getElementById('serialNumberResult').value;
                if (!resultText.trim()) {
                    showMessage('请先生成流水号', 'error');
                    return;
                }
                
                navigator.clipboard.writeText(resultText).then(() => {
                    showMessage('复制成功', 'success');
                }).catch(err => {
                    console.error('复制失败:', err);
                    showMessage('复制失败，请手动复制', 'error');
                });
            }
            
            // 修改为后台批量查询格式
            function formatSerialNumbers() {
                const resultText = document.getElementById('serialNumberResult').value;
                if (!resultText.trim()) {
                    showMessage('请先生成流水号', 'error');
                    return;
                }
                
                // 将换行分隔的流水号转换为逗号分隔
                const serialNumbers = resultText.split('\n').filter(line => line.trim());
                document.getElementById('serialNumberResult').value = serialNumbers.join(',');
                showMessage('已转换为后台批量查询格式', 'success');
            }
            
            // 防止科学计数格式
            function addQuotesToSerialNumbers() {
                const resultText = document.getElementById('serialNumberResult').value;
                if (!resultText.trim()) {
                    showMessage('请先生成流水号', 'error');
                    return;
                }
                
                // 处理不同格式的流水号
                let serialNumbers;
                if (resultText.includes(',')) {
                    // 逗号分隔的格式
                    serialNumbers = resultText.split(',').filter(item => item.trim());
                    // 添加单引号并重新用逗号连接
                    document.getElementById('serialNumberResult').value = serialNumbers.map(serial => 
                        serial.trim().endsWith("'") ? serial.trim() : serial.trim() + "'"
                    ).join(',');
                } else {
                    // 换行分隔的格式
                    serialNumbers = resultText.split('\n').filter(line => line.trim());
                    // 添加单引号并保持换行格式
                    document.getElementById('serialNumberResult').value = serialNumbers.map(serial => 
                        serial.trim().endsWith("'") ? serial.trim() : serial.trim() + "'"
                    ).join('\n');
                }
                showMessage('已添加单引号防止科学计数格式', 'success');
            }
            
        
        // 初始化二维码解析工具
        document.addEventListener('DOMContentLoaded', function() {
            
            // 二维码批量识别工具初始化
            if (document.getElementById('qrBatchStartBtn')) qrBatchInit();
            
        });
        
        // 解析二维码
        // ============================================================
        //  二维码批量识别（qrBatchTool）— 复刻统一工作台 tool_qr_decoder 批量识别
        //  二维码解码使用 ZXing（CDN 加载的 @zxing/library，支持一图多码）
        // ============================================================
        const qrBatchState = { running: false, cancelled: false, results: [] };
        let qrBatchToastTimer = null;

        function qrBatchInit() {
            const drop = document.getElementById('qrBatchDrop');
            const input = document.getElementById('qrBatchFiles');
            drop.addEventListener('click', () => input.click());
            input.addEventListener('change', () => {
                const n = input.files ? input.files.length : 0;
                document.getElementById('qrBatchDropText').textContent =
                    n > 0 ? `已选择 ${n} 个文件` : '📁 点击或拖拽图片文件 / 文件夹到这里';
            });
            ['dragover', 'dragenter'].forEach(ev =>
                drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = '#007bff'; }));
            ['dragleave', 'drop'].forEach(ev =>
                drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = '#ccc'; }));
            drop.addEventListener('drop', e => {
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                    input.files = e.dataTransfer.files;
                    document.getElementById('qrBatchDropText').textContent = `已选择 ${e.dataTransfer.files.length} 个文件`;
                }
            });
            document.getElementById('qrBatchStartBtn').addEventListener('click', qrBatchStart);
            document.getElementById('qrBatchCancelBtn').addEventListener('click', () => {
                qrBatchState.cancelled = true; showQrBatchToast('正在取消...', 'info');
            });
            document.getElementById('qrBatchExportMdBtn').addEventListener('click', () => qrBatchExport('md'));
            document.getElementById('qrBatchExportCsvBtn').addEventListener('click', () => qrBatchExport('csv'));
            document.getElementById('qrBatchExtractLinksBtn').addEventListener('click', qrBatchExtractLinks);
            document.getElementById('qrBatchExtractImeiBtn').addEventListener('click', qrBatchExtractImei);
            document.getElementById('qrBatchBatchFmtBtn').addEventListener('click', qrBatchBatchFormat);
            document.getElementById('qrBatchCopyBtn').addEventListener('click', () =>
                qrBatchCopy(document.getElementById('qrBatchResult').value));
            document.getElementById('qrBatchClearBtn').addEventListener('click', qrBatchClear);
        }

        // ---- 文本处理工具（移植自统一工作台 tool_qr_decoder） ----
        function qrExtractUrls(text) {
            const raw = (text || '').match(/https?:\/\/[^\s<>"')\]}]+/g) || [];
            return raw.map(u => u.replace(/['".,;:!?)`|\\\/><]+$/, ''));
        }
        function qrExtractLastSegment(url) {
            const clean = url.split('?')[0].split('#')[0];
            const segs = clean.split('/').filter(s => s);
            const seg = segs.length ? segs[segs.length - 1] : '';
            return seg.replace(/['".,;:!?)`|\\\/<>]+$/, '');
        }
        function qrExtractImeiNumbers(text) {
            const nums = text.match(/\d+/g) || [];
            return nums.length ? nums[nums.length - 1] : '';
        }
        function qrDedupe(arr) {
            const seen = new Set(), out = [];
            arr.forEach(x => { if (!seen.has(x)) { seen.add(x); out.push(x); } });
            return out;
        }
        function qrToBatchFormat(text) {
            return (text || '').split('\n').map(l => l.trim()).filter(l => l).join(',');
        }

        // ---- 提示 / 汇总 ----
        function showQrBatchToast(msg, type) {
            const t = document.getElementById('qrBatchToast');
            t.textContent = msg;
            t.style.display = 'block';
            if (type === 'error') { t.style.background = '#f8d7da'; t.style.color = '#721c24'; t.style.border = '1px solid #f5c6cb'; }
            else if (type === 'success') { t.style.background = '#d4edda'; t.style.color = '#155724'; t.style.border = '1px solid #c3e6cb'; }
            else { t.style.background = '#cce5ff'; t.style.color = '#004085'; t.style.border = '1px solid #b8daff'; }
            if (qrBatchToastTimer) clearTimeout(qrBatchToastTimer);
            qrBatchToastTimer = setTimeout(() => { t.style.display = 'none'; }, 1500);
        }
        function updateQrBatchSummary() {
            const total = qrBatchState.results.length;
            const qr = qrBatchState.results.reduce((s, r) => s + r.codes.length, 0);
            document.getElementById('qrBatchSummary').textContent = `当前合计：${total} 张图片 / ${qr} 个二维码`;
        }
        function qrBatchSetRunning(running) {
            document.getElementById('qrBatchStartBtn').disabled = running;
            document.getElementById('qrBatchCancelBtn').disabled = !running;
        }

        // ---- 解码单图（ZXing，支持一图多码） ----
        // 新策略（mask-and-repeat）：直接在 canvas 上“解码一个、盖黑一个”地循环。
        //   1) 把图片画到一张可擦写的“工作画布”上；
        //   2) 对工作画布解码一次，拿到一个二维码；
        //   3) 用黑色矩形把该二维码区域盖掉（含 finder 与静区），再解码，直到抛 NotFoundException；
        //   4) 全程对文本去重。
        // 相比旧的“整图 + 多组重叠网格分块”方案：
        //  - 解码次数从“上百次”降到“二维码个数 + 1”，速度大幅提升；
        //  - 不再依赖预设网格，任意排布（3 个相同 / 10~20 个不同 / 混合）都能逐个捞出；
        //  - 用 decodeBitmap + HTMLCanvasElementLuminanceSource 直接吃 canvas，省去 toDataURL 与逐块 new Image 的开销。
        // ---- 解码单图（ZXing，支持一图多码 + 任意排布） ----
        // 组合策略：整图 mask-and-repeat + 多网格分块回退 + dual binarizer
        //   Stage 1) 整图 hybrid  —— 主力，最快路径（码稀疏时 < 100ms）
        //   Stage 2) 整图 global  —— 低对比度补救
        //   Stage 3) 网格 2x2 hybrid  —— 整图漏识别时的主力回退
        //   Stage 4) 网格 2x2 global  —— 整图漏识别时的补救
        //   Stage 5) 网格 3x3 global  —— 密集排布补救（不跳已知区域）
        //   Stage 6) 横排/竖排 1x2,2x1,1x3,3x1 hybrid  —— 长条形排布补救
        // 全程用 Set 文本去重：相同码只输出一次，不同码全输出。
        async function qrBatchDecodeFile(file) {
            if (typeof ZXing === 'undefined' || !ZXing.BrowserMultiFormatReader) {
                return { name: file.name, ok: false, codes: [], positions: [] };
            }
            return new Promise(function (resolve) {
                const fr = new FileReader();
                fr.onload = function (e) {
                    const img = new Image();
                    img.onload = async function () {
                        try {
                            const natW = img.naturalWidth || img.width;
                            const natH = img.naturalHeight || img.height;
                            // 超大图先等比缩小到 maxSize（兼顾速度与细节）
                            const maxSize = 2400;
                            let srcW = natW, srcH = natH, srcCanvas = null;
                            if ((natW > maxSize || natH > maxSize) && natW > 0 && natH > 0) {
                                const s = maxSize / Math.max(natW, natH);
                                srcW = Math.max(1, Math.round(natW * s));
                                srcH = Math.max(1, Math.round(natH * s));
                                srcCanvas = document.createElement('canvas');
                                srcCanvas.width = srcW; srcCanvas.height = srcH;
                                srcCanvas.getContext('2d').drawImage(img, 0, 0, srcW, srcH);
                            }

                            // 基础画布（原始像素，不在它上面累计掩码）
                            const base = document.createElement('canvas');
                            base.width = srcW; base.height = srcH;
                            const bctx = base.getContext('2d');
                            if (srcCanvas) bctx.drawImage(srcCanvas, 0, 0);
                            else bctx.drawImage(img, 0, 0, srcW, srcH);

                            const reader = new ZXing.BrowserMultiFormatReader();
                            const seen = new Map(); // text -> bbox
                            const knownBboxes = [];
                            const tryAdd = function (text, bbox) {
                                if (!text || seen.has(text)) return false;
                                seen.set(text, bbox);
                                knownBboxes.push(bbox);
                                return true;
                            };
                            const bboxOverlap = function (a, b) {
                                const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
                                const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
                                return ix * iy;
                            };
                            const bboxArea = function (b) { return (b.x1 - b.x0) * (b.y1 - b.y0); };
                            // 单元格与已知码 bbox 50% 以上重叠时跳过
                            const cellHasKnown = function (cellBbox) {
                                for (const b of knownBboxes) {
                                    if (bboxOverlap(cellBbox, b) > bboxArea(b) * 0.5) return true;
                                }
                                return false;
                            };

                            // 在指定 canvas 上跑 mask-and-repeat，bin='hybrid'|'global'
                            const runMaskRepeat = async function (canvas, bin, maxIters) {
                                const W = canvas.width, H = canvas.height;
                                const cctx = canvas.getContext('2d');
                                for (let iter = 0; iter < maxIters; iter++) {
                                    let result;
                                    try {
                                        const lum = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
                                        const B = bin === 'global' ? ZXing.GlobalHistogramBinarizer : ZXing.HybridBinarizer;
                                        const bmp = new ZXing.BinaryBitmap(new B(lum));
                                        result = reader.decodeBitmap(bmp);
                                    } catch (e) { break; }
                                    if (!result) break;
                                    const pts = result.getResultPoints() || [];
                                    if (pts.length < 3) break;
                                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                                    for (const p of pts) {
                                        const x = p.getX(), y = p.getY();
                                        if (x < minX) minX = x; if (y < minY) minY = y;
                                        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
                                    }
                                    if (minX === Infinity) break;
                                    const pad = Math.max(6, Math.round(Math.max(maxX - minX, maxY - minY) * 0.12));
                                    const text = result.getText();
                                    const bbox = {
                                        x0: Math.max(0, minX - pad), y0: Math.max(0, minY - pad),
                                        x1: Math.min(W - 1, maxX + pad), y1: Math.min(H - 1, maxY + pad)
                                    };
                                    tryAdd(text, bbox);
                                    cctx.fillStyle = '#000';
                                    cctx.fillRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0 + 1, bbox.y1 - bbox.y0 + 1);
                                }
                            };

                            // 在原图 base 上 crop 一个子区域到新 canvas 上跑 mask-and-repeat
                            const runGridCell = async function (x0, y0, x1, y1, bin, maxIters) {
                                const cw = x1 - x0, ch = y1 - y0;
                                if (cw < 60 || ch < 60) return;
                                const cell = document.createElement('canvas');
                                cell.width = cw; cell.height = ch;
                                cell.getContext('2d').drawImage(base, x0, y0, cw, ch, 0, 0, cw, ch);
                                await runMaskRepeat(cell, bin, maxIters);
                            };

                            // Stage 1: 整图 hybrid
                            {
                                const work = document.createElement('canvas');
                                work.width = srcW; work.height = srcH;
                                work.getContext('2d').drawImage(base, 0, 0);
                                await runMaskRepeat(work, 'hybrid', 30);
                            }
                            // Stage 2: 整图 global
                            {
                                const work = document.createElement('canvas');
                                work.width = srcW; work.height = srcH;
                                work.getContext('2d').drawImage(base, 0, 0);
                                await runMaskRepeat(work, 'global', 30);
                            }
                            // Stage 3-4: 网格 2x2 (hybrid + global) —— 整图漏识别时主力回退
                            const stepX2 = srcW / 2, stepY2 = srcH / 2, ov2 = 0.25;
                            const cW2 = stepX2 * (1 + ov2), cH2 = stepY2 * (1 + ov2);
                            for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
                                const x0 = Math.max(0, Math.round(cx * stepX2 - cW2 * ov2 / 2));
                                const y0 = Math.max(0, Math.round(cy * stepY2 - cH2 * ov2 / 2));
                                const x1 = Math.min(srcW, Math.round(x0 + cW2));
                                const y1 = Math.min(srcH, Math.round(y0 + cH2));
                                if (cellHasKnown({ x0, y0, x1, y1 })) continue;
                                await runGridCell(x0, y0, x1, y1, 'hybrid', 20);
                                await runGridCell(x0, y0, x1, y1, 'global', 20);
                            }
                            // Stage 5: 网格 3x3 global (不跳已知区域) —— 密集排布补救
                            if (seen.size < 3) {
                                const stepX3 = srcW / 3, stepY3 = srcH / 3, ov3 = 0.3;
                                const cW3 = stepX3 * (1 + ov3), cH3 = stepY3 * (1 + ov3);
                                for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) {
                                    const x0 = Math.max(0, Math.round(cx * stepX3 - cW3 * ov3 / 2));
                                    const y0 = Math.max(0, Math.round(cy * stepY3 - cH3 * ov3 / 2));
                                    const x1 = Math.min(srcW, Math.round(x0 + cW3));
                                    const y1 = Math.min(srcH, Math.round(y0 + cH3));
                                    await runGridCell(x0, y0, x1, y1, 'global', 12);
                                }
                            }
                            // Stage 6: 横排/竖排 grids (整图无码或极少时)
                            if (seen.size < 2) {
                                const rowGrids = [[1, 2], [2, 1], [1, 3], [3, 1]];
                                for (const g of rowGrids) {
                                    const cols = g[0], rows = g[1];
                                    const stX = srcW / cols, stY = srcH / rows, ov = 0.2;
                                    const cW = stX * (1 + ov), cH = stY * (1 + ov);
                                    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
                                        const x0 = Math.max(0, Math.round(cx * stX - cW * ov / 2));
                                        const y0 = Math.max(0, Math.round(cy * stY - cH * ov / 2));
                                        const x1 = Math.min(srcW, Math.round(x0 + cW));
                                        const y1 = Math.min(srcH, Math.round(y0 + cH));
                                        if (cellHasKnown({ x0, y0, x1, y1 })) continue;
                                        await runGridCell(x0, y0, x1, y1, 'hybrid', 10);
                                    }
                                }
                            }

                            const codes = [], positions = [];
                            for (const [text, bbox] of seen) {
                                codes.push(text);
                                positions.push({
                                    topLeftCorner: { x: bbox.x0, y: bbox.y0 },
                                    topRightCorner: { x: bbox.x1, y: bbox.y0 },
                                    bottomLeftCorner: { x: bbox.x0, y: bbox.y1 }
                                });
                            }
                            if (codes.length) resolve({ name: file.name, ok: true, codes, positions });
                            else resolve({ name: file.name, ok: false, codes: [], positions: [] });
                        } catch (err) {
                            resolve({ name: file.name, ok: false, codes: [], positions: [] });
                        }
                    };
                    img.onerror = function () { resolve({ name: file.name, ok: false, codes: [], positions: [] }); };
                    img.src = e.target.result;
                };
                fr.onerror = function () { resolve({ name: file.name, ok: false, codes: [], positions: [] }); };
                fr.readAsDataURL(file);
            });
        }



        // ---- 开始批量识别 ----
        async function qrBatchStart() {
            if (qrBatchState.running) return;
            if (typeof ZXing === 'undefined' || !ZXing.BrowserMultiFormatReader) { showQrBatchToast('ZXing 库未加载，无法解析（需联网加载 CDN）', 'error'); return; }
            const input = document.getElementById('qrBatchFiles');
            const files = Array.from(input.files || []).filter(f => (f.type || '').startsWith('image/'));
            if (files.length === 0) { showQrBatchToast('请先选择图片或文件夹', 'error'); return; }

            qrBatchState.running = true; qrBatchState.cancelled = false; qrBatchState.results = [];
            qrBatchSetRunning(true);
            document.getElementById('qrBatchProgress').value = 0;
            document.getElementById('qrBatchStatus').style.display = 'block';
            document.getElementById('qrBatchStatus').textContent = `准备识别 ${files.length} 个文件...`;

            for (let i = 0; i < files.length; i++) {
                if (qrBatchState.cancelled) break;
                const r = await qrBatchDecodeFile(files[i]);
                qrBatchState.results.push(r);
                const pct = Math.round((i + 1) / files.length * 100);
                document.getElementById('qrBatchProgress').value = pct;
                document.getElementById('qrBatchStatus').textContent =
                    `已处理 ${i + 1}/${files.length} · ${r.ok ? '识别到' : '未识别'} ${r.name}`;
            }
            qrBatchFinish();
        }

        function qrBatchFinish() {
            qrBatchState.running = false;
            qrBatchSetRunning(false);
            const total = qrBatchState.results.length;
            const decoded = qrBatchState.results.filter(r => r.ok).length;
            const failed = total - decoded;
            const qrCount = qrBatchState.results.reduce((s, r) => s + r.codes.length, 0);

            document.getElementById('qrBatchResult').value = qrBatchBuildResultText();

            const failedNames = qrBatchState.results.filter(r => !r.ok).map(r => r.name);
            const fl = document.getElementById('qrBatchFailed');
            if (failedNames.length) {
                fl.style.display = 'block';
                fl.textContent = `未识别图片（${failedNames.length} 张）：${failedNames.join('、')}`;
            } else {
                fl.style.display = 'block';
                fl.textContent = '全部识别成功，无未识别图片。';
            }

            updateQrBatchSummary();
            document.getElementById('qrBatchStatus').textContent =
                `完成：共 ${total} 张，识别成功 ${decoded} 张，未识别 ${failed} 张，二维码 ${qrCount} 个`;
            ['qrBatchExportMdBtn', 'qrBatchExportCsvBtn', 'qrBatchExtractLinksBtn',
             'qrBatchExtractImeiBtn', 'qrBatchBatchFmtBtn', 'qrBatchCopyBtn'].forEach(id =>
                document.getElementById(id).disabled = false);
            showQrBatchToast(`识别完成：成功 ${decoded}/${total}，二维码 ${qrCount} 个`, 'success');
        }

        function qrBatchBuildResultText() {
            const lines = [];
            qrBatchState.results.forEach(r => {
                lines.push(`【${r.name}】`);
                if (r.ok) r.codes.forEach((c, i) => lines.push(`  二维码${i + 1}: ${c}`));
                else lines.push('  未识别');
                lines.push('');
            });
            return lines.join('\n');
        }

        // ---- 导出 MD / CSV ----
        function qrBatchExport(kind) {
            if (qrBatchState.results.length === 0) { showQrBatchToast('暂无结果，请先识别', 'error'); return; }
            const ts = new Date();
            const pad = n => String(n).padStart(2, '0');
            const base = `二维码信息${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
            const decoded = qrBatchState.results.filter(r => r.ok).length;
            const qrCount = qrBatchState.results.reduce((s, r) => s + r.codes.length, 0);

            if (kind === 'md') {
                let md = '# 二维码识别结果\n\n';
                md += `- 扫描时间: ${ts.toLocaleString()}\n`;
                md += `- 图片总数: ${qrBatchState.results.length}\n`;
                md += `- 识别成功: ${decoded}\n`;
                md += `- 未识别: ${qrBatchState.results.length - decoded}\n`;
                md += `- 二维码总数: ${qrCount}\n\n---\n\n`;
                md += '## 识别到的二维码\n\n';
                qrBatchState.results.filter(r => r.ok).forEach(r => {
                    md += `### ${r.name}\n\n`;
                    r.codes.forEach((c, i) => { md += `- 二维码${i + 1}: \`${c}\`\n`; });
                    md += '\n';
                });
                qrBatchDownload(base + '.md', md, 'text/markdown');
            } else {
                let csv = '图片名称,图片路径,是否识别成功,二维码序号,二维码内容,IMEI,左上角X,左上角Y,宽度,高度\n';
                qrBatchState.results.forEach(r => {
                    if (r.ok) {
                        r.codes.forEach((c, i) => {
                            const imei = qrExtractImeiNumbers(c);
                            let x = '', y = '', w = '', h = '';
                            const loc = r.positions[i];
                            if (loc && loc.topLeftCorner) {
                                x = Math.round(loc.topLeftCorner.x);
                                y = Math.round(loc.topLeftCorner.y);
                            }
                            if (loc && loc.topRightCorner && loc.topLeftCorner) {
                                w = Math.round(loc.topRightCorner.x - loc.topLeftCorner.x);
                                h = Math.round(loc.bottomLeftCorner.y - loc.topLeftCorner.y);
                            }
                            csv += `"${r.name}","${r.name}",是,${i + 1},"${c}","${imei}",${x},${y},${w},${h}\n`;
                        });
                    } else {
                        csv += `"${r.name}","${r.name}",否,,,,,,,,\n`;
                    }
                });
                qrBatchDownload(base + '.csv', csv, 'text/csv');
            }
            showQrBatchToast(`已导出 ${kind.toUpperCase()}`, 'success');
        }
        function qrBatchDownload(filename, content, mime) {
            const blob = new Blob([content], { type: mime + ';charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
        }

        // ---- 二次提取 ----
        function qrBatchExtractLinks() {
            const text = document.getElementById('qrBatchResult').value;
            if (!text.trim()) { showQrBatchToast('结果区为空，请先识别', 'error'); return; }
            const urls = qrDedupe(qrExtractUrls(text));
            document.getElementById('qrBatchResult').value = urls.join('\n');
            qrBatchCopy(urls.join('\n'));
            updateQrBatchSummary();
            showQrBatchToast(`提取链接：${urls.length} 条（已复制）`, 'success');
        }
        function qrBatchExtractImei() {
            const text = document.getElementById('qrBatchResult').value;
            if (!text.trim()) { showQrBatchToast('结果区为空，请先识别', 'error'); return; }
            const urls = qrExtractUrls(text);
            const ids = qrDedupe(urls.map(u => qrExtractLastSegment(u)).filter(s => s));
            document.getElementById('qrBatchResult').value = ids.join('\n');
            qrBatchCopy(ids.join('\n'));
            updateQrBatchSummary();
            showQrBatchToast(`提取设备ID：${ids.length} 条（已复制）`, 'success');
        }
        function qrBatchBatchFormat() {
            const text = document.getElementById('qrBatchResult').value;
            if (!text.trim()) { showQrBatchToast('结果区为空，请先识别', 'error'); return; }
            const res = qrToBatchFormat(text);
            document.getElementById('qrBatchResult').value = res;
            qrBatchCopy(res);
            updateQrBatchSummary();
            showQrBatchToast('已转换为批量格式（逗号分隔，已复制）', 'success');
        }

        // ---- 复制 / 清空 ----
        function qrBatchCopy(text) {
            if (!text) return;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).catch(() => qrBatchFallbackCopy(text));
            } else {
                qrBatchFallbackCopy(text);
            }
        }
        function qrBatchFallbackCopy(text) {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
        }
        function qrBatchClear() {
            qrBatchState.running = false; qrBatchState.cancelled = false; qrBatchState.results = [];
            document.getElementById('qrBatchFiles').value = '';
            document.getElementById('qrBatchDropText').textContent = '📁 点击或拖拽图片文件 / 文件夹到这里';
            document.getElementById('qrBatchResult').value = '';
            document.getElementById('qrBatchStatus').style.display = 'none';
            document.getElementById('qrBatchFailed').style.display = 'none';
            document.getElementById('qrBatchProgress').value = 0;
            ['qrBatchExportMdBtn', 'qrBatchExportCsvBtn', 'qrBatchExtractLinksBtn',
             'qrBatchExtractImeiBtn', 'qrBatchBatchFmtBtn', 'qrBatchCopyBtn'].forEach(id =>
                document.getElementById(id).disabled = true);
            updateQrBatchSummary();
            showQrBatchToast('已清空', 'info');
        }

        
        // 解析IMEI和ICCID
        function parseImeiAndIccid() {
            const logInput = document.getElementById('logInput');
            const imeiIccidResult = document.getElementById('imeiIccidResult');
            const statusSection = document.getElementById('statusSection');
            
            const inputLines = logInput.value.trim().split('\n');
            const results = [];
            
            if (inputLines.length === 0) {
                showStatus('请输入日志数据', 'error');
                return;
            }
            
            // 逐行解析
            inputLines.forEach(line => {
                if (line.trim()) {
                    const parsed = extractImeiAndIccid(line.trim());
                    results.push(parsed);
                } else {
                    results.push(''); // 保留空行
                }
            });
            
            // 显示结果
            imeiIccidResult.value = results.join('\n');
            showStatus(`成功解析 ${inputLines.length} 条数据`, 'info');
        }
        
        // 从单行数据中提取IMEI和ICCID
        function extractImeiAndIccid(line) {
            try {
                // 清理数据，移除所有分隔符和空格
                const cleanLine = line.replace(/[\s-]/g, '');
                
                let imei = '';
                let iccid = '';
                
                // 首先尝试直接查找IMEI和ICCID的特征模式
                
                // 查找IMEI（通常是15位数字，前两位是86）
                const imeiMatch = cleanLine.match(/([8][6]\d{13})/);
                if (imeiMatch && imeiMatch[1]) {
                    imei = imeiMatch[1];
                } else {
                    // 尝试通过位置提取IMEI
                    const imeiPositionMatch = cleanLine.match(/0[03]86(\d{13})/);
                    if (imeiPositionMatch && imeiPositionMatch[1]) {
                        imei = '86' + imeiPositionMatch[1];
                    }
                }
                
                // 查找ICCID（通常是20位字符，前四位是8986）
                const iccidMatch = cleanLine.match(/(8986\w{16})/);
                if (iccidMatch && iccidMatch[1]) {
                    iccid = iccidMatch[1];
                }
                
                // 如果通过特征模式没有找到，尝试使用位置方法
                if (!imei || !iccid) {
                    if (cleanLine.length >= 58) {
                        // 58字节数据
                        if (!imei) {
                            // 尝试从第65-80位提取IMEI（15位）
                            const potentialImei = cleanLine.substring(64, 79);
                            if (/\d{15}/.test(potentialImei)) {
                                imei = potentialImei;
                            }
                        }
                        if (!iccid) {
                            // 尝试从第83-102位提取ICCID（20位）
                            iccid = cleanLine.substring(82, 102);
                        }
                    } else if (cleanLine.length >= 52) {
                        // 52字节数据
                        if (!imei) {
                            // 尝试从第53-67位提取IMEI（15位）
                            const potentialImei = cleanLine.substring(52, 67);
                            if (/\d{15}/.test(potentialImei)) {
                                imei = potentialImei;
                            }
                        }
                        if (!iccid) {
                            // 尝试从IMEI后面查找ICCID
                            const potentialIccidStart = cleanLine.indexOf('8986');
                            if (potentialIccidStart !== -1) {
                                iccid = cleanLine.substring(potentialIccidStart, potentialIccidStart + 20);
                            }
                        }
                    }
                }
                
                // 确保IMEI是15位数字
                if (imei) {
                    // 移除可能的非数字字符
                    imei = imei.replace(/[^\d]/g, '');
                    // 截取前15位
                    if (imei.length > 15) {
                        imei = imei.substring(0, 15);
                    }
                }
                
                // 确保ICCID是20位字符
                if (iccid) {
                    // 截取前20位
                    if (iccid.length > 20) {
                        iccid = iccid.substring(0, 20);
                    }
                }
                
                // 验证提取结果
            if (!imei && !iccid) {
                return '未能提取到IMEI和ICCID';
            } else if (!imei) {
                return `-${iccid}`;
            } else if (!iccid) {
                return `${imei}-`;
            }
            
            // 返回IMEI和ICCID，用连字符分隔
            return `${imei}-${iccid}`;
            } catch (error) {
                return `解析失败: ${error.message}`;
            }
        }
        
        // 绑定解析IMEI和ICCID按钮事件
        document.getElementById('parseImeiIccidBtn').addEventListener('click', parseImeiAndIccid);
        
        // ===== 工具集优化版本 =====
        (function() {
            // 全局状态管理
            const appState = {
                toolsExpanded: false,
                currentActiveTool: null,
                initialized: false
            };
            
            // 元素缓存
            const elements = {
                toggleTutorialBtn: null,
                toggleToolsBtn: null,
                topToolSwitchBtn: null,
                tutorialsContainer: null,
                toolSwitcher: null,
                toolModal: null
            };
            
            /**
             * DOM元素初始化函数
             * 负责获取并缓存页面中所有需要操作的DOM元素引用
             * 这些元素引用存储在全局elements对象中供其他函数使用
             */
            function initElements() {
                // 获取教程目录切换按钮
                elements.toggleTutorialBtn = document.getElementById('toggleTutorialBtn');
                // 获取工具导航栏切换按钮
                elements.toggleToolsBtn = document.getElementById('toggleToolsBtn');
                // 获取右上角工具列表按钮
                elements.topToolSwitchBtn = document.getElementById('topToolSwitchBtn');
                // 获取教程目录容器
                elements.tutorialsContainer = document.getElementById('tutorialsContainer');
                // 获取主工具切换器
                elements.toolSwitcher = document.getElementById('mainToolSwitcher');
                // 获取工具列表弹窗
                elements.toolModal = document.getElementById('toolModal');
            }
            
            /**
             * 教程目录收起/展开函数
             * 切换教程目录的显示状态，并更新切换按钮的文本
             */
            window.toggleTutorials = function() {
                try {
                    // 解构获取需要的元素引用
                    const { tutorialsContainer, toggleTutorialBtn } = elements;
                    
                    // 检查元素是否有效，无效则直接返回
                    if (!isValidElement(tutorialsContainer) || !isValidElement(toggleTutorialBtn)) return;
                    
                    // 判断当前目录是否隐藏
                    const isHidden = tutorialsContainer.style.display === 'none';
                    
                    // 切换目录显示状态：如果隐藏则显示(block)，否则隐藏(none)
                    tutorialsContainer.style.display = isHidden ? 'block' : 'none';
                    
                    // 更新按钮文本：显示向上箭头表示已展开，向下箭头表示已收起
                    toggleTutorialBtn.textContent = isHidden ? '▲' : '▼';
                } catch (err) {
                    // 统一错误处理
                    handleError('切换教程目录', err);
                }
            };
            
            /**
             * 辅助函数：检查DOM元素是否有效
             * @param {HTMLElement} element - 需要检查的DOM元素
             * @returns {boolean} - 如果元素存在且为DOM元素节点，则返回true，否则返回false
             */
            function isValidElement(element) {
                // 检查元素是否存在且节点类型为1(Element节点)
                return element && element.nodeType === 1;
            }
            
            /**
             * 辅助函数：统一错误处理
             * 提供标准化的错误记录机制，方便调试和错误追踪
             * @param {string} operation - 错误发生的操作描述
             * @param {Error} error - 捕获到的错误对象
             */
            function handleError(operation, error) {
                console.error(`${operation}出错:`, error.message);
            }
            
            /**
             * 更新工具按钮可见性的公共函数
             * 根据显示模式控制工具按钮的显示/隐藏状态
             * @param {NodeList|Array} buttons - 工具按钮集合
             * @param {boolean} shouldShowAll - 是否显示所有按钮，默认为false（仅显示常用工具）
             */
            function updateToolButtonsVisibility(buttons, shouldShowAll = false) {
                // 遍历所有按钮
                buttons.forEach(btn => {
                    // 检查按钮元素是否有效
                    if (isValidElement(btn)) {
                        // 如果设置为显示全部，则直接显示所有按钮
                        if (shouldShowAll) {
                            btn.style.display = 'inline-block';
                            return;
                        }
                        
                        // 获取按钮文本内容（防止文本为空的情况）
                        const btnText = btn.textContent || '';
                        // 判断按钮是否为当前激活状态
                        const isActive = btn.classList.contains('active');
                        // 定义常用工具类型判断
                        const isIcCardTool = btnText.includes('IC卡号处理');
                        const isPulseTool = btnText.includes('脉冲计算器');
                        // 同时检查大小写版本
                        const isIccidTool = btnText.includes('iccid详情') || btnText.includes('ICCID详情');
                        const isSerialTool = btnText.includes('生成流水号');
                        const isQRGeneratorTool = btnText.includes('二维码生成器') || btnText.includes('二维码生成');
                        const isStockParamTool = btnText.includes('入库参数生成');
                        const isImeiExtractionTool = btnText.includes('IMEI提取');
                        
                        // 设置按钮显示状态：如果是激活态或属于常用工具则显示（空字符串重置为默认显示），否则隐藏
                        btn.style.display = (isActive || isIcCardTool || isPulseTool || 
                                          isIccidTool || isSerialTool || isQRGeneratorTool || isStockParamTool || isImeiExtractionTool) ? '' : 'none';
                    }
                });
            }
            
            /**
             * 工具导航栏收起/展开函数
             * 切换工具导航栏的展开/收起状态，并相应地更新按钮显示和文本内容
             */
            window.toggleTools = function() {
                try {
                    // 解构获取需要的元素引用
                    const { toolSwitcher, toggleToolsBtn } = elements;
                    
                    // 使用统一的元素有效性检查
                    if (!isValidElement(toolSwitcher) || !isValidElement(toggleToolsBtn)) return;
                    
                    const allButtons = toolSwitcher.querySelectorAll('button');
                    // 先获取当前状态的反向（要切换到的目标状态）
                    const targetExpanded = !appState.toolsExpanded;
                    
                    if (!targetExpanded) { // 如果目标状态是收起
                        // 收起状态：只显示常用工具
                        updateToolButtonsVisibility(allButtons, false);
                        toggleToolsBtn.textContent = '查看更多▼▲';
                    } else { // 如果目标状态是展开
                        // 展开状态：显示所有工具
                        updateToolButtonsVisibility(allButtons, true);
                        toggleToolsBtn.textContent = '收起▲▼';
                    }
                    
                    // 先更新UI，再更新状态变量
                    appState.toolsExpanded = targetExpanded;
                } catch (err) {
                    // 使用统一的错误处理机制记录切换过程中发生的错误
                    handleError('切换工具栏', err);
                }
            };
            
            /**
             * 添加点击工具导航栏空白区域切换菜单展开/收起状态的功能
             * 为工具导航栏添加点击事件监听，当用户点击导航栏本身（而非其中的按钮元素）时切换展开/收起状态
             */
            function setupToolSwitcherClickHandler() {
                try {
                    // 获取工具导航栏元素引用
                    const { toolSwitcher } = elements;
                    
                    // 使用统一的元素有效性检查
                    if (!isValidElement(toolSwitcher)) return;
                    
                    // 为工具导航栏添加点击事件监听器
                    toolSwitcher.addEventListener('click', function(event) {
                        // 安全检查事件对象并判断点击目标是否是导航栏本身（即空白区域）
                        if (event && event.target === toolSwitcher) {
                            // 如果点击的是导航栏本身而非按钮，则调用toggleTools函数切换菜单展开/收起状态
                            window.toggleTools();
                        }
                    });
                } catch (err) {
                    // 使用统一的错误处理机制记录事件绑定过程中发生的错误
                    handleError('设置工具导航栏点击处理器', err);
                }
            }
            
            /**
             * 工具列表弹窗函数
             * 切换工具列表弹窗的显示/隐藏状态，并相应地控制页面滚动行为
             */
            window.toggleToolModal = function() {
                try {
                    // 获取工具弹窗元素引用
                    const modal = elements.toolModal;
                    
                    // 使用统一的元素有效性检查
                    if (!isValidElement(modal)) return;
                    
                    // 判断弹窗当前是否为打开状态（使用flex布局表示打开）
                    const isOpen = modal.style.display === 'flex';
                    
                    // 切换弹窗显示状态：如果已打开则隐藏(none)，否则显示(flex)
                    modal.style.display = isOpen ? 'none' : 'flex';
                    
                    // 控制页面滚动：弹窗打开时禁止页面滚动，关闭时恢复滚动
                    document.body.style.overflow = isOpen ? '' : 'hidden';
                    
                    // 添加或移除body的modal-open类名，用于样式控制
                    document.body.classList.toggle('modal-open', !isOpen);
                } catch (err) {
                    // 使用统一的错误处理机制记录弹窗切换过程中的错误
                    handleError('切换工具弹窗', err);
                }
            };
            
            /**
             * 扩展showTool函数，增加记录当前激活工具和更新按钮状态功能
             * 采用函数包装模式，保留原始功能的同时增加额外的工具状态管理能力
             */
            function enhanceShowTool() {
                try {
                    // 首先检查原始showTool函数是否存在
                    if (typeof window.showTool === 'function') {
                        // 保存原始showTool函数引用，以便后续调用
                        const originalShowTool = window.showTool;
                        
                        // 重写window.showTool函数
                        window.showTool = function(toolId) {
                            try {
                                // 记录当前激活的工具ID到应用状态
                                appState.currentActiveTool = toolId;
                                
                                // 调用原始函数，保留原有功能
                                originalShowTool.apply(this, arguments);
                                
                                // 更新所有工具按钮的active状态
                                const allButtons = document.querySelectorAll('.tool-switcher button');
                                // 安全检查按钮集合
                                if (allButtons && allButtons.length > 0) {
                                    // 遍历每个按钮
                                    allButtons.forEach(btn => {
                                        // 检查按钮元素是否有效
                                        if (isValidElement(btn)) {
                                            try {
                                                // 获取按钮文本内容
                                                const btnText = btn.textContent || '';
                                                let shouldActivate = false;
                                                
                                                // 工具名称到ID的映射表，用于根据按钮文本识别对应的工具ID
                                                const toolMapping = {
                                                    '脉冲计算器': 'pulseTool',
                                                    '进制转换器': 'conversionTool',
                                                    '入库参数解析': 'paramParser',
                                                    'ICCID详情': 'iccidTool',
                                                    'IC卡号处理': 'excelTemplateTool',
                                                    '生成流水号': 'serialNumberTool',
                                                    '水控计算': 'waterValueTool',
                                                    '修复iccid乱码': 'csv89860Tool',
                                                    '二维码生成器': 'qrGeneratorTool',
                                                    '日志分析器': 'logAnalysisTool',
                                                };
                                                
                                                // 遍历映射表，检查按钮文本是否包含对应工具名称，且ID匹配
                                                for (const [name, id] of Object.entries(toolMapping)) {
                                                    if (btnText.includes(name) && id === toolId) {
                                                        shouldActivate = true;
                                                        break;
                                                    }
                                                }
                                                
                                                // 使用toggle方法根据shouldActivate值添加或移除active类
                                                btn.classList.toggle('active', shouldActivate);
                                            } catch (btnErr) {
                                                // 静默处理单个按钮的错误，不影响其他按钮更新
                                                handleError('工具按钮状态更新', btnErr, true);
                                            }
                                        }
                                    });
                                }
                                
                                // 保持当前的展开/收起状态，无需额外操作
                            } catch (err) {
                                console.error('执行showTool出错:', err.message);
                                // 即使出错也尝试调用原始函数，确保基本功能正常
                                originalShowTool.apply(this, arguments);
                            }
                        };
                    }
                } catch (err) {
                    console.error('增强showTool函数出错:', err.message);
                }
            }
            
            /**
             * 绑定事件监听器
             * 为所有交互元素添加统一的事件监听处理，包括按钮点击、弹窗交互、键盘事件和错误处理等
             */
            function bindEvents() {
                try {
                    // 教程目录按钮绑定事件
                    if (elements.toggleTutorialBtn) {
                        // 移除内联onclick属性，改为使用标准的事件监听器
                        elements.toggleTutorialBtn.removeAttribute('onclick');
                        elements.toggleTutorialBtn.addEventListener('click', window.toggleTutorials);
                    }
                    
                    // 工具导航按钮绑定事件
                    if (elements.toggleToolsBtn) {
                        elements.toggleToolsBtn.removeAttribute('onclick');
                        elements.toggleToolsBtn.addEventListener('click', window.toggleTools);
                    }
                    
                    // 右上角工具列表按钮绑定事件
                    if (elements.topToolSwitchBtn) {
                        elements.topToolSwitchBtn.removeAttribute('onclick');
                        elements.topToolSwitchBtn.addEventListener('click', window.toggleToolModal);
                    }
                    
                    // 弹窗点击外部区域关闭功能
                    if (elements.toolModal) {
                        elements.toolModal.addEventListener('click', function(e) {
                            // 仅当点击目标是弹窗本身而非其子元素时才关闭弹窗
                            if (e && e.target === elements.toolModal) {
                                window.toggleToolModal();
                            }
                        });
                    }
                    
                    // 弹窗关闭按钮绑定事件
                    const closeModalBtn = document.getElementById('closeToolModalBtn');
                    if (closeModalBtn) {
                        closeModalBtn.addEventListener('click', window.toggleToolModal);
                    }
                    
                    // ESC键关闭弹窗功能 - 添加全局键盘事件监听器
                    document.addEventListener('keydown', function(e) {
                        // 检查事件对象是否有效，是否为Escape键，且弹窗是否处于打开状态
                        if (e && e.key === 'Escape' && elements.toolModal && elements.toolModal.style.display === 'flex') {
                            window.toggleToolModal();
                        }
                    });
                    
                    // 添加全局错误处理 - 捕获页面中的JavaScript错误
                    window.addEventListener('error', function(event) {
                        handleError(`全局错误: ${event.message} 位于: ${event.filename} 第 ${event.lineno} 行`, new Error(event.message));
                    });
                    
                    // 添加Promise错误处理 - 捕获未处理的Promise拒绝
                    window.addEventListener('unhandledrejection', function(event) {
                        handleError('未处理的Promise错误', new Error(String(event.reason)));
                    });
                    
                    // 为所有带data-tool-id属性的工具按钮添加统一的点击事件处理
                    const allToolButtons = document.querySelectorAll('button[data-tool-id]');
                    if (allToolButtons && allToolButtons.length > 0) {
                        // 遍历所有工具按钮
                        allToolButtons.forEach(btn => {
                            // 检查按钮元素是否有效
                            if (isValidElement(btn)) {
                                btn.addEventListener('click', function() {
                                    try {
                                        // 获取按钮对应的工具ID
                                        const toolId = this.getAttribute('data-tool-id');
                                        
                                        // 安全检查：工具ID存在且showTool函数可用
                                        if (toolId && typeof window.showTool === 'function') {
                                            // 调用showTool函数切换到指定工具
                                            window.showTool(toolId);
                                            
                                            // 强制关闭工具列表弹窗，确保用户体验一致性
                                            setTimeout(function() {
                                                try {
                                                    const toolModal = document.getElementById('toolModal');
                                                    if (toolModal && toolModal.style.display === 'flex') {
                                                        window.toggleToolModal();
                                                    }
                                                } catch (closeErr) {
                                                    handleError('关闭弹窗', closeErr);
                                                }
                                            }, 100); // 短暂延迟确保工具切换完成后再关闭弹窗
                                        }
                                    } catch (err) {
                                        handleError('工具按钮点击', err);
                                    }
                                });
                            }
                        });
                    }
                } catch (err) {
                    // 统一错误处理
                    handleError('绑定事件监听器', err);
                }
            }
            
            /**
             * 初始化应用程序
             * 负责设置应用程序的初始状态、绑定事件监听器和增强现有功能
             * 使用try-catch结构确保初始化过程中的错误能够被捕获和处理
             */
            function initApp() {
                try {
                    // 防止重复初始化检查
                    if (appState.initialized) return;
                    
                    // 初始化DOM元素引用，方便后续操作
                    initElements();
                    
                    // 初始化教程目录为收起状态
                    if (isValidElement(elements.tutorialsContainer)) {
                        elements.tutorialsContainer.style.display = 'none';
                    }
                    // 更新教程切换按钮文本为收起状态
                    if (isValidElement(elements.toggleTutorialBtn)) {
                        elements.toggleTutorialBtn.textContent = '▼';
                    }
                    
                    // 绑定所有交互元素的事件监听器
                    bindEvents();
                    
                    // 增强原生showTool函数，添加工具状态管理功能
                    enhanceShowTool();
                    
                    // 设置工具导航栏空白区域的点击事件处理器
                    setupToolSwitcherClickHandler();
                    
                    // 使用setTimeout延迟执行，确保DOM完全加载后再应用初始样式
                    setTimeout(() => {
                        try {
                            const { toolSwitcher, toggleToolsBtn } = elements;
                            // 检查必要元素是否存在
                            if (isValidElement(toolSwitcher) && isValidElement(toggleToolsBtn)) {
                                // 初始化时确保工具导航栏状态为收起
                                appState.toolsExpanded = false;
                            
                                // 获取所有工具按钮
                                const allButtons = toolSwitcher.querySelectorAll('button');
                                // 应用初始状态下的按钮可见性控制
                                updateToolButtonsVisibility(allButtons);
                                // 设置切换按钮的初始文本
                                toggleToolsBtn.textContent = '查看更多▼▲';
                            }
                        } catch (timeoutErr) {
                            // 捕获并处理初始化样式应用过程中的错误
                            handleError('工具导航栏初始化超时', timeoutErr);
                        }
                    }, 200);
                    
                    // 标记应用已完成初始化，防止重复执行
                    appState.initialized = true;
                } catch (err) {
                    // 统一错误处理，确保初始化过程中的异常不会影响整个应用
                    handleError('初始化应用', err);
                }
            }
            
            /**
             * 页面加载完成后自动初始化应用
             * 检查当前文档加载状态：
             * - 如果文档仍在加载中(loading状态)，则注册DOMContentLoaded事件监听器
             * - 如果文档已经加载完成，则使用setTimeout在下一个事件循环中初始化应用
             * 这种方式确保无论在脚本执行时文档处于何种状态，都能正确初始化应用
             */
            if (document.readyState === 'loading') {
                // 文档正在加载中，等待DOM完全解析和构建后再初始化
                document.addEventListener('DOMContentLoaded', initApp);
            } else {
                // 文档已经加载完成，使用setTimeout确保在当前执行栈清空后再初始化
                // 这是一种常见的异步初始化模式，可以避免阻塞UI渲染
                setTimeout(initApp, 0);
            }
        })();
        
        