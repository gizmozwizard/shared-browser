chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
let panelPort=null;
chrome.runtime.onConnect.addListener(port=>{if(port.name==='panel'){panelPort=port;port.onDisconnect.addListener(()=>{if(panelPort===port)panelPort=null;});}});
chrome.runtime.onMessage.addListener(msg=>{if(msg.type==='scroll')panelPort?.postMessage(msg);});
