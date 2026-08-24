// The gallery. Default view is a dark, continuously-scrolling editorial INDEX of places
// (giant serif names + hero prints). Choosing a place dissolves into the spotlight ROOM —
// the lit framed print for that location, cycling its photographs. "Back" returns to the index.
(function(){
  const G = window.GALLERY || {rooms:[]};
  const rooms = G.rooms || [];
  const $ = id => document.getElementById(id);
  const photo=$('photo'), plate=$('plate'), capTitle=$('capTitle'), capPlace=$('capPlace'), capCue=$('capCue'),
        reveal=$('reveal'), back=$('back'), sitEl=$('sit'), locLink=$('locLink');
  const indexView=$('indexView'), ixScroll=$('ixScroll'), ixCount=$('ixCount');
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
  let entering=false, ixRaf=0;
  function heroImg(rm){ const h=heroOf(rm); return h.card||h.src; }
  function buildIndex(){
    const N=rooms.length, tot=String(N).padStart(2,'0');
    ixScroll.innerHTML = rooms.map((rm,i)=>
      '<a class="ix-item" data-i="'+i+'">'
      +'<figure class="ix-fig"><img src="'+heroImg(rm)+'" alt="'+esc(rm.title)+'"></figure>'
      +'<div class="ix-caption"><span class="ix-num">'+String(i+1).padStart(2,'0')+' / '+tot+'</span>'
      +'<span class="ix-loc">'+esc(rm.title)+'</span>'
      +'<span class="ix-sub">'+rm.count+' photograph'+(rm.count>1?'s':'')+'</span></div></a>'
    ).join('');
    ixCount.textContent = tot+' places';
    rooms.forEach(rm=>preloadSrc(heroOf(rm).src));
    const io=new IntersectionObserver(es=>es.forEach(en=>{ if(en.isIntersecting) en.target.classList.add('in'); }),{threshold:.18});
    [...ixScroll.children].forEach(el=>io.observe(el));
    ixScroll.addEventListener('scroll', ()=>{ if(!ixRaf) ixRaf=requestAnimationFrame(()=>{ ixRaf=0; parallax(); }); }, {passive:true});
    parallax();
  }
  // subtle parallax: the print and the name drift at slightly different rates as they pass centre
  function parallax(){
    if(entering) return;
    const vh=innerHeight, cy=vh/2, kids=ixScroll.children;
    for(let k=0;k<kids.length;k++){
      const el=kids[k], r=el.getBoundingClientRect();
      if(r.bottom<-vh*0.6 || r.top>vh*1.6) continue;
      const d=(r.top+r.height/2-cy)/vh;                       // -1..1 across the viewport
      const img=el.querySelector('img');   if(img) img.style.transform='translateY('+(d*8).toFixed(2)+'%) scale(1.12)';
      const cap=el.querySelector('.ix-caption'); if(cap) cap.style.transform='translateY(calc(-50% + '+(d*-2.4).toFixed(2)+'vh))';
    }
  }
  // choose a place → the print zooms and the index dissolves into the dark room
  function choosePlace(a){
    if(mode!=='strip'||entering) return;
    const img=a.querySelector('.ix-fig img');
    if(img){ img.style.transition='transform 1.25s cubic-bezier(.5,0,.2,1),filter 1.25s ease';
      img.style.transform='translateY(0) scale(1.4)'; img.style.filter='brightness(.66)'; }
    a.classList.add('leaving');
    goFullscreen();
    enterRoom(+a.dataset.i);
  }
  ixScroll.addEventListener('click', e=>{ const a=e.target.closest('.ix-item'); if(a) choosePlace(a); });
  function resetIndex(scrollToI){
    [...ixScroll.children].forEach(el=>{ el.classList.remove('leaving');
      const im=el.querySelector('img'); if(im){ im.style.transition=''; im.style.transform='scale(1.12)'; im.style.filter=''; } });
    if(scrollToI!=null){ const el=ixScroll.children[scrollToI]; if(el) ixScroll.scrollTop=el.offsetTop; }
    parallax();
  }
  function chooseCentred(){
    const cy=innerHeight/2; let best=null,bd=1e9;
    [...ixScroll.children].forEach(el=>{ const r=el.getBoundingClientRect(); const c=Math.abs(r.top+r.height/2-cy); if(c<bd){bd=c;best=el;} });
    if(best) choosePlace(best);
  }

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

  addEventListener('resize', () => { setMax(); if(mode==='strip') parallax(); });
  setMax();

  // land straight on the index
  setMode('strip'); buildIndex();
})();
