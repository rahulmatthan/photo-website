// The gallery. Default view is a dark, continuously-scrolling editorial INDEX of places
// (giant serif names + hero prints). Choosing a place dissolves into the spotlight ROOM —
// the lit framed print for that location, cycling its photographs. "Back" returns to the index.
(function(){
  const G = window.GALLERY || {rooms:[]};
  const rooms = G.rooms || [];
  const $ = id => document.getElementById(id);
  const photo=$('photo'), plate=$('plate'), capTitle=$('capTitle'), capPlace=$('capPlace'), capCue=$('capCue'),
        reveal=$('reveal'), back=$('back'), sitEl=$('sit'), locLink=$('locLink');
  const indexView=$('indexView'), ixScroll=$('ixScroll'), ixCluster=$('ixCluster'), ixMenu=$('ixMenu');
  const enterMsg=$('enterMsg'), enterH=$('enterH');
  const cv=$('cv'), cx = cv && cv.getContext('2d',{willReadFrequently:true});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!rooms.length){ return; }

  let maxR=1600;
  function setMax(){ maxR = 1.85*Math.hypot(innerWidth,innerHeight); }

  // ---------- dominant colour + bounded preloading ----------
  const cache={}, dom={};
  function dominant(img){
    if(!cx) return '#caa46a';
    cx.clearRect(0,0,36,36); cx.drawImage(img,0,0,36,36);
    let d; try{ d=cx.getImageData(0,0,36,36).data; }catch(e){ return '#caa46a'; }
    let r=0,g=0,b=0,n=0;
    for(let p=0;p<d.length;p+=4){
      const R=d[p],Gc=d[p+1],B=d[p+2],l=0.2126*R+0.7152*Gc+0.0722*B;
      if(l<26||l>232) continue;
      const s=Math.max(R,Gc,B)-Math.min(R,Gc,B), w=1+s/128;
      r+=R*w; g+=Gc*w; b+=B*w; n+=w;
    }
    if(!n) return '#caa46a';
    r/=n; g/=n; b/=n; const a=(r+g+b)/3, K=1.3;
    r=Math.min(255,a+(r-a)*K); g=Math.min(255,a+(g-a)*K); b=Math.min(255,a+(b-a)*K);
    return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')';
  }
  function preloadSrc(src){
    if(!src || cache[src]) return cache[src];
    const img = new Image();
    img.onload = () => { if(!dom[src]) dom[src] = dominant(img); };
    img.src = src; cache[src] = img; return img;
  }
  function heroOf(room){ return room.photos[room.heroIdx] || room.photos[0]; }
  const ease = x => x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2;
  const clampC = v => Math.max(0, Math.min(rooms.length-1, v));

  let mode='entry';   // entry | strip (the index) | room
  function setMode(m){ mode=m; document.body.classList.toggle('strip', m==='strip'); document.body.classList.toggle('room', m==='room'); }

  // ================= INDEX (overview) =================
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let entering=false, ixRaf=0, activeIdx=0, clusterIdx=-1, lastTrans=0;
  // one artistic collage arrangement, reused for every place (hero biggest/centre, rest scattered)
  const SLOTS=[
    {x:53,y:47,w:19,r:-2.5},{x:24,y:26,w:12.5,r:4},{x:79,y:24,w:13,r:-5},{x:19,y:67,w:12,r:-3.5},
    {x:82,y:63,w:11,r:5.5},{x:47,y:83,w:10.5,r:2.5},{x:36,y:13,w:9,r:-7},{x:68,y:87,w:9.5,r:6.5}
  ];
  function clusterSrcs(rm){ return rm.photos.slice(0,SLOTS.length).map(p=>p.card||p.src); }
  function buildIndex(){
    const N=rooms.length, tot=String(N).padStart(2,'0');
    ixScroll.innerHTML = rooms.map((rm,i)=>
      '<a class="ix-item" data-i="'+i+'"><span class="ix-num">'+String(i+1).padStart(2,'0')+' / '+tot+'</span>'
      +'<span class="ix-loc">'+esc(rm.title)+'</span>'
      +'<span class="ix-sub">'+rm.count+' photograph'+(rm.count>1?'s':'')+'</span></a>'
    ).join('');
    ixMenu.innerHTML = rooms.map((rm,i)=>'<a data-i="'+i+'">'+esc(rm.title)+'</a>').join('');
    rooms.forEach(rm=>preloadSrc(heroOf(rm).src));
    setTimeout(()=>rooms.forEach(rm=>clusterSrcs(rm).forEach(preloadSrc)), 600);   // warm every cluster for smooth reforms
    [...ixScroll.children].forEach(el=>el.addEventListener('click',()=>choosePlace(+el.dataset.i)));
    [...ixMenu.children].forEach(el=>el.addEventListener('click',()=>scrollToPlace(+el.dataset.i)));
    ixScroll.addEventListener('scroll', ()=>{ if(!ixRaf) ixRaf=requestAnimationFrame(()=>{ ixRaf=0; onFrame(); }); }, {passive:true});
    setCluster(0,false); activeIdx=0; markActive(); onFrame();
  }
  // as names scroll, the one nearest centre is "active" — and the cluster explode/reforms to it
  function onFrame(){
    if(entering) return;
    const cy=innerHeight*0.5, kids=ixScroll.children; let best=0,bd=1e9;
    for(let i=0;i<kids.length;i++){ const r=kids[i].getBoundingClientRect(); const dd=Math.abs(r.top+r.height/2-cy); if(dd<bd){bd=dd;best=i;} }
    if(best!==activeIdx){ activeIdx=best; markActive(); maybeTransition(best); }
  }
  function markActive(){
    [...ixScroll.children].forEach((el,i)=>el.classList.toggle('active', i===activeIdx));
    [...ixMenu.children].forEach((el,i)=>el.classList.toggle('on', i===activeIdx));
  }
  function scrollToPlace(i){ const el=ixScroll.children[i]; if(el) ixScroll.scrollTo({top:el.offsetTop,behavior:'smooth'}); }

  function homeTf(sl){ return 'translate(-50%,-50%) rotate('+sl.r+'deg) scale(1)'; }
  function boomTf(sl,scale,push){ const dx=((sl.x-50)/50)*push, dy=((sl.y-50)/50)*(push*0.82);
    return 'translate(-50%,-50%) translate('+dx.toFixed(1)+'vw,'+dy.toFixed(1)+'vh) rotate('+(sl.r*2.6).toFixed(1)+'deg) scale('+scale+')'; }
  function makeThumb(src,sl){ const t=document.createElement('div'); t.className='ix-thumb';
    t.style.setProperty('--x',sl.x+'%'); t.style.setProperty('--y',sl.y+'%'); t.style.setProperty('--w',sl.w+'vw'); t.style.setProperty('--r',sl.r+'deg');
    t.innerHTML='<img src="'+src+'" alt="">'; t.__sl=sl; return t; }
  // rebuild the cluster for place i. animate: old thumbs explode outward, new thumbs reform inward.
  function setCluster(i,animate){
    const srcs=clusterSrcs(rooms[i]), old=[...ixCluster.children];
    srcs.forEach(preloadSrc);
    const news=srcs.map((s,k)=>makeThumb(s,SLOTS[k]));
    news.forEach((t,k)=>{ if(animate){ t.style.transition='none'; t.style.opacity='0'; t.style.transform=boomTf(SLOTS[k],0.15,34); } ixCluster.appendChild(t); });
    if(animate){
      old.forEach(t=>{ t.style.transition='transform .72s cubic-bezier(.5,0,.5,1),opacity .6s ease'; t.style.transform=boomTf(t.__sl,0.15,34); t.style.opacity='0'; setTimeout(()=>t.remove(),740); });
      requestAnimationFrame(()=>requestAnimationFrame(()=>{ news.forEach((t,k)=>{ t.style.transition='transform 1s cubic-bezier(.16,.7,.2,1),opacity .8s ease'; t.style.transform=homeTf(SLOTS[k]); t.style.opacity='1'; }); }));
    } else {
      old.forEach(t=>t.remove());
      news.forEach((t,k)=>{ t.style.transform=homeTf(SLOTS[k]); t.style.opacity='1'; });
    }
    clusterIdx=i;
  }
  function maybeTransition(i){
    if(i===clusterIdx) return;
    const now=performance.now(), animate=(now-lastTrans>260); lastTrans=now;   // snap through fast scroll, animate once it settles
    setCluster(i,animate);
  }
  // choose a place → the cluster zooms toward the viewer and the index dissolves into the room
  function choosePlace(i){
    if(mode!=='strip'||entering) return;
    [...ixCluster.children].forEach(t=>{ t.style.transition='transform 1.15s cubic-bezier(.5,0,.3,1),opacity 1.1s ease'; t.style.transform=boomTf(t.__sl,1.9,26); t.style.opacity='0'; });
    goFullscreen();
    enterRoom(i);
  }
  function resetIndex(scrollToI){
    if(scrollToI!=null){ const el=ixScroll.children[scrollToI]; if(el){ ixScroll.scrollTop=el.offsetTop; activeIdx=scrollToI; } }
    markActive(); setCluster(activeIdx,false);
  }
  function chooseCentred(){ choosePlace(activeIdx); }

  // ================= SPOTLIGHT ROOM =================
  let currentRoom=null, roomIdx=0, roomFrom=0, phase='rise', t0=0, sitting=false, roomPending=1, pendingExit=false, roomRunning=false;
  const RISE=reduce?900:4000, HOLD=reduce?2500:7000, FALL=reduce?900:4000, BLACK=reduce?300:1100;

  function swapRoom(){
    const p=currentRoom.photos[roomIdx];
    photo.src=p.src;
    document.documentElement.style.setProperty('--dom', dom[p.src] || '#caa46a');
    capTitle.textContent=p.title||'';
    capCue.style.display='none';
    capPlace.textContent=p.place||''; capPlace.style.display=p.place?'':'none';
    back.classList.add('avail');
    const ni=(roomIdx+1)%currentRoom.photos.length;
    preloadSrc(currentRoom.photos[ni].src);
  }
  function setReveal(light){
    if(light<=0.02){ reveal.style.background='#000'; return; }
    const r=light*maxR, rx=(r*1.35).toFixed(1), ry=(r*0.78).toFixed(1);
    const a0=1-light, s1=a0.toFixed(3), s2=(a0+(1-a0)*0.30).toFixed(3), s3=(a0+(1-a0)*0.65).toFixed(3);
    reveal.style.background='radial-gradient(ellipse '+rx+'px '+ry+'px at 50% 46%, rgba(0,0,0,'+s1+') 0%, rgba(0,0,0,'+s1+') 14%, rgba(0,0,0,'+s2+') 42%, rgba(0,0,0,'+s3+') 70%, #000 100%)';
  }
  function roomLoop(now){
    if(mode!=='room'){ roomRunning=false; return; }
    requestAnimationFrame(roomLoop);
    const el=now-t0; let light;
    if(phase==='rise'){ light=ease(Math.min(1,el/RISE)); if(el>=RISE){ phase='hold'; t0=now; plate.classList.add('show'); } }
    else if(phase==='hold'){ light=1; if(!sitting && el>=HOLD){ phase='fall'; t0=now; plate.classList.remove('show'); } }
    else if(phase==='fall'){ light=1-ease(Math.min(1,el/FALL)); if(el>=FALL){ phase='black'; t0=now; } }
    else {
      light=0;
      if(el>=BLACK){
        if(pendingExit){ finishExit(); return; }
        roomIdx=(roomIdx+roomPending+currentRoom.photos.length)%currentRoom.photos.length; roomPending=1;
        swapRoom(); phase='rise'; t0=now;
      }
    }
    setReveal(light);
  }
  function goFall(){ if(phase==='rise'||phase==='hold'){ phase='fall'; t0=performance.now(); plate.classList.remove('show'); setSit(false); } }
  function setSit(on){ sitting=on; sitEl.classList.toggle('show', on && mode==='room' && phase==='hold'); if(!on) t0=performance.now(); }

  let enterTimers=[];
  function clearEnterTimers(){ enterTimers.forEach(clearTimeout); enterTimers=[]; }
  function startRoom(i){
    setMode('room'); currentRoom=rooms[i]; roomFrom=i; roomIdx=0; pendingExit=false; sitting=false;
    preloadSrc(currentRoom.photos[0].src);   // dominant colour resolves on load; glow uses a fallback until then
    swapRoom(); phase='rise'; t0=performance.now();
    if(!roomRunning){ roomRunning=true; requestAnimationFrame(roomLoop); }
  }
  // A slow, deliberate entry: the index dissolves to black, the title fades in, then the
  // subtitle, both breathe, fade to black, wait in darkness, then the print rises.
  const FADE_TXT = 2000;   // matches the CSS opacity transition on .h / .p
  function enterRoom(i){
    entering=true;
    clearEnterTimers();
    enterH.textContent='Now entering the '+rooms[i].title+' Gallery';
    enterMsg.classList.remove('h-in','p-in');
    indexView.classList.add('gone');                       // 1. index dissolves to black
    const T = reduce
      ? { pre:500,  subDelay:400,  hold:500,  black:400 }
      : { pre:1800, subDelay:1600, hold:1600, black:1300 };
    let t = T.pre;                                          // black settled before any text
    enterTimers.push(setTimeout(()=>enterMsg.classList.add('h-in'), t));           // 2. title fades in
    t += T.subDelay;
    enterTimers.push(setTimeout(()=>enterMsg.classList.add('p-in'), t));           // 3. subtitle fades in, after the title
    t += FADE_TXT + T.hold;                                 // wait for subtitle to arrive, then breathe
    enterTimers.push(setTimeout(()=>enterMsg.classList.remove('h-in','p-in'), t)); // 4. message fades to black
    t += FADE_TXT + T.black;                                // wait for it to fade out, then a beat of pure black
    enterTimers.push(setTimeout(()=>startRoom(i), t));      // 5. the first print rises
  }
  function exitToStrip(){ if(mode!=='room') return; pendingExit=true; goFall(); }
  function finishExit(){
    roomRunning=false; back.classList.remove('avail'); plate.classList.remove('show');
    clearEnterTimers(); enterMsg.classList.remove('h-in','p-in');
    setMode('strip'); entering=false;
    resetIndex(roomFrom);                                  // reopen the index at the place we left
    indexView.classList.remove('gone');
  }

  back.addEventListener('click', e => { e.stopPropagation(); exitToStrip(); });

  // ================= ENTRY + GLOBAL INPUT =================
  function goFullscreen(){
    try{ const el=document.documentElement, rq=el.requestFullscreen||el.webkitRequestFullscreen;
      if(rq && !document.fullscreenElement && !document.webkitFullscreenElement){ const r=rq.call(el); if(r&&r.catch) r.catch(()=>{}); } }catch(e){}
  }
  addEventListener('pointerdown', e => {
    if(mode==='room' && phase==='hold'){
      if(e.target && e.target.closest && e.target.closest('#back')) return;
      setSit(!sitting);
    }
  });
  addEventListener('keydown', e => {
    if(mode==='strip'){
      if(e.key==='ArrowDown'||e.key==='PageDown'||e.key===' '){ e.preventDefault(); ixScroll.scrollBy({top:innerHeight*0.9,behavior:'smooth'}); }
      else if(e.key==='ArrowUp'||e.key==='PageUp'){ e.preventDefault(); ixScroll.scrollBy({top:-innerHeight*0.9,behavior:'smooth'}); }
      else if(e.key==='Home'){ e.preventDefault(); ixScroll.scrollTo({top:0,behavior:'smooth'}); }
      else if(e.key==='Enter'){ e.preventDefault(); chooseCentred(); }
    } else if(mode==='room'){
      if(e.key==='ArrowRight'||e.key===' '){ e.preventDefault(); roomPending=1; goFall(); }
      else if(e.key==='ArrowLeft'){ e.preventDefault(); roomPending=-1; goFall(); }
      else if(e.key==='Escape'){ exitToStrip(); }
    }
  });

  // idle: fade chrome + cursor after stillness
  let idle;
  function wake(){ document.body.classList.remove('ui-hidden'); clearTimeout(idle); idle=setTimeout(()=>document.body.classList.add('ui-hidden'), 3800); }
  ['mousemove','pointerdown','wheel','keydown','touchstart'].forEach(ev=>addEventListener(ev,wake,{passive:true}));
  wake();

  addEventListener('resize', () => { setMax(); if(mode==='strip') onFrame(); });
  setMax();

  // land straight on the index
  setMode('strip'); buildIndex();
})();
