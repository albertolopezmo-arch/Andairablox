(() => {
 'use strict';
 // No cookies, localStorage, sessionStorage, fingerprinting, or visible UI.
 if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl||navigator.webdriver)return;
 const endpoint=window.ANDAIRA_ANALYTICS_ENDPOINT || (window.ANDAIRA_CONFIG?.supabaseUrl ? window.ANDAIRA_CONFIG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/andairablox/collect' : '');
 if(!endpoint||!/^https:\/\//.test(endpoint))return;
 const pageId=crypto.randomUUID(),path=location.pathname;
 const lang=['en','fr'].includes(document.documentElement.lang)?document.documentElement.lang:'es';
 const catalog=Object.values(window.andairaCatalog||{}).flat();
 const slug=p=>p.match(/\/libros\/([^/]+)\/?$/)?.[1]||'';
 const currentBook=slug(path);
 const params=new URLSearchParams(location.search);
 let source='Directo / desconocido';
 try{const ref=new URL(document.referrer);if(ref.hostname!==location.hostname)source=ref.hostname;}catch{}
 if(params.get('utm_source'))source=params.get('utm_source').slice(0,80);
 const campaign=(params.get('utm_campaign')||'').slice(0,80);
 function send(type,book=currentBook,value=0) {
  const data=JSON.stringify({id:crypto.randomUUID(),pageId,type,path,book,source,campaign,lang,value});
  // text/plain allows a cross-origin beacon without exposing a credential.
  if(navigator.sendBeacon?.(endpoint,new Blob([data],{type:'text/plain'})))return;
  fetch(endpoint,{method:'POST',body:data,keepalive:true,credentials:'omit',referrerPolicy:'no-referrer'}).catch(()=>{});
 }
 send('pageview');
 document.addEventListener('click',e=>{
  if(!e.isTrusted)return;
  const target=e.target.closest('a,button');if(!target)return;
  if(target.matches('[data-sample-enlarge]'))return send('sample','truco-o-trato');
  if(target.matches('.assistant-launcher')&&target.getAttribute('aria-expanded')==='true')return send('assistant');
  if(!target.href)return;
  let url;try{url=new URL(target.href);}catch{return;}
  const book=slug(url.pathname);
  if(url.origin===location.origin){if(book)send('book_click',book);else if(/\/contacto\/?$/.test(url.pathname))send('contact');return;}
  if(!/^https?:$/.test(url.protocol))return;
  const matched=catalog.find(b=>b.purchase===url.href&&b.directPurchase);
  if(matched)return send('purchase',matched.slug);
  if(/(^|\.)(mybook\.to|amzn\.to|a\.co|amazon\.[a-z.]+)$/.test(url.hostname))return send('purchase');
  if(/(^|\.)(wa\.me|whatsapp\.com)$/.test(url.hostname))return send('contact');
  send('outbound');
 });
 let depth=0,active=0,started=document.hidden?null:performance.now(),lastSent=-1;
 function trackDepth(){const range=document.documentElement.scrollHeight-innerHeight;const percentage=range<=0?100:Math.min(100,Math.round(scrollY/range*100));const milestone=[25,50,75,100].filter(x=>x<=percentage).pop()||0;if(milestone>depth){depth=milestone;send('scroll',currentBook,depth);}}
 addEventListener('scroll',trackDepth,{passive:true});
 function flush(){if(started!==null){active+=performance.now()-started;started=null;}const seconds=Math.min(3600,Math.round(active/1000));if(seconds!==lastSent){send('engagement',currentBook,seconds);lastSent=seconds;}}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();else started=performance.now();});
 addEventListener('pagehide',flush);
 addEventListener('pageshow',e=>{if(e.persisted&&!document.hidden)started=performance.now();});
 setInterval(()=>{if(!document.hidden){flush();started=performance.now();}},15000);
})();
