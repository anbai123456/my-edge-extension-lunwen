// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPapers();
    document.getElementById('saveCurrent').addEventListener('click', savePaperInfo);
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);
    document.getElementById('batchDelete').addEventListener('click', batchDelete);
    document.getElementById('searchInput').addEventListener('input', function(e) {
        loadPapers(e.target.value);
    });
});

// 状态消息处理
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    status.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 2000);
    }
}

// 保存论文信息
function savePaperInfo() {
    showStatus('正在获取论文信息...', 'loading');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0].url.includes('cnki.net')) {
            showStatus('请在知网论文页面使用此功能', 'error');
            return;
        }

        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            files: ['content.js']
        }).then(() => {
            setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, {action: "clickQuoteButton"}, function(response) {
                    if (chrome.runtime.lastError) {
                        showStatus('获取信息失败: ' + chrome.runtime.lastError.message, 'error');
                        return;
                    }
                    
                    if (response && response.paperInfo) {
                        const paperInfo = response.paperInfo;
                        if (!paperInfo.citation) {
                            showStatus('未能获取引用信息', 'error');
                            return;
                        }
                        
                        chrome.storage.local.get(['papers'], function(result) {
                            let papers = result.papers || [];
                            // 检查是否已存在相同URL的论文
                            if (papers.some(p => p.url === paperInfo.url)) {
                                showStatus('该论文已存在列表中', 'error');
                                return;
                            }
                            paperInfo.favorite = false; // 新增收藏字段
                            papers.unshift(paperInfo);
                            chrome.storage.local.set({papers: papers}, function() {
                                showStatus('保存成功！', 'success');
                                loadPapers();
                                window.close(); // 保存成功后立即关闭弹窗
                            });
                        });
                    } else {
                        showStatus('获取信息失败', 'error');
                    }
                });
            }, 500);
        }).catch(error => {
            showStatus('注入脚本失败: ' + error.message, 'error');
        });
    });
}

// 删除论文
function deletePaper(url) {
    chrome.storage.local.get(['papers'], function(result) {
        let papers = result.papers || [];
        papers = papers.filter(p => p.url !== url);
        chrome.storage.local.set({papers: papers}, function() {
            showStatus('删除成功！', 'success');
            loadPapers();
        });
    });
}

let allPapersCache = [];

function loadPapers(filter = '') {
    const paperList = document.getElementById('paperList');
    paperList.innerHTML = '';
    chrome.storage.local.get(['papers'], function(result) {
        let papers = result.papers || [];
        allPapersCache = papers;
        // 收藏的排在最前面
        papers = papers.slice().sort((a, b) => (b.favorite === true) - (a.favorite === true));
        // 搜索过滤
        if (filter) {
            const kw = filter.trim().toLowerCase();
            papers = papers.filter(paper => {
                const title = (paper.title || '').replace(/"/g, '').toLowerCase();
                const authors = (paper.authors || '').replace(/"/g, '').toLowerCase();
                const fav = paper.favorite ? '收藏' : '';
                return title.includes(kw) || authors.includes(kw) || fav.includes(kw);
            });
        }
        const template = document.getElementById('paperTemplate');
        if (papers.length === 0) {
            paperList.innerHTML = '<div class="empty-state">暂无符合条件的论文信息</div>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'paper-table';
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th><input type="checkbox" id="selectAll"></th>
                <th>标题</th>
                <th>作者</th>
                <th>引用</th>
                <th>地址</th>
                <th>操作</th>
            </tr>
        `;
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        papers.forEach(function(paper) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="select-row" data-url="${paper.url}"></td>
                <td class="title">${paper.title}</td>
                <td class="authors">${paper.authors}</td>
                <td class="citation">${paper.citation}</td>
                <td class="url">
                    <a href="${paper.url}" target="_blank" class="url-link">${paper.url}</a>
                </td>
                <td class="actions">
                    <button class="favorite-btn" style="color:${paper.favorite ? '#eab308':'#888'};font-weight:bold;">${paper.favorite ? '★ 已收藏' : '☆ 收藏'}</button>
                    <button class="copy-btn">复制标题</button>
                    <button class="copy-btn">复制作者</button>
                    <button class="copy-btn">复制引用</button>
                    <button class="delete-btn">删除</button>
                </td>
            `;
            // 收藏按钮事件
            const favBtn = tr.querySelector('.favorite-btn');
            favBtn.onclick = () => toggleFavorite(paper.url);
            // 复制按钮事件
            const copyButtons = tr.querySelectorAll('.copy-btn');
            copyButtons[0].onclick = () => copyText(paper.title.replace(/"/g, ''), '标题');
            copyButtons[1].onclick = () => copyText(paper.authors.replace(/"/g, ''), '作者');
            copyButtons[2].onclick = () => copyText(paper.citation, '引用');
            // 删除按钮事件
            const deleteButton = tr.querySelector('.delete-btn');
            deleteButton.onclick = () => deletePaper(paper.url);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        paperList.appendChild(table);
        // 全选/反选
        const selectAll = document.getElementById('selectAll');
        selectAll.onclick = function() {
            const checkboxes = document.querySelectorAll('.select-row');
            checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
        };
    });
}

// 复制文本到剪贴板
async function copyText(text, type) {
    if (!text) {
        showStatus(`没有可复制的${type}内容`, 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(text);
        showStatus(`${type}已复制到剪贴板`, 'success');
    } catch (err) {
        console.error('Clipboard API failed:', err);
        
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        try {
            textarea.select();
            document.execCommand('copy');
            showStatus(`${type}已复制到剪贴板`, 'success');
        } catch (err) {
            showStatus(`复制${type}失败，请手动复制`, 'error');
        } finally {
            document.body.removeChild(textarea);
        }
    }
}

function exportToExcel() {
    chrome.storage.local.get(['papers'], function(result) {
        const papers = result.papers || [];
        if (papers.length === 0) {
            showStatus('没有可导出的论文信息', 'error');
            return;
        }
        // 转换为SheetJS需要的格式
        const data = papers.map(paper => ({
            '标题': paper.title.replace(/"/g, ''),
            '作者': paper.authors.replace(/"/g, ''),
            '引用': paper.citation,
            '地址': paper.url
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '论文信息');
        XLSX.writeFile(wb, '论文信息.xlsx');
    });
}

function toggleFavorite(url) {
    chrome.storage.local.get(['papers'], function(result) {
        let papers = result.papers || [];
        papers = papers.map(p => {
            if (p.url === url) {
                p.favorite = !p.favorite;
            }
            return p;
        });
        chrome.storage.local.set({papers: papers}, function() {
            loadPapers();
        });
    });
}

function batchDelete() {
    const checkedUrls = Array.from(document.querySelectorAll('.select-row:checked')).map(cb => cb.dataset.url);
    if (checkedUrls.length === 0) {
        showStatus('请选择要删除的论文', 'error');
        return;
    }
    chrome.storage.local.get(['papers'], function(result) {
        let papers = result.papers || [];
        papers = papers.filter(p => !checkedUrls.includes(p.url));
        chrome.storage.local.set({papers: papers}, function() {
            showStatus('批量删除成功！', 'success');
            loadPapers();
        });
    });
}