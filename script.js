let photos = [];
let uploadQueue = [];
let isProcessing = false;
let currentMode = 'cetak';

const sizes = { 
    '2x3': {w: 21, h: 30}, '3x4': {w: 28, h: 38}, '4x6': {w: 38, h: 56}, 
    '4R': {w: 102, h: 152}, '8R': {w: 203, h: 254} 
};

// GANTI MODE
function switchMode(mode) {
    currentMode = mode;
    document.getElementById('btn-mode-cetak').classList.toggle('active', mode === 'cetak');
    document.getElementById('btn-mode-bg').classList.toggle('active', mode === 'bg-remover');

    document.getElementById('control-cetak').classList.toggle('mode-hidden', mode === 'bg-remover');
    document.getElementById('paper-view').classList.toggle('mode-hidden', mode === 'bg-remover');
    document.getElementById('bg-welcome').classList.toggle('mode-hidden', mode === 'cetak');
    document.getElementById('main-download-btn').classList.toggle('mode-hidden', mode === 'bg-remover');

    renderPhotoList();
}

function updateProgress(val) {
    const fill = document.getElementById('progress-fill');
    const txt = document.getElementById('percent-val');
    if(fill) fill.style.width = val + '%';
    if(txt) txt.innerText = Math.floor(val) + '%';
}

async function handleUpload(event) {
    uploadQueue.push(...Array.from(event.target.files));
    if (!isProcessing) processQueue();
}

async function processQueue() {
    if (uploadQueue.length === 0) {
        isProcessing = false;
        setTimeout(() => document.getElementById('loading').style.display='none', 1000);
        return;
    }
    isProcessing = true;
    document.getElementById('loading').style.display = 'block';
    const file = uploadQueue.shift();
    document.getElementById('status-msg').innerText = "AI Memproses: " + file.name;
    
    updateProgress(10);
    const base64 = await new Promise(res => {
        const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file);
    });

    try {
        let p = 10;
        const interval = setInterval(() => { if(p < 90) { p += 2; updateProgress(p); } }, 150);
        const blob = await imglyRemoveBackground(file);
        clearInterval(interval);
        const noBg = URL.createObjectURL(blob);
        photos.push({ original: base64, noBg: noBg, current: base64, qty: 1, offset: 50 });
    } catch (e) {
        photos.push({ original: base64, current: base64, qty: 1, offset: 50 });
    }
    
    updateProgress(100);
    setTimeout(() => { renderPhotoList(); updatePreview(); processQueue(); }, 500);
}

async function changeBg(index, color) {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('status-msg').innerText = "Ganti Warna...";
    let prg = 0;
    const interval = setInterval(() => { prg += 10; updateProgress(prg); if(prg>=100) clearInterval(interval); }, 30);

    const p = photos[index];
    if (color === 'original') { p.current = p.original; } 
    else {
        const canvas = document.getElementById('tempCanvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.src = p.noBg; await new Promise(r => img.onload = r);
        canvas.width = img.width; canvas.height = img.height;
        ctx.fillStyle = color; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0); p.current = canvas.toDataURL('image/png');
    }
    setTimeout(() => { renderPhotoList(); updatePreview(); document.getElementById('loading').style.display='none'; }, 500);
}

function renderPhotoList() {
    const container = document.getElementById('photoListContainer');
    container.innerHTML = '';
    const sz = sizes[document.getElementById('size').value];
    const boxHeight = (sz.h / sz.w) * 75;

    photos.forEach((p, i) => {
        const isBgMode = currentMode === 'bg-remover';
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <div class="single-preview-box" style="height: ${boxHeight}px">
                <div id="crop-prev-${i}" style="height:100%; background-image: url('${p.current}'); background-position: center ${p.offset}%; background-size: cover;"></div>
            </div>
            <div style="flex:1">
                <input type="range" style="width:100%" min="0" max="100" value="${p.offset}" oninput="updateSingleCrop(${i}, this.value)">
                <div style="display:flex; gap:4px; margin-top:5px">
                    ${!isBgMode ? `<input type="number" value="${p.qty}" onchange="photos[${i}].qty=parseInt(this.value);updatePreview()" style="width:35px">` : ''}
                    <button onclick="changeBg(${i}, '#ff0000')" style="background:red; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer">M</button>
                    <button onclick="changeBg(${i}, '#0000ff')" style="background:blue; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer">B</button>
                    <button onclick="changeBg(${i}, 'original')" style="font-size:10px; cursor:pointer">Asli</button>
                </div>
                <button onclick="downloadManualCrop(${i})" style="width:100%; background:#059669; color:white; border:none; padding:8px; border-radius:6px; font-weight:800; cursor:pointer; margin-top:10px">
                    ${isBgMode ? '💾 DOWNLOAD FOTO' : '💾 SIMPAN'}
                </button>
            </div>`;
        container.appendChild(div);
    });
}

function updatePreview() {
    const paper = document.getElementById('paper');
    if (!paper) return;
    paper.innerHTML = '';
    const sizeKey = document.getElementById('size').value;
    const sz = sizes[sizeKey];
    const scale = paper.offsetWidth / 210;
    let margin = (sizeKey === '8R') ? 2 : 5;
    let x = margin, y = margin;

    photos.forEach(p => {
        for(let i=0; i<p.qty; i++) {
            const w = sz.w * scale, h = sz.h * scale;
            if (x + w > paper.offsetWidth - margin) { x = margin; y += h + 1; }
            if (y + h > paper.offsetHeight - margin) break;
            const div = document.createElement('div');
            div.className = 'preview-photo';
            Object.assign(div.style, { width: w+'px', height: h+'px', left: x+'px', top: y+'px', backgroundImage: `url(${p.current})`, backgroundPosition: `center ${p.offset}%` });
            paper.appendChild(div); x += w + 1;
        }
    });
}

function updateSingleCrop(index, val) {
    photos[index].offset = val;
    const el = document.getElementById(`crop-prev-${index}`);
    if(el) el.style.backgroundPosition = `center ${val}%`;
    updatePreview();
}

function getCleanCrop(ctx, img, canvas, offset) {
    const iR = img.width / img.height; const cR = canvas.width / canvas.height;
    let dW, dH, dX, dY;
    if (iR > cR) { dH = img.height; dW = img.height * cR; dX = (img.width - dW) / 2; dY = 0; }
    else { dW = img.width; dH = img.width / cR; dX = 0; dY = (img.height - dH) * (offset / 100); }
    ctx.drawImage(img, dX, dY, dW, dH, 0, 0, canvas.width, canvas.height);
}

async function downloadManualCrop(i) {
    const canvas = document.getElementById('tempCanvas'); const ctx = canvas.getContext('2d');
    const p = photos[i]; const sz = sizes[document.getElementById('size').value];
    const img = new Image(); img.src = p.current; await new Promise(res => img.onload = res);
    canvas.width = 1200; canvas.height = (sz.h/sz.w)*1200;
    getCleanCrop(ctx, img, canvas, p.offset);
    const link = document.createElement('a'); link.download = `StudioFnD-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png'); link.click();
}

async function generatePDF() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
    const sz = sizes[document.getElementById('size').value];
    let curX = 10, curY = 10;
    for (let p of photos) {
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.src = p.current; await new Promise(res => img.onload = res);
        canvas.width = 1500; canvas.height = (sz.h/sz.w)*1500;
        getCleanCrop(ctx, img, canvas, p.offset);
        const finalImg = canvas.toDataURL('image/jpeg', 0.95);
        for (let i=0; i<p.qty; i++) {
            if (curX + sz.w > 200) { curX = 10; curY += sz.h + 2; }
            if (curY + sz.h > 285) { pdf.addPage(); curX = 10; curY = 10; }
            pdf.addImage(finalImg, 'JPEG', curX, curY, sz.w, sz.h); curX += sz.w + 2;
        }
    }
    pdf.save("Studio-FnD-Cetak-A4.pdf");
}
