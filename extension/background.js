chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

let panelPort = null;
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'panel') return;
  panelPort = port;
  port.onDisconnect.addListener(() => {
    if (panelPort === port) panelPort = null;
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'scroll') {
    panelPort?.postMessage({ ...message, tabId: sender.tab?.id ?? null });
  }
});
