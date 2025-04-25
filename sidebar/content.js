// content.js
(function() {
    let ocrButton = null;
    let currentTargetImage = null;
    let hideButtonTimeout = null;

    function createButton() {
        const button = document.createElement('button');
        button.textContent = 'OCR';
        button.className = 'ocr-trigger-button'; // Use class from content.css
        button.style.pointerEvents = 'auto'; // Ensure button is clickable
        button.addEventListener('click', handleOcrButtonClick);
        // Prevent mouseover on button from triggering mouseout on image immediately
        button.addEventListener('mouseover', () => {
            if (hideButtonTimeout) clearTimeout(hideButtonTimeout);
            button.style.opacity = '1';
        });
        button.addEventListener('mouseout', hideButtonWithDelay); // Hide if mouse leaves button too
        document.body.appendChild(button);
        return button;
    }

    function showButton(targetImage) {
        if (!ocrButton) {
            ocrButton = createButton();
        }
        currentTargetImage = targetImage; // Remember which image triggered it
        const rect = targetImage.getBoundingClientRect();
        // Position near top-left corner of image
        ocrButton.style.left = `${rect.left + window.scrollX + 5}px`;
        ocrButton.style.top = `${rect.top + window.scrollY + 5}px`;
        ocrButton.dataset.imageUrl = targetImage.src; // Store URL on button data
        ocrButton.style.opacity = '1'; // Make visible
        if (hideButtonTimeout) clearTimeout(hideButtonTimeout); // Cancel any pending hide
    }

    function hideButton() {
        if (ocrButton) {
            ocrButton.style.opacity = '0';
            currentTargetImage = null;
            // Optional: Remove button from DOM after fade? Simpler to just hide.
            // setTimeout(() => {
            //    if (ocrButton && ocrButton.style.opacity === '0') {
            //        ocrButton.remove();
            //        ocrButton = null;
            //     }
            // }, 300); // delay slightly longer than transition
        }
    }

    function hideButtonWithDelay() {
         if (hideButtonTimeout) clearTimeout(hideButtonTimeout);
         hideButtonTimeout = setTimeout(hideButton, 300); // Hide after a short delay
    }

    function handleOcrButtonClick(event) {
        event.stopPropagation();
        event.preventDefault();
        const imageUrl = event.target.dataset.imageUrl;
        console.log('OCR Button Clicked. Image URL:', imageUrl);
        if (imageUrl && chrome && chrome.runtime) {
             try {
                chrome.runtime.sendMessage({ action: 'triggerOcr', imageUrl: imageUrl }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Content Script: Error sending triggerOcr message:', chrome.runtime.lastError.message);
                        // alert('Error sending message to extension. Please reload.'); // Optional user feedback
                    } else {
                        console.log('Content Script: triggerOcr message sent.');
                    }
                });
                hideButton(); // Hide button immediately after click
             } catch (error) {
                  console.error('Content Script: Failed to send message:', error);
                  // alert('Error contacting extension. Please reload.'); // Optional user feedback
             }
        } else {
             console.error('Content Script: Cannot send message - missing imageUrl or runtime.');
        }
    }

    // --- Event Listeners ---
    document.body.addEventListener('mouseover', (event) => {
        if (event.target.tagName === 'IMG' && event.target.src && !event.target.src.startsWith('data:')) {
             // Check if image is reasonably sized (optional, avoids tiny icons)
             const rect = event.target.getBoundingClientRect();
             if (rect.width > 50 && rect.height > 50) {
                  showButton(event.target);
             }
        }
    });

    document.body.addEventListener('mouseout', (event) => {
        // If mouse leaves the image that triggered the button OR the button itself
        if ((event.target === currentTargetImage || event.target === ocrButton) && ocrButton) {
             // Check if the mouse moved TO the other related element (button or image)
             if (event.relatedTarget !== currentTargetImage && event.relatedTarget !== ocrButton) {
                 hideButtonWithDelay();
             }
        } else if (event.target.tagName !== 'IMG' && event.target !== ocrButton && currentTargetImage) {
            // If mouse moved out of something else entirely, maybe hide if not over image/button
             const isMouseOverImage = currentTargetImage.matches(':hover');
             const isMouseOverButton = ocrButton ? ocrButton.matches(':hover') : false;
             if (!isMouseOverImage && !isMouseOverButton) {
                 hideButtonWithDelay();
             }
        }
    });

    console.log("OCR Content Script Loaded.");

})();