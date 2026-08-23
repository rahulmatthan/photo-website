// The gallery. Default view is a filmstrip carousel of location cards (drag / scroll
// to browse). Clicking the centred card flips into the spotlight — the lit framed
// print for that location, cycling its photographs. "Back" returns to the filmstrip.
(function(){
  const G = window.GALLERY || {rooms:[]};
  const rooms = G.rooms || [];
  const $ = id => document.getElementById(id);
  const photo=$('photo'), plate=$('plate'), capTitle=$('capTitle'), capPlace=$('capPlace'), capCue=$('capCue'),
        reveal=$('reveal'), entry=$('entry'), back=$('back'), sitEl=$('sit'), locLink=$('locLink');
  const filmstrip=$('filmstrip'), stripStage=$('stripStage'), stripLabel=$('stripLabel');
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

  let mode='entry';   // entry | strip | room
  function setMode(m){ mode=m; document.body.classList.toggle('strip', m==='strip'); document.body.classList.toggle('room', m==='room'); }

  // ================= FILMSTRIP =================
  const cards=[];
  rooms.forEach((rm,i)=>{
    const c=document.createElement('button'); c.className='card'; c.type='button'; c.dataset.i=i;
    const img=document.createElement('img'); img.alt=rm.title;
    img.src = heroOf(rm).card || heroOf(rm).src;
    c.appendChild(img); stripStage.appendChild(c); cards.push(c);
    c.addEventListener('click', () => {
      if(stripMoved) return;
      if(i===Math.round(center)) enterRoom(i);
      else { targetCenter=i; pauseDrift(); }
    });
  });

  let center=0, targetCenter=0, dragging=false, startX=0, startCenter=0, stripMoved=false,
      spacing=460, nextDrift=0, driftDir=1, autoResumeAt=0, stripRunning=false, wheeling=false, wheelTO=null;
  const DRIFT_MS = reduce ? 1e12 : 9000;

  function computeSpacing(){ const cw = cards[0] ? cards[0].offsetWidth : 460; spacing = cw*0.66; }
  function renderStrip(){
    for(let i=0;i<cards.length;i++){
      const o=i-center, ab=Math.abs(o);
      const card=cards[i];
      if(ab>3.2){ card.style.opacity='0'; card.style.pointerEvents='none'; continue; }
      const scale=Math.max(0.5, 1-ab*0.26);
      // near plates stay fully opaque (solid); only the far ones fade out, so you
      // never see the next plate through the one in front.
      const op = ab<2.0 ? 1 : Math.max(0, 1-(ab-2.0)*0.85);
      const tx=o*spacing, ry=Math.max(-1,Math.min(1,o))*-28, tz=-ab*160;
      const rz=Math.max(-6, Math.min(6, o*-2.4));   // side plates tilt like leafed pages; centre straightens
      card.style.transform='translate(-50%,-50%) translateX('+tx.toFixed(1)+'px) translateZ('+tz.toFixed(1)+'px) rotateY('+ry.toFixed(2)+'deg) rotateZ('+rz.toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
      card.style.opacity=op.toFixed(3);
      card.style.zIndex=String(100-Math.round(ab*10));
      card.style.pointerEvents = ab<1.5 ? 'auto' : 'none';
      card.classList.toggle('center', ab<0.5);
    }
  }
  let lastLabel=-1;
  function updateLabel(){
    const ci=Math.round(center);
    if(ci!==lastLabel && rooms[ci]){ lastLabel=ci;
      stripLabel.innerHTML='<span class="loc">'+rooms[ci].title+'</span><span class="sub">'+rooms[ci].count+' photograph'+(rooms[ci].count>1?'s':'')+'</span>';
      preloadSrc(heroOf(rooms[ci]).src);   // warm the spotlight hero for a quick flip
    }
  }
  function pauseDrift(){ autoResumeAt = performance.now() + (reduce?0:7000); }
  function advanceDrift(){
    let n=Math.round(center)+driftDir;
    if(n>rooms.length-1){ driftDir=-1; n=Math.round(center)+driftDir; }
    else if(n<0){ driftDir=1; n=Math.round(center)+driftDir; }
    targetCenter=clampC(n);
  }
  function stripLoop(now){
    if(mode!=='strip'){ stripRunning=false; return; }
    requestAnimationFrame(stripLoop);
    if(!dragging && !wheeling){
      center += (targetCenter-center)*0.12;
      if(Math.abs(targetCenter-center)<0.0015) center=targetCenter;
      if(now>=autoResumeAt && now>=nextDrift){ advanceDrift(); nextDrift=now+DRIFT_MS; }
    }
    renderStrip(); updateLabel();
  }
  function startStrip(){ if(!stripRunning){ stripRunning=true; nextDrift=performance.now()+DRIFT_MS; requestAnimationFrame(stripLoop); } }

  // drag (no pointer capture — capture would steal the pointerup and kill the card click)
  stripStage.addEventListener('pointerdown', e => {
    if(mode!=='strip') return;
    dragging=true; stripMoved=false; startX=e.clientX; startCenter=center; pauseDrift();
  });
  addEventListener('pointermove', e => {
    if(!dragging) return;
    const dx=e.clientX-startX; if(Math.abs(dx)>8) stripMoved=true;
    center=clampC(startCenter - dx/spacing);
  });
  addEventListener('pointerup', () => {
    if(!dragging) return;
    dragging=false; targetCenter=clampC(Math.round(center)); pauseDrift();
  });
  // two-finger scroll — horizontal (natural for the carousel) or vertical, continuous + snap
  addEventListener('wheel', e => {
    if(mode!=='strip') return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    center = clampC(center + d*0.004);
    wheeling=true; pauseDrift();
    clearTimeout(wheelTO);
    wheelTO = setTimeout(() => { wheeling=false; targetCenter=clampC(Math.round(center)); }, 150);
  }, {passive:true});

  // ================= SPOTLIGHT ROOM =================
  let currentRoom=null, roomIdx=0, roomFrom=0, phase='rise', t0=0, sitting=false, roomPending=1, pendingExit=false, roomRunning=false, msgShown=false;
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
  // A slow, deliberate entry: strip -> black, settle, title fades in, then the
  // subtitle, both breathe, fade to black, wait in darkness, then the print rises.
  const FADE_TXT = 2000;   // matches the CSS opacity transition on .h / .p
  function enterRoom(i){
    clearEnterTimers();
    enterH.textContent='Now entering the '+rooms[i].title+' Gallery';
    enterMsg.classList.remove('h-in','p-in');
    filmstrip.classList.add('gone');                       // 1. strip fades to black (1.3s)
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
    setMode('strip');
    center=targetCenter=roomFrom; lastLabel=-1; renderStrip(); updateLabel();
    filmstrip.classList.remove('gone');
    pauseDrift(); startStrip();
  }

  back.addEventListener('click', e => { e.stopPropagation(); exitToStrip(); });

  // ================= ENTRY + GLOBAL INPUT =================
  let started=false, autoEnter=null;
  function startGallery(){
    if(started) return; started=true; clearTimeout(autoEnter);
    entry.classList.add('gone');
    setMode('strip'); center=0; targetCenter=0; computeSpacing(); renderStrip(); updateLabel(); startStrip();
  }
  addEventListener('pointerdown', e => {
    if(e.target && e.target.closest && (e.target.closest('#back') || e.target.closest('.card'))) return;
    if(!started){ startGallery(); return; }
    if(mode==='room' && phase==='hold'){ setSit(!sitting); }
  });
  addEventListener('keydown', e => {
    if(!started){ startGallery(); return; }
    if(mode==='strip'){
      if(e.key==='ArrowRight'){ targetCenter=clampC(Math.round(center)+1); pauseDrift(); }
      else if(e.key==='ArrowLeft'){ targetCenter=clampC(Math.round(center)-1); pauseDrift(); }
      else if(e.key==='Enter'||e.key===' '){ e.preventDefault(); enterRoom(Math.round(center)); }
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

  addEventListener('resize', () => { setMax(); computeSpacing(); if(mode==='strip') renderStrip(); });
  setMax();

  autoEnter = setTimeout(startGallery, reduce?2000:5000);
})();
