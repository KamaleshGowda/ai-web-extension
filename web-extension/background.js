chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: 400,
      height: 600,
      top: 0,
      left: 0
  });
});