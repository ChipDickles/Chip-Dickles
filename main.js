
// Basic site bootstrapping
async function loadConfig(){
  const res = await fetch('./config/site.json');
  const cfg = await res.json();
  document.documentElement.style.setProperty('--brand', cfg.brand.primaryColor || '#0a7cff');
  document.documentElement.style.setProperty('--accent', cfg.brand.accentColor || '#ffd400');
  document.title = cfg.brand.siteTitle + ' — ' + cfg.brand.tagline;
  const titleEl = document.querySelector('#site-title');
  const tagEl = document.querySelector('#site-tagline');
  if(titleEl) titleEl.textContent = cfg.brand.siteTitle;
  if(tagEl) tagEl.textContent = cfg.brand.tagline;
  return cfg;
}

// Live weather via Open‑Meteo (no API key). Uses user geolocation.
async function loadWeather(){
  const out = document.getElementById('weather-out');
  if(!out) return;
  out.innerHTML = '<div class="notice">Getting your location for live weather…</div>';
  try{
    const pos = await new Promise((resolve, reject)=>{
      navigator.geolocation.getCurrentPosition(resolve, reject, {timeout:10000});
    });
    const {latitude, longitude} = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability&wind_speed_unit=mph&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data.current;
    const wmoDesc = (code)=>{
      // minimal mapping
      const map = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Depositing rime fog',51:'Light drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Snow',80:'Rain showers',95:'Thunderstorms'};
      return map[code] || 'Weather';
    };
    out.innerHTML = `
      <div class="grid-2">
        <div>
          <div class="badge-mini">Your Location</div>
          <h3>${Math.round(c.temperature_2m)}°F — ${wmoDesc(c.weather_code)}</h3>
          <div class="subtitle">Feels like ${Math.round(c.apparent_temperature)}°F • Wind ${Math.round(c.wind_speed_10m)} mph • Humidity ${c.relative_humidity_2m}%</div>
        </div>
        <div>
          <canvas id="tempSpark" width="400" height="120"></canvas>
          <div class="notice">Next 24h temperature (°F)</div>
        </div>
      </div>
    `;
    // Simple sparkline with Canvas
    const ctx = document.getElementById('tempSpark').getContext('2d');
    const temps = data.hourly.temperature_2m.slice(0, 24);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const min = Math.min(...temps), max = Math.max(...temps);
    ctx.clearRect(0,0,W,H);
    ctx.lineWidth = 2;
    ctx.beginPath();
    temps.forEach((t,i)=>{
      const x = i/(temps.length-1)*W;
      const y = H - ((t - min)/(max - min || 1))*H;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#ffd400';
    ctx.stroke();
  }catch(err){
    out.innerHTML = '<div class="notice">Could not load weather (location blocked or offline).</div>';
    console.error(err);
  }
}

// Tide charts placeholder that reads config
async function loadTides(cfg){
  const wrap = document.getElementById('tides-wrap');
  if(!wrap) return;
  const url = cfg?.tides?.stationUrl || 'https://tidesandcurrents.noaa.gov/';
  wrap.innerHTML = `
    <p class="subtitle">Linking to: <a href="${url}" target="_blank" rel="noopener">${url}</a></p>
    <div class="card">
      <p>Want an embedded chart? Paste a station or widget URL in <code>config/site.json</code> under <code>tides.stationUrl</code>.</p>
      <p class="notice">We can also wire NOAA/third‑party APIs later for full inline charts.</p>
    </div>
  `;
}

// Simple RSS → list using rss2json (free, rate‑limited). Graceful fallback.
async function loadNews(cfg){
  const out = document.getElementById('news-out');
  if(!out) return;
  out.innerHTML = '<div class="notice">Loading weather news…</div>';
  try{
    const feeds = (cfg.news && cfg.news.rss) ? cfg.news.rss : [];
    const items = [];
    for(const rss of feeds){
      try{
        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}`;
        const r = await fetch(url);
        const j = await r.json();
        (j.items||[]).slice(0,5).forEach(it=>items.push(it));
      }catch(e){ console.warn('Failed feed', rss); }
    }
    items.sort((a,b)=> new Date(b.pubDate||0) - new Date(a.pubDate||0));
    if(items.length===0){ out.innerHTML = '<div class="notice">No news right now. Try again later.</div>'; return; }
    out.innerHTML = items.slice(0,10).map(it=>`
      <div class="card">
        <a href="${it.link}" target="_blank" rel="noopener"><h3>${it.title}</h3></a>
        <div class="notice">${new Date(it.pubDate||Date.now()).toLocaleString()}</div>
      </div>
    `).join('');
  }catch(err){
    out.innerHTML = '<div class="notice">News feed blocked by your browser. We can set up a serverless proxy later.</div>';
  }
}

// Social hub renderer
async function loadSocial(cfg){
  const grid = document.getElementById('social-grid');
  if(!grid) return;
  const map = {
    tiktok: (u)=> `https://www.tiktok.com/@${u}`,
    instagram: (u)=> `https://www.instagram.com/${u}`,
    youtube: (u)=> `https://www.youtube.com/${u}`,
    facebook: (u)=> `https://www.facebook.com/${u}`,
    threads: (u)=> `https://www.threads.net/@${u}`,
    x: (u)=> `https://x.com/${u}`,
    twitch: (u)=> `https://www.twitch.tv/${u}`,
    discord: (u)=> u, // expect invite link
    email: (u)=> `mailto:${u}`,
    linktree: (u)=> `https://linktr.ee/${u}`
  };
  const icons = {
    tiktok: "fa-brands fa-tiktok",
    instagram: "fa-brands fa-instagram",
    youtube: "fa-brands fa-youtube",
    facebook: "fa-brands fa-facebook",
    threads: "fa-brands fa-threads",
    x: "fa-brands fa-x-twitter",
    twitch: "fa-brands fa-twitch",
    discord: "fa-brands fa-discord",
    email: "fa-regular fa-envelope",
    linktree: "fa-solid fa-link"
  };
  const entries = Object.entries(cfg.social || {})
    .filter(([k,v])=> v && v.trim().length>0);
  grid.innerHTML = entries.map(([k,v])=>{
    const url = map[k] ? map[k](v) : v;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
    return `
      <div class="social-card">
        <div><i class="${icons[k]||'fa-solid fa-link'}"></i> <strong style="text-transform:capitalize">${k}</strong></div>
        <div class="meta"><a href="${url}" target="_blank" rel="noopener">${url}</a></div>
        <img class="qr" src="${qr}" alt="QR for ${k}">
      </div>
    `;
  }).join('');
}

window.addEventListener('DOMContentLoaded', async ()=>{
  const cfg = await loadConfig();
  loadWeather();
  loadTides(cfg);
  loadNews(cfg);
  loadSocial(cfg);
});
