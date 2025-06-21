document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("queryBtn").onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { type: "QUERY_DOM" }, (response) => {
        if (!response?.allText) {
            console.error("No valid text returned from content script");
            return;
        }
        fetch_page_summary(response?.allText || "")
      if (!response) {
        console.error("No response from content script");
        return;
      }
      console.log("Full page text:", response.allText);
    });
  };
});
