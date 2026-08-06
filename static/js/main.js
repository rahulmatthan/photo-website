// The Hide — gallery spotlight. A framed print rises from black, is held, then the
// light dims fully to black before the next photograph lights up in its place.
(function(){
  const IMAGES = window.IMAGES || [];
  const $ = id => document.getElementById(id);
  const photo=$('photo'), plate=$('plate'), capTitle=$('capTitle'), capPlace=$('capPlace'), reveal=$('reveal');
  const cv=$('cv'), cx = cv && cv.getContext('2d',{willReadFrequently:true});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = IMAGES.length;
  if(!N || !reveal){ return; }

  let maxR=1600;
  function setMax(){ maxR = 1.85*Math.hypot(innerWidth,innerHeight); }
  addEventListener('resize', setMax); setMax();

  // Pull a pleasing dominant colour from an image, for the wall's ambient glow.
  function dominant(img){
    if(!cx) return '#caa46a';
    cx.clearRect(0,0,36,36); cx.drawImage(img,0,0,36,36);
    let d; try{ d=cx.getImageData(0,0,36,36).data; }catch(e){ return '#caa46a'; }
    let r=0,g=0,b=0,n=0;
    for(let p=0;p<d.length;p+=4){
      const R=d[p],G=d[p+1],B=d[p+2],l=0.2126*R+0.7152*G+0.0722*B;
      if(l<26||l>232) continue;
      const s=Math.max(R,G,B)-Math.min(R,G,B), w=1+s/128;
      r+=R*w; g+=G*w; b+=B*w; n+=w;
    }
    if(!n) return '#caa46a';
    r/=n; g/=n; b/=n; const a=(r+g+b)/3, K=1.3;
    r=Math.min(255,a+(r-a)*K); g=Math.min(255,a+(g-a)*K); b=Math.min(255,a+(b-a)*K);
    return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')';
  }

  // Bounded preloading — only ever a couple of images in flight, so this scales to any
  // library size. Dominant colour is computed once, when each image loads.
  const cache = {};
  function preload(i){
    i = ((i%N)+N)%N;
    if(cache[i]) return cache[i];
    const img = new Image();
    img.onload = () => { if(!IMAGES[i].dom){ IMAGES[i].dom = dominant(img); } };
    img.src = IMAGES[i].src;
    cache[i] = img;
    return img;
  }

  let idx=0, phase='rise', t0=0, pendingDir=1;
  const RISE=reduce?900:3000, HOLD=reduce?2500:5200, FALL=reduce?900:3000, BLACK=reduce?300:900;
  const ease = x => x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2;

  function swap(i){
    photo.src = IMAGES[i].src;
    document.documentElement.style.setProperty('--dom', IMAGES[i].dom || '#caa46a');
    capTitle.textContent = IMAGES[i].title || '';
    const pl = IMAGES[i].place || '';
    capPlace.textContent = pl;
    capPlace.style.display = pl ? '' : 'none';
    preload(i+1);
  }

  function loop(now){
    requestAnimationFrame(loop);
    const el = now - t0; let light;
    if(phase==='rise'){ light=ease(Math.min(1,el/RISE)); if(el>=RISE){ phase='hold'; t0=now; plate.classList.add('show'); } }
    else if(phase==='hold'){ light=1; if(el>=HOLD){ phase='fall'; t0=now; plate.classList.remove('show'); } }
    else if(phase==='fall'){ light=1-ease(Math.min(1,el/FALL)); if(el>=FALL){ phase='black'; t0=now; } }
    else { light=0; if(el>=BLACK){ idx=(idx+pendingDir+N)%N; pendingDir=1; swap(idx); phase='rise'; t0=now; } }
    const r=light*maxR, rx=(r*1.35).toFixed(1), ry=(r*0.78).toFixed(1);
    reveal.style.background='radial-gradient(ellipse '+rx+'px '+ry+'px at 50% 46%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0.16) 40%, rgba(0,0,0,0.5) 68%, rgba(0,0,0,0.85) 88%, #000 100%)';
  }

  function advance(dir){ if(phase==='rise'||phase==='hold'){ pendingDir=dir; phase='fall'; t0=performance.now(); plate.classList.remove('show'); } }
  function begin(){ idx=0; swap(0); phase='rise'; t0=performance.now(); requestAnimationFrame(loop); }

  const first = preload(0); preload(1);
  if(first.complete && first.naturalWidth){ if(!IMAGES[0].dom){ IMAGES[0].dom = dominant(first); } begin(); }
  else {
    first.addEventListener('load', () => { if(!IMAGES[0].dom){ IMAGES[0].dom = dominant(first); } begin(); }, {once:true});
    first.addEventListener('error', begin, {once:true});
  }

  addEventListener('click', e => { advance(e.clientX < innerWidth/3 ? -1 : 1); });
  addEventListener('keydown', e => {
    if(e.key==='ArrowRight'||e.key===' '){ e.preventDefault(); advance(1); }
    if(e.key==='ArrowLeft'){ e.preventDefault(); advance(-1); }
  });
  addEventListener('touchstart', () => advance(1), {passive:true});
})();
