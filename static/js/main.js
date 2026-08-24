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
  let entering=false, activeIdx=0, clusterIdx=-1, homes=[], ixRaf=0;
  function clusterSrcs(rm){ return rm.photos.slice(0,9).map(p=>p.card||p.src); }
  function buildIndex(){
    const N=rooms.length, tot=String(N).padStart(2,'0');
    ixScroll.innerHTML = rooms.map((rm,i)=>
      '<a class="ix-item" data-i="'+i+'"><span class="ix-num">'+String(i+1).padStart(2,'0')+' / '+tot+'</span>'
      +'<span class="ix-loc">'+esc(rm.title)+'</span>'
      +'<span class="ix-sub">'+rm.count+' photograph'+(rm.count>1?'s':'')+'</span></a>'
    ).join('');
    ixMenu.innerHTML = rooms.map((rm,i)=>'<a data-i="'+i+'">'+esc(rm.title)+'</a>').join('');
    rooms.forEach(rm=>preloadSrc(heroOf(rm).src));
    setTimeout(()=>rooms.forEach(rm=>clusterSrcs(rm).forEach(preloadSrc)), 500);   // warm every grid
    [...ixScroll.children].forEach(el=>el.addEventListener('click',()=>choosePlace(+el.dataset.i, 0)));
    [...ixMenu.children].forEach(el=>el.addEventListener('click',()=>scrollToPlace(+el.dataset.i)));
    ixScroll.addEventListener('scroll', onScroll, {passive:true});
    // click a photograph in the grid → enter that place, starting the slideshow from that photo
    ixScroll.addEventListener('click', e=>{ if(mode!=='strip'||entering) return; if(e.target.closest&&e.target.closest('.ix-item')) return; const k=hitTile(e); if(k>=0) choosePlace(activeIdx, k); });
    ixScroll.addEventListener('mousemove', e=>{ if(mode==='strip') ixScroll.style.cursor = hitTile(e)>=0 ? 'pointer' : ''; });
    setCluster(0); markActive(); requestAnimationFrame(()=>{ measureHomes(); applyCluster(); });
  }
  function hitTile(e){
    const t=ixCluster.children;
    for(let i=0;i<t.length;i++){ const r=t[i].getBoundingClientRect();
      if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom) return i; }
    return -1;
  }
  function itemH(){ return (ixScroll.children[0]&&ixScroll.children[0].offsetHeight)||innerHeight; }
  function onScroll(){ if(!ixRaf) ixRaf=requestAnimationFrame(()=>{ ixRaf=0; applyCluster(); }); }
  function markActive(){
    [...ixScroll.children].forEach((el,i)=>el.classList.toggle('active', i===activeIdx));
    [...ixMenu.children].forEach((el,i)=>el.classList.toggle('on', i===activeIdx));
  }
  function scrollToPlace(i){ const el=ixScroll.children[i]; if(el) ixScroll.scrollTo({top:el.offsetTop,behavior:'smooth'}); }

  // The grid is scroll-driven: imploded (home) at a place's centre; as you scroll away each tile
  // flies outward from the grid centre and fades; at the midpoint it swaps to the next place's tiles
  // (fully exploded + faded) which implode as that place scrolls to centre. A lerp keeps it buttery.
  function setCluster(i){
    clusterIdx=i;
    ixCluster.innerHTML = clusterSrcs(rooms[i]).map(s=>'<div class="ix-thumb"><img src="'+s+'" alt=""></div>').join('');
    [...ixCluster.querySelectorAll('img')].forEach(im=>{ if(!im.complete) im.addEventListener('load',measureHomes,{once:true}); });
  }
  function measureHomes(){
    const cb=ixCluster.getBoundingClientRect(), ccx=cb.left+cb.width/2, ccy=cb.top+cb.height/2;
    homes=[...ixCluster.children].map((t,i)=>{ const r=t.getBoundingClientRect();
      const vx=r.left+r.width/2-ccx, vy=r.top+r.height/2-ccy;
      // polar home + per-tile swirl/spin, so tiles spiral out along curved (murmuration) arcs
      return {vx,vy,r:Math.hypot(vx,vy)||1,ang:Math.atan2(vy,vx),sw:2.3*(1+0.3*Math.sin(i*1.7)),spin:13*Math.sin(i*2.3)}; });
  }
  // scroll-driven grid: a dead zone holds it imploded near a place's centre (a magnetic hold),
  // then each tile flies outward as you push past. Mandatory scroll-snap "clicks" it back home.
  function applyCluster(){
    if(entering || mode!=='strip') return;
    const N=rooms.length, p=ixScroll.scrollTop/itemH();
    const active=Math.max(0,Math.min(N-1,Math.round(p)));
    if(active!==clusterIdx){ setCluster(active); measureHomes(); }
    if(active!==activeIdx){ activeIdx=active; markActive(); }
    let a=Math.max(0,Math.min(1,(Math.abs(p-active)-0.12)/0.36));   // flat dead zone near centre, then ramp
    const amt=a*a*(3-2*a);                                          // smoothstep
    const OUT=1.5, op=1-amt, kids=ixCluster.children;
    for(let i=0;i<kids.length;i++){ const h=homes[i]; if(!h) continue;
      const ang=h.ang+amt*h.sw, dist=h.r*(1+amt*OUT);              // spiral out along a curved arc
      const tx=dist*Math.cos(ang)-h.vx, ty=dist*Math.sin(ang)-h.vy;
      kids[i].style.transform='translate('+tx.toFixed(1)+'px,'+ty.toFixed(1)+'px) rotate('+(amt*h.spin).toFixed(1)+'deg) scale('+(1-0.62*amt).toFixed(3)+')';
      kids[i].style.opacity=op.toFixed(3);
    }
  }
  // choose a place → blow the grid apart toward the viewer while the index dissolves into the room
  // choose a place (optionally starting the slideshow at photo `startAt`) → the grid swirls apart
  // and dissipates as the index dissolves into the room.
  function choosePlace(i, startAt){
    if(mode!=='strip'||entering) return;
    entering=true;
    const kids=ixCluster.children;
    for(let k=0;k<kids.length;k++){ const h=homes[k]||{r:1,ang:0,sw:2,spin:0,vx:0,vy:0};
      const ang=h.ang+h.sw*1.25, dist=h.r*3.4;
      kids[k].style.transition='transform 1.1s cubic-bezier(.5,0,.3,1),opacity 1s ease';
      kids[k].style.transform='translate('+(dist*Math.cos(ang)-h.vx).toFixed(1)+'px,'+(dist*Math.sin(ang)-h.vy).toFixed(1)+'px) rotate('+(h.spin*1.6).toFixed(1)+'deg) scale(.18)';
      kids[k].style.opacity='0'; }
    goFullscreen(); enterRoom(i, startAt||0);
  }
  function resetIndex(scrollToI){
    if(scrollToI!=null){ const el=ixScroll.children[scrollToI]; if(el){ ixScroll.scrollTop=el.offsetTop; activeIdx=scrollToI; } }
    markActive(); clusterIdx=-1; setCluster(activeIdx);
    [...ixCluster.children].forEach(t=>{ t.style.transition=''; t.style.transform='none'; t.style.opacity='1'; });
    requestAnimationFrame(()=>{ measureHomes(); applyCluster(); });
  }
  function chooseCentred(){ choosePlace(activeIdx, 0); }

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
  function startRoom(i, startAt){
    setMode('room'); currentRoom=rooms[i]; roomFrom=i;
    roomIdx=Math.max(0, Math.min(currentRoom.photos.length-1, startAt||0));   // slideshow begins here
    pendingExit=false; sitting=false;
    preloadSrc(currentRoom.photos[roomIdx].src);   // dominant colour resolves on load; glow uses a fallback until then
    swapRoom(); phase='rise'; t0=performance.now();
    if(!roomRunning){ roomRunning=true; requestAnimationFrame(roomLoop); }
  }
  // A slow, deliberate entry: the index dissolves to black, the title fades in, then the
  // subtitle, both breathe, fade to black, wait in darkness, then the print rises.
  const FADE_TXT = 2000;   // matches the CSS opacity transition on .h / .p
  function enterRoom(i, startAt){
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
    enterTimers.push(setTimeout(()=>startRoom(i, startAt||0), t));   // 5. the chosen print rises
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

  addEventListener('resize', () => { setMax(); if(mode==='strip'){ measureHomes(); applyCluster(); } });
  setMax();

  // land straight on the index
  setMode('strip'); buildIndex();
})();
