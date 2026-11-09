let last = 0;
function report(){const now=Date.now();if(now-last<350)return;last=now;
 const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
 chrome.runtime.sendMessage({type:'scroll',scroll:max?scrollY/max:0}).catch(()=>{});
}
addEventListener('scroll',report,{passive:true});addEventListener('load',report);report();
chrome.runtime.onMessage.addListener((msg)=>{if(msg.type==='jumpScroll'){
 const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
 scrollTo({top:max*Math.max(0,Math.min(1,msg.scroll||0)),behavior:'smooth'});
}});
