console.log("content.js loaded!");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "QUERY_DOM") {
    const getVisibleText = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
          const parent = node.parentElement;
          const style = parent && window.getComputedStyle(parent);
          if (
            !node.nodeValue.trim() ||
            (style && (style.display === "none" || style.visibility === "hidden"))
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let text = "";
      let node;
      while ((node = walker.nextNode())) {
        text += node.nodeValue.trim() + " ";
      }
      return text.trim();
    };

    console.log(getVisibleText())

    // Send the response
    sendResponse({ allText: getVisibleText() });

    // Let Chrome know we're using sendResponse asynchronously
    return true;
  }
});
