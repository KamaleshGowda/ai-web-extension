document.addEventListener("DOMContentLoaded", () => {
    const summarizeBtn = document.getElementById("summarizeBtn");
    const queryBtn = document.getElementById("queryBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const askBtn = document.getElementById("askBtn");
    const sourceInput = document.getElementById("sourceInput");
    const summaryResult = document.getElementById("summaryResult");
    const queryDialog = document.getElementById("queryDialog");
    const queryInput = document.getElementById("queryInput");
    const queryResponse = document.getElementById("queryResponse");
    const fileInput = document.getElementById("fileInput");
    const closeModal = document.querySelector(".close");

    // Fetch the current tab's URL and display it
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            sourceInput.value = "Source: " + tabs[0].url;  // Set URL in the input field
        } else {
            sourceInput.value = "Source: Could not fetch URL";
        }
    });

    // Function to summarize content
    summarizeBtn.addEventListener("click", async () => {
        const source = sourceInput.value.trim();
        const uploadedFileElement = document.getElementById("fileInput");
        const uploadedFile = uploadedFileElement.files[0];
        let formData = new FormData();

        if (uploadedFile) {
            formData.append("file", uploadedFile); // Send the file for summarization
            sourceInput.value = "Source: Uploaded File"; // Update source input
        } else if (source && source !== "Source: Could not fetch URL") {
            formData.append("source", source.replace("Source: ", "")); // Send the URL for summarization
        } else {
            alert("Please open a valid webpage or upload a file.");
            return;
        }

        try {
            const response = await fetch("http://127.0.0.1:8000/summarize/", {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            console.log(data); // Debugging: Inspect data
            if (data.error) {
                summaryResult.innerText = "Error: " + data.error; // Display the error message
            } else {
                summaryResult.innerText = data.summary || "Error in summarization.";
            }
        } catch (error) {
            console.error("Error:", error);
            summaryResult.innerText = "Failed to fetch summary.";
        }
    });

    // Function to open query dialog
    queryBtn.addEventListener("click", () => {
        queryDialog.style.display = "block";
    });

    // Function to ask a query
    askBtn.addEventListener("click", async () => {
        const queryText = queryInput.value.trim();
        const source = sourceInput.value.trim();
        const uploadedFileElement = document.getElementById("fileInput");
        const uploadedFile = uploadedFileElement.files[0];
        const formData = new FormData();

        if (uploadedFile) {
            formData.append("file", uploadedFile); // Send the file for querying
        } else {
            formData.append("source", source.replace("Source: ", ""));
        }
        formData.append("query", queryText);

        try {
            const response = await fetch("http://127.0.0.1:8000/query/", {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            console.log(data); // Debugging: Inspect data
            queryResponse.innerText = data.answer || "Error processing query.";
        } catch (error) {
            console.error("Error:", error);
            queryResponse.innerText = "Failed to fetch answer.";
        }
    });

    // Function to upload file
    uploadBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("http://127.0.0.1:8000/upload/", {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            console.log(data); // Debugging: Inspect data
            summaryResult.innerText = data.message || "File uploaded successfully!"; // Display success message
            sourceInput.value = "Source: Uploaded File"; // Update source input
            // You might want to store the filename or some identifier here if needed for later actions
        } catch (error) {
            console.error("Error:", error);
            summaryResult.innerText = "File upload failed.";
        }
    });

    // Close the modal
    closeModal.addEventListener("click", () => {
        queryDialog.style.display = "none";
    });

    window.onclick = (event) => {
        if (event.target === queryDialog) {
            queryDialog.style.display = "none";
        }
    };
});
