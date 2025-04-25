// sidepanel.js

document.addEventListener("DOMContentLoaded", () => {
    // --- Elements ---
    const summarizeBtn = document.getElementById("summarizeBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const askBtn = document.getElementById("askBtn");
    const sourceInput = document.getElementById("sourceInput");
    const fileInput = document.getElementById("fileInput");
    const queryInput = document.getElementById("queryInput");
    const chatContainer = document.getElementById("chat-container");

    // --- Constants ---
    const OCR_IMAGE_URL_KEY = 'ocrImageUrlForSidePanel';
    const BACKEND_OCR_ENDPOINT = "http://127.0.0.1:8000/ocr/extract_text/";
    const BACKEND_SUMMARIZE_ENDPOINT = "http://127.0.0.1:8000/summarize/";
    const BACKEND_QUERY_ENDPOINT = "http://127.0.0.1:8000/query/";

    // --- State Variables ---
    let currentTabUrl = "";
    let currentTabTitle = "";
    // NEW: Store active file context persistently until cleared
    let activeFileContext = null; // { file: File, name: string, type: string } | null
    let originalSourceBeforeUpload = null; // Stores tab info when file is chosen

    // --- Initialization ---
    fetchCurrentTabInfo(); // Fetch initial tab info
    checkForPendingOcr(); // Check for web OCR triggered before panel opened
    setupEventListeners(); // Setup all listeners

    // --- Functions ---

    function fetchCurrentTabInfo(callback) { // Added callback
        console.log("Side Panel: Fetching current tab info...");
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    console.error("Side Panel: Error querying tabs:", chrome.runtime.lastError);
                    sourceInput.textContent = "Error fetching source";
                    if (callback) callback();
                    return;
                }
                if (tabs && tabs.length > 0) {
                    const tab = tabs[0];
                    currentTabUrl = tab.url || "";
                    currentTabTitle = tab.title || (currentTabUrl ? "Untitled Tab" : "");
                    console.log("Side Panel: Current Tab - URL:", currentTabUrl, "Title:", currentTabTitle);
                    // Update display ONLY if no file context is active
                    if (!activeFileContext) {
                        sourceInput.textContent = currentTabTitle || currentTabUrl || "No active tab found";
                    }
                } else {
                    console.log("Side Panel: No active tab found in current window.");
                    if (!activeFileContext) { // Update only if no file context
                        sourceInput.textContent = "No active tab";
                    }
                }
                if (callback) callback(); // Execute callback after info is fetched
            });
        } else {
            console.warn("Side Panel: Chrome tabs API not available.");
            if (!activeFileContext) { // Update only if no file context
                sourceInput.textContent = "(Extension context unavailable)";
            }
            if (callback) callback();
        }
    }

    // NEW: Function to clear file context and restore tab view
    function clearFileContextAndRestoreTab() {
        console.log("Side Panel: Clearing file context and restoring tab view.");
        activeFileContext = null;
        fileInput.value = ''; // Clear the actual file input element
        summarizeBtn.textContent = "Summarize"; // Reset button text

        // Restore original display from stored info or re-fetch
        if (originalSourceBeforeUpload) {
            console.log("Side Panel: Restoring original source from prior upload state.");
            currentTabUrl = originalSourceBeforeUpload.url; // Restore URL state
            currentTabTitle = originalSourceBeforeUpload.title; // Restore title state
            sourceInput.textContent = currentTabTitle || currentTabUrl || "Source restored";
            originalSourceBeforeUpload = null; // Clear the stored state
        } else {
            console.log("Side Panel: Re-fetching tab info as no prior upload state was stored.");
            // Re-fetch tab info to update display if originalSource wasn't set
            fetchCurrentTabInfo();
        }
    }


    function checkForPendingOcr() {
        console.log("Side Panel: Checking storage for pending OCR URL...");
        chrome.storage.local.get([OCR_IMAGE_URL_KEY], (result) => {
            const imageUrl = result[OCR_IMAGE_URL_KEY];
            if (imageUrl) {
                console.log("Side Panel: Found pending OCR URL on load:", imageUrl);
                // **Clear any active file context before processing web OCR**
                if (activeFileContext) {
                    clearFileContextAndRestoreTab();
                }
                chrome.storage.local.remove(OCR_IMAGE_URL_KEY, () => {
                    if (!chrome.runtime.lastError) {
                        console.log("Side Panel: Removed OCR URL from storage.");
                    }
                    performOcrFromWeb(imageUrl);
                });
            } else {
                console.log("Side Panel: No pending OCR URL found on load.");
            }
        });
    }

    function setupEventListeners() {
        // Runtime message listener (for web OCR trigger while panel is open)
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log("Side Panel: Received message:", request);
            if (request.action === 'newOcrRequestReady') {
                console.log("Side Panel: Received newOcrRequestReady message. Checking storage...");
                // **Clear any active file context before processing web OCR**
                if (activeFileContext) {
                    clearFileContextAndRestoreTab();
                }
                checkForPendingOcr(); // Check storage when notified
                return false;
            }
            return false;
        });

        // Other listeners (keep as before)
        queryInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                handleAskClick();
            }
        });
        uploadBtn.addEventListener("click", () => { fileInput.click(); });
        fileInput.addEventListener("change", handleFileSelect);
        summarizeBtn.addEventListener("click", handleSummarizeOrExtractClick);
        askBtn.addEventListener("click", handleAskClick); // Use the corrected version from last time
    }

    // --- Action Handlers ---

    function handleFileSelect() {
        const file = fileInput.files[0];
        if (file) {
            console.log(`Side Panel: File selected: ${file.name}`);
            // Store current tab info *before* overwriting display/state
            // Fetch fresh info in case user navigated since panel load
            fetchCurrentTabInfo(() => {
                originalSourceBeforeUpload = { url: currentTabUrl, title: currentTabTitle };
                console.log("Side Panel: Stored original source:", originalSourceBeforeUpload);

                // Set the active file context
                activeFileContext = { file: file, name: file.name, type: file.type || 'unknown' };
                console.log("Side Panel: Set active file context:", activeFileContext);

                // Update UI
                sourceInput.textContent = `File: ${activeFileContext.name}`;
                if (/\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(activeFileContext.name)) {
                    summarizeBtn.textContent = "Extract Text";
                } else {
                    summarizeBtn.textContent = "Summarize File";
                }
            });
        } else {
            // File selection cancelled
            if (activeFileContext) { // Only clear if a file *was* active
                clearFileContextAndRestoreTab();
            }
        }
    }

    async function handleSummarizeOrExtractClick() {
        const buttonText = summarizeBtn.textContent;
        const currentFileContext = activeFileContext;
    
        console.log(`Side Panel: Summarize/Extract button clicked. Text: "${buttonText}", Active File Context:`, currentFileContext);
    
        if (buttonText === "Extract Text" && currentFileContext && /\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(currentFileContext.name)) {
            // --- Perform OCR on Uploaded Image File ---
            console.log("Side Panel: 'Extract Text' action initiated.");
            displayMessage(`Extracting text from ${currentFileContext.name}...`, "ai-message");
    
            const formData = new FormData();
            formData.append('image_file', currentFileContext.file);
    
            try {
                const response = await fetch(BACKEND_OCR_ENDPOINT, { method: "POST", body: formData });
                const data = await response.json();
    
                if (!response.ok || data.error) {
                    displayMessage(`Error extracting text: ${data.error || `HTTP ${response.status}`}`, "error-message");
                } else if (data.results && data.results.length > 0) {
                    const firstResult = data.results[0];
                    if (firstResult.error) {
                        displayMessage(`Error extracting text: ${firstResult.error}`, "error-message");
                    } else {
                        displayMessage(firstResult.finalText || "No text extracted.", "ocr-result-message");
                        // --- FIX FOR UI UPDATE AFTER OCR ---
                        clearFileContextAndRestoreTab(); // Clear file context
                        fetchCurrentTabInfo();       // Update source input to current tab
                        // --- END OF FIX ---
                    }
                } else {
                    displayMessage("No results received from OCR.", "error-message");
                }
            } catch (error) {
                console.error("Side Panel: Error during Upload OCR fetch:", error);
                displayMessage(`Request failed: ${error.message}`, "error-message");
            } finally {
                summarizeBtn.textContent = "Summarize";
                console.log("Side Panel: Reset button text after Extract Text.");
                // Note: We are now calling clearFileContextAndRestoreTab() which handles more.
                // File context will be cleared, and tab info refetched.
            }
    
        } else if (buttonText === "Summarize File" && currentFileContext && !/\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(currentFileContext.name)) {
            // --- Perform Summarization on Uploaded Text/PDF File ---
            console.log("Side Panel: 'Summarize File' action initiated for:", currentFileContext.name);
            const fileType = currentFileContext.type || "unknown type";
            displayMessage(`Summarizing uploaded file (${fileType})...`, "ai-message");
    
            const formData = new FormData();
            formData.append('file', currentFileContext.file);
            console.log("Side Panel: Sending non-image file to Summarize endpoint:", currentFileContext.name, "File object:", currentFileContext.file);
    
            try {
                const response = await fetch(BACKEND_SUMMARIZE_ENDPOINT, { method: "POST", body: formData });
                console.log("Side Panel: Upload Summary Fetch initiated. Status pending...");
                const data = await response.json();
                console.log("Side Panel: Uploaded File Summary Response Received. Status:", response.status, "Data:", data);
    
                if (!response.ok || data.error) {
                    if (data.error && data.error.toLowerCase().includes('unsupported file type')) {
                        displayMessage(`Error: Backend cannot summarize this file type (${fileType}).`, "error-message");
                    } else {
                        displayMessage(`Error summarizing file: ${data.error || `HTTP ${response.status}`}`, "error-message");
                    }
                } else {
                    displayMessage(data.summary || "No summary received.", "summary-message");
                }
            } catch (error) {
                console.error("Side Panel: Error during Uploaded File Summary fetch:", error);
                displayMessage(`Request failed: ${error.message}`, "error-message");
            } finally {
                summarizeBtn.textContent = "Summarize";
                console.log("Side Panel: Reset button text after Summarize File. File context remains.");
            }
    
        } else if (buttonText === "Summarize" && !currentFileContext) {
            // --- Perform Summarization on Current Web Page ---
            // This block now also ensures no file context is active
            console.log("Side Panel: 'Summarize' action initiated for webpage.");
            // **Clear any potential lingering file state (belt-and-suspenders)**
            // This shouldn't be necessary if logic is correct, but safe to add.
            if (activeFileContext) clearFileContextAndRestoreTab();
    
            if (!currentTabUrl || currentTabUrl.startsWith("chrome://") || currentTabUrl.startsWith("file://")) {
                alert("Cannot summarize this page. Please navigate to a valid web page (http/https).");
                return;
            }
            const sourceNameToSummarize = currentTabTitle || currentTabUrl;
            displayMessage(`Summarizing ${sourceNameToSummarize}...`, "ai-message");
    
            const formData = new FormData();
            formData.append('source', currentTabUrl);
            console.log("Side Panel: Sending URL to Summarize endpoint:", currentTabUrl);
    
            try {
                const response = await fetch(BACKEND_SUMMARIZE_ENDPOINT, { method: "POST", body: formData });
                const data = await response.json();
                console.log("Side Panel: Web Page Summary Response Data:", data);
                if (!response.ok || data.error) {
                    displayMessage(`Error summarizing page: ${data.error || `HTTP ${response.status}`}`, "error-message");
                } else {
                    displayMessage(data.summary || "No summary received.", "summary-message");
                }
            } catch (error) {
                console.error("Side Panel: Error during Web Page Summary fetch:", error);
                displayMessage(`Request failed: ${error.message}`, "error-message");
            }
    
        } else {
            console.error(`Side Panel: handleSummarizeOrExtractClick called with unexpected state or mismatched context. Button: "${buttonText}", FileContext:`, currentFileContext);
            alert("An action mismatch occurred. Please try selecting a source again.");
            // Reset to a known state
            clearFileContextAndRestoreTab();
        }
    }
    
    async function performOcrFromWeb(imageUrl) {
        console.log('Side Panel: Performing OCR from Web Image URL:', imageUrl);
        displayMessage("Extracting text from web image...", "ai-message");

        // **Clear any active file context FIRST**
        if (activeFileContext) {
            clearFileContextAndRestoreTab();
        }

        try {
            const formData = new FormData();
            formData.append('image_url', imageUrl);
            const response = await fetch(BACKEND_OCR_ENDPOINT, { method: "POST", body: formData });
            const data = await response.json();
            if (!response.ok || data.error) {
                displayMessage(`Error: ${data.error || `HTTP error ${response.status}`}`, "error-message");
            } else if (data.results && data.results.length > 0) {
                const firstResult = data.results[0];
                if (firstResult.error) {
                    displayMessage(`Error extracting text: ${firstResult.error}`, "error-message");
                } else {
                    displayMessage(firstResult.finalText || "No text extracted.", "ocr-result-message");
                }
            } else {
                displayMessage("No results received from OCR.", "error-message");
            }
        } catch (error) {
            console.error("Side Panel: Error during Web OCR fetch:", error);
            displayMessage(`Failed to extract text. Error: ${error.message}`, "error-message");
        }
    }

    const displayMessage = (text, className) => {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add(className);
        if ((className.includes("-message") || className.includes("-result")) && text && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            try {
                const rawHTML = marked.parse(text);
                const sanitizedHTML = DOMPurify.sanitize(rawHTML);
                messageDiv.innerHTML = sanitizedHTML;
            } catch (e) {
                messageDiv.textContent = text; /* fallback */
            }
        } else {
            messageDiv.textContent = text;
        }
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    async function handleAskClick() {
        console.log("Side Panel: Ask button clicked.");
        const query = queryInput.value.trim();
        if (!query) {
            alert("Please enter a query.");
            return;
        }
        displayMessage(query, "user-message");
        queryInput.value = '';

        const formData = new FormData();
        formData.append('query', query);

        // **MODIFIED**: Use activeFileContext
        if (activeFileContext && activeFileContext.file) {
            console.log(`Side Panel: Sending query with file context: ${activeFileContext.name}`);
            formData.append('file', activeFileContext.file); // Use file from context
        } else if (currentTabUrl && !currentTabUrl.startsWith("chrome://")) {
            console.log(`Side Panel: Sending query with URL context: ${currentTabUrl}`);
            formData.append('source', currentTabUrl);
        } else {
            console.warn("Side Panel: Sending query without specific file or URL context.");
        }

        try {
            const response = await fetch(BACKEND_QUERY_ENDPOINT, { method: "POST", body: formData });
            const data = await response.json();
            console.log("Side Panel: Query Response Data:", data);

            if (!response.ok || data.error) {
                if (response.status === 400 && data.error && data.error.includes("No source or uploaded file")) {
                    displayMessage("Error: Query requires a valid webpage or uploaded file context.", "error-message");
                } else {
                    displayMessage(`Error: ${data.error || `HTTP error ${response.status}`}`, "error-message");
                }
            } else {
                displayMessage(data.answer || "No answer received.", "ai-message");
            }
        } catch (error) {
            console.error("Side Panel: Error during query fetch:", error);
            displayMessage(`Failed to get answer. Error: ${error.message}`, "error-message");
        }
    }

}); // End DOMContentLoaded