// 监听插件安装事件
chrome.runtime.onInstalled.addListener(function() {
    // 初始化存储
    chrome.storage.local.get(['papers'], function(result) {
        if (!result.papers) {
            chrome.storage.local.set({papers: []});
        }
    });
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "getPaperInfo") {
        // 处理获取论文信息的请求
        sendResponse({status: "success"});
    }
    return true;
}); 