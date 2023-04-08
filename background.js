chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.request == "getSessionId") {
        myDomain = message.host;
        chrome.cookies.get({url : "https://" + myDomain, name : "sid"}, sessionCookie => {
            sendResponse(sessionCookie.value);
        })
        return true; 
    }
});