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
            function extractData() {
                // 验证滤芯寿命是否已选择
                const filterLifeType = document.getElementById('filterLifeType').value;
                if (!filterLifeType) {
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
                    '制水时间：': document.getElementById('waterTime').value.trim(),
                    '阀2放水时间[冷、小]：': document.getElementById('valve2Time').value.trim(),
                    '阀1放水时间[罐装、大、热]：': document.getElementById('valve1Time').value.trim(),
                    '检修 时间：': document.getElementById('maintainTime').value.trim(),
                    '热水 温度：': document.getElementById('hotWaterTemp').value.trim(),
                    '温度锁定、消毒后等待：': document.getElementById('tempLockDisinfectionWait').value.trim(),
                    '消毒持续时间：': document.getElementById('disinfectionDuration').value.trim(),
                    '大/1通道/热水老费率：': document.getElementById('rate1Hot').value.trim(),
                    '小/2通道/冷水老费率：': document.getElementById('rate2Cold').value.trim(),
                    '大/1通道/热水费率：': document.getElementById('rate1HotPerLiter').value.trim(),
                    '小/2通道/冷水费率：': document.getElementById('rate2ColdPerLiter').value.trim(),
                    '单次限制流量/箱3：': document.getElementById('singleLimitFlow').value.trim(),
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
                    '制水时间：',
                    '阀2放水时间[冷、小]：',
                    '阀1放水时间[罐装、大、热]：',
                    '检修 时间：',
                    '热水 温度：',
                    '温度锁定、消毒后等待：',
                    '消毒持续时间：',
                    '大/1通道/热水老费率：',
                    '小/2通道/冷水老费率：',
                    '大/1通道/热水费率：',
                    '小/2通道/冷水费率：',
                    '单次限制流量/箱3：',
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
                document.getElementById('floatBall').value = '';
                document.getElementById('singleLimitTime').value = '';
                document.getElementById('cardFlow').value = '';
                document.getElementById('iccidStart').value = '';
                document.getElementById('iccidEnd').value = '';
                document.getElementById('inStockCount').value = '';
                document.getElementById('hotWaterTemp').value = '';
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
                
                // 解析热水费率为大/1通道/热水老费率
                const hotOldRateMatch = nonStandardData.match(/热水费率(\d+)/);
                if (hotOldRateMatch && hotOldRateMatch[1]) {
                    document.getElementById('rate1Hot').value = hotOldRateMatch[1];
                }
                
                // 解析冷水费率为小/2通道/冷水老费率
                const coldOldRateMatch = nonStandardData.match(/冷水费率(\d+)/);
                if (coldOldRateMatch && coldOldRateMatch[1]) {
                    document.getElementById('rate2Cold').value = coldOldRateMatch[1];
                }
                
                // 解析冷水费率2路为小/2通道/冷水费率
                const coldRate2Match = nonStandardData.match(/冷水费率2路([\d.]+)元\/升/);
                if (coldRate2Match && coldRate2Match[1]) {
                    document.getElementById('rate2ColdPerLiter').value = coldRate2Match[1];
                }
                
                // 解析冷水费率(0.3)元/升格式为小/2通道/冷水费率
                const coldRateWithBracketsMatch = nonStandardData.match(/冷水费率\(([\d.]+)\)元\/升/);
                if (coldRateWithBracketsMatch && coldRateWithBracketsMatch[1]) {
                    document.getElementById('rate2ColdPerLiter').value = coldRateWithBracketsMatch[1];
                }
                
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
                document.getElementById('floatBall').value = '';
                document.getElementById('singleLimitTime').value = '';
                document.getElementById('cardFlow').value = '';
                document.getElementById('hotWaterTemp').value = '';
                document.getElementById('tempLockDisinfectionWait').value = '';
                document.getElementById('disinfectionDuration').value = '';
                document.getElementById('iccidStart').value = '';
                document.getElementById('iccidEnd').value = '';
                document.getElementById('inStockCount').value = '';
                
                // 清空结果显示区域
                document.getElementById('result').textContent = '';
            }
            