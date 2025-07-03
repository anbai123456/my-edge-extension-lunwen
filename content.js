// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "clickQuoteButton") {
        // 使用 Promise 处理异步操作
        getQuoteData().then(paperInfo => {
            sendResponse({paperInfo: paperInfo});
        });
        return true; // 保持消息通道开启
    }
    return true;
});

// 获取引用数据
async function getQuoteData() {
    // 先获取基本信息
    const basicInfo = extractBasicInfo();
    
    // 模拟点击引用按钮
    const quoteButton = document.querySelector('.btn-quote a');
    if (quoteButton) {
        // 获取原始的onclick处理函数
        const originalOnClick = quoteButton.getAttribute('onclick');
        if (originalOnClick && originalOnClick.includes('getQuotes')) {
            try {
                // 添加延时模拟真实点击
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 创建并分发自定义事件
                const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: quoteButton.getBoundingClientRect().left + 5,
                    clientY: quoteButton.getBoundingClientRect().top + 5
                });
                quoteButton.dispatchEvent(event);
                
                // 等待引用数据加载
                const citation = await waitForQuoteData();
                
                // 关闭弹窗
                const closeButton = document.querySelector('.quote-pop .close');
                if (closeButton) {
                    closeButton.click();
                }
                
                return {
                    ...basicInfo,
                    citation: citation
                };
            } catch (error) {
                console.error('Error triggering quote:', error);
            }
        }
    }
    
    // 如果无法获取引用数据，返回基本信息和构建的引用格式
    return {
        ...basicInfo,
        citation: constructCitation(basicInfo)
    };
}

// 等待引用数据加载
function waitForQuoteData() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // 增加尝试次数
        let lastValue = '';
        
        const checkForData = () => {
            // 检查引用弹窗是否存在
            const quotePopup = document.querySelector('.quote-pop');
            if (quotePopup) {
                const textarea = quotePopup.querySelector("td.quote-r textarea.text");
                if (textarea && (textarea.value || textarea.textContent)) {
                    const currentValue = (textarea.value || textarea.textContent).trim();
                    // 确保数据已经稳定（连续两次获取到相同的数据）
                    if (currentValue === lastValue) {
                        resolve(currentValue);
                        return;
                    }
                    lastValue = currentValue;
                }
            }
            
            if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkForData, 300); // 增加检查间隔
            } else {
                resolve(lastValue || ""); // 如果多次尝试后仍未找到，返回最后一次获取的值或空字符串
            }
        };
        
        setTimeout(checkForData, 500); // 增加初次检查延迟
    });
}

// 提取基本信息（标题和作者）
function extractBasicInfo() {
    let title = "";
    let authors = "";
    let url = window.location.href;
    
    // 获取标题
    const titleElement = document.querySelector(".wx-tit h1");
    if (titleElement) {
        let titleText = titleElement.childNodes[0].textContent.trim();
        title = `${titleText}`;
    }
    
    // 获取作者
    const authorElement = document.querySelector(".wx-tit h3.author");
    if (authorElement) {
        const authorLinks = authorElement.querySelectorAll("a");
        if (authorLinks.length > 0) {
            authors = Array.from(authorLinks)
                .map(link => {
                    const name = link.textContent
                        .replace(/<sup>\d+<\/sup>/g, '')
                        .replace(/\s*\d+\s*/g, '')
                        .trim();
                    return name;
                })
                .filter(name => name && !name.includes('作者单位'))
                .join("、");
            authors = `${authors}`;
        }
    }
    
    return {
        title: title,
        authors: authors,
        url: url
    };
}

// 构建引用格式
function constructCitation(basicInfo) {
    const journalElement = document.querySelector(".top-tip a");
    const journal = journalElement ? journalElement.textContent.trim() : "";
    const pages = document.querySelector(".total-inform span:first-child");
    const pageInfo = pages ? pages.textContent.replace(/[^\d-]/g, '') : "1-17";
    const year = new Date().getFullYear();
    
    if (basicInfo.title && basicInfo.authors && journal) {
        const plainTitle = basicInfo.title.replace(/"/g, '');
        const plainAuthors = basicInfo.authors.replace(/"/g, '');
        return `[1]${plainAuthors}.${plainTitle}[J/OL].${journal},${pageInfo}[${year}-03-27].${basicInfo.url}.`;
    }
    
    return "";
}