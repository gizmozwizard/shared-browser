const $=id=>document.getElementById(id);
let ws=null,myId=null,roomId=null,sharedTabs=[],users=[],scrollPositions=new Map(),activeChromeTab=null;
const store=chrome.storage.local;
const safeUrl=url=>{try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}};
const send=obj=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));};
function roomFromUrl(){const params=new URLSearchParams(location.search);return params.get('room');}
async function init(){const saved=await store.get(['name','server','room']);$('name').value=saved.name||'';$('server').value=saved.server||'ws://localhost:8787';$('room').value=roomFromUrl()||saved.room||'';}
function randomRoom(){const a=new Uint8Array(12);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}
async function currentTab(){const [t]=await chrome.tabs.query({active:true,currentWindow:true});return t;}
async function publishPresence(){if(!myId)return;const tab=await currentTab();activeChromeTab=tab?.id;const url=safeUrl(tab?.url||'');if(!url){send({type:'presence',url:'',title:'Unsupported tab',scroll:0});return;}
 let scroll=scrollPositions.get(tab.id)||0;send({type:'presence',url,title:tab.title||url,scroll});}
async function jump(url,scroll){const valid=safeUrl(url);if(!valid)return;const tabs=await chrome.tabs.query({currentWindow:true});let tab=tabs.find(t=>t.url===valid);
 if(tab){await chrome.tabs.update(tab.id,{active:true});}else{tab=await chrome.tabs.create({url:valid});}
 await chrome.windows.update(tab.windowId,{focused:true});
 let attempts=0;const deliver=async()=>{try{await chrome.tabs.sendMessage(tab.id,{type:'jumpScroll',scroll});}catch{if(++attempts<12)setTimeout(deliver,350);}};
 setTimeout(deliver,tab.status==='complete'?150:700);
}
function item(title,sub,action,initial,remove){const outer=document.createElement('div');outer.className='item';const avatar=document.createElement('div');avatar.className='avatar';avatar.textContent=initial;const main=document.createElement('div');main.className='main';const a=document.createElement('div');a.className='title';a.textContent=title;const b=document.createElement('div');b.className='sub';b.textContent=sub;main.append(a,b);main.addEventListener('click',action);outer.append(avatar,main);if(remove){const x=document.createElement('button');x.className='remove';x.textContent='×';x.title='Remove shared tab';x.onclick=remove;outer.append(x);}return outer;}
function render(){const people=$('people'),tabs=$('tabs');people.replaceChildren();tabs.replaceChildren();$('count').textContent=`(${users.length})`;
 for(const u of users){const label=u.name+(u.id===myId?' (you)':'');const sub=u.url?`${u.title||u.url} · ${Math.round(u.scroll*100)}% down`:'No shareable page';people.append(item(label,sub,()=>{if(u.id!==myId)jump(u.url,u.scroll);},(u.name||'?')[0].toUpperCase()));}
 for(const t of sharedTabs){tabs.append(item(t.title,t.url,()=>jump(t.url,0),'↗',()=>send({type:'removeTab',id:t.id})));}
 if(!sharedTabs.length){const p=document.createElement('p');p.className='hint';p.textContent='No shared tabs yet. Add the page you are viewing.';tabs.append(p);}
}
function connect(){const name=$('name').value.trim()||'Guest';const server=$('server').value.trim();const id=$('room').value.trim()||randomRoom();
 if(!/^[a-zA-Z0-9_-]{6,100}$/.test(id)){alert('Room ID must be at least 6 letters, numbers, _ or -');return;}
 if(!/^wss?:\/\//.test(server)){alert('Enter a ws:// or wss:// server URL');return;}
 store.set({name,server,room:id});roomId=id;$('room').value=id;$('roomLabel').textContent=`Room: ${id}`;$('setup').hidden=true;$('workspace').hidden=false;
 ws=new WebSocket(server);$('status').textContent='Connecting...';
 ws.onopen=()=>send({type:'join',room:id,name});
 ws.onmessage=event=>{let m;try{m=JSON.parse(event.data);}catch{return;}
 if(m.type==='joined'){myId=m.userId;$('status').textContent='Connected';publishPresence();}
 if(m.type==='state'){sharedTabs=m.tabs||[];users=m.users||[];render();}
 if(m.type==='error')$('status').textContent=m.message;
 };
 ws.onclose=()=>{$('status').textContent='Disconnected — leave and rejoin to reconnect';myId=null;};
 ws.onerror=()=>{$('status').textContent='Connection failed. Check server address.';};
}
$('join').onclick=connect;
$('share').onclick=async()=>{const tab=await currentTab();const url=safeUrl(tab?.url);if(!url){alert('This page cannot be shared');return;}send({type:'addTab',url,title:tab.title||url});};
$('refresh').onclick=publishPresence;
$('copy').onclick=async()=>{const server=$('server').value.trim();const invite=`Shared Browser room: ${roomId}\nServer: ${server}\nInstall the extension, enter this server and room ID, then join.`;await navigator.clipboard.writeText(invite);$('copy').textContent='Copied!';setTimeout(()=>$('copy').textContent='Copy invite',1500);};
$('leave').onclick=()=>{ws?.close();ws=null;myId=null;roomId=null;users=[];sharedTabs=[];$('setup').hidden=false;$('workspace').hidden=true;};
chrome.tabs.onActivated.addListener(()=>publishPresence());
chrome.tabs.onUpdated.addListener((id,info)=>{if(info.url||info.status==='complete')publishPresence();});
chrome.runtime.connect({name:'panel'}).onMessage.addListener(msg=>{if(msg.type==='scroll'){if(activeChromeTab!==null)scrollPositions.set(activeChromeTab,msg.scroll);publishPresence();}});
setInterval(()=>{if(myId)publishPresence();},2500);
init();
