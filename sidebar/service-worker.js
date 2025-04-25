// service-worker.js
console.log('Service Worker Started.');

const OCR_IMAGE_URL_KEY = 'ocrImageUrlForSidePanel'; // Define storage key

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension Installed/Updated.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Service Worker received message:', request);

    if (request.action === 'triggerOcr') {
        const imageUrl = request.imageUrl;
        if (!imageUrl) {
            console.error('Service Worker: No image URL provided in triggerOcr message.');
            return false; // Indicate sync response or no response needed
        }

        console.log('Service Worker: Storing image URL for OCR:', imageUrl);
        // Store the URL
        chrome.storage.local.set({ [OCR_IMAGE_URL_KEY]: imageUrl }, () => {
            if (chrome.runtime.lastError) {
                console.error('Service Worker: Error storing OCR image URL:', chrome.runtime.lastError);
                // Maybe notify content script? For now, just log.
                return;
            }
            console.log('Service Worker: OCR image URL stored successfully.');

            // Ensure we have context to open the side panel
            if (sender.tab && sender.tab.windowId) {
                // Open the side panel for the window where the click happened
                chrome.sidePanel.open({ windowId: sender.tab.windowId }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Service Worker: Error opening side panel:', chrome.runtime.lastError.message);
                        // Even if opening fails, the URL is stored. Panel might already be open.
                    } else {
                        console.log('Service Worker: Side panel open command issued.');
                    }

                    // **Crucially: Send a message to the side panel(s) telling them to check**
                    // This handles the case where the panel might already be open.
                    // We don't know *which* side panel instance is the right one if multiple
                    // windows are open, so we send to the extension globally. The sidepanel
                    // script needs to be robust enough to ignore messages not for it,
                    // although side panels are usually window-specific.
                    console.log('Service Worker: Sending newOcrRequestReady message to runtime...');
                    chrome.runtime.sendMessage({ action: 'newOcrRequestReady' }, (response) => {
                        if (chrome.runtime.lastError) {
                             // This error often means no listeners were available (e.g., panel closed) - usually safe to ignore.
                            console.log('Service Worker: newOcrRequestReady message - no active listener (panel might be closed or loading). Error:', chrome.runtime.lastError.message);
                        } else {
                            console.log('Service Worker: newOcrRequestReady message acknowledged by a listener.');
                        }
                    });
                });
            } else {
                 console.error('Service Worker: Cannot open side panel - missing sender tab context.');
                 // Still attempt to send the message, the panel might be open independently
                 chrome.runtime.sendMessage({ action: 'newOcrRequestReady' });
            }
        });

        // Indicate that we might respond asynchronously (though we don't in this path)
        // Return false as the main work is done synchronously or via callbacks.
        return false;

    } else if (request.action === 'contentScriptPing') {
        // Keep the ping handler if you used the minimal test script
        console.log('Service Worker: Received contentScriptPing.');
        sendResponse({ status: 'pong', receivedAt: Date.now() });
        return true; // Async response
    }

    // Handle other messages if your extension needs more background tasks

    // Return false if message is not handled or response is synchronous
    return false;
});