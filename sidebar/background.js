chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log('Background script received message:', request); // Log every received message
        if (request.action === 'openSidePanelForOCR') {
            const imageUrl = request.imageUrl;
            console.log('Received openSidePanelForOCR request. Image URL:', imageUrl);
            // Store the imageUrl so the side panel can access it
            chrome.storage.local.set({ 'OCR_IMAGE_URL_KEY': imageUrl }, () => { // Updated key
                console.log('Image URL stored for OCR:', imageUrl);
                // Check if the side panel is already open for this window
                chrome.sidePanel.getPanel({ windowId: sender.tab.windowId }, (panel) => {
                    if (!panel) {
                        // Open the side panel only if it's not already open
                        chrome.sidePanel.open({ windowId: sender.tab.windowId }, () => {
                            console.log('Side panel opened for OCR.');
                        });
                    } else {
                        console.log('Side panel is already open.');
                        // If the side panel is open, we still stored the URL,
                        // and the sidepanel.js will pick it up.
                    }
                });
            });
        } else if (request.action === 'displayOCRTextInPanel') {
            const extractedText = request.text;
            console.log('Received OCR text in background:', extractedText);
        }
    }
);