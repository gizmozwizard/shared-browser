import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
const port = Number(process.env.PORT || 8787);
const httpServer = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, {'Content-Type':'text/plain'}); res.end('ok'); }
  else { res.writeHead(404); res.end('Not found'); }
});
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(port, '0.0.0.0');
const rooms = new Map();
const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
function broadcast(room) {
  for (const ws of room.clients) send(ws, {type:'state',tabs:room.tabs,users:[...room.users.values()]});
}
wss.on('connection', ws => {
  let room, userId;
  ws.on('message', raw => {
    let m; try {m=JSON.parse(raw);} catch {return;}
    if (m.type === 'join') {
      if (room) return;
      const id = String(m.room || '').slice(0,100);
      if (!/^[a-zA-Z0-9_-]{6,100}$/.test(id)) return send(ws,{type:'error',message:'Invalid room'});
      room = rooms.get(id) || {tabs:[],users:new Map(),clients:new Set()};
      rooms.set(id,room); userId=randomUUID();room.clients.add(ws);
      room.users.set(userId,{id:userId,name:String(m.name||'Guest').slice(0,40),tabId:null,url:'',title:'',scroll:0});
      send(ws,{type:'joined',userId,room:id});broadcast(room);return;
    }
    if (!room || !userId) return;
    if (m.type === 'addTab') {
      try { const u=new URL(m.url);if (!['http:','https:'].includes(u.protocol)) return;
        const tab={id:randomUUID(),url:u.href,title:String(m.title||u.hostname).slice(0,160),by:userId};
        room.tabs.push(tab);if(room.tabs.length>100)room.tabs.shift();broadcast(room);
      } catch {} return;
    }
    if (m.type === 'removeTab') {room.tabs=room.tabs.filter(t=>t.id!==m.id);broadcast(room);return;}
    if (m.type === 'presence') {
      const u=room.users.get(userId); if(!u)return;
      u.tabId=typeof m.tabId==='string'?m.tabId:null;
      u.url=String(m.url||'').slice(0,2048);u.title=String(m.title||'').slice(0,160);
      u.scroll=Math.max(0,Math.min(1,Number(m.scroll)||0));broadcast(room);
    }
  });
  ws.on('close',()=>{if(!room)return;room.clients.delete(ws);room.users.delete(userId);if(!room.clients.size){for(const [id,r] of rooms)if(r===room)rooms.delete(id);}else broadcast(room);});
});
console.log(`Shared Browser WebSocket server on ws://localhost:${port}`);
