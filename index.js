var sfHost = ""
var sessionId = ""
chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
    var newUrl = new URL(tabs[0].url)
    let sfHost = newUrl.hostname.replace("lightning.force", "my.salesforce");
    chrome.runtime.sendMessage({request: "getSessionId", host : sfHost}, function(response) {
        sessionId = response;
        var newTabUrl = "table.html?host="+sfHost+"&sessionId="+sessionId    

        var a = document.getElementById("openTab")
        a.addEventListener('click', function(tab) {
            chrome.tabs.query({
                active: true, currentWindow: true
              }, tabs => {
                let index = tabs[0].index;
                chrome.tabs.create({url: newTabUrl, index: index + 1});
              }
            );
        });
    });
});


