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
  const pcv=$('ixCanvas'), pcx = pcv && pcv.getContext('2d');
  const scv=document.createElement('canvas'), sxx=scv.getContext('2d',{willReadFrequently:true});
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
  let entering=false, activeIdx=0, clusterIdx=-1, ixRaf=0;
  function clusterSrcs(rm){ return rm.photos.slice(0,9).map(p=>p.card||p.src); }

  // ---- the particle field (Surendar-style). The sharp DOM grid dematerialises into tiny particles
  //      that are then drawn TOWARD the grid's centre into a soft, central, constantly-buzzing cloud
  //      (its resting state — image-agnostic, uniform warm-white). As you scroll toward the next
  //      place the cloud flows back out, each particle regaining that place's photo colour + grid
  //      position, reforming the grid. Because the resting cloud is identical for every place, the
  //      composite swap at mid-transition is invisible. `amt` (0 = settled grid, 1 = central cloud);
  //      a time clock drives the buzz so the cloud stays alive independent of scroll.
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const DOT = 1.3;                                   // base particle size (px) — fine, à la Surendar
  const sstep = x => { x = x<0?0:(x>1?1:x); return x*x*(3-2*x); };
  // a soft warm-white sprite — drawn scaled per particle for the depth-of-field bokeh: scaled up = a
  // big blurry "near" particle, scaled tiny = a sharp far speck (the look surendarselvaraj.com has).
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
  (function(){ const s=sprite.getContext('2d'); const g=s.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,251,242,1)'); g.addColorStop(.4,'rgba(255,249,238,0.45)'); g.addColorStop(1,'rgba(255,249,238,0)');
    s.fillStyle=g; s.fillRect(0,0,64,64); })();
  let P = null;
  function sizeCanvas(){
    if(!pcv) return;
    pcv.width = Math.round(innerWidth*DPR); pcv.height = Math.round(innerHeight*DPR);
    pcv.style.width = innerWidth+'px'; pcv.style.height = innerHeight+'px';
    pcx.setTransform(DPR,0,0,DPR,0,0);
  }
  function sampleParticles(){
    if(!pcx) return;
    const tiles=[...ixCluster.children];
    if(!tiles.length){ P=null; return; }
    const cb=ixCluster.getBoundingClientRect();
    const ox=Math.floor(cb.left), oy=Math.floor(cb.top), W=Math.ceil(cb.width), H=Math.ceil(cb.height);
    if(W<2||H<2){ P=null; return; }
    scv.width=W; scv.height=H; sxx.clearRect(0,0,W,H);
    let drew=0;
    for(const t of tiles){
      const im=t.querySelector('img'); if(!im) continue;
      const src=im.getAttribute('src'), dec=cache[src];
      const img=(dec&&dec.complete&&dec.naturalWidth)?dec:(im.complete&&im.naturalWidth?im:null);
      if(!img) continue;
      const r=t.getBoundingClientRect();
      sxx.drawImage(img, r.left-ox, r.top-oy, r.width, r.height); drew++;
    }
    if(!drew){ P=null; return; }
    let data; try{ data=sxx.getImageData(0,0,W,H).data; }catch(e){ P=null; return; }
    // collect this grid's opaque cells (the colour + shape source, used only for the reformed grid)
    const cstep=4, ch=cstep>>1, clx=[], cly=[], cr=[], cg=[], cbl=[];
    for(let y=0;y<H;y+=cstep){ for(let x=0;x<W;x+=cstep){
      const sx=Math.min(W-1,x+ch), sy=Math.min(H-1,y+ch), idx=(sy*W+sx)*4;
      if(data[idx+3]<40) continue;                           // skip the masonry gaps only
      clx.push(x+ch); cly.push(y+ch); cr.push(data[idx]&0xF8); cg.push(data[idx+1]&0xF8); cbl.push(data[idx+2]&0xF8);
    }}
    const M=clx.length; if(!M){ P=null; return; }
    // The CLOUD is FIXED — same size, shape and density for EVERY grid: a fixed count of particles at a
    // Gaussian scatter of viewport-scaled radius, centred on the (stable) grid centre (dense in the
    // middle, thinning outward). Grid dimensions never touch it. Only the grid HOMES + colours below
    // come from this particular grid, so its shape only emerges as the particles coalesce back in.
    const n=Math.max(4000, Math.min(9500, Math.round(innerWidth*innerHeight/185)));
    const gx=ox+W/2, gy=oy+H/2, gw=Math.min(innerWidth*0.43,660);
    const coreX=gw*0.34, coreY=innerHeight*0.22;              // dense core (the image zone)
    const haloX=innerWidth*0.52, haloY=innerHeight*0.46;      // a sparse halo spreading over the whole screen
    const refX=innerWidth*0.30, refY=innerHeight*0.32;        // brightness falloff by REAL distance (centre bright → edges faint)
    const parts=new Array(n);
    for(let i=0;i<n;i++){
      const m=(fr(i*1.37+0.7)*M)|0, r=cr[m], g=cg[m], b=cbl[m];
      const u1=Math.max(1e-4, fr(i*12.9898)), u2=fr(i*0.723+7.13);
      const mag=Math.sqrt(-2*Math.log(u1)), aa=6.2832*u2;    // Box–Muller → normal (dense core, thin tails)
      let g1=mag*Math.cos(aa), g2=mag*Math.sin(aa);
      if(g1>3.2)g1=3.2; else if(g1<-3.2)g1=-3.2;
      if(g2>3.2)g2=3.2; else if(g2<-3.2)g2=-3.2;
      const halo=fr(i*5.11+2.9)>0.74;                         // ~26% form the wide, screen-filling halo; the rest the dense core
      const dxp=g1*(halo?haloX:coreX), dyp=g2*(halo?haloY:coreY);
      // size: the vast majority are tiny sharp specks; a rare ~0.2% (≈1 in 500) bloom into big soft bokeh
      const big=fr(i*2.37+8.8)>0.998, rr=fr(i*3.71+5.9);
      parts[i]={
        fx:ox+clx[m]+(fr(i*7.1+3.3)-0.5)*cstep, fy:oy+cly[m]+(fr(i*5.7+9.1)-0.5)*cstep,   // grid home
        cx:gx+dxp, cy:gy+dyp,                                                              // fixed cloud target
        sa:fr(i*39.42+4.1)*6.283, sb:fr(i*93.71+2.3)*6.283,                                // buzz phase
        cf:Math.exp(-0.5*((dxp/refX)*(dxp/refX)+(dyp/refY)*(dyp/refY))),                   // centre bright → very faint over the text
        sz: big ? (3.0+4.5*fr(i*6.13+1.1)) : (0.75+0.7*rr*rr),                             // base size (DOT units)
        br: big ? (0.8+1.2*fr(i*9.7+2.2)) : 0.16,                                          // size-breathing amplitude (approach/recede)
        bright: big ? (0.55+0.32*fr(i*4.4+3.3)) : (0.45+0.35*rr),                          // per-particle brightness
        zp:fr(i*8.17+0.5)*6.283,
        col:'rgb('+r+','+g+','+b+')', key:(r<<16|g<<8|b)
      };
    }
    parts.sort((p,q)=>p.key-q.key);                          // group by colour → the sharp reform layer rarely re-sets fillStyle
    P={n, gx, gy, fx:new Float32Array(n), fy:new Float32Array(n), cx:new Float32Array(n), cy:new Float32Array(n),
       sa:new Float32Array(n), sb:new Float32Array(n), cf:new Float32Array(n),
       sz:new Float32Array(n), br:new Float32Array(n), bright:new Float32Array(n), zp:new Float32Array(n),
       px:new Float32Array(n), py:new Float32Array(n), col:new Array(n)};
    for(let i=0;i<n;i++){ const p=parts[i];
      P.fx[i]=p.fx; P.fy[i]=p.fy; P.cx[i]=p.cx; P.cy[i]=p.cy; P.sa[i]=p.sa; P.sb[i]=p.sb;
      P.cf[i]=p.cf; P.sz[i]=p.sz; P.br[i]=p.br; P.bright[i]=p.bright; P.zp[i]=p.zp; P.col[i]=p.col;
    }
  }
  const fr = x => { const s=Math.sin(x)*43758.5453; return s-Math.floor(s); };   // deterministic 0..1
  function drawParticles(amt, now){
    if(!pcx) return;
    pcx.clearRect(0,0,innerWidth,innerHeight);
    if(!P || amt<=0.002) return;
    const vis = Math.min(1, amt*5);                // slower particle↔DOM hand-off (complements ixCluster opacity)
    if(vis<=0.003) return;
    // the reform is stretched over the approach: cloud rises slowly as you leave a place and lingers low
    // for a long time as you arrive — so the coalescing into the grid gets much more scroll to play out.
    const cloud=Math.pow(amt,1.6), form=1-cloud;
    const amp=0.4 + cloud*6.6, bC=(now||0)*0.0045, zC=(now||0)*0.0011;
    // positions (shared by both layers): cloud target ⇄ grid home, plus a gentle buzz
    const px=P.px, py=P.py;
    for(let i=0;i<P.n;i++){
      const sa=P.sa[i], sb=P.sb[i];
      const nx=Math.sin(sa+bC)+0.5*Math.sin(sa*1.7+bC*1.6);
      const ny=Math.cos(sb+bC*0.9)+0.5*Math.cos(sb*1.9+bC*1.4);
      px[i]=P.cx[i]+(P.fx[i]-P.cx[i])*form + amp*nx*0.66;
      py[i]=P.cy[i]+(P.fy[i]-P.cy[i])*form + amp*ny*0.66;
    }
    // colour ⇄ white is one complementary crossfade at the SAME positions, so each dot smoothly
    // desaturates from its photo colour into the white cloud (and back) — no hand-off seam.
    const t = sstep((cloud-0.04)/0.80);                    // 0 = grid colour, 1 = white cloud — starts early, long+gradual
    // LAYER A — sharp coloured dots that reform the photos (near the grid)
    if(t<0.985){
      pcx.globalAlpha = vis*(1-t);
      let last='';
      for(let i=0;i<P.n;i++){ const c=P.col[i]; if(c!==last){ pcx.fillStyle=c; last=c; }
        pcx.fillRect(px[i]-DOT*0.5, py[i]-DOT*0.5, DOT, DOT); }
    }
    // LAYER B — the white cloud: a starfield of crisp small specks, with a rare few (~1 in 500) blooming
    // into big soft depth-of-field bokeh that breathes toward/away over time.
    if(t>0.015){
      const base=vis*t;
      pcx.fillStyle='rgb(232,228,219)';                    // warm white for the crisp specks
      for(let i=0;i<P.n;i++){
        let a=base*P.cf[i]*P.bright[i]; if(a>1)a=1; if(a<=0.004) continue;
        pcx.globalAlpha=a;
        let s=P.sz[i]+Math.sin(P.zp[i]+zC)*P.br[i]; if(s<0.35)s=0.35;
        const size=DOT*s;
        if(P.sz[i]<2.2) pcx.fillRect(px[i]-size*0.5, py[i]-size*0.5, size, size);          // crisp small speck
        else pcx.drawImage(sprite, px[i]-size*0.5, py[i]-size*0.5, size, size);            // soft big bokeh
      }
    }
    pcx.globalAlpha=1;
  }
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
    ixScroll.addEventListener('wheel', onWheel, {passive:false});           // damp the scroll speed
    // click a photograph in the grid → enter that place, starting the slideshow from that photo
    ixScroll.addEventListener('click', e=>{ if(mode!=='strip'||entering) return; if(e.target.closest&&e.target.closest('.ix-item')) return; const k=hitTile(e); if(k>=0) choosePlace(activeIdx, k); });
    ixScroll.addEventListener('mousemove', e=>{ if(mode==='strip') ixScroll.style.cursor = hitTile(e)>=0 ? 'pointer' : ''; });
    sizeCanvas();
    setCluster(0); markActive(); ixScroll.scrollTop=centerTop(0);   // centre the first place
    requestAnimationFrame(()=>{ sampleParticles(); applyCluster(); });
  }
  function hitTile(e){
    const t=ixCluster.children;
    for(let i=0;i<t.length;i++){ const r=t[i].getBoundingClientRect();
      if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom) return i; }
    return -1;
  }
  function itemH(){ return (ixScroll.children[0]&&ixScroll.children[0].offsetHeight)||innerHeight; }
  // place i is centred at this scrollTop; posQ() is the fractional place position (integer == centred):
  function centerTop(i){ return i*itemH() + itemH()/2 - innerHeight/2; }
  function posQ(){ return (ixScroll.scrollTop + innerHeight/2 - itemH()/2) / itemH(); }

  // Scroll is damped (a trackpad gesture moves the page more slowly) and then MAGNETICALLY snaps the
  // nearest place back to centre once the gesture settles. We drive the scroll ourselves (native snap
  // is off in CSS) so intermediate positions render the dissolve instead of the browser yanking to a snap point.
  const SCROLL_GAIN = 0.75;                    // <1 → same finger motion travels less = slower
  const SNAP_ZONE = 0.28;                      // only magnetically snap when this close to a place (where the colour emerges)
  let wheeling=false, wheelTO=0, snapTO=0, snapUntil=0;
  function settle(){                            // after the gesture stops, glide the nearest place to centre
    clearTimeout(snapTO);
    snapTO=setTimeout(()=>{
      if(mode!=='strip'||entering||wheeling||performance.now()<snapUntil) return;
      const q=posQ(), i=clampC(Math.round(q)), top=centerTop(i);
      if(Math.abs(q-i)>SNAP_ZONE) return;              // out in the cloud → don't yank; rest where you left it
      if(Math.abs(ixScroll.scrollTop-top)<2) return;   // already home
      snapUntil=performance.now()+700;                 // hold off re-snapping while this glide runs
      ixScroll.scrollTo({top, behavior:'smooth'});
    }, 130);
  }
  function onWheel(e){
    if(mode!=='strip'||entering) return;
    e.preventDefault();                          // take over from native scrolling
    let dy=e.deltaY; if(e.deltaMode===1) dy*=16; else if(e.deltaMode===2) dy*=innerHeight;
    snapUntil=0;                                 // the user is driving now — cancel any snap lock
    const max=ixScroll.scrollHeight-ixScroll.clientHeight;
    ixScroll.scrollTop=Math.max(0, Math.min(max, ixScroll.scrollTop + dy*SCROLL_GAIN));
    wheeling=true; clearTimeout(wheelTO); wheelTO=setTimeout(()=>{ wheeling=false; settle(); }, 110);
  }
  function onScroll(){ applyCluster(); settle(); }   // touch-scroll also settles to centre
  function markActive(){
    [...ixScroll.children].forEach((el,i)=>el.classList.toggle('active', i===activeIdx));
    [...ixMenu.children].forEach((el,i)=>el.classList.toggle('on', i===activeIdx));
  }
  function scrollToPlace(i){ snapUntil=performance.now()+700; ixScroll.scrollTo({top:centerTop(clampC(i)),behavior:'smooth'}); }

  // The grid is scroll-driven: at a place's centre the sharp DOM masonry shows; as you scroll away
  // it dissolves into the particle field (which scatters + fades); at the midpoint the composite
  // swaps to the next place, whose particles gather back into its sharp grid as it reaches centre.
  function setCluster(i){
    clusterIdx=i;
    ixCluster.innerHTML = clusterSrcs(rooms[i]).map(s=>'<div class="ix-thumb"><img src="'+s+'" alt=""></div>').join('');
    [...ixCluster.querySelectorAll('img')].forEach(im=>{ if(!im.complete) im.addEventListener('load',sampleParticles,{once:true}); });
  }
  // scroll-driven dissolve: a dead zone holds the sharp grid near a place's centre (a magnetic hold),
  // then it dematerialises into the central cloud as you push past. A continuous rAF tick keeps the
  // cloud buzzing (time-driven) while it's on screen; it idles out when the grid is fully settled.
  let curAmt=0, ixAnim=0, ixIdle=0;
  function updateIndex(){
    if(entering || mode!=='strip') return curAmt;
    const N=rooms.length, p=posQ();
    const active=Math.max(0,Math.min(N-1,Math.round(p)));
    if(active!==clusterIdx){ setCluster(active); sampleParticles(); }
    if(active!==activeIdx){ activeIdx=active; markActive(); }
    let a=Math.max(0,Math.min(1,(Math.abs(p-active)-0.12)/0.36));   // flat dead zone near centre, then ramp
    curAmt=a*a*(3-2*a);                                             // smoothstep
    ixCluster.style.opacity=Math.max(0,1-curAmt*5).toFixed(3);     // sharp grid ↔ particles hand off (matches vis in drawParticles)
    return curAmt;
  }
  function ixTick(now){
    if(entering || mode!=='strip'){ ixAnim=0; return; }
    const amt=updateIndex();
    drawParticles(amt, now);
    if(amt<=0.003){ if(++ixIdle>44){ ixAnim=0; return; } } else ixIdle=0;   // idle out once fully settled
    ixAnim=requestAnimationFrame(ixTick);
  }
  function applyCluster(){ ixIdle=0; if(!ixAnim && !entering && mode==='strip') ixAnim=requestAnimationFrame(ixTick); }
  // choose a place (optionally starting the slideshow at photo `startAt`) → the grid bursts into
  // particles that scatter and dissipate as the index dissolves into the room.
  function choosePlace(i, startAt){
    if(mode!=='strip'||entering) return;
    entering=true;
    if(P && pcx){                                                  // a quick particle burst on select
      const t0=performance.now(), DUR=reduce?400:820;
      (function step(now){
        const e=Math.min(1,(now-t0)/DUR);
        ixCluster.style.opacity=Math.max(0,1-e*5).toFixed(3);
        drawParticles(0.14+e*0.85, now);
        if(e<1 && entering) requestAnimationFrame(step);
      })(t0);
    }
    goFullscreen(); enterRoom(i, startAt||0);
  }
  function resetIndex(scrollToI){
    if(scrollToI!=null && ixScroll.children[scrollToI]){ ixScroll.scrollTop=centerTop(scrollToI); activeIdx=scrollToI; }
    markActive(); clusterIdx=-1; setCluster(activeIdx);
    ixCluster.style.opacity='1';
    if(pcx) pcx.clearRect(0,0,innerWidth,innerHeight);
    requestAnimationFrame(()=>{ sampleParticles(); applyCluster(); });
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
      if(e.key==='ArrowDown'||e.key==='PageDown'||e.key===' '){ e.preventDefault(); scrollToPlace(activeIdx+1); }
      else if(e.key==='ArrowUp'||e.key==='PageUp'){ e.preventDefault(); scrollToPlace(activeIdx-1); }
      else if(e.key==='Home'){ e.preventDefault(); scrollToPlace(0); }
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

  addEventListener('resize', () => { setMax(); sizeCanvas(); if(mode==='strip'){ sampleParticles(); applyCluster(); } });
  setMax();

  // land straight on the index
  setMode('strip'); buildIndex();
})();
