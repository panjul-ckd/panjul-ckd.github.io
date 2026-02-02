let photos = [];
let uploadQueue = [];
let isProcessing = false;
const sizes = { '2x3': {w: 21, h: 30}, '3x4': {w: 28, h: 38}, '4x6': {w: 38, h: 56}, '4R': {w: 102, h: 152}, '8R': {w: 203, h: 254} };

async function handleUpload(event) {
    uploadQueue.push(...Array.from(event.target.files));
    if (!isProcessing) processQueue();
}

async function processQueue() {
    if (uploadQueue.length === 0) {
        isProcessing = false;
        document.getElementById('loading').style.display = 'none';
        return;
    }
    isProcessing = true;
    const loader = document.getElementById('loading');
    const statusMsg = document.getElementById('status-msg');
    loader.style.display = 'block';

    const file = uploadQueue.shift();
    statusMsg.innerText = "Memproses AI: " + file.name;
    
    updateProgress(10);
    const base64 = await new Promise(res => {
        const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file);
    });
    
    updateProgress(30);
    try {
        let p = 30;
        const interval = setInterval(() => { if(p < 85) { p += 2; updateProgress(p); } }, 250);
        
        const blob = await imglyRemoveBackground(file);
        clearInterval(interval);
        
        updateProgress(95);
        const noBg = URL.createObjectURL(blob);
        photos.push({ original: base64, noBg: noBg, current: base64, qty: 1, offset: 50 });
    } catch (e) {
        photos.push({ original: base64, current: base64, qty: 1, offset: 50 });
    }

    updateProgress(100);
    setTimeout(() => {
        renderPhotoList(); updatePreview();
        processQueue();
    }, 600);
}

async function changeBg(index, color) {
    const loader = document.getElementById('loading');
    const statusMsg = document.getElementById('status-msg');
    loader.style.display = 'block';
    statusMsg.innerText = "Mengganti Background...";

    let prg = 0;
    const interval = setInterval(() => {
        prg += 10; updateProgress(prg);
        if (prg >= 100) clearInterval(interval);
    }, 35);

    const p = photos[index];
    if (color === 'original') { p.current = p.original; } 
    else {
        const canvas = document.getElementById('tempCanvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.src = p.noBg; await new Promise(r => img.onload = r);
        canvas.width = img.width; canvas.height = img.height;
        ctx.fillStyle = color; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0); p.current = canvas.toDataURL('image/png');
    }

    setTimeout(() => {
        renderPhotoList(); updatePreview();
        loader.style.display = 'none';
        updateProgress(0);
    }, 600);
}

function updateProgress(val) {
    document.getElementById('progress-fill').style.width = val + '%';
    document.getElementById('percent-val').innerText = Math.floor(val) + '%';
}

function renderPhotoList() {
    const container = document.getElementById('photoListContainer');
    container.innerHTML = '';
    const sz = sizes[document.getElementById('size').value];
    const boxHeight = (sz.h / sz.w) * 85;

    photos.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <div class="single-preview-box" style="height: ${boxHeight}px">
                <div id="crop-prev-${i}" style="background-image: url('${p.current}'); background-position: center ${p.offset}%; background-size: cover;"></div>
            </div>
            <div style="flex:1">
                <label style="font-size:10px; font-weight:bold; color:#64748b;">ATUR POSISI WAJAH:</label>
                <input type="range" class="position-slider" min="0" max="100" value="${p.offset}" oninput="updateSingleCrop(${i}, this.value)">
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="number" value="${p.qty}" min="1" onchange="photos[${i}].qty=parseInt(this.value);updatePreview()" style="width:42px; padding:5px; border-radius:5px; border:1px solid #ddd;">
                    <button class="bg-btn" style="background:#ef4444;color:white;border:none" onclick="changeBg(${i}, '#ff0000')">M</button>
                    <button class="bg-btn" style="background:#2563eb;color:white;border:none" onclick="changeBg(${i}, '#0000ff')">B</button>
                    <button class="bg-btn" onclick="changeBg(${i}, 'original')">Asli</button>
                </div>
                <button onclick="downloadManualCrop(${i})" style="width:100%; background:#059669; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; margin-top:10px">💾 SIMPAN FOTO</button>
                <button onclick="photos.splice(${i},1);renderPhotoList();updatePreview()" style="color:#94a3b8;border:none;background:none;font-size:10px;cursor:pointer;margin-top:6px">✕ Hapus dari daftar</button>
            </div>`;
        container.appendChild(div);
    });
}

function updateSingleCrop(index, val) {
    photos[index].offset = val;
    document.getElementById(`crop-prev-${index}`).style.backgroundPosition = `center ${val}%`;
    updatePreview();
}

function updatePreview() {
    const paper = document.getElementById('paper'); paper.innerHTML = '';
    const sz = sizes[document.getElementById('size').value];
    const scale = paper.offsetWidth / 210;
    let x = 12, y = 12;

    photos.forEach(p => {
        for(let i=0; i<p.qty; i++) {
            const w = sz.w * scale, h = sz.h * scale;
            if (x + w > paper.offsetWidth - 12) { x = 12; y += h + 4; }
            if (y + h > paper.offsetHeight - 12) break;
            const div = document.createElement('div');
            div.className = 'preview-photo';
            Object.assign(div.style, { 
                width: w+'px', height: h+'px', left: x+'px', top: y+'px', 
                backgroundImage: `url(${p.current})`, backgroundPosition: `center ${p.offset}%`, backgroundSize: 'cover'
            });
            paper.appendChild(div); x += w + 4;
        }
    });
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
        const finalImg = canvas.toDataURL('image/jpeg', 0.98);
        for (let i=0; i<p.qty; i++) {
            if (curX + sz.w > 200) { curX = 10; curY += sz.h + 2; }
            if (curY + sz.h > 285) { pdf.addPage(); curX = 10; curY = 10; }
            pdf.addImage(finalImg, 'JPEG', curX, curY, sz.w, sz.h); curX += sz.w + 2;
        }
    }
    pdf.save("Studio-FnD-Print-A4.pdf");
}
