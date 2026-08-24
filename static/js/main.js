// The gallery. Default view is a full-screen portfolio BOOK — leaf through the
// spreads (one location each: a matted plate on the left page, an editorial
// label on the right). Opening a plate flips into the spotlight — the lit framed
// print for that location, cycling its photographs. "Back" returns to the book.
(function(){
  const G = window.GALLERY || {rooms:[]};
  const rooms = G.rooms || [];
  const $ = id => document.getElementById(id);
  const photo=$('photo'), plate=$('plate'), capTitle=$('capTitle'), capPlace=$('capPlace'), capCue=$('capCue'),
        reveal=$('reveal'), cover=$('cover'), back=$('back'), sitEl=$('sit'), locLink=$('locLink');
  const book=$('book'), spread=$('spread'), sheet=$('sheet'), leaf=$('leaf');
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

  let mode='entry';   // entry | strip (the book) | room
  function setMode(m){ mode=m; document.body.classList.toggle('strip', m==='strip'); document.body.classList.toggle('room', m==='room'); }

  // ================= BOOK (overview) =================
  const FLIP = reduce ? 420 : 1250;
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // one leaf of the book: the photograph centred at full aspect, plus a small caption
  function sheetHTML(rm){ const h=heroOf(rm);
    return '<div class="head"><span class="n">Rahul Matthan</span><span class="s">Photography</span></div>'
      +'<div class="art"><img class="pimg" src="'+(h.card||h.src)+'" alt="'+esc(rm.title)+'"></div>'
      +'<div class="cap"><span class="loc">'+esc(rm.title)+'</span>'
      +'<span class="sub">'+rm.count+' photograph'+(rm.count>1?'s':'')+'</span>'
      +'<span class="enter" data-enter="1">enter the gallery</span></div>'; }

  let bookIdx=0, flipping=false, wheelLock=false;
  function showSpread(i){
    bookIdx=clampC(i);
    sheet.innerHTML=sheetHTML(rooms[bookIdx]);
    preloadSrc(heroOf(rooms[bookIdx]).src);                 // warm current + neighbours for quick flips
    if(rooms[bookIdx+1]) preloadSrc(heroOf(rooms[bookIdx+1]).src);
    if(rooms[bookIdx-1]) preloadSrc(heroOf(rooms[bookIdx-1]).src);
  }

  // ---- the bending page-turn: a chain of nested strips whose tangent sweeps an arc, so the paper
  //      curves like real paper instead of pivoting flat. Adapted from Meng To's ThreeUI sketchbook
  //      (github.com/MengTo/threeui, MIT). Each strip clips a vertical slice of a full-page clone.
  const NST = reduce ? 7 : 15;   // number of strips — more = smoother curve
  const BETA = 0.62;             // peak bend of the arc, in radians
  let turnStrips=[];
  function buildLeaf(rm){
    leaf.textContent='';
    leaf.style.setProperty('--n', NST);
    leaf.style.setProperty('--bw', sheet.clientWidth+'px');
    const inner=sheetHTML(rm); turnStrips=[]; let host=leaf;
    for(let i=0;i<NST;i++){
      const s=document.createElement('div'); s.className='strip'; s.style.setProperty('--i',i);
      const f=document.createElement('div'); f.className='face';
      const cl=document.createElement('div'); cl.className='clone'; cl.innerHTML=inner;
      const sh=document.createElement('div'); sh.className='sh';
      f.appendChild(cl); f.appendChild(sh); s.appendChild(f);
      host.appendChild(s); host=s; turnStrips.push(s);
    }
  }
  function applyTurn(t){
    const beta=BETA*Math.sin(Math.PI*t), D=180/Math.PI;
    const tt=Math.PI*t + beta, td=2*beta/NST;
    leaf.style.setProperty('--tt',(tt*D).toFixed(2)+'deg');
    leaf.style.setProperty('--td',(td*D).toFixed(3)+'deg');
    for(let i=0;i<turnStrips.length;i++){
      const l1=Math.abs(Math.cos(tt-i*td)), l2=Math.abs(Math.cos(tt-(i+1)*td));
      const st=turnStrips[i].style;
      st.setProperty('--a1',((1-l1)*.5).toFixed(3));
      st.setProperty('--a2',((1-l2)*.5).toFixed(3));
    }
  }
  // Forward: the current page bends away to the left (t 0→1), revealing the next beneath.
  // Backward: the previous page bends back in from the left (t 1→0), landing over the current.
  function turn(dir){
    if(flipping || mode!=='strip') return;
    const j=bookIdx+dir;
    if(j<0 || j>rooms.length-1) return;
    flipping=true;
    const leafRoom = dir>0 ? rooms[bookIdx] : rooms[j];      // the page that visibly turns
    const baseRoom = dir>0 ? rooms[j] : rooms[bookIdx];      // the page beneath / revealed
    sheet.innerHTML=sheetHTML(baseRoom);
    buildLeaf(leafRoom);
    leaf.classList.remove('hidden');
    applyTurn(dir>0 ? 0 : 1);
    const t0=performance.now();
    function frame(now){
      const p=Math.min(1,(now-t0)/FLIP), e=ease(p);
      applyTurn(dir>0 ? e : 1-e);
      if(p<1){ requestAnimationFrame(frame); return; }
      showSpread(j);
      leaf.classList.add('hidden'); leaf.textContent='';
      leaf.style.removeProperty('--tt'); leaf.style.removeProperty('--td');
      flipping=false;
    }
    requestAnimationFrame(frame);
  }

  // input: swipe / two-finger scroll to turn; tap a plate or "enter" cue to open the room
  let bStartX=0,bStartY=0,bDown=false,bMoved=false;
  spread.addEventListener('pointerdown', e=>{ if(mode!=='strip'||flipping) return; bDown=true; bMoved=false; bStartX=e.clientX; bStartY=e.clientY; });
  addEventListener('pointermove', e=>{ if(bDown && (Math.abs(e.clientX-bStartX)>10||Math.abs(e.clientY-bStartY)>10)) bMoved=true; });
  addEventListener('pointerup', e=>{
    if(!bDown) return; bDown=false;
    const dx=e.clientX-bStartX;
    if(bMoved && Math.abs(dx)>60){ turn(dx<0?1:-1); return; }   // swipe left = forward
    if(!bMoved && e.target && e.target.closest && (e.target.closest('.pimg') || e.target.closest('[data-enter]'))){
      enterRoom(bookIdx);
    }
  });
  addEventListener('wheel', e=>{
    if(mode!=='strip'||flipping||wheelLock) return;
    const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
    if(Math.abs(d)<8) return;
    wheelLock=true; setTimeout(()=>wheelLock=false, FLIP+140);
    turn(d>0?1:-1);
  },{passive:true});

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
  // A slow, deliberate entry: book -> black, settle, title fades in, then the
  // subtitle, both breathe, fade to black, wait in darkness, then the print rises.
  const FADE_TXT = 2000;   // matches the CSS opacity transition on .h / .p
  function enterRoom(i){
    clearEnterTimers();
    enterH.textContent='Now entering the '+rooms[i].title+' Gallery';
    enterMsg.classList.remove('h-in','p-in');
    book.classList.add('gone');                            // 1. book fades to black (1.3s)
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
    setMode('strip'); showSpread(roomFrom);                // reopen the book at the location we left
    book.classList.remove('gone');
  }

  back.addEventListener('click', e => { e.stopPropagation(); exitToStrip(); });

  // ================= ENTRY + GLOBAL INPUT =================
  function goFullscreen(){
    try{ const el=document.documentElement, rq=el.requestFullscreen||el.webkitRequestFullscreen;
      if(rq && !document.fullscreenElement && !document.webkitFullscreenElement){ const r=rq.call(el); if(r&&r.catch) r.catch(()=>{}); } }catch(e){}
  }
  let started=false, autoEnter=null;
  const readyAt = performance.now() + (reduce?0:350);      // ignore any stray pointer event at load
  // The site opens closed on the leather folio; the first gesture swings the cover
  // open on its spine, revealing the catalogue behind it.
  function openFolio(){
    if(started || performance.now() < readyAt) return;
    started=true; clearTimeout(autoEnter);
    cover.classList.add('open');
    let done=false;
    const finish=()=>{ if(done) return; done=true;
      cover.removeEventListener('transitionend',finish);
      document.body.classList.remove('sealed'); cover.classList.add('gone'); setMode('strip'); };
    cover.addEventListener('transitionend',finish);
    setTimeout(finish, reduce?800:2000);                     // safety past the open transition
  }
  addEventListener('pointerdown', e => {
    if(!started){ if(e.target && e.target.closest && e.target.closest('#back')) return; goFullscreen(); openFolio(); return; }
    if(e.target && e.target.closest && (e.target.closest('#back') || e.target.closest('#spread'))) return;
    if(mode==='room' && phase==='hold'){ setSit(!sitting); }
  });
  addEventListener('keydown', e => {
    if(!started){ goFullscreen(); openFolio(); return; }
    if(mode==='strip'){
      if(e.key==='ArrowRight'){ turn(1); }
      else if(e.key==='ArrowLeft'){ turn(-1); }
      else if(e.key==='Enter'||e.key===' '){ e.preventDefault(); enterRoom(bookIdx); }
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

  addEventListener('resize', setMax);
  setMax();

  // open sealed: the first page is rendered behind the closed leather cover
  setMode('entry'); document.body.classList.add('sealed'); showSpread(0);
  autoEnter = setTimeout(openFolio, reduce?3000:7000);
})();
