/* 由 工具集.html 原样抽离，逻辑未作任何修改 —— 重构 v2 */

            // 全局变量
            let excelData = null;
            let parsedData = { waterCardNumbers: [], serialNumbers: [] };
            let uploadedFileName = '';
            let templateWorkbook = null;
            let loadedTemplates = new Map(); // 存储已加载的模板文件
            
            // IMEI提取工具相关变量
            let imeiData = [];
            let imeiFileName = '';
            
            // 远程模板配置（多重备用方案）
            const remoteTemplateConfig = {
                // 🔗 主方案使用GitHub Raw，更稳定可靠
                templateUrl: 'js/ic卡入库模板.xls',
                templateName: 'ic卡入库模板.xls',
                // 多个备用URL（按优先级排序）
                fallbackUrls: [
                    'https://DDzhp.github.io/ICkamuban/ic卡入库模板.xls',  // GitHub Pages
                    'https://raw.githubusercontent.com/DDzhp/ICkamuban/main/ic卡入库模板.xls',  // Gitee Pages
                    'https://cdn.jsdelivr.net/gh/DDzhp/ICkamuban/ic卡入库模板.xls',  // jsDelivr CDN
                    'https://your-username.coding.net/p/your-project/d/your-repo/git/raw/master/ic卡入库模板.xls'  // Coding.net
                ]
            };
            
            // 从远程URL加载模板文件（支持多重备用）
            async function loadRemoteTemplate() {
                const statusDiv = document.getElementById('templateStatus');
                const { templateUrl, templateName, fallbackUrls } = remoteTemplateConfig;
                
                statusDiv.innerHTML = '🔄 正在从远程服务器加载模板...';
                
                // 所有要尝试的URL列表
                const urlsToTry = [templateUrl, ...fallbackUrls];
                let lastError = null;
                
                for (let i = 0; i < urlsToTry.length; i++) {
                    const currentUrl = urlsToTry[i];
                    if (!currentUrl || currentUrl.includes('your-username')) {
                        continue; // 跳过未配置的URL
                    }
                    
                    try {
                        statusDiv.innerHTML = `🔄 正在尝试第${i + 1}个服务器: ${getServerName(currentUrl)}...`;
                        
                        const response = await fetch(currentUrl, {
                            method: 'GET',
                            mode: 'cors',
                            cache: 'default'
                        });
                        
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}`);
                        }
                        
                        // 获取文件数据
                        const arrayBuffer = await response.arrayBuffer();
                        const data = new Uint8Array(arrayBuffer);
                        
                        // 使用XLSX读取模板
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        // 验证工作簿
                        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                            throw new Error('模板文件格式无效');
                        }
                        
                        // 存储模板工作簿和来源信息
                        loadedTemplates.set(templateName, {
                            workbook: workbook,
                            fileName: templateName,
                            fileData: data,
                            source: `${getServerName(currentUrl)} - ${currentUrl}`,
                            loadedAt: new Date().toISOString()
                        });
                        
                        statusDiv.innerHTML = `✅ 远程模板加载成功: ${templateName}<br>` +
                            `📊 包含 ${workbook.SheetNames.length} 个工作表<br>` +
                            `🌐 来源: ${getServerName(currentUrl)} (第${i + 1}个服务器)<br>` +
                            `🔗 当前URL: <code style="font-size:11px;color:#666;">${currentUrl}</code>`;
                        
                        console.log('远程模板加载成功:', {
                            name: templateName,
                            sheets: workbook.SheetNames,
                            size: `${(data.length / 1024).toFixed(2)}KB`,
                            source: currentUrl
                        });
                        
                        // 启用处理按钮
                        updateProcessButton();
                        
                        return; // 成功后退出
                        
                    } catch (error) {
                        lastError = error;
                        console.warn(`第${i + 1}个服务器失败:`, currentUrl, error.message);
                        
                        if (i < urlsToTry.length - 1) {
                            statusDiv.innerHTML = `⚠️ ${getServerName(currentUrl)}失败，正在尝试下一个服务器...`;
                            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
                        }
                    }
                }
                
                // 所有URL都失败
                console.error('所有远程模板加载失败:', lastError);
                statusDiv.innerHTML = `❌ 所有远程模板都加载失败<br>` +
                    `📝 请检查以下事项：<br>` +
                    `• 确保模板文件已正确上传<br>` +
                    `• 检查URL配置是否正确<br>` +
                    `• 确保网络连接正常<br>` +
                    `• 尝试使用下面的替代方案<br>` +
                    `🔗 尝试的URL列表: <details><summary>点击查看</summary><pre style="font-size:10px;">${urlsToTry.filter(url => url && !url.includes('your-username')).join('\n')}</pre></details>`;
                
                // 禁用处理按钮
                updateProcessButton();
            }
            
            // 获取服务器名称
            function getServerName(url) {
                if (url.includes('github.io')) return 'GitHub Pages';
                if (url.includes('gitee.io')) return 'Gitee Pages';
                if (url.includes('coding.net')) return 'Coding.net';
                if (url.includes('jsdelivr.net')) return 'jsDelivr CDN';
                if (url.includes('githubusercontent.com')) return 'GitHub Raw';
                return '未知服务器';
            }
            
            // 工具切换函数
            function showTool(toolId) {
                document.querySelectorAll('.calculator').forEach(tool => {
                    tool.style.display = 'none';
                });
                
                document.getElementById(toolId).style.display = 'block';
                
                document.querySelectorAll('.tool-switcher button').forEach(btn => {
                    btn.classList.remove('active');
                });
                // 找到对应的按钮并添加active类
                const activeButton = document.querySelector(`.tool-switcher button[onclick="showTool('${toolId}')"]`);
                if (activeButton) {
                    activeButton.classList.add('active');
                }
            }

            // ===== Excel模板处理相关函数 =====
            
            // 加载模板文件列表
            const templatePath = 'ic卡入库模板.xls';
            // 加载指定路径的模板
            async function loadSpecificTemplate() {
                const templateName = 'ic卡入库模板.xls';
                const statusDiv = document.getElementById('templateStatus');
                
                try {
                    // 首先尝试从指定绝对路径加载模板文件
                    let response;
                    let usedPath;
                    
                    try {
                        response = await fetch(templatePath);
                        usedPath = templatePath;
                    } catch (error) {
                        // 绝对路径失败，尝试相对路径
                        response = await fetch(templateName);
                        usedPath = templateName;
                    }
                    
                    if (!response.ok) {
                        throw new Error(`无法加载模板文件: ${response.status}`);
                    }
                    
                    const arrayBuffer = await response.arrayBuffer();
                    const data = new Uint8Array(arrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // 存储模板工作簿
                    loadedTemplates.set(templateName, {
                        workbook: workbook,
                        fileName: templateName,
                        fileData: data
                    });
                    
                    statusDiv.innerHTML = `✅ 已成功加载模板: ${usedPath}`;
                    
                } catch (error) {
                    console.error('加载模板失败:', error);
                    statusDiv.innerHTML = `⚠️ 加载模板失败: ${error.message}<br>请确保本地服务器运行且模板文件可访问: ${templatePath}`;
                }
            }
            async function loadTemplateList() {
                // 如果已经有加载的模板，显示它们
                if (loadedTemplates.size > 0) {
                    renderTemplateOptions();
                } else {
                    // 提示用户加载模板
                    const statusDiv = document.getElementById('excelProcessStatus');
                    statusDiv.innerHTML = '请点击“加载模板文件夹”按钮来选择模板文件';
                }
            }
            
            // 处理模板文件上传
            function handleTemplateUpload(event) {
                const file = event.target.files[0];
                if (!file) return;
                
                const statusDiv = document.getElementById('excelProcessStatus');
                statusDiv.innerHTML = '正在加载模板文件...';
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        templateWorkbook = XLSX.read(data, { type: 'array' });
                        
                        // 更新选择框显示已上传的模板
                        const select = document.getElementById('templateSelect');
                        const uploadedOption = document.createElement('option');
                        uploadedOption.value = 'uploaded';
                        uploadedOption.textContent = `📄 ${file.name} (已上传)`;
                        uploadedOption.selected = true;
                        
                        // 移除之前的上传选项
                        const existingUploaded = select.querySelector('option[value="uploaded"]');
                        if (existingUploaded) {
                            existingUploaded.remove();
                        }
                        
                        select.appendChild(uploadedOption);
                        
                        statusDiv.innerHTML = `模板文件 "${file.name}" 加载成功`;
                        updateProcessButton();
                        
                    } catch (error) {
                        statusDiv.innerHTML = `模板文件加载失败: ${error.message}`;
                        templateWorkbook = null;
                    }
                };
                
                reader.readAsArrayBuffer(file);
            }
            
            // 读取Excel文件
            function readExcelFile(file) {
                const statusDiv = document.getElementById('excelProcessStatus');
                const previewDiv = document.getElementById('excelDataPreview');
                
                // 保存上传文件名
                uploadedFileName = file.name;
                
                statusDiv.innerHTML = '正在读取Excel文件...';
                previewDiv.innerHTML = '正在解析文件内容...';
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        // 获取第一个工作表
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        
                        // 转换为JSON
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                        
                        excelData = jsonData;
                        analyzeExcelData(jsonData);
                        
                    } catch (error) {
                        statusDiv.innerHTML = `读取文件失败: ${error.message}`;
                        previewDiv.innerHTML = '文件解析失败';
                    }
                };
                
                reader.readAsArrayBuffer(file);
            }
            
            // 清洗流水号：移除NO.前缀 + 删除所有英文和特殊字符，只保留纯数字
            // 例如：QAD-1100082640 -> 1100082640，NO.20250101001 -> 20250101001
            function cleanSerialNumber(serial) {
                let cleaned = String(serial).replace(/^NO\./i, '').trim();
                cleaned = cleaned.replace(/[^0-9]/g, '');
                return cleaned;
            }

            // 分析Excel数据
            function analyzeExcelData(data) {
                const statusDiv = document.getElementById('excelProcessStatus');
                const previewDiv = document.getElementById('excelDataPreview');
                
                try {
                    if (!data || data.length === 0) {
                        statusDiv.innerHTML = '文件为空或无有效数据';
                        return;
                    }
                    
                    let startRow = 0;
                    let waterCardCol = -1;
                    let serialCol = -1;
                    
                    // 检查首行是否包含中文字符
                    const firstRow = data[0] || [];
                    const hasChineseInFirstRow = firstRow.some(cell => 
                        cell && /[\u4e00-\u9fa5]/.test(cell.toString())
                    );
                    
                    if (hasChineseInFirstRow) {
                        startRow = 1;
                        statusDiv.innerHTML = '检测到首行包含中文，将从第二行开始处理';
                    } else {
                        startRow = 0;
                        statusDiv.innerHTML = '首行不包含中文，从第一行开始处理';
                    }
                    
                    // 分析A、B列数据类型
                    const sampleSize = Math.min(10, data.length - startRow);
                    let colAHasLetters = false;
                    let colBHasLetters = false;
                    
                    for (let i = startRow; i < startRow + sampleSize && i < data.length; i++) {
                        const row = data[i];
                        if (row && row.length >= 2) {
                            const cellA = row[0] ? row[0].toString() : '';
                            const cellB = row[1] ? row[1].toString() : '';
                            
                            if (/[a-zA-Z]/.test(cellA)) colAHasLetters = true;
                            if (/[a-zA-Z]/.test(cellB)) colBHasLetters = true;
                        }
                    }
                    
                    // 根据规则确定列类型
                    if (colAHasLetters && !colBHasLetters) {
                        waterCardCol = 0;
                        serialCol = 1;
                    } else if (colBHasLetters && !colAHasLetters) {
                        waterCardCol = 1;
                        serialCol = 0;
                    } else if (colAHasLetters && colBHasLetters) {
                        // 两列都有字母，默认A列为水卡号
                        waterCardCol = 0;
                        serialCol = 1;
                    } else {
                        // 都是纯数字，默认A列为流水号，B列为水卡号
                        serialCol = 0;
                        waterCardCol = 1;
                    }
                    
                    // 提取数据
                    const waterCards = [];
                    const serials = [];
                    const rawSerials = [];
                    let hasCleanedSerials = false;
                    
                    for (let i = startRow; i < data.length; i++) {
                        const row = data[i];
                        if (row && row.length >= 2) {
                            if (waterCardCol >= 0 && row[waterCardCol]) {
                                waterCards.push(row[waterCardCol].toString());
                            }
                            if (serialCol >= 0 && row[serialCol]) {
                                const rawSerial = row[serialCol].toString();
                                rawSerials.push(rawSerial);
                                // 清洗流水号：移除NO.前缀 + 删除英文和特殊字符，只保留纯数字
                                const cleanedSerial = cleanSerialNumber(rawSerial);
                                if (cleanedSerial !== rawSerial.replace(/^NO\./i, '').trim()) {
                                    hasCleanedSerials = true;
                                }
                                serials.push(cleanedSerial);
                            }
                        }
                    }
                    
                    parsedData = {
                        waterCardNumbers: waterCards,
                        serialNumbers: serials,
                        rawSerialNumbers: rawSerials,
                        hasCleanedSerials: hasCleanedSerials,
                        startRow: startRow,
                        waterCardCol: waterCardCol,
                        serialCol: serialCol
                    };
                    
                    // 显示预览
                    let preview = `<p>数据解析结果：</p>`;
                    preview += `<p><text>开始行：第${startRow + 1}行</text>`;
                    preview += `<text>;水卡号列：${String.fromCharCode(65 + waterCardCol)}列 (${waterCards.length}条)</text>`;
                    preview += `<text>;流水号列：${String.fromCharCode(65 + serialCol)}列 (${serials.length}条)</text></p>`;
                    
                    preview += `<table class="data-table">`;
                    preview += `<tr><th>序号</th><th>水卡号</th><th>流水号</th></tr>`;
                    
                    const maxRows = Math.min(10, Math.max(waterCards.length, serials.length));
                    for (let i = 0; i < maxRows; i++) {
                        preview += `<tr>`;
                        preview += `<td>${i + 1}</td>`;
                        preview += `<td>${waterCards[i] || ''}</td>`;
                        preview += `<td>${serials[i] || ''}</td>`;
                        preview += `</tr>`;
                    }
                    
                    if (Math.max(waterCards.length, serials.length) > 10) {
                        preview += `<tr><td colspan="3">... 还有 ${Math.max(waterCards.length, serials.length) - 10} 行数据</td></tr>`;
                    }
                    
                    preview += `</table>`;
                    
                    previewDiv.innerHTML = preview;
                    let statusMsg = `数据解析完成！共识别到 ${waterCards.length} 个水卡号和 ${serials.length} 个流水号`;
                    if (hasCleanedSerials) {
                        statusMsg += `<br>⚠ 检测到流水号包含英文/特殊字符，已自动清洗为纯数字`;
                    }
                    statusDiv.innerHTML = statusMsg;
                    
                    // 更新按钮状态
                    updateProcessButton();
                    
                } catch (error) {
                    statusDiv.innerHTML = `数据分析失败: ${error.message}`;
                    previewDiv.innerHTML = '数据分析失败';
                }
            }
            
            // 显示数据对比预览（源文件 vs 转换后）
            function showComparisonPreview() {
                const sourceDiv = document.getElementById('sourcePreview');
                const convertedDiv = document.getElementById('convertedPreview');
                const previewGroup = document.getElementById('comparisonPreviewGroup');
                
                if (!parsedData || !parsedData.waterCardNumbers) {
                    return;
                }
                
                const waterCards = parsedData.waterCardNumbers || [];
                const serials = parsedData.serialNumbers || [];
                const rawSerials = parsedData.rawSerialNumbers || serials;
                const maxRows = Math.max(waterCards.length, serials.length, rawSerials.length);
                const displayRows = Math.min(50, maxRows);
                
                const startRow = parsedData.startRow != null ? parsedData.startRow + 1 : 1;
                const waterCardCol = parsedData.waterCardCol != null ? parsedData.waterCardCol : 0;
                const serialCol = parsedData.serialCol != null ? parsedData.serialCol : 1;
                
                // 构建源文件预览HTML
                let sourceHtml = `<p style="color: #1565c0; font-weight: 600; margin-bottom: 5px;">数据解析结果：开始行：第${startRow}行; 水卡号列：${String.fromCharCode(65 + waterCardCol)}列 (${waterCards.length}条); 流水号列：${String.fromCharCode(65 + serialCol)}列 (${rawSerials.length}条)</p>`;
                sourceHtml += `<table class="data-table" style="width: 100%;"><tr><th>序号</th><th>水卡号</th><th>流水号(原始)</th></tr>`;
                for (let i = 0; i < displayRows; i++) {
                    sourceHtml += `<tr><td>${i + 1}</td><td>${waterCards[i] || ''}</td><td style="color: #e67e22;">${rawSerials[i] || ''}</td></tr>`;
                }
                if (maxRows > displayRows) {
                    sourceHtml += `<tr><td colspan="3" style="text-align:center;color:#999;">... 还有 ${maxRows - displayRows} 行数据</td></tr>`;
                }
                sourceHtml += `</table>`;
                
                // 构建转换后预览HTML
                let convertedHtml = `<p style="color: #1565c0; font-weight: 600; margin-bottom: 5px;">数据解析结果：开始行：第${startRow}行; 水卡号列：${String.fromCharCode(65 + waterCardCol)}列 (${waterCards.length}条); 流水号列：${String.fromCharCode(65 + serialCol)}列 (${serials.length}条)</p>`;
                if (parsedData.hasCleanedSerials) {
                    convertedHtml += `<p style="color: #e74c3c; font-weight: 600; margin-bottom: 5px;">⚠ 已自动清洗英文/特殊字符，只保留纯数字</p>`;
                }
                convertedHtml += `<table class="data-table" style="width: 100%;"><tr><th>序号</th><th>水卡号</th><th>流水号(清洗后)</th></tr>`;
                for (let i = 0; i < displayRows; i++) {
                    convertedHtml += `<tr><td>${i + 1}</td><td>${waterCards[i] || ''}</td><td style="color: #27ae60; font-weight: 600;">${serials[i] || ''}</td></tr>`;
                }
                if (maxRows > displayRows) {
                    convertedHtml += `<tr><td colspan="3" style="text-align:center;color:#999;">... 还有 ${maxRows - displayRows} 行数据</td></tr>`;
                }
                convertedHtml += `</table>`;
                
                sourceDiv.innerHTML = sourceHtml;
                convertedDiv.innerHTML = convertedHtml;
                previewGroup.style.display = 'block';
            }

            // 处理Excel文件
            async function processExcelFile() {
                const statusDiv = document.getElementById('excelProcessStatus');
                const templateName = document.getElementById('templateSelect').value;
                
                if (!excelData || !templateName) {
                    statusDiv.innerHTML = '请确保已上传文件并选择模板';
                    return;
                }
                
                if (!loadedTemplates.has(templateName)) {
                    statusDiv.innerHTML = '选中的模板文件不存在，请重新加载模板';
                    return;
                }
                
                try {
                    const totalRows = Math.max(parsedData.waterCardNumbers.length, parsedData.serialNumbers.length);
                    const maxRowsPerFile = 20000;
                    const totalFiles = Math.ceil(totalRows / maxRowsPerFile);
                    
                    if (totalFiles > 1) {
                        statusDiv.innerHTML = `🔄 正在处理数据，数据量较大(${totalRows}条)，将分割为${totalFiles}个文件...`;
                    } else {
                        statusDiv.innerHTML = '🔄 正在使用模板处理数据...';
                    }
                    
                    // 获取模板工作簿和来源信息
                    const templateInfo = loadedTemplates.get(templateName);
                    const templateWorkbook = templateInfo.workbook;
                    const templateSource = templateInfo.source || '本地缓存';
                    
                    // 使用模板处理数据
                    const result = await processWithTemplate(templateWorkbook, templateName, templateSource);
                    
                    if (result.success) {
                        let statusText = `✅ 文件处理完成！<br>` +
                            `• 使用模板：${templateName}<br>` +
                            `• 模板来源：${templateSource}<br>` +
                            `• 水卡号：${parsedData.waterCardNumbers.length}条，流水号：${parsedData.serialNumbers.length}条<br>`;
                        
                        if (parsedData.hasCleanedSerials) {
                            statusText += `• ⚠ 流水号已自动清洗英文/特殊字符，只保留纯数字<br>`;
                        }
                        
                        if (totalFiles > 1) {
                            statusText += `• 文件已分割为 ${totalFiles} 个文件（每文件最多${maxRowsPerFile}条）<br>`;
                        }
                        
                        statusText += `• 已下载文件：${result.filename}`;
                        statusDiv.innerHTML = statusText;
                        
                        // 显示数据对比预览
                        showComparisonPreview();
                    } else {
                        statusDiv.innerHTML = `❌ 处理失败：${result.error}`;
                    }
                    
                } catch (error) {
                    statusDiv.innerHTML = `❌ 处理失败: ${error.message}`;
                    console.error('处理Excel文件失败:', error);
                }
            }
            
            // 使用模板处理数据
            async function processWithTemplate(templateWorkbook, templateName, templateSource) {
                try {
                    const maxRowsPerFile = 20000;
                    const totalRows = Math.max(parsedData.waterCardNumbers.length, parsedData.serialNumbers.length);
                    const totalFiles = Math.ceil(totalRows / maxRowsPerFile);
                    
                    const originalName = uploadedFileName;
                    const baseName = originalName.lastIndexOf('.') >= 0 ? originalName.slice(0, originalName.lastIndexOf('.')) : originalName;
                    const timestamp = new Date().getTime();
                    
                    const generatedFiles = [];
                    
                    for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
                        const startIndex = fileIndex * maxRowsPerFile;
                        const endIndex = Math.min(startIndex + maxRowsPerFile, totalRows);
                        const currentBatchSize = endIndex - startIndex;
                        
                        const newWorkbook = XLSX.utils.book_new();
                        
                        templateWorkbook.SheetNames.forEach(sheetName => {
                            const originalSheet = templateWorkbook.Sheets[sheetName];
                            const sheetData = XLSX.utils.sheet_to_json(originalSheet, { header: 1, defval: '' });
                            
                            const batchMaxRows = currentBatchSize;
                            
                            while (sheetData.length < batchMaxRows + 1) {
                                sheetData.push([]);
                            }
                            
                            for (let i = 0; i < batchMaxRows; i++) {
                                const dataIndex = startIndex + i;
                                const rowIndex = i + 1;
                                
                                if (!sheetData[rowIndex]) {
                                    sheetData[rowIndex] = [];
                                }
                                
                                if (parsedData.waterCardNumbers[dataIndex]) {
                                    const pureWaterCardNumber = String(parsedData.waterCardNumbers[dataIndex]).trim();
                                    if(pureWaterCardNumber.length != 8 ){
                                        alert(`第${dataIndex+1}行水卡(IC卡)号长度必须为8个字符，请检查！`);return;
                                    }else{
                                        sheetData[rowIndex][0] = '\'' + pureWaterCardNumber;
                                    }
                                }
                                
                                if (parsedData.serialNumbers[dataIndex]) {
                                    const rawSerial = String(parsedData.serialNumbers[dataIndex]).trim();
                                    const cleanedSerial = cleanSerialNumber(rawSerial);
                                    if(cleanedSerial.length < 1 || cleanedSerial.length > 12){
                                        alert(`第${dataIndex+1}行流水号长度必须在1-12个字符之间，请检查！`);return;
                                    }else{
                                        sheetData[rowIndex][1] = '\'' + cleanedSerial;
                                    }
                                }
                            }
                            
                            const newSheet = XLSX.utils.aoa_to_sheet(sheetData);
                            
                            for (let i = 1; i <= batchMaxRows; i++) {
                                const cellAddressA = XLSX.utils.encode_cell({r: i, c: 0});
                                if (newSheet[cellAddressA]) {
                                    newSheet[cellAddressA].t = 's';
                                }
                                const cellAddressB = XLSX.utils.encode_cell({r: i, c: 1});
                                if (newSheet[cellAddressB]) {
                                    newSheet[cellAddressB].t = 's';
                                }
                            }
                            
                            const b2CellAddress = XLSX.utils.encode_cell({r: 1, c: 1});
                            if (newSheet[b2CellAddress]) {
                                newSheet[b2CellAddress].t = 's';
                            }
                            
                            XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
                        });
                        
                        const fileNumber = totalFiles > 1 ? `_${fileIndex + 1}_${totalFiles}` : '';
                        
                        try {
                            const csvFilename = `${baseName}_已处理${fileNumber}_${currentBatchSize}条_${timestamp}.csv`;
                            
                            let csvContent = 'IC卡号,流水号\n';
                            for (let i = startIndex; i < endIndex; i++) {
                                const icCardNumber = parsedData.waterCardNumbers[i] || '';
                                const serialNumber = parsedData.serialNumbers[i] || '';
                                csvContent += `"${icCardNumber}","${serialNumber}"\n`;
                            }
                            
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            const url = URL.createObjectURL(blob);
                            link.setAttribute('href', url);
                            link.setAttribute('download', csvFilename);
                            link.style.visibility = 'hidden';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            generatedFiles.push(csvFilename);
                            
                            const xlsxFilename = `${baseName}_已处理${fileNumber}_${currentBatchSize}条_${timestamp}.xlsx`;
                            const writeOptions = {
                                bookType: 'xlsx',
                                type: 'file',
                                cellDates: false,
                                cellStyles: false,
                                compression: true
                            };
                            
                            XLSX.writeFile(newWorkbook, xlsxFilename, writeOptions);
                            
                            generatedFiles.push(xlsxFilename);
                        } catch (error) {
                            const xlsxFilename = `${baseName}_已处理${fileNumber}_${currentBatchSize}条_${timestamp}.xlsx`;
                            const writeOptions = {
                                bookType: 'xlsx',
                                type: 'file',
                                cellDates: false,
                                cellStyles: false,
                                compression: true
                            };
                            
                            XLSX.writeFile(newWorkbook, xlsxFilename, writeOptions);
                            generatedFiles.push(xlsxFilename);
                        }
                    }
                    
                    return {
                        success: true,
                        filename: generatedFiles.join(', '),
                        templateSource: templateSource
                    };
                    
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            }
            
            // 使用默认模板处理
            function processWithDefaultTemplate() {
                const statusDiv = document.getElementById('excelProcessStatus');
                
                try {
                    // 创建新的工作簿
                    const newWorkbook = XLSX.utils.book_new();
                    
                    // 创建工作表数据
                    const wsData = [];
                    
                    // 添加标题行
                    wsData.push(['水卡号', '流水号']);
                    
                    // 添加数据行
                    const maxRows = Math.max(parsedData.waterCardNumbers.length, parsedData.serialNumbers.length);
                    for (let i = 0; i < maxRows; i++) {
                        // 清洗流水号，只保留纯数字
                        const rawSerial = parsedData.serialNumbers[i] || '';
                        const cleanedSerial = cleanSerialNumber(rawSerial);
                        wsData.push([
                            parsedData.waterCardNumbers[i] || '',
                            cleanedSerial
                        ]);
                    }
                    
                    // 创建工作表
                    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
                    
                    // 添加工作表到工作簿
                    XLSX.utils.book_append_sheet(newWorkbook, worksheet, 'Sheet1');
                    
                    // 生成文件并下载
                    const originalName = uploadedFileName;
                    const extension = originalName.lastIndexOf('.') >= 0 ? originalName.slice(originalName.lastIndexOf('.')) : '.xlsx';
                    const baseName = originalName.lastIndexOf('.') >= 0 ? originalName.slice(0, originalName.lastIndexOf('.')) : originalName;
                    
                    // 添加时间戳到文件名，避免缓存问题
                    const timestamp = new Date().getTime();
                    const filename = `${baseName}已处理_${timestamp}${extension}`;
                    
                    // 使用更严格的选项生成文件，确保数据以纯文本形式存储
                    const writeOptions = {
                        bookType: extension === '.xlsx' ? 'xlsx' : 'xls',
                        type: 'file',
                        cellDates: false,
                        cellStyles: false,
                        compression: true
                    };
                    
                    XLSX.writeFile(newWorkbook, filename, writeOptions);
                    
                    statusDiv.innerHTML = `文件处理完成！<br>` +
                        `• 使用默认模板<br>` +
                        `• 已下载文件：${filename}<br>` +
                        `• 水卡号：${parsedData.waterCardNumbers.length}条，流水号：${parsedData.serialNumbers.length}条`;
                    
                } catch (error) {
                    statusDiv.innerHTML = `默认模板处理失败: ${error.message}`;
                }
            }
            
            // 清空数据
            function clearExcelData() {
                excelData = null;
                parsedData = { waterCardNumbers: [], serialNumbers: [] };
                uploadedFileName = '';
                templateWorkbook = null;
                document.getElementById('excelFileInput').value = '';
                document.getElementById('templateSelect').value = '';
                document.getElementById('templateFileInput').value = '';
                
                // 移除上传的模板选项
                const select = document.getElementById('templateSelect');
                const uploadedOption = select.querySelector('option[value="uploaded"]');
                if (uploadedOption) {
                    uploadedOption.remove();
                }
                
                document.getElementById('excelProcessStatus').innerHTML = '请上传Excel文件并选择模板';
                document.getElementById('excelDataPreview').innerHTML = '等待文件上传...';
                document.getElementById('sourcePreview').innerHTML = '';
                document.getElementById('convertedPreview').innerHTML = '';
                document.getElementById('comparisonPreviewGroup').style.display = 'none';
                updateProcessButton();
            }
            
            // 更新处理按钮状态
            function updateProcessButton() {
                const hasFile = excelData !== null;
                const hasTemplate = document.getElementById('templateSelect').value !== '' && loadedTemplates.has('ic卡入库模板.xls');
                const processButton = document.querySelector('#excelTemplateTool .btn-primary');
                processButton.disabled = !(hasFile && hasTemplate);
                
                // 更新按钮文本显示当前状态
                if (processButton.disabled) {
                    if (!hasFile) {
                        processButton.textContent = '📊 请先上传Excel文件';
                    } else if (!hasTemplate) {
                        processButton.textContent = '📊 正在加载模板...';
                    }
                } else {
                    processButton.textContent = '📊 处理Excel文件';
                }
            }

            // 十进制转十六进制函数（支持多行）
            function convertDecToHex() {
                var lines = (document.getElementById('decimalInput').value || '').split('\n');
                var results = [];
                for (var i = 0; i < lines.length; i++) {
                    var v = lines[i].trim();
                    if (!v) { results.push(''); continue; }
                    if (/^\d+$/.test(v)) {
                        results.push(parseInt(v, 10).toString(16).toUpperCase());
                    } else {
                        results.push('[无效: ' + v + ']');
                    }
                }
                document.getElementById('hexInput').value = results.join('\n');
            }

            // 十六进制转十进制函数（支持多行）
            function convertHexToDec() {
                var lines = (document.getElementById('hexInput').value || '').split('\n');
                var results = [];
                for (var i = 0; i < lines.length; i++) {
                    var v = lines[i].trim();
                    if (!v) { results.push(''); continue; }
                    if (/^[0-9A-Fa-f]+$/.test(v)) {
                        results.push(String(parseInt(v, 16)));
                    } else {
                        results.push('[无效: ' + v + ']');
                    }
                }
                document.getElementById('decimalInput').value = results.join('\n');
            }

            // 脉冲计算主函数
            function calculateActualPulses() {
                const systemPulses = parseFloat(document.getElementById('systemPulses').value);
                const systemWater = parseFloat(document.getElementById('systemWater').value);
                const actualWater = parseFloat(document.getElementById('actualWater').value);
                
                if (isNaN(systemPulses) || isNaN(systemWater) || isNaN(actualWater)) {
                    document.getElementById('actualPulses').value = '';
                    showMessage('请输入有效的数字', 'error');
                    return;
                }
                
                if (systemPulses > 0 && systemWater > 0 && actualWater > 0) {
                    const actualPulses = (systemPulses * systemWater) / actualWater;
                    document.getElementById('actualPulses').value = actualPulses.toFixed(2);
                    showMessage('脉冲计算成功', 'success');
                } else {
                    document.getElementById('actualPulses').value = '';
                    if (systemPulses <= 0 || isNaN(systemPulses)) {
                        showMessage('请输入大于0的系统脉冲数', 'error');
                    } else if (systemWater <= 0 || isNaN(systemWater)) {
                        showMessage('请输入大于0的系统水量', 'error');
                    } else if (actualWater <= 0 || isNaN(actualWater)) {
                        showMessage('请输入大于0的实际水量', 'error');
                    }
                }
            }


            // [已删除: 入库参数解析工具]

            // ICCID解析函数
            function parseIccids() {
                const inputText = document.getElementById('iccidInput').value;
                const resultArray = [];
                
                if (!inputText.trim()) {
                    showIccidToast('请输入ICCID数据', 'error');
                    return;
                }
                
                // 处理范围格式：ICCID到ICCID(数量张)
                const rangePattern = /(\d+[A-Za-z0-9]*)到(\d+[A-Za-z0-9]*)(?:\s*[\(（](\d+)张[\)）])?/g;
                let match;
                
                // 处理范围格式
                while ((match = rangePattern.exec(inputText)) !== null) {
                    const startIccid = match[1];
                    const endIccid = match[2];
                    const count = match[3] ? parseInt(match[3]) : null;
                    
                    // 提取数字部分
                    const numericStart = extractNumericSuffix(startIccid);
                    const numericEnd = extractNumericSuffix(endIccid);
                    
                    if (numericStart && numericEnd) {
                        const prefix = startIccid.substring(0, startIccid.length - numericStart.length);
                        const startNum = parseInt(numericStart);
                        const endNum = parseInt(numericEnd);
                        
                        // 验证范围是否与指定数量匹配
                        const actualCount = endNum - startNum + 1;
                        if (count !== null && actualCount !== count) {
                            console.warn(`警告：指定数量 ${count} 与实际范围 ${actualCount} 不匹配`);
                        }
                        
                        // 生成范围内的所有ICCID
                        for (let i = startNum; i <= endNum; i++) {
                            const paddedNum = i.toString().padStart(numericStart.length, '0');
                            resultArray.push(prefix + paddedNum);
                        }
                    } else {
                        console.error('无法提取数字部分:', startIccid, endIccid);
                    }
                }
                
                // 同时处理单行ICCID格式（无论是否已处理范围格式）
                // 分割输入文本，处理每一行
                const lines = inputText.split(/[\n\r]+/);
                
                lines.forEach(line => {
                    // 跳过包含"到"的行，因为这些行已经在范围处理中处理过了
                    if (line.includes('到')) {
                        return;
                    }
                    
                    // 首先尝试匹配 'ICCID（数量张）' 或 'ICCID(数量张)' 格式
                    const singleIccidWithCountPattern = /([A-Za-z0-9]+)\s*[\(（]\s*(\d+)\s*张[\)）]/;
                    const singleMatch = line.match(singleIccidWithCountPattern);
                    
                    if (singleMatch) {
                        // 提取ICCID部分
                        const iccid = singleMatch[1].trim();
                        // 提取数量部分（这里我们不使用数量，只提取ICCID）
                        const count = singleMatch[2];
                        
                        // 验证ICCID的有效性
                        if (iccid.length > 0) {
                            resultArray.push(iccid);
                        }
                    } else {
                        // 清理每行，移除可能的引号和空格
                        const cleanedLine = line.trim().replace(/['""`]/g, '');
                        
                        // 如果是有效的ICCID（至少包含数字和可能的字母，长度大于10）
                        if (/^[A-Za-z0-9]+$/.test(cleanedLine)) {
                            resultArray.push(cleanedLine);
                        }
                    }
                });
                
                // 显示结果，每行一个ICCID
                document.getElementById('iccidResult').value = resultArray.join('\n');
                updateIccidSummary(resultArray.join('\n'));

                if (resultArray.length > 0) {
                    showIccidToast(`解析成功，共提取 ${resultArray.length} 个ICCID`, 'success');
                } else {
                    showIccidToast('未找到有效的ICCID数据，请检查输入格式', 'error');
                }
            }
            
            // 提取ICCID末尾的数字部分
            function extractNumericSuffix(iccid) {
                // 对于纯数字ICCID，需要特殊处理
                if (/^\d+$/.test(iccid)) {
                    // 如果是纯数字，取最后5位作为变化部分
                    return iccid.slice(-5);
                } else {
                    // 对于混合字母数字的ICCID，使用原来的逻辑
                    const match = iccid.match(/(\d+)$/);
                    return match ? match[1] : null;
                }
            }
            
            // 修改ICCID格式函数
            function formatIccids() {
                const resultText = document.getElementById('iccidResult').value;
                if (!resultText.trim()) {
                    showMessage('请先解析ICCID数据', 'error');
                    return;
                }
                
                // 将换行分隔的ICCID转换为逗号分隔
                const iccids = resultText.split('\n').filter(line => line.trim());
                document.getElementById('iccidResult').value = iccids.join(',');
                showMessage('已转换为后台批量查询格式', 'success');
            }
            
            // 恢复ICCID格式函数 - 在每个ICCID后添加单引号
            function addQuotesToIccids() {
                const resultText = document.getElementById('iccidResult').value;
                if (!resultText.trim()) {
                    showMessage('请先解析ICCID数据', 'error');
                    return;
                }
                
                // 处理不同格式的ICCID
                let iccids;
                if (resultText.includes(',')) {
                    // 逗号分隔的格式
                    iccids = resultText.split(',').filter(item => item.trim());
                    // 添加单引号并重新用逗号连接
                    document.getElementById('iccidResult').value = iccids.map(iccid => 
                        iccid.trim().endsWith("'") ? iccid.trim() : iccid.trim() + "'"
                    ).join(',');
                } else {
                    // 换行分隔的格式
                    iccids = resultText.split('\n').filter(line => line.trim());
                    // 添加单引号并保持换行格式
                    document.getElementById('iccidResult').value = iccids.map(iccid => 
                        iccid.trim().endsWith("'") ? iccid.trim() : iccid.trim() + "'"
                    ).join('\n');
                }
                
                showMessage('已添加单引号，防止科学计数格式', 'success');
            }

            // ===== ICCID详情工具：新增功能（去除20位长度限制，按行通用处理） =====
            // 数据汇总：统计结果框中合计数据条数（逗号单行按逗号拆分，多行按非空行统计）
            function countIccidDataItems(text) {
                const trimmed = (text || '').trim();
                if (!trimmed) return 0;
                const lines = trimmed.split(/[\n\r]+/);
                if (lines.length === 1 && trimmed.includes(',')) {
                    return trimmed.split(',').filter(s => s.trim().length > 0).length;
                }
                return lines.filter(s => s.trim().length > 0).length;
            }

            // 更新数据汇总信息显示区域
            function updateIccidSummary(text) {
                const el = document.getElementById('iccidSummary');
                if (!el) return;
                el.textContent = `当前合计数据：${countIccidDataItems(text)} 条`;
            }

            // 操作提示：显示后1秒自动消失
            function showIccidToast(message, type = 'info') {
                const el = document.getElementById('iccidToast');
                if (!el) return;
                el.textContent = message;
                if (type === 'success') {
                    el.style.backgroundColor = '#d4edda';
                    el.style.color = '#155724';
                    el.style.border = '1px solid #c3e6cb';
                } else if (type === 'error') {
                    el.style.backgroundColor = '#f8d7da';
                    el.style.color = '#721c24';
                    el.style.border = '1px solid #f5c6cb';
                } else {
                    el.style.backgroundColor = '#d1ecf1';
                    el.style.color = '#0c5460';
                    el.style.border = '1px solid #bee5eb';
                }
                el.style.display = 'block';
                clearTimeout(el._iccidToastTimer);
                el._iccidToastTimer = setTimeout(() => { el.style.display = 'none'; }, 1000);
            }

            // 统一的数据源：结果框有内容则取结果框，否则取原始输入框
            // 拆分按行、按逗号，使链式操作（如反复转换查询格式）保持正确、幂等
            function getIccidSourceLines() {
                const resultText = document.getElementById('iccidResult').value;
                const source = resultText.trim() ? resultText : document.getElementById('iccidInput').value;
                return source.split(/[\n\r,]+/).map(s => s.trim());
            }

            // 1. 一键去重：对原始数据输入框内容按行去重，结果输出到结果框
            function dedupIccids() {
                const inputText = document.getElementById('iccidInput').value;
                if (!inputText.trim()) {
                    showIccidToast('请输入需要去重的数据', 'error');
                    return;
                }
                const seen = new Set();
                const result = [];
                inputText.split(/[\n\r]+/).forEach(raw => {
                    const line = raw.trim();
                    if (line && !seen.has(line)) {
                        seen.add(line);
                        result.push(line);
                    }
                });
                document.getElementById('iccidResult').value = result.join('\n');
                updateIccidSummary(result.join('\n'));
                showIccidToast(`去重完成，共 ${result.length} 条数据`, 'success');
            }

            // 2. 清空输入：清空输入框和结果框，重置汇总信息
            function clearIccidInput() {
                document.getElementById('iccidInput').value = '';
                document.getElementById('iccidResult').value = '';
                updateIccidSummary('');
                showIccidToast('已清空输入和结果', 'info');
            }

            // 数据分裂：将原始数据的有效行按每份 N 行分裂成多个输出框
            function splitIccidData() {
                const lines = getIccidSourceLines().filter(s => s.length > 0);
                if (lines.length === 0) {
                    showIccidToast('没有可分裂的数据', 'error');
                    return;
                }
                const sizeInput = document.getElementById('iccidSplitSize');
                let size = parseInt(sizeInput.value, 10);
                if (!size || size < 1) { size = 300; sizeInput.value = 300; }
                const wrap = document.getElementById('iccidSplitWrap');
                const info = document.getElementById('iccidSplitInfo');
                wrap.innerHTML = '';
                const chunks = Math.ceil(lines.length / size);
                for (let i = 0; i < chunks; i++) {
                    const part = lines.slice(i * size, (i + 1) * size);
                    const start = i * size + 1;
                    const end = start + part.length - 1;
                    const box = document.createElement('div');
                    box.style.cssText = 'border:1px solid #dfe6e9;border-radius:8px;padding:8px;background:#fff;display:flex;flex-direction:column;';
                    const title = document.createElement('div');
                    title.style.cssText = 'font-size:12px;color:#0984e3;font-weight:600;margin-bottom:4px;';
                    title.textContent = `第 ${i + 1}/${chunks} 份（第 ${start}-${end} 行）`;
                    const ta = document.createElement('textarea');
                    ta.value = part.join('\n');
                    ta.style.cssText = 'width:100%;height:160px;padding:6px;font-size:13px;border:1px solid #e0e0e0;border-radius:6px;resize:vertical;font-family:Consolas,Monaco,monospace;';
                    // 每个输出框的操作按钮：转查询 / 转Excel / 防计数 / 加引号
                    const btnRow = document.createElement('div');
                    btnRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;';
                    const mkBtn = (txt, tip, bg, fn) => {
                        const b = document.createElement('button');
                        b.textContent = txt;
                        b.title = tip;
                        b.style.cssText = `font-size:11px;padding:3px 8px;background:${bg};color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;`;
                        b.onclick = () => fn(ta);
                        btnRow.appendChild(b);
                    };
                    mkBtn('转查询', '将该份数据每行用英文逗号拼接为单行查询格式', '#00b894', convertSplitBoxToQuery);
                    mkBtn('转Excel', '每个数据独占一行，自动删除空白行与分隔符', '#17a2b8', convertSplitBoxToExcel);
                    mkBtn('防计数', '每行末尾追加单引号，防止科学计数法', '#f39c12', preventSplitBoxScientific);
                    mkBtn('加引号', '每行添加单引号并用英文逗号隔开', '#8e44ad', addQuotesToSplitBox);
                    box.appendChild(title);
                    box.appendChild(btnRow);
                    box.appendChild(ta);
                    wrap.appendChild(box);
                }
                info.textContent = `共 ${lines.length} 条有效数据，已分裂为 ${chunks} 份（每份 ${size} 行）`;
                showIccidToast(`数据分裂完成，共 ${chunks} 份`, 'success');
            }

            // 清空数据分裂区域
            function clearIccidSplit() {
                document.getElementById('iccidSplitWrap').innerHTML = '';
                document.getElementById('iccidSplitInfo').textContent = '';
            }

            // 将单个分裂输出框的内容转换为查询格式（逗号拼接）
            function convertSplitBoxToQuery(ta) {
                const lines = ta.value.split('\n').filter(s => s.trim().length > 0);
                if (lines.length === 0) {
                    showIccidToast('该份数据为空，无需转换', 'info');
                    return false;
                }
                const cleaned = lines
                    .map(s => s.replace(/[,'";]+/g, '').trim())
                    .filter(s => s.length > 0);
                if (cleaned.length === 0) {
                    showIccidToast('该份数据清洗后为空', 'info');
                    return false;
                }
                ta.value = cleaned.join(',');
                showIccidToast(`已转换，共 ${cleaned.length} 条`, 'success');
                return true;
            }

            // 将单个分裂输出框转换为 Excel 格式：每个数据独占一行，清除分隔符与空白行
            function convertSplitBoxToExcel(ta) {
                const items = ta.value.split(/[,'";\t]+/).map(s => s.trim()).filter(s => s.length > 0);
                if (items.length === 0) {
                    showIccidToast('该份数据为空，无需转换', 'info');
                    return false;
                }
                ta.value = items.join('\n');
                showIccidToast(`已转换为Excel格式，共 ${items.length} 条`, 'success');
                return true;
            }

            // 防止科学计数法：对单个分裂输出框每行末尾追加单引号
            function preventSplitBoxScientific(ta) {
                const items = ta.value.split(/[\n\r]+/).map(s => s.trim()).filter(s => s.length > 0);
                if (items.length === 0) {
                    showIccidToast('请先转换格式再追加单引号', 'error');
                    return false;
                }
                ta.value = items.map(s => s.endsWith("'") ? s : s + "'").join('\n');
                showIccidToast(`已追加单引号防止科学计数法，共 ${items.length} 条`, 'success');
                return true;
            }

            // 新增：批量添加单引号并用英文逗号隔开（单个分裂输出框）
            function addQuotesToSplitBox(ta) {
                const lines = ta.value.split(/[\n\r,]+/).map(s => s.trim()).filter(s => s.length > 0);
                if (lines.length === 0) {
                    showIccidToast('该份数据为空', 'info');
                    return false;
                }
                const cleaned = lines.map(s => s.replace(/^'+|'+$/g, '').trim()).filter(s => s.length > 0);
                if (cleaned.length === 0) {
                    showIccidToast('清洗后无有效数据', 'info');
                    return false;
                }
                ta.value = cleaned.map(s => `'${s}'`).join(',');
                showIccidToast(`已添加单引号并用逗号隔开，共 ${cleaned.length} 条`, 'success');
                return true;
            }

            // 批量：对每个分裂输出框都应用同一转换函数
            function forEachSplitBox(fn) {
                const tas = document.querySelectorAll('#iccidSplitWrap textarea');
                if (tas.length === 0) {
                    showIccidToast('请先执行「确定分裂」', 'error');
                    return false;
                }
                let done = 0;
                tas.forEach(ta => { if (fn(ta)) done++; });
                return done;
            }

            // 批量转换为查询格式（所有分裂输出框）
            function batchConvertSplitToQuery() {
                const done = forEachSplitBox(convertSplitBoxToQuery);
                if (done) showIccidToast(`已批量转换查询格式，共处理 ${done} 份`, 'success');
            }

            // 批量转换为 Excel 格式（所有分裂输出框）
            function batchConvertSplitToExcel() {
                const done = forEachSplitBox(convertSplitBoxToExcel);
                if (done) showIccidToast(`已批量转换Excel格式，共处理 ${done} 份`, 'success');
            }

            // 批量防止科学计数法（所有分裂输出框）
            function batchPreventSplitScientific() {
                const done = forEachSplitBox(preventSplitBoxScientific);
                if (done) showIccidToast(`已批量防止科学计数法，共处理 ${done} 份`, 'success');
            }

            // 批量添加单引号并用逗号隔开（所有分裂输出框）
            function batchAddQuotesToSplit() {
                const done = forEachSplitBox(addQuotesToSplitBox);
                if (done) showIccidToast(`已批量加引号，共处理 ${done} 份`, 'success');
            }

            // 3. 批量转换为查询格式：删除所有换行，每行用英文逗号拼接为单行输出
            function convertToQueryFormat() {
                const items = getIccidSourceLines().filter(s => s.length > 0);
                if (items.length === 0) {
                    showIccidToast('没有可处理的数据', 'error');
                    return;
                }
                const cleaned = items
                    .map(s => s.replace(/[,'";]+/g, '').trim())
                    .filter(s => s.length > 0);
                const output = cleaned.join(',');
                document.getElementById('iccidResult').value = output;
                updateIccidSummary(output);
                showIccidToast(`已转换为查询格式，共 ${cleaned.length} 条数据`, 'success');
            }

            // 4. 转换为Excel格式：清除常见分隔符，每个数据项独占一行，自动删除空白行
            function convertToExcelFormat() {
                const items = getIccidSourceLines().filter(s => s.length > 0);
                if (items.length === 0) {
                    showIccidToast('没有可处理的数据', 'error');
                    return;
                }
                // 以常见分隔符（逗号、单引号、分号、制表符）拆分，每个数据项独占一行
                const expanded = items
                    .join('\n')
                    .split(/[,'";\t]+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
                document.getElementById('iccidResult').value = expanded.join('\n');
                updateIccidSummary(expanded.join('\n'));
                showIccidToast(`已转换为Excel格式，共 ${expanded.length} 条数据`, 'success');
            }

            // 5. 防止科学计数法：在"转换为Excel格式"结果基础上，每行末尾追加单引号
            function preventScientificNotation() {
                const lines = document.getElementById('iccidResult').value
                    .split(/[\n\r]+/)
                    .map(s => s.trim());
                const items = lines.filter(s => s.length > 0);
                if (items.length === 0) {
                    showIccidToast('请先转换为Excel格式再追加单引号', 'error');
                    return;
                }
                const output = items
                    .map(s => s.endsWith("'") ? s : s + "'")
                    .join('\n');
                document.getElementById('iccidResult').value = output;
                updateIccidSummary(output);
                showIccidToast(`已追加单引号防止科学计数法，共 ${items.length} 条数据`, 'success');
            }

            // 结果框内容实时更新汇总信息
            document.getElementById('iccidResult').addEventListener('input', function (e) {
                updateIccidSummary(e.target.value);
            });

            // 金额水量换算函数
            function calculateWaterValue() {
                const amount = parseFloat(document.getElementById('amount').value) || 0;
                const waterVolume = parseFloat(document.getElementById('waterVolume').value) || 0;
                const mlPerCent = parseFloat(document.getElementById('pricePerMl').value) || 0;
                
                let results = [];
                
                if (amount > 0 && waterVolume > 0) {
                    const calculatedMlPerCent = waterVolume / (amount * 100);
                    document.getElementById('pricePerMl').value = calculatedMlPerCent.toFixed(4);
                    results.push(`🧮 1分钱对应：<span style="color:red">${calculatedMlPerCent.toFixed(4)}毫升</span>`);
                    results.push(`💧 ${waterVolume}毫升 = <span style="color:red">${amount}元</span>`);
                } else if (amount > 0 && mlPerCent > 0) {
                    const calculatedVolume = (amount * 100) * mlPerCent;
                    document.getElementById('waterVolume').value = calculatedVolume.toFixed(2);
                    results.push(`💧 水量：<span style="color:red">${calculatedVolume.toFixed(2)}毫升</span>`);
                } else if (waterVolume > 0 && mlPerCent > 0) {
                    const calculatedAmount = waterVolume / mlPerCent / 100;
                    document.getElementById('amount').value = calculatedAmount.toFixed(2);
                    results.push(`💰 金额：<span style="color:red">${calculatedAmount.toFixed(2)}元</span>`);
                } else {
                    results.push(`📝 请输入任意两个参数进行计算`);
                }
                
                document.getElementById('waterCalculations').innerHTML = results.join('<br>');
            }

            // 水单价计算函数
            // 清空洗浴水控数据函数
            function clearWaterValueData() {
                document.getElementById('amount').value = '';
                document.getElementById('waterVolume').value = '';
                document.getElementById('pricePerMl').value = '';
                document.getElementById('waterCalculations').innerHTML = '请输入任意两个参数进行计算';
            }

            // 绑定洗浴水控清空按钮事件
            document.getElementById('clearWaterValueBtn').addEventListener('click', clearWaterValueData);

            // 水控单价计算函数
            function calculateWaterPrice() {
                const waterVolume = parseFloat(document.getElementById('waterVolume2').value) || 0;
                const amount = parseFloat(document.getElementById('amount2').value) || 0;
                const pricePerLiter = parseFloat(document.getElementById('pricePerLiter').value) || 0;
                
                let results = [];
                
                if (waterVolume > 0 && amount > 0) {
                    const calculatedPricePerLiter = (amount / waterVolume) * 1000;
                    document.getElementById('pricePerLiter').value = calculatedPricePerLiter.toFixed(4);
                    results.push(`🚰 <strong>计算结果：1升水单价 = <span style="color:red;font-size:18px">${calculatedPricePerLiter.toFixed(4)}元/升</span></strong>`);
                    results.push(`📊 计算过程：${amount}元 ÷ ${waterVolume}毫升 × 1000 = ${calculatedPricePerLiter.toFixed(4)}元/升`);
                } else if (waterVolume > 0 && pricePerLiter > 0) {
                    const calculatedAmount = (waterVolume / 1000) * pricePerLiter;
                    document.getElementById('amount2').value = calculatedAmount.toFixed(4);
                    results.push(`💰 <strong>应付金额：<span style="color:red;font-size:18px">${calculatedAmount.toFixed(4)}元</span></strong>`);
                } else if (amount > 0 && pricePerLiter > 0) {
                    const calculatedVolume = (amount / pricePerLiter) * 1000;
                    document.getElementById('waterVolume2').value = calculatedVolume.toFixed(2);
                    results.push(`💧 <strong>可购买水量：<span style="color:red;font-size:18px">${calculatedVolume.toFixed(2)}毫升</span></strong>`);
                } else {
                    results.push(`📝 请输入任意两个参数进行计算`);
                    results.push(`💡 示例：输入787毫升和0.2385元，自动计算1升水单价`);
                }
                
                document.getElementById('waterPriceCalculations').innerHTML = results.join('<br>');
            }
            
            // 清空水控单价数据函数
            function clearWaterPriceData() {
                document.getElementById('waterVolume2').value = '';
                document.getElementById('amount2').value = '';
                document.getElementById('pricePerLiter').value = '';
                document.getElementById('waterPriceCalculations').innerHTML = '请输入任意两个参数进行计算';
            }
            
            // 绑定清空数据按钮事件
            document.getElementById('clearWaterPriceBtn').addEventListener('click', clearWaterPriceData);

            // CSV/Excel文件处理相关
            document.getElementById('csvFileInput').addEventListener('change', function() {
                const processButton = document.querySelector('#csv89860Tool button');
                if (this.files.length > 0) {
                    processButton.disabled = false;
                    document.getElementById('csvProcessStatus').textContent = `已选择文件: ${this.files[0].name}`;
                } else {
                    processButton.disabled = true;
                    document.getElementById('csvProcessStatus').textContent = '请选择文件进行处理';
                }
            });
            
            function processCSVFile() {
                const fileInput = document.getElementById('csvFileInput');
                const file = fileInput.files[0];
                
                if (!file) {
                    document.getElementById('csvProcessStatus').textContent = '请先选择文件';
                    return;
                }
                
                document.getElementById('csvProcessStatus').textContent = '正在处理文件...';
                
                const fileExtension = file.name.split('.').pop().toLowerCase();
                
                // 根据文件类型选择处理方法
                if (fileExtension === 'csv') {
                    processCSV(file);
                } else if (['xls', 'xlsx'].includes(fileExtension)) {
                    processExcel(file);
                } else {
                    document.getElementById('csvProcessStatus').textContent = '不支持的文件格式，请选择CSV、XLS或XLSX文件';
                }
            }
            
            // 处理CSV文件
            function processCSV(file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const content = e.target.result;
                        let matchCount = 0;
                        
                        // 处理引号中的89860开头的值
                        let modifiedContent = content;
                        const pattern89860 = /"89860/g;
                        const matches89860 = content.match(pattern89860) || [];
                        modifiedContent = modifiedContent.replace(pattern89860, '"\'89860');
                        matchCount += matches89860.length;
                        
                        // 处理86开头的15位数字(IMEI)
                        // 先匹配引号中的IMEI
                        const patternIMEIQuoted = /"86\d{13}"/g;
                        const matchesIMEIQuoted = content.match(patternIMEIQuoted) || [];
                        modifiedContent = modifiedContent.replace(patternIMEIQuoted, (match) => {
                            return `"'${match.substring(1, match.length - 1)}"`;
                        });
                        matchCount += matchesIMEIQuoted.length;

                        // 再匹配没有引号的IMEI（通常在CSV中出现）
                        const patternIMEIUnquoted = /(^|,|\n)86\d{13}($|,|\n)/g;
                        const matchesIMEIUnquoted = content.match(patternIMEIUnquoted) || [];
                        modifiedContent = modifiedContent.replace(patternIMEIUnquoted, (match) => {
                            // 保留分隔符
                            if (match.startsWith(',') || match.startsWith('\n')) {
                                const prefix = match[0];
                                const imei = match.substring(1, match.length - 1);
                                const suffix = match[match.length - 1];
                                return `${prefix}"${imei}"${suffix}`;
                            } else if (match.endsWith(',') || match.endsWith('\n')) {
                                const prefix = match[0];
                                const imei = match.substring(1, match.length - 1);
                                const suffix = match[match.length - 1];
                                return `${prefix}"${imei}"${suffix}`;
                            } else {
                                const imei = match;
                                return `"${imei}"`;
                            }
                        });
                        matchCount += matchesIMEIUnquoted.length;
                        
                        // 处理可能被Excel转为科学计数法的长数字
                        // 匹配引号中的10位以上纯数字
                        const patternLongNum = /"\d{10,}"/g;
                        const matchesLongNum = content.match(patternLongNum) || [];
                        modifiedContent = modifiedContent.replace(patternLongNum, (match) => {
                            // 避免重复处理已经添加单引号的值
                            if (!match.includes("'")) {
                                return `"'${match.substring(1, match.length - 1)}"`;
                            }
                            return match;
                        });
                        matchCount += matchesLongNum.length;
                        
                        // 创建下载链接
                        const blob = new Blob(['\ufeff' + modifiedContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        
                        // 设置下载文件名
                        const originalName = file.name;
                        const extension = originalName.lastIndexOf('.') >= 0 ? originalName.slice(originalName.lastIndexOf('.')) : '.csv';
                        const baseName = originalName.lastIndexOf('.') >= 0 ? originalName.slice(0, originalName.lastIndexOf('.')) : originalName;
                        const downloadName = `${baseName}_processed${extension}`;
                        
                        link.setAttribute('href', url);
                        link.setAttribute('download', downloadName);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        document.getElementById('csvProcessStatus').textContent = `处理完成！共处理了 ${matchCount} 个需要添加单引号的值，文件已下载`;
                        
                        // 重置文件输入，允许再次选择同一文件
                        document.getElementById('csvFileInput').value = '';
                        document.querySelector('#csv89860Tool button').disabled = true;
                    } catch (error) {
                        document.getElementById('csvProcessStatus').textContent = `处理失败: ${error.message}`;
                    }
                };
                
                reader.onerror = function() {
                    document.getElementById('csvProcessStatus').textContent = '读取文件失败';
                };
                
                // 读取文件内容
                reader.readAsText(file, 'utf-8');
            }
            
            // 处理Excel文件
            function processExcel(file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        let totalProcessedCount = 0;
                        
                        // 处理每个工作表
                        workbook.SheetNames.forEach(sheetName => {
                            const worksheet = workbook.Sheets[sheetName];
                            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
                            
                            let sheetProcessedCount = 0;
                            
                            // 遍历所有单元格
                            for (let row = range.s.r; row <= range.e.r; row++) {
                                for (let col = range.s.c; col <= range.e.c; col++) {
                                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                                    const cell = worksheet[cellAddress];
                                    
                                    if (cell && cell.v && typeof cell.v === 'string') {
                                        const originalValue = cell.v;
                                        let modified = false;
                                        
                                        // 检查是否需要添加单引号
                                        // 去除前后空格后再判断
                                        const trimmedValue = originalValue.trim();
                                        if (
                                            (trimmedValue.startsWith('89860') || 
                                            (trimmedValue.startsWith('86') && /^86\d{13}$/.test(trimmedValue)) ||
                                            /^\d{10,}$/.test(trimmedValue)) &&
                                            !originalValue.startsWith("'")
                                        ) {
                                            // 在值前添加单引号，并设置单元格类型为文本
                                            cell.v = `'${originalValue}`;
                                            cell.t = 's'; // 设置为字符串类型
                                            modified = true;
                                            sheetProcessedCount++;
                                        }
                                    } else if (cell && typeof cell.v === 'number') {
                                        // 处理数字类型值
                                        const originalValue = cell.v.toString();
                                        
                                        // 检查是否是长数字（可能被Excel转为科学计数法）
                                        if (originalValue.length >= 10 && !originalValue.includes('.')) {
                                            // 转换为字符串并添加单引号
                                            cell.v = `'${originalValue}`;
                                            cell.t = 's'; // 设置为字符串类型
                                            modified = true;
                                            sheetProcessedCount++;
                                        }
                                    }
                                }
                            }
                            
                            totalProcessedCount += sheetProcessedCount;
                            console.log(`工作表 ${sheetName} 处理了 ${sheetProcessedCount} 个单元格`);
                        });
                        
                        // 生成处理后的文件
                        const originalName = file.name;
                        const extension = originalName.lastIndexOf('.') >= 0 ? originalName.slice(originalName.lastIndexOf('.')) : '.xlsx';
                        const baseName = originalName.lastIndexOf('.') >= 0 ? originalName.slice(0, originalName.lastIndexOf('.')) : originalName;
                        const downloadName = `${baseName}_已处理${extension}`;
                        
                        // 下载文件
                        XLSX.writeFile(workbook, downloadName);
                        
                        document.getElementById('csvProcessStatus').textContent = `处理完成！共处理了 ${totalProcessedCount} 个单元格，文件已下载`;
                        
                        // 重置文件输入，允许再次选择同一文件
                        document.getElementById('csvFileInput').value = '';
                        document.querySelector('#csv89860Tool button').disabled = true;
                    } catch (error) {
                        document.getElementById('csvProcessStatus').textContent = `处理失败: ${error.message}`;
                        console.error('Excel处理错误:', error);
                    }
                };
                
                reader.onerror = function() {
                    document.getElementById('csvProcessStatus').textContent = '读取文件失败';
                };
                
                // 读取文件内容
                reader.readAsArrayBuffer(file);
            }
            
            // 十进制转十六进制函数（支持多行）
            function convertDecToHex() {
                var lines = (document.getElementById('decimalInput').value || '').split('\n');
                var results = [];
                for (var i = 0; i < lines.length; i++) {
                    var v = lines[i].trim();
                    if (!v) { results.push(''); continue; }
                    if (/^\d+$/.test(v)) {
                        results.push(parseInt(v, 10).toString(16).toUpperCase());
                    } else {
                        results.push('[无效: ' + v + ']');
                    }
                }
                document.getElementById('hexInput').value = results.join('\n');
            }

            // 十六进制转十进制函数（支持多行）
            function convertHexToDec() {
                var lines = (document.getElementById('hexInput').value || '').split('\n');
                var results = [];
                for (var i = 0; i < lines.length; i++) {
                    var v = lines[i].trim();
                    if (!v) { results.push(''); continue; }
                    if (/^[0-9A-Fa-f]+$/.test(v)) {
                        results.push(String(parseInt(v, 16)));
                    } else {
                        results.push('[无效: ' + v + ']');
                    }
                }
                document.getElementById('decimalInput').value = results.join('\n');
            }
            
            // IMEI提取工具相关函数
            function readImeiFile(file) {
                const statusDiv = document.getElementById('imeiProcessStatus');
                const resultDiv = document.getElementById('imeiResult');
                
                // 保存上传文件名
                imeiFileName = file.name;
                
                statusDiv.innerHTML = '正在读取Excel文件...';
                resultDiv.innerHTML = '正在解析文件内容...';
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        // 获取第一个工作表
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        
                        // 转换为JSON
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                        
                        analyzeImeiData(jsonData);
                        
                    } catch (error) {
                        statusDiv.innerHTML = `读取文件失败: ${error.message}`;
                        resultDiv.innerHTML = '文件解析失败';
                    }
                };
                
                reader.readAsArrayBuffer(file);
            }
            
            function analyzeImeiData(data) {
                const statusDiv = document.getElementById('imeiProcessStatus');
                const resultDiv = document.getElementById('imeiResult');
                
                try {
                    if (!data || data.length === 0) {
                        statusDiv.innerHTML = '文件为空或无有效数据';
                        resultDiv.innerHTML = '文件为空或无有效数据';
                        return;
                    }
                    
                    let startRow = 0;
                    
                    // 检查首行是否包含中文字符
                    const firstRow = data[0] || [];
                    const hasChineseInFirstRow = firstRow.some(cell => 
                        cell && /[\u4e00-\u9fa5]/.test(cell.toString())
                    );
                    
                    if (hasChineseInFirstRow) {
                        startRow = 1;
                        statusDiv.innerHTML = '检测到首行包含中文，将从第二行开始处理';
                    } else {
                        startRow = 0;
                        statusDiv.innerHTML = '首行不包含中文，从第一行开始处理';
                    }
                    
                    // 从B列提取IMEI数据
                    const imeiList = [];
                    
                    for (let i = startRow; i < data.length; i++) {
                        const row = data[i];
                        if (row && row.length >= 2) { // B列是索引1
                            const cellValue = row[1] ? row[1].toString().trim() : '';
                            
                            // 验证IMEI格式：86开头的15位纯数字
                            if (/^86\d{13}$/.test(cellValue)) {
                                imeiList.push(cellValue);
                            }
                        }
                    }
                    
                    imeiData = imeiList;
                    
                    // 显示提取结果
                    let resultHtml = '';
                    if (imeiList.length > 0) {
                        resultHtml = `<p>共提取到 ${imeiList.length} 个有效的IMEI：</p>`;
                        resultHtml += '<ul>';
                        
                        const maxDisplay = Math.min(3000, imeiList.length);
                        for (let i = 0; i < maxDisplay; i++) {
                            resultHtml += `<li>${imeiList[i]}</li>`;
                        }
                        
                        if (imeiList.length > maxDisplay) {
                            resultHtml += `<li>... 还有 ${imeiList.length - maxDisplay} 个IMEI</li>`;
                        }
                        
                        resultHtml += '</ul>';
                    } else {
                        resultHtml = '未找到有效的IMEI数据，请检查文件格式';
                    }
                    
                    resultDiv.innerHTML = resultHtml;
                    statusDiv.innerHTML = `提取完成！共找到 ${imeiList.length} 个有效的IMEI`;
                    
                    // 更新按钮状态
                    updateImeiButton();
                    
                } catch (error) {
                    statusDiv.innerHTML = `数据分析失败: ${error.message}`;
                    resultDiv.innerHTML = '数据分析失败';
                }
            }
            
            function extractImei() {
                const statusDiv = document.getElementById('imeiProcessStatus');
                
                if (imeiData.length === 0) {
                    statusDiv.innerHTML = '没有找到有效的IMEI数据';
                    return;
                }
                
                // 生成一行一个IMEI的格式
                const imeiText = imeiData.join('\n');
                
                // 复制到剪贴板
                navigator.clipboard.writeText(imeiText)
                    .then(() => {
                        statusDiv.innerHTML = `✅ 提取完成！共提取 ${imeiData.length} 个IMEI，已自动复制到剪贴板`;
                    })
                    .catch(err => {
                        statusDiv.innerHTML = `提取完成！共提取 ${imeiData.length} 个IMEI，但复制到剪贴板失败: ${err.message}`;
                    });
            }
            
            function clearImeiData() {
                imeiData = [];
                imeiFileName = '';
                document.getElementById('imeiFileInput').value = '';
                document.getElementById('imeiResult').innerHTML = '等待文件上传...';
                document.getElementById('imeiProcessStatus').innerHTML = '请上传Excel文件';
                updateImeiButton();
            }
            
            function updateImeiButton() {
                const hasData = imeiData.length > 0;
                const processButton = document.querySelector('#imeiExtractionTool .btn-primary');
                processButton.disabled = !hasData;
                
                if (processButton.disabled) {
                    processButton.textContent = '🔍 请先上传文件';
                } else {
                    processButton.textContent = '🔍 提取IMEI';
                }
            }
            
            // 事件绑定
            document.addEventListener('DOMContentLoaded', function() {
                // 脉冲计算器事件
                document.getElementById('systemPulses').addEventListener('input', calculateActualPulses);
                document.getElementById('systemWater').addEventListener('input', calculateActualPulses);
                document.getElementById('actualWater').addEventListener('input', calculateActualPulses);
                
                // 进制转换事件
                document.getElementById('decimalInput').addEventListener('input', convertDecToHex);
                document.getElementById('hexInput').addEventListener('input', convertHexToDec);

                
                // Excel文件上传事件
                const fileInput = document.getElementById('excelFileInput');
                fileInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        readExcelFile(file);
                    } else {
                        clearExcelData();
                    }
                });
                
                // IMEI文件上传事件
                const imeiFileInput = document.getElementById('imeiFileInput');
                if (imeiFileInput) {
                    imeiFileInput.addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        if (file) {
                            readImeiFile(file);
                        } else {
                            clearImeiData();
                        }
                    });
                }
                
                // 模板选择事件
                document.getElementById('templateSelect').addEventListener('change', function(e) {
                    if (e.target.value === 'upload') {
                        // 触发模板文件上传
                        document.getElementById('templateFileInput').click();
                        // 重置选择框
                        e.target.value = '';
                    } else {
                        updateProcessButton();
                    }
                });
                
                // 初始化：加载远程模板
                loadRemoteTemplate().then(() => {
                    console.log('远程模板初始化完成');
                    // 确保按钮状态正确更新
                    updateProcessButton();
                }).catch(error => {
                    console.error('远程模板初始化失败:', error);
                    // 即使加载失败也要更新按钮状态
                    updateProcessButton();
                });

                // 默认显示入库参数生成工具
                showTool('stockParamTool');
            });
            
            // 入库参数生成器相关函数
            function extractData(allowNoFilter) {
                // 验证滤芯寿命是否已选择（订单自动提取 allowNoFilter=true 时不中断，该项留空待补）
                const filterLifeType = document.getElementById('filterLifeType').value;
                if (!filterLifeType && !allowNoFilter) {
                    alert('请选择滤芯寿命！');
                    return;
                }
                
                // 获取Excel数据并处理
                const excelData = document.getElementById('excelData').value.trim();
                let excelResult = '';
                
                if (excelData) {
                    // 处理制表符分隔的字段
                    const extractedData = excelData.split(/\t/).filter(item => item.trim() !== '');
                    // 确保只包含基础信息：公司名称、微信公众号、无卡类型、厂商ID、系统类型
                    // 去除可能包含重复参数的多余字段
                    const basicFields = extractedData.slice(0, 5);
                    // 第2步：系统类型输出完成后，用【】括起来
                    excelResult ='【' + basicFields.join('，') + '。】';
                }
                
                // 获取滤芯寿命的完整描述
                let filterLifeTypeText = '';
                if (filterLifeType === '0') {
                    filterLifeTypeText = '0.时间';
                } else if (filterLifeType === '1') {
                    filterLifeTypeText = '1.流量';
                }
                
                // 获取参数数据
                const parameterData = {
                    '主板型号：': document.getElementById('motherboardModel').value.trim(),
                    '滤芯寿命：': filterLifeTypeText,
                    '通道2脉冲[冷、小2]：': document.getElementById('channel2Pulse').value.trim(),
                    '通道1脉冲[热,大]：': document.getElementById('channel1Pulse').value.trim(),
                    '启动流量计脉冲：': document.getElementById('startFlowPulse').value.trim(),
                    '氢水流量计脉冲：': document.getElementById('hydrogenFlowPulse').value.trim(),
                    '制水时间：': document.getElementById('waterTime').value.trim(),
                    '阀2放水时间[冷、小]：': document.getElementById('valve2Time').value.trim(),
                    '阀1放水时间[罐装、大、热]：': document.getElementById('valve1Time').value.trim(),
                    '检修 时间：': document.getElementById('maintainTime').value.trim(),
                    '热水 温度：': document.getElementById('hotWaterTemp').value.trim(),
                    '制冷启动温度：': document.getElementById('coolStartTemp').value.trim(),
                    '温度锁定、消毒后等待：': document.getElementById('tempLockDisinfectionWait').value.trim(),
                    '消毒持续时间：': document.getElementById('disinfectionDuration').value.trim(),
                    '大/1通道/热水老费率：': document.getElementById('rate1Hot').value.trim(),
                    '小/2通道/冷水老费率：': document.getElementById('rate2Cold').value.trim(),
                    '大/1通道/热水费率：': document.getElementById('rate1HotPerLiter').value.trim(),
                    '小/2通道/冷水费率：': document.getElementById('rate2ColdPerLiter').value.trim(),
                    '单次限制流量/箱3：': document.getElementById('singleLimitFlow').value.trim(),
                    '取水等待时间：': document.getElementById('waterWaitTime').value.trim(),
                    '取水暂停等待时间：': document.getElementById('waterPauseTime').value.trim(),
                    '浮球-派士：': document.getElementById('floatBall').value.trim(),
                    '单次限制时间：': document.getElementById('singleLimitTime').value.trim(),
                    '卡流量：': document.getElementById('cardFlow').value.trim(),
                    'ICCID起始：': document.getElementById('iccidStart').value.trim(),
                    'ICCID结尾：': document.getElementById('iccidEnd').value.trim(),
                    '入库数量：': document.getElementById('inStockCount').value.trim()
                };
                
                // 定义参数输出顺序：主板型号 → 滤芯寿命 → 其他带数值参数
                const parameterOrder = [
                    '主板型号：',
                    '滤芯寿命：',
                    '通道2脉冲[冷、小2]：',
                    '通道1脉冲[热,大]：',
                    '启动流量计脉冲：',
                    '氢水流量计脉冲：',
                    '制水时间：',
                    '阀2放水时间[冷、小]：',
                    '阀1放水时间[罐装、大、热]：',
                    '检修 时间：',
                    '热水 温度：',
                    '制冷启动温度：',
                    '温度锁定、消毒后等待：',
                    '消毒持续时间：',
                    '大/1通道/热水老费率：',
                    '小/2通道/冷水老费率：',
                    '大/1通道/热水费率：',
                    '小/2通道/冷水费率：',
                    '单次限制流量/箱3：',
                    '取水等待时间：',
                    '取水暂停等待时间：',
                    '浮球-派士：',
                    '单次限制时间：',
                    '卡流量：',
                    'ICCID起始：',
                    'ICCID结尾：',
                    '入库数量：'
                ];
                
                // 构建参数结果，只包含有值的参数，按照指定顺序输出
                const paramEntries = [];
                for (const paramName of parameterOrder) {
                    const value = parameterData[paramName];
                    if (value !== '') {
                        paramEntries.push(`${paramName}${value}`);
                    }
                }
                let paramResult = '';
                if (paramEntries.length > 0) {
                    paramResult = paramEntries.join('，') + '。';
                }
                
                // 检查原始数据是否包含"指定ID"，如果包含则添加到结果末尾
                const nonStandardData = document.getElementById('nonStandardData').value.trim();
                if (nonStandardData.includes('指定ID')) {
                    if (paramResult) {
                        // 如果已有参数结果，在句号前添加
                        paramResult = paramResult.replace(/。$/, '，指定ID。');
                    } else {
                        // 如果没有参数结果，直接添加
                        paramResult = '指定ID。';
                    }
                }
                
                // 合并结果
                let finalResult = '';
                if (excelResult) {
                    finalResult += excelResult;
                }
                if (paramResult) {
                    finalResult += paramResult;
                }
                
                // 显示结果
                const resultElement = document.getElementById('result');
                resultElement.textContent = finalResult;
                
                // 自动复制结果到剪贴板
                navigator.clipboard.writeText(finalResult)
                    .then(() => {
                        console.log('结果已复制到剪贴板');
                    })
                    .catch(err => {
                        console.error('复制失败:', err);
                    });
            }
            
            function convertData() {
                const nonStandardData = document.getElementById('nonStandardData').value.trim();
                if (!nonStandardData) {
                    alert('请输入非标准内容！');
                    return;
                }

                // 📷 生产订单格式（图片识别原文/订单粘贴）：只提取固定六项+按需数值项（有数值才填）
                if (/常规参数|特别参数|生产订单表|主板型号\/产品型号|冷水2路脉冲|放水时间冷2路|滤芯寿命[:：]?☑|单次限制流量/.test(nonStandardData) || nonStandardData === window.__lastOrderSummary) {
                    var OF = parseOrderTextCore(nonStandardData);
                    applyOrderParseToForm(OF, !window.__orderConvBusy);
                    return;
                }
                
                // 不清空之前所有转换的数据，只清空参数设置区域
                // 清空参数设置区域
                document.getElementById('motherboardModel').value = '';
                document.getElementById('filterLifeType').value = '';
                document.getElementById('channel2Pulse').value = '';
                document.getElementById('channel1Pulse').value = '';
                document.getElementById('waterTime').value = '';
                document.getElementById('valve2Time').value = '';
                document.getElementById('valve1Time').value = '';
                document.getElementById('maintainTime').value = '';
                document.getElementById('rate1Hot').value = '';
                document.getElementById('rate2Cold').value = '';
                document.getElementById('rate1HotPerLiter').value = '';
                document.getElementById('rate2ColdPerLiter').value = '';
                document.getElementById('singleLimitFlow').value = '';
                document.getElementById('waterWaitTime').value = '';
                document.getElementById('waterPauseTime').value = '';
                document.getElementById('floatBall').value = '';
                document.getElementById('singleLimitTime').value = '';
                document.getElementById('cardFlow').value = '';
                document.getElementById('iccidStart').value = '';
                document.getElementById('iccidEnd').value = '';
                document.getElementById('inStockCount').value = '';
                document.getElementById('hotWaterTemp').value = '';
                document.getElementById('coolStartTemp').value = '';
                document.getElementById('tempLockDisinfectionWait').value = '';
                document.getElementById('disinfectionDuration').value = '';
                
                // 定义系统类型关键字数组，包含所有支持的系统类型
                const systemKeywords = ['跃龙新私有', '跃龙公有售水机', '跃龙公有售水机有域名', '跃龙新公有', '跃龙新公有有域名', '跃龙公有', '跃龙公有有域名', '跃龙2.0公有', '跃龙3.0公有', '跃龙私有', '客户私有'];
                
                // 处理用户输入的格式，支持逗号和空格分隔
                let basicInfo;
                let companyName = '';
                let wechatName = '';
                let vendorId = '';
                let cardType = '无卡类型'; // 默认无卡类型
                let motherboardModel = '';
                let systemType = ''; // 系统类型
                
                if (nonStandardData.includes('，')) {
                    // 优化：用户数据包含逗号，但主要是空格分隔的，所以先按空格分割处理
                    basicInfo = nonStandardData.split(/\s+/).filter(item => item.trim() !== '');
                    
                    // 处理五要素：公司名称,微信公众号,厂商ID,卡类型,所属系统
                // 1. 处理公司名称
                if (basicInfo.length >= 1) {
                    companyName = basicInfo[0];
                }
                
                // 2. 处理微信公众号 - 为空时补填公司名称
                if (basicInfo.length >= 2 && basicInfo[1].trim() !== '') {
                    wechatName = basicInfo[1];
                } else {
                    wechatName = companyName; // 微信公众号为空时，默认补填公司名称
                }
                
                // 3. 处理厂商ID
                if (basicInfo.length >= 3) {
                    vendorId = basicInfo[2];
                }
                
                // 4. 所有卡类型都设置为"无卡类型"
                cardType = '无卡类型';
                
                // 5. 处理所属系统 - 检测到所属系统时，完结五要素转换
                // 遍历从第四个字段开始的所有字段，寻找系统类型
                for (let i = 3; i < basicInfo.length; i++) {
                    const item = basicInfo[i];
                    if (systemKeywords.includes(item)) {
                        systemType = item;
                        break; // 检测到所属系统时，完结五要素转换
                    }
                }
                    // 所有卡类型都设置为"无卡类型"，忽略原始卡类型字段
                    cardType = '无卡类型';
                    
                    // 提取主板型号
                    // 1. 先尝试从明确标注中提取
                    let modelMatch = nonStandardData.match(/主板型号：([^，。]+)/);
                    if (modelMatch && modelMatch[1]) {
                        motherboardModel = modelMatch[1].trim();
                    } else {
                        // 2. 遍历所有字段，查找型号
                        for (const item of basicInfo) {
                            // 匹配任意字母开头，包含字母、数字、连字符和中文的型号，不包含空格
                            const modelRegex = /^[A-Za-z][A-Za-z0-9\-\u4e00-\u9fa5]+$/;
                            if (modelRegex.test(item)) {
                                motherboardModel = item;
                                break;
                            }
                        }
                        
                        // 3. 如果还是没找到，从系统类型后面查找型号
                        if (!motherboardModel) {
                            let systemTypePos = -1;
                            for (const keyword of systemKeywords) {
                                const pos = nonStandardData.indexOf(keyword);
                                if (pos !== -1) {
                                    systemTypePos = pos + keyword.length;
                                    break;
                                }
                            }
                            
                            if (systemTypePos !== -1) {
                                // 从系统类型后面提取型号，遇到空格自动结束
                                const textAfterSystem = nonStandardData.slice(systemTypePos).trim();
                                // 匹配任意字母开头，包含字母、数字、连字符和中文的型号，遇到空格停止
                                const modelRegex = /^[A-Za-z][A-Za-z0-9\-\u4e00-\u9fa5]+/;
                                const match = textAfterSystem.match(modelRegex);
                                if (match && match[0]) {
                                    motherboardModel = match[0].trim();
                                }
                            }
                        }
                    }
                } else {
                    // 处理空格分隔格式
                    basicInfo = nonStandardData.split(/\s+/).filter(item => item.trim() !== '');
                    
                    // 处理五要素：公司名称,微信公众号,厂商ID,卡类型,所属系统
                    // 1. 处理公司名称
                    if (basicInfo.length >= 1) {
                        companyName = basicInfo[0];
                    }
                    
                    // 2. 处理微信公众号 - 为空时补填公司名称
                    if (basicInfo.length >= 2 && basicInfo[1].trim() !== '') {
                        wechatName = basicInfo[1];
                    } else {
                        wechatName = companyName; // 微信公众号为空时，默认补填公司名称
                    }
                    
                    // 3. 处理厂商ID
                    if (basicInfo.length >= 3) {
                        vendorId = basicInfo[2];
                    }
                    
                    // 4. 所有卡类型都设置为"无卡类型"
                    cardType = '无卡类型';
                    
                    // 5. 处理所属系统 - 检测到所属系统时，完结五要素转换
                    // 遍历从第四个字段开始的所有字段，寻找系统类型
                    for (let i = 3; i < basicInfo.length; i++) {
                        const item = basicInfo[i];
                        if (systemKeywords.includes(item)) {
                            systemType = item;
                            break; // 检测到所属系统时，完结五要素转换
                        }
                    }
                    
                    // 提取主板型号
                    // 1. 先尝试从明确标注中提取
                    let modelMatch = nonStandardData.match(/主板型号：([^，。]+)/);
                    if (modelMatch && modelMatch[1]) {
                        motherboardModel = modelMatch[1].trim();
                    } else {
                        // 2. 找到系统类型在字符串中的位置
                        let systemTypePos = -1;
                        for (const keyword of systemKeywords) {
                            const pos = nonStandardData.indexOf(keyword);
                            if (pos !== -1) {
                                systemTypePos = pos + keyword.length;
                                break;
                            }
                        }
                        
                        if (systemTypePos !== -1) {
                            // 3. 从系统类型后面提取第一个以字母开头的连续字符串作为型号
                            const textAfterSystem = nonStandardData.slice(systemTypePos).trim();
                            // 匹配任意字母开头，包含字母、数字、连字符和中文的型号，遇到空格停止
                            const modelRegex = /^[A-Za-z][A-Za-z0-9\-\u4e00-\u9fa5]+/;
                            const match = textAfterSystem.match(modelRegex);
                            if (match && match[0]) {
                                motherboardModel = match[0].trim();
                            }
                        }
                        
                        // 4. 如果还是没找到，遍历所有字段，查找型号
                        if (!motherboardModel) {
                            for (const item of basicInfo) {
                                // 匹配任意字母开头，包含字母、数字、连字符和中文的型号，不包含空格
                                const modelRegex = /^[A-Za-z][A-Za-z0-9\-\u4e00-\u9fa5]+$/;
                                if (modelRegex.test(item)) {
                                    motherboardModel = item;
                                    break;
                                }
                            }
                        }
                    }
                    // 填充主板型号
                    document.getElementById('motherboardModel').value = motherboardModel;
                }
                
                // 五要素已在前面处理完成，此处不再重复处理
                // 删除重复的五要素处理逻辑，保留微信公众号为空时补填公司名称的优化
                
                // 提取主板型号和系统类型
                    if (basicInfo.length >= 1) {
                        // 优化：系统类型后面，以AI、ai、Ai、W、YL等开头，允许-连字符的型号识别
                        // 1. 找到系统类型在basicInfo中的位置
                        let systemTypeIndex = -1;
                        for (let i = 0; i < basicInfo.length; i++) {
                            if (systemKeywords.includes(basicInfo[i])) {
                                systemTypeIndex = i;
                                break;
                            }
                        }
                        
                        // 2. 从系统类型后面开始查找型号
                        let startIndex = systemTypeIndex + 1;
                        if (systemTypeIndex === -1) {
                            startIndex = 0; // 如果没有找到系统类型，从开始查找
                        }
                        
                        for (let i = startIndex; i < basicInfo.length; i++) {
                            const item = basicInfo[i];
                            // 匹配以AI、ai、Ai、W、YL等开头，允许-连字符和中文后缀的型号
                            const modelRegex = /^(AI|ai|Ai|W|YL)[A-Za-z0-9\-]+(?:[\u4e00-\u9fa5])?$/;
                            if (modelRegex.test(item)) {
                                motherboardModel = item;
                                break;
                            }
                        }
                        // 填充主板型号
                        document.getElementById('motherboardModel').value = motherboardModel;
                    }
                    
                    // 如果还没有找到系统类型，尝试从所有基本信息中匹配
                    if (!systemType) {
                        const systemKeywords = ['跃龙新私有', '跃龙公有售水机', '跃龙公有售水机有域名', '跃龙新公有', '跃龙新公有有域名', '跃龙公有', '跃龙公有有域名', '跃龙2.0公有', '跃龙3.0公有', '跃龙私有', '客户私有'];
                        for (const item of basicInfo) {
                            if (systemKeywords.includes(item)) {
                                systemType = item;
                                break;
                            }
                        }
                    }
                
                // 完全从原始数据提取系统类型，不使用默认值
                if (!systemType) {
                    // 定义完整的系统类型关键字数组
                    const systemKeywords = ['跃龙新私有', '跃龙公有售水机', '跃龙公有售水机有域名', '跃龙新公有', '跃龙新公有有域名', '跃龙公有', '跃龙公有有域名', '跃龙2.0公有', '跃龙3.0公有', '跃龙私有', '客户私有'];
                    // 尝试从整个非标准数据中匹配
                    for (const keyword of systemKeywords) {
                        if (nonStandardData.includes(keyword)) {
                            systemType = keyword;
                            break;
                        }
                    }
                }
                
                // 填充系统类型到新添加的输入框
                document.getElementById('systemType').value = systemType;
                
                // 将基础信息填充到Excel数据文本域
                // 格式：公司名称	微信公众号	无卡类型	厂商ID	系统类型
                document.getElementById('excelData').value = `${companyName}\t${wechatName}\t${cardType}\t${vendorId}\t${systemType}`;
                
                // 优化：解析滤芯寿命 - 更精确的判断逻辑
                let filterLifeType = '';
                
                // 1. 优先匹配明确的滤芯寿命标识
                const filterLifeMatch = nonStandardData.match(/滤芯寿命(流量|时间)|寿命类型(流量|时间)/i);
                if (filterLifeMatch) {
                    filterLifeType = filterLifeMatch[1] || filterLifeMatch[2];
                    if (filterLifeType === '流量') {
                        document.getElementById('filterLifeType').value = '1';
                    } else if (filterLifeType === '时间') {
                        document.getElementById('filterLifeType').value = '0';
                    }
                } else {
                    // 2. 提取型号数据之后、带数值参数之前的内容用于判断
                    let targetRange = nonStandardData;
                    
                    // 2.1 找到主板型号位置，提取型号之后的内容
                    if (motherboardModel) {
                        const modelIndex = nonStandardData.indexOf(motherboardModel);
                        if (modelIndex !== -1) {
                            targetRange = nonStandardData.substring(modelIndex + motherboardModel.length).trim();
                        }
                    }
                    
                    // 2.2 找到第一个带数值的参数位置，提取数值参数之前的内容
                    // 匹配模式：任意字符 + 数字 + 任意字符（用于识别带数值的参数）
                    const firstNumericParamMatch = targetRange.match(/[^\d]*\d+[^\d]*/);
                    if (firstNumericParamMatch && firstNumericParamMatch.index > 0) {
                        targetRange = targetRange.substring(0, firstNumericParamMatch.index).trim();
                    }
                    
                    // 3. 定义关键词
                    const flowKeywords = ['流量', 'L', '升', 'm³'];
                    const timeKeywords = ['时间', '小时', '分钟', '天', '月', '年'];
                    
                    // 4. 在目标范围内查找关键词
                    let hasFlowKeyword = flowKeywords.some(keyword => targetRange.includes(keyword));
                    let hasTimeKeyword = timeKeywords.some(keyword => targetRange.includes(keyword));
                    
                    // 5. 如果目标范围内没有关键词，尝试在整个非标准数据中查找
                    if (!hasFlowKeyword && !hasTimeKeyword) {
                        hasFlowKeyword = flowKeywords.some(keyword => nonStandardData.includes(keyword));
                        hasTimeKeyword = timeKeywords.some(keyword => nonStandardData.includes(keyword));
                    }
                    
                    // 6. 根据关键词匹配结果设置滤芯寿命类型
                    // 优化：优先考虑目标范围内的关键词，因为这是型号后面直接提到的滤芯类型
                    // 只有在目标范围内没有找到时，才考虑整个文本中的关键词
                    if (hasTimeKeyword) {
                        document.getElementById('filterLifeType').value = '0';
                    } else if (hasFlowKeyword) {
                        document.getElementById('filterLifeType').value = '1';
                    } else if (nonStandardData.includes('时间')) {
                        document.getElementById('filterLifeType').value = '0';
                    } else if (nonStandardData.includes('流量')) {
                        document.getElementById('filterLifeType').value = '1';
                    }
                }
                
                // 解析ICCID起始和结尾（支持换行，匹配所有8986开头的ICCID）
                const iccidRangeMatch = nonStandardData.match(/(8986[0-9A-F]+)\s*到\s*(8986[0-9A-F]+)/i);
                if (iccidRangeMatch && iccidRangeMatch[1] && iccidRangeMatch[2]) {
                    document.getElementById('iccidStart').value = iccidRangeMatch[1];
                    document.getElementById('iccidEnd').value = iccidRangeMatch[2];
                }
                
                // 解析入库数量
                const countMatch = nonStandardData.match(/[（(]\s*(\d+)\s*张[）)]/);
                if (countMatch && countMatch[1]) {
                    document.getElementById('inStockCount').value = countMatch[1];
                }
                
                // 解析通道2脉冲（冷水脉冲）
                const coldPulseMatch = nonStandardData.match(/冷水(?:路)?脉冲(\d+)/);
                if (coldPulseMatch && coldPulseMatch[1]) {
                    document.getElementById('channel2Pulse').value = coldPulseMatch[1];
                }
                
                // 解析通道1脉冲（热水脉冲）
                const hotPulseMatch = nonStandardData.match(/热水脉冲(\d+)/);
                if (hotPulseMatch && hotPulseMatch[1]) {
                    document.getElementById('channel1Pulse').value = hotPulseMatch[1];
                }
                
                // 解析未标明类型的脉冲，自动填充到通道2脉冲
                if (!document.getElementById('channel2Pulse').value && !document.getElementById('channel1Pulse').value) {
                    const pulseMatch = nonStandardData.match(/脉冲(\d+)/);
                    if (pulseMatch && pulseMatch[1]) {
                        document.getElementById('channel2Pulse').value = pulseMatch[1];
                    }
                }
                
                // 解析检修时间
                const maintainTimeMatch = nonStandardData.match(/检修\s*时间：(\d+)|检修(\d+)/);
                if (maintainTimeMatch) {
                    const maintainTime = maintainTimeMatch[1] || maintainTimeMatch[2];
                    if (maintainTime) {
                        document.getElementById('maintainTime').value = maintainTime;
                    }
                }
                
                // 解析制水时间
                const waterTimeMatch = nonStandardData.match(/制水\s*时间：(\d+)|制水(\d+)/);
                if (waterTimeMatch) {
                    const waterTime = waterTimeMatch[1] || waterTimeMatch[2];
                    if (waterTime) {
                        document.getElementById('waterTime').value = waterTime;
                    }
                }
                
                // v4.6: 「冷水费率(0.3)元/升」「冷水费率0.3元/升」→ 小/2通道/冷水老费率（先抓，防被下面的整数匹配抢成 0）
                const coldRateYuanShengMatch = nonStandardData.match(/冷水费率[:：(（]?([\d.]+)[)）]?\s*元\/升/);
                if (coldRateYuanShengMatch && coldRateYuanShengMatch[1]) {
                    document.getElementById('rate2Cold').value = coldRateYuanShengMatch[1];
                }
                const hotRateYuanShengMatch = nonStandardData.match(/热水费率[:：(（]?([\d.]+)[)）]?\s*元\/升/);
                if (hotRateYuanShengMatch && hotRateYuanShengMatch[1]) {
                    document.getElementById('rate1Hot').value = hotRateYuanShengMatch[1];
                }

                // 解析热水费率为大/1通道/热水老费率（跳过「1路」新费率与已被元/升匹配填入的值）
                const hotOldRateMatch = nonStandardData.match(/热水费率(\d+)(?!路)/);
                if (hotOldRateMatch && hotOldRateMatch[1] && !document.getElementById('rate1Hot').value) {
                    document.getElementById('rate1Hot').value = hotOldRateMatch[1];
                }

                // 解析冷水费率为小/2通道/冷水老费率（跳过「2路」新费率与已被元/升匹配填入的值）
                const coldOldRateMatch = nonStandardData.match(/冷水费率(\d+)(?!路)/);
                if (coldOldRateMatch && coldOldRateMatch[1] && !document.getElementById('rate2Cold').value) {
                    document.getElementById('rate2Cold').value = coldOldRateMatch[1];
                }
                
                // 解析冷水费率2路为小/2通道/冷水费率
                const coldRate2Match = nonStandardData.match(/冷水费率2路([\d.]+)元\/升/);
                if (coldRate2Match && coldRate2Match[1]) {
                    document.getElementById('rate2ColdPerLiter').value = coldRate2Match[1];
                }
                
                // v4.6: 「冷水费率(0.3)元/升」已改判归 小/2通道/冷水老费率（见上方元/升匹配），不再填 小/2通道/冷水费率
                
                // 解析热水费率1路为大/1通道/热水费率
                const hotRate1Match = nonStandardData.match(/热水费率1路([\d.]+)元\/升/);
                if (hotRate1Match && hotRate1Match[1]) {
                    document.getElementById('rate1HotPerLiter').value = hotRate1Match[1];
                }
                
                // 解析大/1通道/热水费率元/升（保留原有逻辑）
                const hotRateMatch = nonStandardData.match(/大\/1通道\/热水费率\[元\/升\]([\d.]+)/);
                if (hotRateMatch && hotRateMatch[1]) {
                    document.getElementById('rate1HotPerLiter').value = hotRateMatch[1];
                }
                
                // 解析小/2通道/冷水费率元/升（保留原有逻辑）
                const coldRateMatch = nonStandardData.match(/小\/2通道\/冷水费率\[元\/升\]([\d.]+)/);
                if (coldRateMatch && coldRateMatch[1]) {
                    document.getElementById('rate2ColdPerLiter').value = coldRateMatch[1];
                }
                
                // 解析限制流量
                const limitFlowMatch = nonStandardData.match(/限制流量(\d+)/);
                if (limitFlowMatch && limitFlowMatch[1]) {
                    document.getElementById('singleLimitFlow').value = limitFlowMatch[1];
                }
                
                // 解析浮球
                const floatBallMatch = nonStandardData.match(/浮球(\d+)/);
                if (floatBallMatch && floatBallMatch[1]) {
                    document.getElementById('floatBall').value = floatBallMatch[1];
                }
                
                // 解析单次限制时间
                const limitTimeMatch = nonStandardData.match(/单次限制(\d+)/);
                if (limitTimeMatch && limitTimeMatch[1]) {
                    document.getElementById('singleLimitTime').value = limitTimeMatch[1];
                }
                
                // 解析卡流量
                const cardFlowMatch = nonStandardData.match(/(\d+)M/);
                if (cardFlowMatch && cardFlowMatch[1]) {
                    document.getElementById('cardFlow').value = cardFlowMatch[1];
                }
                
                // 解析单次消费限制，填写到单次限制流量/箱3
                const singleConsumptionLimitMatch = nonStandardData.match(/单次消费限制(\d+)/);
                if (singleConsumptionLimitMatch && singleConsumptionLimitMatch[1]) {
                    document.getElementById('singleLimitFlow').value = singleConsumptionLimitMatch[1];
                }
                
                // 解析单次限制时间
                const singleLimitTimeMatch = nonStandardData.match(/单次限制时间(\d+)/);
                if (singleLimitTimeMatch && singleLimitTimeMatch[1]) {
                    document.getElementById('singleLimitTime').value = singleLimitTimeMatch[1];
                }
                
                // 解析冷水费率2路(X)元/升格式，填写到小/2通道/冷水费率
                const coldRate2WithBracketsMatch = nonStandardData.match(/冷水费率2路\(([\d.]+)\)元\/升/);
                if (coldRate2WithBracketsMatch && coldRate2WithBracketsMatch[1]) {
                    document.getElementById('rate2ColdPerLiter').value = coldRate2WithBracketsMatch[1];
                }
                
                // 解析热水费率1路(X)元/升格式，填写到大/1通道/热水费率
                const hotRate1WithBracketsMatch = nonStandardData.match(/热水费率1路\(([\d.]+)\)元\/升/);
                if (hotRate1WithBracketsMatch && hotRate1WithBracketsMatch[1]) {
                    document.getElementById('rate1HotPerLiter').value = hotRate1WithBracketsMatch[1];
                }
                
                // 解析热水温度，填写到热水 温度
                const hotWaterTempMatch = nonStandardData.match(/热水温度(\d+)|加热最高温(\d+)|加热最高温度(\d+)/);
                if (hotWaterTempMatch) {
                    const hotWaterTemp = hotWaterTempMatch[1] || hotWaterTempMatch[2] || hotWaterTempMatch[3];
                    if (hotWaterTemp) {
                        document.getElementById('hotWaterTemp').value = hotWaterTemp;
                    }
                }
                
                // 解析温度锁定、消毒后等待 - 支持合并和单独出现的情况
                let tempLockValue = '';
                let disinfectionWaitValue = '';
                
                // 匹配合并格式：温度锁定、消毒后等待XXX
                const combinedMatch = nonStandardData.match(/温度锁定、消毒后等待(\d+)/);
                if (combinedMatch && combinedMatch[1]) {
                    document.getElementById('tempLockDisinfectionWait').value = combinedMatch[1];
                } else {
                    // 匹配单独的温度锁定
                    const tempLockMatch = nonStandardData.match(/温度锁定(\d+)/);
                    if (tempLockMatch && tempLockMatch[1]) {
                        tempLockValue = tempLockMatch[1];
                    }
                    
                    // 匹配单独的消毒后等待
                    const disinfectionWaitMatch = nonStandardData.match(/消毒后等待(\d+)/);
                    if (disinfectionWaitMatch && disinfectionWaitMatch[1]) {
                        disinfectionWaitValue = disinfectionWaitMatch[1];
                    }
                    
                    // 如果有单独的值，合并后填写
                    if (tempLockValue || disinfectionWaitValue) {
                        // 如果只有一个有值，使用该值；如果都有值，优先使用温度锁定的值
                        const combinedValue = tempLockValue || disinfectionWaitValue;
                        document.getElementById('tempLockDisinfectionWait').value = combinedValue;
                    }
                }
                
                // 解析消毒持续时间
                const disinfectionDurationMatch = nonStandardData.match(/消毒持续时间(\d+)|消毒持续(\d+)/);
                if (disinfectionDurationMatch) {
                    const disinfectionDuration = disinfectionDurationMatch[1] || disinfectionDurationMatch[2];
                    if (disinfectionDuration) {
                        document.getElementById('disinfectionDuration').value = disinfectionDuration;
                    }
                }
                
                // 解析阀2放水时间[冷、小]：匹配多种格式
                // 匹配格式1：放水时间冷2路6
                // 匹配格式2：冷2路6
                // 匹配格式3：阀2放水时间冷2路6
                let valve2Time = '';
                const valve2TimeMatch = nonStandardData.match(/放水时间冷2路(\d+)/i);
                if (valve2TimeMatch && valve2TimeMatch[1]) {
                    valve2Time = valve2TimeMatch[1];
                    document.getElementById('valve2Time').value = valve2Time;
                }
                
                // 解析阀1放水时间[罐装、大、热]：匹配多种格式
                // 匹配格式1：热1路6
                // 匹配格式2：阀1放水时间热1路6
                // 匹配格式3：放水时间热1路6
                // 匹配格式4：如果没有明确热1路参数，使用冷2路的参数值
                const valve1TimeMatch = nonStandardData.match(/(?:放水时间|阀1放水时间)?热1路(\d+)/i);
                if (valve1TimeMatch && valve1TimeMatch[1]) {
                    document.getElementById('valve1Time').value = valve1TimeMatch[1];
                } else {
                    // 如果没有找到热1路参数，使用冷2路的参数值作为默认值
                    if (valve2Time) {
                        document.getElementById('valve1Time').value = valve2Time;
                    }
                }
                
                // 自动提取标准化信息
                extractData();
            }
            
            // 清空所有数据的函数
            function clearAllData() {
                // 清空Excel数据区域
                document.getElementById('excelData').value = '';
                
                // 清空参数设置区域
                document.getElementById('motherboardModel').value = '';
                document.getElementById('filterLifeType').value = '';
                document.getElementById('channel2Pulse').value = '';
                document.getElementById('channel1Pulse').value = '';
                document.getElementById('waterTime').value = '';
                document.getElementById('valve2Time').value = '';
                document.getElementById('valve1Time').value = '';
                document.getElementById('maintainTime').value = '';
                document.getElementById('rate1Hot').value = '';
                document.getElementById('rate2Cold').value = '';
                document.getElementById('rate1HotPerLiter').value = '';
                document.getElementById('rate2ColdPerLiter').value = '';
                document.getElementById('singleLimitFlow').value = '';
                document.getElementById('waterWaitTime').value = '';
                document.getElementById('waterPauseTime').value = '';
                document.getElementById('floatBall').value = '';
                document.getElementById('singleLimitTime').value = '';
                document.getElementById('cardFlow').value = '';
                document.getElementById('hotWaterTemp').value = '';
                document.getElementById('coolStartTemp').value = '';
                document.getElementById('tempLockDisinfectionWait').value = '';
                document.getElementById('disinfectionDuration').value = '';
                document.getElementById('iccidStart').value = '';
                document.getElementById('iccidEnd').value = '';
                document.getElementById('inStockCount').value = '';
                
                // 清空结果显示区域
                document.getElementById('result').textContent = '';
            }
            
            // ==================================================================
            // 📷 生产订单图片识别（OCR → 解析 → 自动填充参数）—— 入库参数生成器扩展
            // OCR 引擎：tesseract.js@5 CDN 懒加载（chi_sim+eng），识别文本可人工修正后二次解析
            // v2：针对真实 OCR 乱码加固 —— 全角/Cyrillic 归一化、去空格、勾选框前缀判定、
            //     模糊词匹配（流量→流室、路→像）、识别不出时状态条提示（不再 alert 卡死）
            // === ORDER_PARSE_BEGIN ===
            // 文本归一化：全角→半角、形近字映射、去空格（保留换行）
            function normalizeOrderText(text) {
                var map = {
                    '：': ':', '；': ';', '（': '(', '）': ')', '【': '[', '】': ']',
                    '《': '(', '》': ')', '［': '[', '］': ']', '｜': '|',
                    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
                    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
                    'З': '3', 'з': '3', 'О': '0', 'о': '0', '〇': '0'
                };
                var out = '';
                var t = String(text == null ? '' : text);
                for (var i = 0; i < t.length; i++) {
                    var ch = t.charAt(i);
                    out += (map[ch] !== undefined ? map[ch] : ch);
                }
                return out.replace(/[ \u3000]/g, '');
            }

            // 订单文本解析核心（纯函数，可脱离 DOM 单测）：输入 OCR 原文，输出字段表
            function parseOrderTextCore(text) {
                var t = normalizeOrderText(text);
                // OCR 常见错字预修复（向下兼容：干净原文原样通过，仅乱码受影响）
                t = t.replace(/(?<!厂)商账号/g, '厂商账号');                     // 厂字被吞：商账号:1153
                t = t.replace(/厂商[^:：\n]{0,4}(?=[:：])/g, '厂商账号');        // 厂商贤吏: → 厂商账号:
                t = t.replace(/名苑/g, '名称');                                 // 名称→名苑
                t = t.replace(/(微信|征信)[^:：\n]{0,6}[:：]/g, '微信公众号名称:'); // 微信→征信 错字 // 微信&众日花: → 微信公众号名称:
                t = t.replace(/六司名称/g, '公司名称');                          // 公司名称 → 六司名称
                var F = { filled: [], missing: [], warnings: [] };

                function grab(re, key, label, isNum) {
                    var m = t.match(re);
                    var v = m && m[1] ? m[1].trim() : '';
                    if (v && isNum) v = v.replace(/[Oo]/g, '0'); // OCR 把 0 认成字母 O/o（数值参数不含字母，统一纠正）
                    if (v) { F[key] = v; F.filled.push(label); } else { F.missing.push(label); }
                    return v;
                }

                grab(/(?:公司|司)名称[:]?([^\n]*?)(?=\n|微信公众号名称|微信公众号|厂商账号|产品型号)/, 'company', '公司名称');
                grab(/微信[^:\n]{0,6}[:]?([^\n]*?)(?=\n|厂商账号|产品型号|$)/, 'wechat', '微信公众号名称');
                grab(/厂商账号[:]?([A-Za-z0-9]+)/, 'vendorId', '厂商账号');
                grab(/产品型号[:]?_?\s*([^\n]*?)(?=\n|$|产品数量|产品类型|厂商账号|微信公众号名称|下单时间|业务员|备注|定制程序|域名地址|入库方式|云平台|常规参数|特别参数|配线|天线|物联网卡|灌装|氢水|滤芯寿命|脉冲)/, 'model', '产品型号'); // 型号可含中文(宇泉定制)，遇到下一字段标签/换行/行尾为止
                // 型号中文后缀裁剪：保留"宇泉定制"类定制方名（后面无字母数字粘行、不含注记词）；剔除 OCR 粘连的手写注记（定制TDS改浮球(24V门锁)/单出水/贴片天线等）
                if (F.model) {
                    var mm = F.model.match(/^([\s\S]*?)([\u4e00-\u9fa5]+)([\s\S]*)$/);
                    if (mm && mm[2] && mm[2].length >= 2) { // 单字中文(如连字符错字"一")不裁
                        var suspicious = /TDS|改|浮球|门锁|单出水|单进水|贴片|天线|蘑菇|吸盘|排线|并线|电源线|模块|探头|喇叭|屏蔽|灌装|氢水|卡号|IMEI|定制程序/.test(mm[2]);
                        var glued = /[A-Za-z0-9(（]/.test(mm[3]);
                        if (suspicious || glued) F.model = mm[1].replace(/[—\-~]+$/, '');
                    }
                }
                grab(/产品数量[:]?[^\dOo\n]{0,2}([\dOo]+)/, 'count', '产品数量', true);
                // 脉冲：容忍 路→像 等错字与 (C1000 类括号杂讯
                grab(/冷水2[^0-9Oo\n]{0,6}?([\dOo]{2,})/, 'channel2Pulse', '冷水2路脉冲', true);
                grab(/(?:热|熠|烈)水?1[^0-9Oo\n]{0,6}?([\dOo]{2,})/, 'channel1Pulse', '热水1路脉冲', true); // 容 热→熠/烈 错字、"热1路脉冲"无水字形态
                grab(/启动流量计脉冲[:：]?\s*([\dOo]+)/, 'startFlowPulse', '启动流量计脉冲', true);
                grab(/氢水流量计脉冲[:：]?\s*([\dOo]+)/, 'hydrogenFlowPulse', '氢水流量计脉冲', true);
                grab(/放水时间:?冷2路[(]?\s*([\dOo]+)/, 'valve2', '放水时间冷2路', true);
                grab(/放水时间:?热1路[(]?\s*([\dOo]+)/, 'valve1', '放水时间热1路', true);
                grab(/制水时间:?[(]?([\dOo]+)/, 'waterTime', '制水时间', true);
                grab(/(?<!阀)检修时间:?[(]?([\dOo]+)/, 'maintainTime', '检修时间', true); // 排除「水壶进水阀检修时间」
                grab(/加热最高温度:?[(]?([\dOo]+)/, 'hotWaterTemp', '加热最高温度', true);
                grab(/制冷启动温度:?[(]?([\dOo]+)/, 'coolStartTemp', '制冷启动温度', true);
                grab(/[浮涛泊]球[(]\s*([\dOo]+)\s*[)lI|｜）]/, 'floatBall', '浮球', true); // 闭合括号限定，防「改浮球(24V门锁)」手写注记
                grab(/(?:单|卑)次限制流量:?[(]?([\dOo]+)/, 'singleLimitFlow', '单次限制流量', true);
                grab(/取水等待时间:?[(]?([\dOo]+)/, 'waterWait', '取水等待时间', true);
                grab(/取水暂停等待时间:?[(]?([\dOo]+)/, 'waterPause', '取水暂停等待时间', true);
                grab(/(?:单|卑)次限制时间:?[(]?([\dOo]+)/, 'singleLimitTime', '单次限制时间', true);
                grab(/水费率2路[(]?([\dOo.]+)/, 'rate2', '冷水费率2路', true); // 容 冷→识 错字
                grab(/水费率1路[(]?([\dOo.]+)/, 'rate1', '热水费率1路', true);
                // 老费率（mL 计费）：「热水费率(7500)mL」「冷水费率(0)」——带"1路/2路"后缀的是新费率（元/升），不会被这两条误抓
                grab(/热水费率[:]?[(]([\dOo.]+)/, 'rate1Hot', '热水老费率', true);
                grab(/冷水费率[:]?[(]([\dOo.]+)/, 'rate2Cold', '冷水老费率', true);
                // v4.6: 带「元/升」后缀形态（冷水费率0.3元/升 / 冷水费率:0.3元/升 / 冷水费率(0.3)元/升）→ 强制归老费率
                // 放在无单位 grab 之后：只要文中出现 X元/升 形态，后抓覆盖以其为准；[元/升] 前置形态（费率[元/升]0.5）不受影响
                grab(/冷水费率[:：(（]?\s*([\dOo.]+)\s*[)）]?\s*元\s*\/\s*升/, 'rate2Cold', '冷水老费率', true);
                grab(/热水费率[:：(（]?\s*([\dOo.]+)\s*[)）]?\s*元\s*\/\s*升/, 'rate1Hot', '热水老费率', true);
                grab(/消毒后等待时间:?[(]?([\dOo]+)/, 'disinfectionWait', '消毒后等待时间', true);
                grab(/消毒持续时间:?[(]?([\dOo]+)/, 'disinfectionDuration', '消毒持续时间', true);

                // 「制水时间:0」多为 OCR 把空括号()认成 0（真实表单不会填 0）→ 弃用防误填
                if (F.waterTime === '0') {
                    delete F.waterTime;
                    var _wi = F.filled.indexOf('制水时间');
                    if (_wi !== -1) { F.filled.splice(_wi, 1); F.missing.push('制水时间'); }
                }
                // 数值有效性：放水/制水时间 0 开头（空括号被认成 0/01）、费率非正数或畸形（0.5 被认成 0.0/0.b）→ 不填交人工
                ['valve2', 'valve1', 'waterTime'].forEach(function (k) {
                    if (F[k] && /^0/.test(F[k])) {
                        var _lb = { valve2: '放水时间冷2路', valve1: '放水时间热1路', waterTime: '制水时间' }[k];
                        delete F[k];
                        var _fi = F.filled.indexOf(_lb);
                        if (_fi !== -1) { F.filled.splice(_fi, 1); F.missing.push(_lb); }
                    }
                });
                ['rate2', 'rate1'].forEach(function (k) {
                    if (F[k]) { F[k] = F[k].replace(/\.+$/, ''); }
                    if (F[k] && (!/^\d+(\.\d+)?$/.test(F[k]) || parseFloat(F[k]) <= 0)) {
                        var _lb2 = k === 'rate2' ? '冷水费率2路' : '热水费率1路';
                        delete F[k];
                        var _fi2 = F.filled.indexOf(_lb2);
                        if (_fi2 !== -1) { F.filled.splice(_fi2, 1); F.missing.push(_lb2); }
                    }
                });
                if (F.singleLimitTime && /[Oo]/.test(F.singleLimitTime)) F.singleLimitTime = F.singleLimitTime.replace(/[Oo]/g, '0');

                // 滤芯寿命：勾选框前缀判定（OCR 把 ☑ 认成 2З/[ /R 等也能认；口/□/0/O = 空框）
                F.filterLife = detectFilterLife(t);
                if (F.filterLife) F.filled.push('滤芯寿命(' + (F.filterLife === '0' ? '时间' : '流量') + ')');
                else { F.missing.push('滤芯寿命'); F.warnings.push('滤芯寿命勾选未识别，请在表单手工选择后再点「提取数据」'); }

                // 云平台：勾选框前缀判定 + 行上下文（跃龙1.0/2.0/3.0/客户私有/华码）
                F.platform = detectOrderPlatform(t);
                if (F.platform) F.filled.push('云平台(' + F.platform + ')');
                else { F.missing.push('云平台'); F.warnings.push('云平台勾选未识别，请手工选择下拉框后重新点解析'); }

                return F;
            }

            // 双渠道交叉互补：主渠道缺失字段从副渠道补（与批量脚本 order_resolver.js 同逻辑）
            function mergeOrderFields(F, FS, otherName) {
                if (!FS) return F;
                var LABELS = { company: '公司名称', wechat: '微信公众号名称', vendorId: '厂商账号', model: '产品型号', count: '产品数量', channel2Pulse: '冷水2路脉冲', channel1Pulse: '热水1路脉冲', waterTime: '制水时间', valve2: '放水时间冷2路', valve1: '放水时间热1路', maintainTime: '检修时间', hotWaterTemp: '加热最高温度', coolStartTemp: '制冷启动温度', floatBall: '浮球', singleLimitFlow: '单次限制流量', waterWait: '取水等待时间', waterPause: '取水暂停等待时间', singleLimitTime: '单次限制时间', rate2: '冷水费率2路', rate1: '热水费率1路', rate1Hot: '热水老费率', rate2Cold: '冷水老费率', startFlowPulse: '启动流量计脉冲', hydrogenFlowPulse: '氢水流量计脉冲', disinfectionWait: '消毒后等待时间', disinfectionDuration: '消毒持续时间', filterLife: '滤芯寿命', platform: '云平台' };
                var mergedKeys = [];
                Object.keys(LABELS).forEach(function (k) {
                    if ((F[k] === undefined || F[k] === '') && FS[k] !== undefined && FS[k] !== '') {
                        F[k] = FS[k];
                        mergedKeys.push(LABELS[k]);
                        var lb = LABELS[k];
                        var mi = F.missing.indexOf(lb);
                        if (mi >= 0) F.missing.splice(mi, 1);
                        var disp = String(FS[k]);
                        if (k === 'filterLife') disp = '滤芯寿命(' + (FS[k] === '0' ? '时间' : '流量') + ')';
                        if (k === 'platform') disp = '云平台(' + FS[k] + ')';
                        F.filled.push(disp + '<' + otherName + '补>');
                        F.warnings.push(lb + ' 主渠道未识别，已从' + otherName + '补（建议人工核对）');
                        if (k === 'filterLife') F.warnings = F.warnings.filter(function (w) { return w.indexOf('滤芯寿命勾选未识别') === -1; });
                        if (k === 'platform') F.warnings = F.warnings.filter(function (w) { return w.indexOf('云平台勾选未识别') === -1; });
                    }
                });
                F.mergedKeys = mergedKeys;
                return F;
            }

            // 滤芯寿命勾选识别：在「寿命」后的窗口内找 时间/流量（模糊错字），看前缀字符
            function detectFilterLife(t) {
                var ctxM = t.match(/寿命[:]?([\s\S]{0,14})/);
                if (!ctxM) return '';
                var ctx = ctxM[1];
                var BOX = '口□Oo0Оо〇↵⏎DU';
                var CONTENT = /[A-Za-z0-9√☑☒☐■✓✔回团因四囚囗囬区冈RVv]/;
                var SEP = ':;|、,，.。\\/"\'，。《》~-—_';
                var defs = [
                    { re: /时[间司]/, key: '0', name: '时间' },
                    { re: /流[量室置]/, key: '1', name: '流量' }
                ];
                var checked = [], unchecked = 0;
                defs.forEach(function (d) {
                    var m = ctx.match(d.re);
                    if (!m) return; // 该项未出现在识别文本中
                    var idx = m.index;
                    var prev = idx > 0 ? ctx.charAt(idx - 1) : '';
                    if (BOX.indexOf(prev) !== -1) { unchecked++; return; }        // 空框
                    if (CONTENT.test(prev)) { checked.push(d); return; }          // 有杂字符/对勾 → 已勾选
                    if (SEP.indexOf(prev) !== -1) return;                          // 分隔符 → 无法判断
                    // 其它 CJK 字符（如「时间流量」连写时流量前是间）→ 无法判断
                    unchecked++; // 视作未提供有效勾选信息
                });
                if (checked.length === 1) return checked[0].key;
                if (checked.length === 2) return ''; // 两个都判定勾选 → 矛盾，人工处理
                return '';
            }

            // 云平台勾选识别：长词优先找关键词出现点（掩码防子串），看前缀字符定勾选，行标签定归属
            function detectOrderPlatform(t) {
                var BOX = '口□Oo0Оо〇↵⏎DU';
                var SEP = ':;|,：；，';
                var rows = [
                    { re: /跃龙\s*1[.。,，!lI|]?\s*0/, kws: [['公有售水机有域名', '跃龙公有售水机'], ['有售水机有域名', '跃龙公有售水机'], ['公有售水机', '跃龙公有售水机'], ['有售水机', '跃龙公有售水机'], ['新公有有域名', '跃龙新公有'], ['新公有', '跃龙新公有'], ['公有有域名', '跃龙公有'], ['新私有', '跃龙新私有'], ['私有', '跃龙私有'], ['公有', '跃龙公有']] },
                    { re: /跃龙\s*2[.。,，!lI|]?\s*0/, kws: [['公有', '2.0公有'], ['私有', '2.0私有']] },
                    { re: /跃龙\s*[38][.。,，!lI|]?\s*0/, kws: [['公有', '3.0公有'], ['私有', '3.0私有']] },
                    { re: /客户私有平台/, kws: [['客户私有平台', '客户私有平台']] },
                    { re: /华码/, kws: [['华码公有', '华码公有'], ['华码私有', '华码私有'], ['公有', '华码公有'], ['私有', '华码私有']] }
                ];
                // 收集所有行标签出现点，按位置切段；每行只在自己标签开始的段内找关键词，避免跨行抢占同名词
                var labels = [];
                rows.forEach(function (r) {
                    var re = new RegExp(r.re.source, 'g'), m;
                    while ((m = re.exec(t)) !== null) labels.push({ row: r, idx: m.index });
                });
                labels.sort(function (a, b) { return a.idx - b.idx; });
                var hits = [], sepHits = [];
                labels.forEach(function (L, li) {
                    var seg = t.slice(L.idx, li + 1 < labels.length ? labels[li + 1].idx : t.length);
                    var base = L.idx, masked = [];
                    L.row.kws.slice().sort(function (a, b) { return b[0].length - a[0].length; }).forEach(function (kv) {
                        var from = 0, idx;
                        while ((idx = seg.indexOf(kv[0], from)) !== -1) {
                            var overlap = masked.some(function (s) { return idx < s.end && idx + kv[0].length > s.start; });
                            if (!overlap) {
                                var prev = idx > 0 ? seg.charAt(idx - 1) : (base > 0 ? t.charAt(base - 1) : '');
                                var isCJK = /[\u4e00-\u9fff]/.test(prev);
                                var dom = kv[0].indexOf('域名') !== -1;
                                if (BOX.indexOf(prev) === -1 && SEP.indexOf(prev) === -1 && !(isCJK && dom)) {
                                    hits.push({ val: kv[1], idx: base + idx });
                                } else if (SEP.indexOf(prev) !== -1) {
                                    // 勾选符被云端 OCR 丢弃（冒号后直接跟关键词，如腾讯云「[Lr]:公有售水机」）→ 记为弱候选
                                    sepHits.push({ val: kv[1], idx: base + idx });
                                }
                                masked.push({ start: idx, end: idx + kv[0].length });
                            }
                            from = idx + 1;
                        }
                    });
                });
                if (!hits.length) {
                    // 勾选符全丢时的兜底：仅当弱候选取值唯一才采用，避免瞎猜
                    if (sepHits.length) {
                        var vals = [];
                        sepHits.forEach(function (x) { if (vals.indexOf(x.val) === -1) vals.push(x.val); });
                        if (vals.length === 1) return vals[0];
                    }
                    return '';
                }
                hits.sort(function (a, b) { return a.idx - b.idx; });
                return hits[0].val;
            }

            // === ORDER_PARSE_END ===

            var __orderImageDataUrl = '';
            var __orderTessLoading = false;

            function orderSetStatus(msg, isErr) {
                var el = document.getElementById('orderOcrStatus');
                if (el) { el.textContent = msg; el.style.color = isErr ? '#e74c3c' : '#555'; }
            }

            function orderSetStatusHTML(html) {
                var el = document.getElementById('orderOcrStatus');
                if (el) { el.innerHTML = html; el.style.color = '#555'; }
            }

            // 识别完成状态：蓝字=已识别字段、红字=未识别字段
            function orderOcrDoneStatus(txt, engineName) {
                var F0 = parseOrderTextCore(txt || '');
                var okPart = '<span style="color:#2b6cf6;font-weight:600;">识别到：' + (F0.filled.length ? F0.filled.join('、') : '（无）') + '</span>';
                var missPart = F0.missing.length ? '<span style="color:#e74c3c;">　未识别：' + F0.missing.join('、') + '</span>' : '';
                orderSetStatusHTML('✅ ' + engineName + '识别完成！' + okPart + missPart + '<span style="color:#888;">　请核对/修正文字，再点「⚡ 解析并填充参数」</span>');
            }

            function handleOrderImageFile(file) {
                if (!file) return;
                if (file.type && file.type.indexOf('image') !== 0) { alert('请选择图片文件（jpg/png 等）'); return; }
                var reader = new FileReader();
                reader.onload = function (e) {
                    __orderImageDataUrl = e.target.result;
                    var img = document.getElementById('orderImagePreview');
                    var wrap = document.getElementById('orderImagePreviewWrap');
                    if (img && wrap) { img.src = __orderImageDataUrl; wrap.style.display = 'block'; }
                    orderSetStatus('✅ 图片已就绪（约 ' + Math.round(file.size / 1024) + 'KB），点击「🔍 识别图片文字」开始识别');
                };
                reader.readAsDataURL(file);
                var inp = document.getElementById('orderImageInput');
                if (inp) inp.value = ''; // 允许重复选择同一张图
            }

            // 图片预处理：放大 + 灰度 + 对比度拉伸（提升 OCR 命中率）；失败时退回原图
            function preprocessOrderImage(dataUrl, cb) {
                var img = new Image();
                img.onload = function () {
                    try {
                        // 大图（≥1200px）直接把原图交给 OCR：实测 canvas 重编码（低质量插值+JPEG 压缩）会把表单小字糊掉，导致只认出大字行
                        if (img.width >= 1200) { cb(dataUrl); return; }
                        // 小图放大 2x 帮助识别：高质量插值 + 灰度 + 对比度拉伸 + 无损 PNG
                        var scale = 2;
                        var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
                        var cv = document.createElement('canvas');
                        cv.width = w; cv.height = h;
                        var ctx = cv.getContext('2d');
                        ctx.imageSmoothingEnabled = true;
                        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, w, h);
                        ctx.drawImage(img, 0, 0, w, h);
                        var d = ctx.getImageData(0, 0, w, h), px = d.data;
                        var min = 255, max = 0, i, g;
                        var gray = new Float64Array(w * h);
                        for (i = 0; i < px.length; i += 4) {
                            g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
                            gray[i / 4] = g;
                            if (g < min) min = g;
                            if (g > max) max = g;
                        }
                        var range = Math.max(1, max - min);
                        for (i = 0; i < gray.length; i++) {
                            g = Math.max(0, Math.min(255, (gray[i] - min) * 255 / range));
                            px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = g;
                        }
                        ctx.putImageData(d, 0, 0);
                        cb(cv.toDataURL('image/png'));
                    } catch (e) { cb(dataUrl); }
                };
                img.onerror = function () { cb(dataUrl); };
                img.src = dataUrl;
            }

            function loadOrderTesseractLib(cb) {
                if (window.Tesseract) { cb(); return; }
                orderSetStatus('正在加载 OCR 引擎…');
                // 优先本站自托管（国内直连稳），失败再走 jsdelivr；worker/core 同样自托管，仅语言包走 jsdelivr
                var SRCS = [
                    'js/tesseract/tesseract.min.js',
                    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
                ];
                var si = 0;
                (function loadNext() {
                    if (si >= SRCS.length) { orderSetStatus('OCR 引擎加载失败，请检查网络后重试', true); return; }
                    var s = document.createElement('script');
                    s.src = SRCS[si];
                    s.onload = function () { cb(); };
                    s.onerror = function () { si++; loadNext(); };
                    document.head.appendChild(s);
                })();
            }

            // 云渠道显示名（入库参数生成器2 新增接口经 SCF 端点 /ocr_accurate 等；老渠道文案保持原样）
            function orderChanLabel(ch) {
                var M = {
                    baidu_accurate: '百度云·通用文字（高精度版）',
                    tencent_accurate: '腾讯云·通用印刷体（高精度）',
                    tencent_fast: '腾讯云·通用印刷体（高速）',
                    tencent_efficient: '腾讯云·通用印刷体（精简）',
                    tencent_handwriting: '腾讯云·通用印刷体（手写）'
                };
                return M[ch] || (ch === 'tencent' ? '腾讯云' : '百度云');
            }

            // 云渠道短名（互补标题/补源标注用）
            function orderChanShort(ch) {
                var M = { tencent_accurate: '腾讯高精度', baidu_accurate: '百度高精度', tencent: '腾讯云', baidu: '百度云' };
                return M[ch] || orderChanLabel(ch);
            }

            function runOrderOcr() {
                if (!__orderImageDataUrl) { alert('请先上传 / 粘贴 / 拖拽生产订单图片'); return; }
                if (/^file:/i.test(location.protocol)) { orderSetStatus('本地引擎不支持 file:// 直接打开（浏览器安全限制），请访问线上地址使用，或改用云端渠道', true); return; }
                if (__orderTessLoading) { orderSetStatus('识别进行中，请稍候…'); return; }
                var ch = 'local';
                var chSel = document.getElementById('orderOcrChannel');
                if (chSel) ch = chSel.value;
                if (ch !== 'local') {
                    // 云端渠道：复用 🔳 二维码批量识别 的云端代理（百度/腾讯，密钥在代理侧）
                    if (!window.__CloudOCR) { orderSetStatus('云端渠道不可用（qrbatch-init 未加载），请改用本地引擎', true); return; }
                    if (ch === 'both') {
                        // 腾讯+百度互补：并行识别 → 主(腾讯优先)缺副补 → 文本框放双原文供核对，解析时自动合并
                        // v4.5 起互补默认双云高精度（腾讯高精度+百度高精度），可用 __orderBothEngines 钩子覆盖
                        var be = (typeof window.__orderBothEngines === 'function') ? window.__orderBothEngines() : ['tencent_accurate', 'baidu_accurate'];
                        var nA = orderChanLabel(be[0]), nB = orderChanLabel(be[1]);
                        var bothTitle = orderChanShort(be[0]) + '+' + orderChanShort(be[1]);
                        __orderTessLoading = true;
                        orderSetStatus('云端识别中（' + bothTitle + '互补）…');
                        Promise.all([
                            window.__CloudOCR.ocr(__orderImageDataUrl, be[0]).catch(function (e) { return { text: '', error: (e && e.message) || String(e) }; }),
                            window.__CloudOCR.ocr(__orderImageDataUrl, be[1]).catch(function (e) { return { text: '', error: (e && e.message) || String(e) }; })
                        ]).then(function (rs) {
                            __orderTessLoading = false;
                            var tT = (rs[0].text || '').trim(), tB = (rs[1].text || '').trim();
                            var eT = rs[0].error, eB = rs[1].error;
                            var show = '';
                            if (tT && tB) show = '【' + nA + '】\n' + tT + '\n\n――― ' + nB + ' ―――\n' + tB;
                            else show = tT || tB;
                            var ta = document.getElementById('orderOcrText');
                            var wrap = document.getElementById('orderOcrTextWrap');
                            if (ta) ta.value = show;
                            if (wrap) wrap.style.display = show ? 'block' : 'none';
                            if (!show) { orderSetStatus('⚠️ 两渠道均未识别到文字' + ((eT || eB) ? '（' + (eT || eB) + '）' : '') + '，可手工粘贴订单文字', true); return; }
                            window.__orderDual = { shown: show, primaryText: tT || tB, secondaryText: (tT && tB) ? tB : null, otherName: tT ? orderChanShort(be[1]) : orderChanShort(be[0]) };
                            // 完成状态：互补合并后的字段蓝/红展示
                            var Fm = parseOrderTextCore(tT || tB);
                            mergeOrderFields(Fm, (tT && tB) ? parseOrderTextCore(tB) : null, tT ? orderChanShort(be[1]) : orderChanShort(be[0]));
                            var okPart = '<span style="color:#2b6cf6;font-weight:600;">识别到：' + (Fm.filled.length ? Fm.filled.join('、') : '（无）') + '</span>';
                            var supPart = (Fm.mergedKeys && Fm.mergedKeys.length) ? '<span style="color:#2b8a3e;font-weight:600;">　〔互补补充: ' + Fm.mergedKeys.join('、') + '〕</span>' : '';
                            var missPart = Fm.missing.length ? '<span style="color:#e74c3c;">　未识别：' + Fm.missing.join('、') + '</span>' : '';
                            orderSetStatusHTML('✅ ' + bothTitle + '互补识别完成！' + okPart + supPart + missPart + '<span style="color:#888;">　请核对/修正文字，再点「⚡ 解析并填充参数」</span>');
                            // 识别完成钩子（入库参数生成器2：自动解析填充 + 下拉 500px；1 号未定义钩子不受影响）
                            if (typeof window.__orderAutoParse === 'function') window.__orderAutoParse();
                        });
                        return;
                    }
                    __orderTessLoading = true;
                    orderSetStatus('云端识别中（' + orderChanLabel(ch) + '）…');
                    window.__CloudOCR.ocr(__orderImageDataUrl, ch).then(function (r) {
                        __orderTessLoading = false;
                        var ta = document.getElementById('orderOcrText');
                        var wrap = document.getElementById('orderOcrTextWrap');
                        if (ta) ta.value = r.text;
                        if (wrap) wrap.style.display = r.text ? 'block' : 'none';
                        if (r.text) {
                            orderOcrDoneStatus(r.text, orderChanLabel(ch));
                            // 识别完成钩子（入库参数生成器2：自动解析填充 + 下拉 500px；1 号未定义钩子不受影响）
                            if (typeof window.__orderAutoParse === 'function') window.__orderAutoParse();
                        }
                        else orderSetStatus('⚠️ 云端未识别到文字，可换渠道或手工粘贴订单文字', true);
                    }).catch(function (err) {
                        __orderTessLoading = false;
                        orderSetStatus('云端识别失败：' + (err && err.message ? err.message : err) + '（可换一个渠道重试）', true);
                    });
                    return;
                }
                loadOrderTesseractLib(function () {
                    __orderTessLoading = true;
                    orderSetStatus('图片预处理中…');
                    preprocessOrderImage(__orderImageDataUrl, function (procUrl) {
                        orderSetStatus('正在加载中文识别模型（首次约 5~15MB，视网速 10~60 秒，之后有缓存）…');
                        // 语言模型多源下载：默认源 tessdata.projectnaptha.com 国内常连不上导致卡 0%，优先 jsdelivr 镜像，90 秒无响应自动换源
                        var LANG_PATHS = [
                            'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0',
                            'https://tessdata.projectnaptha.com/4.0.0'
                        ];
                        var loggerFn = function (m) {
                            if (m && m.status && m.progress != null) orderSetStatus('识别中：' + m.status + ' ' + Math.round(m.progress * 100) + '%');
                        };
                        (function trySource(pi) {
                            if (pi >= LANG_PATHS.length) {
                                __orderTessLoading = false;
                                orderSetStatus('识别失败：中文模型两个源都下载失败，请检查网络或挂代理后重试', true);
                                return;
                            }
                            if (pi > 0) orderSetStatus('语言模型源无响应，切换备用源(' + (pi + 1) + '/' + LANG_PATHS.length + ')重试…', true);
                            var settled = false;
                            var watchdog = setTimeout(function () {
                                if (settled) return;
                                settled = true;
                                trySource(pi + 1);
                            }, 90000);
                            function settle() { if (!settled) { settled = true; clearTimeout(watchdog); } }
                            function finish(ok, txt, errMsg) {
                                settle();
                                __orderTessLoading = false;
                                if (!ok) {
                                    var m = String(errMsg || '未知错误');
                                    if (/SetVariable|wasm|worker|importScripts/i.test(m)) {
                                        m += '（本地引擎与当前浏览器环境不兼容：请改用云端渠道（百度云/腾讯云），或换 Chrome/Edge 浏览器）';
                                    }
                                    orderSetStatus('识别失败：' + m, true);
                                    return;
                                }
                                txt = (txt || '').trim();
                                var ta = document.getElementById('orderOcrText');
                                var wrap = document.getElementById('orderOcrTextWrap');
                                if (ta) ta.value = txt;
                                if (wrap) wrap.style.display = txt ? 'block' : 'none';
                                if (txt) {
                                    orderOcrDoneStatus(txt, ch === 'tencent' ? '腾讯云' : (ch === 'baidu' ? '百度云' : '本地引擎'));
                                    // 识别完成钩子（入库参数生成器2：自动解析填充 + 下拉 500px；1 号未定义钩子不受影响）
                                    if (typeof window.__orderAutoParse === 'function') window.__orderAutoParse();
                                } else {
                                    orderSetStatus('⚠️ 未识别到文字，请换更清晰的图片或手工粘贴订单文字', true);
                                }
                            }
                            // worker/wasm 内核自托管；corePath 钉死到具体文件（目录形式 worker 会按 oem 拼 -lstm 变体名导致 404）
                            // 内核加载失败（SetVariable/wasm/worker 类错误）自动切换 jsdelivr 备源重建一次，仍失败才走换语言包源/报错
                            var __tessBase = location.origin + location.pathname.replace(/[^/]*$/, '');
                            var __tessAltBase = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/';
                            function makeTessWorker(wp, cp, firstErr) {
                                return window.Tesseract.createWorker('chi_sim+eng', 1, { logger: loggerFn, langPath: LANG_PATHS[pi], workerPath: wp, corePath: cp }).catch(function (e) {
                                    if (settled) return null;
                                    if (!firstErr) {
                                        orderSetStatus('本站引擎内核加载失败，自动切换备用源重试…', true);
                                        return makeTessWorker(__tessAltBase + 'worker.min.js', __tessAltBase + 'tesseract-core-simd.wasm.js', e);
                                    }
                                    throw firstErr;
                                });
                            }
                            makeTessWorker(__tessBase + 'js/tesseract/worker.min.js', __tessBase + 'js/tesseract/tesseract-core-simd.wasm.js', null).then(function (w) {
                                if (!w) return; // 已 settled（超时/用户中断）
                                function dense(s) { return (s || '').replace(/\s+/g, '').length; }
                                function rec(psm) {
                                    return w.setParameters({ tessedit_pageseg_mode: String(psm) }).then(function () { return w.recognize(procUrl); })
                                        .then(function (res) { return (res && res.data && res.data.text ? res.data.text : ''); });
                                }
                                rec(3).then(function (t3) {
                                    var best = t3;
                                    if (dense(best) >= 150) return best;
                                    // 版面分割偶然失败（只认出零星几行）→ 自动换分割模式重试，取字数最多的一版
                                    orderSetStatus('版面分割不佳，自动换分割模式重试…');
                                    return rec(4).then(function (t4) {
                                        if (dense(t4) > dense(best)) best = t4;
                                        if (dense(best) >= 150) return best;
                                        return rec(11).then(function (t11) { return dense(t11) > dense(best) ? t11 : best; });
                                    });
                                }).then(function (txt) {
                                    try { w.terminate(); } catch (e2) {}
                                    finish(true, txt);
                                }).catch(function (err) {
                                    try { w.terminate(); } catch (e2) {}
                                    if (settled) return;
                                    if (pi + 1 < LANG_PATHS.length) { trySource(pi + 1); return; }
                                    finish(false, '', err && err.message ? err.message : err);
                                });
                            }).catch(function (err) {
                                if (settled) return;
                                if (pi + 1 < LANG_PATHS.length) { trySource(pi + 1); return; }
                                finish(false, '', err && err.message ? err.message : err);
                            });
                        })(0);
                    });
                });
            }

            // 解析识别文本并回填表单（空值不覆盖手工输入）；滤芯寿命未识别时不自动生成，避免 alert 卡死
            // 订单解析结果统一回填表单（「解析并填充参数」与「一键转换」订单分支共用）
            function applyOrderParseToForm(F, autoExtract) {
                function setVal(id, v) {
                    var el = document.getElementById(id);
                    if (el && v != null && v !== '') el.value = v;
                }
                // 换单前先清空本批参数框：未识别到的字段留空，不残留上一单数值进标准内容
                ['motherboardModel', 'channel2Pulse', 'channel1Pulse', 'waterTime', 'valve2Time', 'valve1Time',
                 'maintainTime', 'hotWaterTemp', 'coolStartTemp', 'floatBall', 'singleLimitFlow',
                 'waterWaitTime', 'waterPauseTime', 'singleLimitTime', 'rate2ColdPerLiter', 'rate1HotPerLiter',
                 'rate1Hot', 'rate2Cold', 'startFlowPulse', 'hydrogenFlowPulse',
                 'tempLockDisinfectionWait', 'disinfectionDuration', 'inStockCount'].forEach(function (id) {
                    var el = document.getElementById(id);
                    if (el) el.value = '';
                });
                setVal('motherboardModel', F.model);
                setVal('channel2Pulse', F.channel2Pulse);
                setVal('channel1Pulse', F.channel1Pulse);
                setVal('startFlowPulse', F.startFlowPulse);
                setVal('hydrogenFlowPulse', F.hydrogenFlowPulse);
                setVal('waterTime', F.waterTime);
                setVal('valve2Time', F.valve2);
                setVal('valve1Time', F.valve1 || F.valve2); // 与一键转换同规则：热1路缺省回填冷2路
                setVal('maintainTime', F.maintainTime);
                setVal('hotWaterTemp', F.hotWaterTemp);
                setVal('coolStartTemp', F.coolStartTemp);
                setVal('floatBall', F.floatBall);
                setVal('singleLimitFlow', F.singleLimitFlow);
                setVal('waterWaitTime', F.waterWait);
                setVal('waterPauseTime', F.waterPause);
                setVal('singleLimitTime', F.singleLimitTime);
                setVal('rate2ColdPerLiter', F.rate2);
                setVal('rate1HotPerLiter', F.rate1);
                setVal('rate1Hot', F.rate1Hot);
                setVal('rate2Cold', F.rate2Cold);
                setVal('tempLockDisinfectionWait', F.disinfectionWait);
                setVal('disinfectionDuration', F.disinfectionDuration);
                setVal('inStockCount', F.count);

                // 滤芯寿命：识别成功自动选；未识别保留原选择（用户手工选）
                var flSel = document.getElementById('filterLifeType');
                if (F.filterLife && flSel) flSel.value = F.filterLife;

                // 云平台：自动识别优先写入下拉框；未识别时保留用户手工选择
                var ps = document.getElementById('platformSelect');
                if (ps && F.platform) ps.value = F.platform;
                var platform = ps ? ps.value : (F.platform || '');

                // 五要素写入 Excel 数据区（与一键转换同约定：公众号空补公司名、卡类型=无卡类型）
                if (F.company) {
                    // 单行摘要再解析时 company/wechat 无换行边界会带尾逗号，写入前清除
                    var comp = (F.company || '').replace(/[,，、\s]+$/, '');
                    var wx = (F.wechat || comp).replace(/[,，、\s]+$/, '');
                    document.getElementById('excelData').value = [comp, wx, '无卡类型', F.vendorId || '', platform].join('\t');
                } else {
                    // 公司名未识别：五要素整体不可信，清空防上一单残留
                    var ed0 = document.getElementById('excelData');
                    if (ed0) ed0.value = '';
                }
                var blocked = flSel && !flSel.value; // 滤芯寿命仍未确定
                if (autoExtract) extractData(true); // 无论滤芯寿命是否识别，标准内容必须输出（未识别项留空）
                return { blocked: blocked };
            }

            // 非标内容框摘要：单行逗号间隔；固定四项（公司名称/微信公众号名称/厂商账号/云平台）用【】包裹
            function buildOrderExtractText(F) {
                var parts = [], box = [];
                function add(lbl, v) { if (v != null && v !== '') parts.push(lbl + '：' + v); }
                if (F.company) box.push('公司名称：' + F.company);
                if (F.wechat) box.push('微信公众号名称：' + F.wechat);
                box.push('厂商账号：' + (F.vendorId || '')); // 强制出现：为空也占位，提示人工补查
                if (F.platform) box.push('云平台：' + F.platform);
                var head = box.length ? '【' + box.join('，') + '】' : '';
                add('主板型号/产品型号', F.model);
                add('产品数量', F.count);
                if (F.filterLife) parts.push('滤芯寿命：☑' + (F.filterLife === '0' ? '时间' : '流量'));
                add('冷水2路脉冲', F.channel2Pulse);
                add('热水1路脉冲', F.channel1Pulse);
                add('启动流量计脉冲', F.startFlowPulse);
                add('氢水流量计脉冲', F.hydrogenFlowPulse);
                add('制水时间', F.waterTime);
                add('放水时间冷2路', F.valve2);
                add('放水时间热1路', F.valve1);
                add('检修时间', F.maintainTime);
                add('加热最高温度', F.hotWaterTemp);
                add('制冷启动温度', F.coolStartTemp);
                if (F.floatBall) parts.push('浮球(' + F.floatBall + ')');
                add('单次限制流量', F.singleLimitFlow);
                add('取水等待时间', F.waterWait);
                add('取水暂停等待时间', F.waterPause);
                add('单次限制时间', F.singleLimitTime);
                if (F.rate1Hot) parts.push('热水费率(' + F.rate1Hot + ')（老）');
                if (F.rate2Cold) parts.push('冷水费率(' + F.rate2Cold + ')（老）');
                if (F.rate2) parts.push('冷水费率2路(' + F.rate2 + ')'); // 括号形式满足费率正则"路(数值)"
                if (F.rate1) parts.push('热水费率1路(' + F.rate1 + ')');
                add('消毒后等待时间', F.disinfectionWait);
                add('消毒持续时间', F.disinfectionDuration);
                return head + parts.join('，');
            }

            function parseOrderText() {
                var ta = document.getElementById('orderOcrText');
                var raw = ta ? ta.value : '';
                if (!raw.trim()) { alert('识别文本为空，请先识别图片或手工粘贴订单文字'); return; }
                var F = parseOrderTextCore(raw);
                // 互补渠道缓存命中（文本未手工修改）→ 主渠道字段从副渠道补
                var dual = window.__orderDual;
                if (dual && dual.primaryText && raw === dual.shown) {
                    mergeOrderFields(F, dual.secondaryText ? parseOrderTextCore(dual.secondaryText) : null, dual.otherName);
                    window.__orderDual = null;
                }

                // 非标内容框只保留提取结果单行摘要（固定四项【】包裹+按需项），不放 OCR 全文
                var summaryTxt = buildOrderExtractText(F);
                window.__lastOrderSummary = summaryTxt; // 供 convertData 兜底识别摘要格式
                var nsBox = document.getElementById('nonStandardData');
                if (nsBox) nsBox.value = summaryTxt;

                var res = applyOrderParseToForm(F, false);
                var blocked = res.blocked; // 滤芯寿命仍未确定
                var msg = '填充完成 ✅ ' + F.filled.join('、') +
                    (F.missing.length ? ' ｜ 未识别: ' + F.missing.join('、') : '') +
                    (F.warnings.length ? ' ｜ ⚠️ ' + F.warnings.join('；') : '');
                orderSetStatus(msg + (blocked ? ' ｜ 请在上方表单选择「滤芯寿命」后，点「提取数据」生成参数' : ''), F.warnings.length > 0 || blocked);

                // 标准内容必须输出（滤芯寿命未识别时该项留空，状态条仍提示补选）
                extractData(true);
            }

            // 截图粘贴：仅在入库参数生成工具激活时拦截图片粘贴，不影响其他工具
            document.addEventListener('paste', function (e) {
                if (window.currentActiveTool !== 'stockParamTool') return;
                var items = e.clipboardData && e.clipboardData.items;
                if (!items) return;
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type && items[i].type.indexOf('image') === 0) {
                        var f = items[i].getAsFile();
                        if (f) { e.preventDefault(); handleOrderImageFile(f); }
                        break;
                    }
                }
            });

            // 拖拽上传（独立页无 orderDropZone 时自动跳过）
            document.addEventListener('DOMContentLoaded', function () {
                var zone = document.getElementById('orderDropZone');
            try {
                var chSaved = localStorage.getItem('stock_ocr_channel');
                var chSel2 = document.getElementById('orderOcrChannel');
                if (chSaved && chSel2) chSel2.value = chSaved;
            } catch (e2) { }
                if (!zone) return;
                ['dragenter', 'dragover'].forEach(function (ev) {
                    zone.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); zone.style.background = '#eef6ff'; });
                });
                zone.addEventListener('dragleave', function (e) { e.preventDefault(); zone.style.background = '#f8fbff'; });
                zone.addEventListener('drop', function (e) {
                    e.preventDefault(); e.stopPropagation(); zone.style.background = '#f8fbff';
                    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                    if (f) handleOrderImageFile(f);
                });
            });

            // 🖼️ 预览图灯箱：点击放大、滚轮缩放、点空白/ESC 关闭
            (function () {
                var lb = null, lbScale = 1;
                function lbClose() {
                    if (lb && lb.parentNode) lb.parentNode.removeChild(lb);
                    lb = null;
                    document.removeEventListener('keydown', lbKey);
                }
                function lbKey(e) { if (e.key === 'Escape') lbClose(); }
                function lbOpen(src) {
                    if (lb) lbClose();
                    lbScale = 1;
                    lb = document.createElement('div');
                    lb.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
                    var img = document.createElement('img');
                    img.src = src;
                    img.style.cssText = 'max-width:92vw;max-height:92vh;border-radius:6px;box-shadow:0 0 30px rgba(0,0,0,.6);transition:transform .1s ease;cursor:grab;';
                    img.addEventListener('wheel', function (e) {
                        e.preventDefault();
                        lbScale *= (e.deltaY < 0 ? 1.15 : 1 / 1.15);
                        if (lbScale < 0.2) lbScale = 0.2;
                        if (lbScale > 8) lbScale = 8;
                        img.style.transform = 'scale(' + lbScale + ')';
                    }, { passive: false });
                    img.addEventListener('click', function (e) { e.stopPropagation(); });
                    lb.addEventListener('click', function () { lbClose(); });
                    lb.appendChild(img);
                    document.body.appendChild(lb);
                    document.addEventListener('keydown', lbKey);
                }
                document.addEventListener('click', function (e) {
                    var t = e.target;
                    if (t && t.id === 'orderImagePreview' && t.getAttribute('src')) {
                        e.preventDefault();
                        lbOpen(t.getAttribute('src'));
                    }
                }, true);
                document.addEventListener('DOMContentLoaded', function () {
                    var pv = document.getElementById('orderImagePreview');
                    if (pv) { pv.style.cursor = 'zoom-in'; pv.title = '点击放大预览（滚轮缩放，ESC/点空白关闭）'; }
                });
            })();
