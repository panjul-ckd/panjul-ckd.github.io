let photos = [];
const sizes = { 
    '2x3': {w: 21, h: 30}, '3x4': {w: 28, h: 38}, '4x6': {w: 38, h: 56},
    '4R': {w: 102, h: 152}, '8R': {w: 203, h: 254}
};

async function handleUpload(event) {
    const files = event.target.files;
    const loader = document.getElementById('loading');
    for (let file of files) {
        loader.style.display = 'block';
        const originalSrc = await fileToBox64(file);
        try {
            const blob = await imglyRemoveBackground(file);
            const noBgSrc = URL.createObjectURL(blob);
            photos.push({ original: originalSrc, noBg: noBgSrc, current: originalSrc, qty: 1 });
        } catch (e) {
            photos.push({ original: originalSrc, current: originalSrc, qty: 1 });
        }
        loader.style.display = 'none';
        renderPhotoList();
        updatePreview();
    }
}

function fileToBox64(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.readAsDataURL(file);
    });
}

function renderPhotoList() {
    const container = document.getElementById('photoListContainer');
    container.innerHTML = '';
    photos.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <img src="${p.current}">
            <div style="flex:1">
                <input type="number" value="${p.qty}" min="1" onchange="updateQty(${i}, this.value)" style="width:40px">
                <div style="margin-top:5px">
                    <button class="bg-btn" onclick="changeBg(${i}, 'original')">Asli</button>
                    <button class="bg-btn" style="background:red;color:white" onclick="changeBg(${i}, '#ff0000')">Merah</button>
                    <button class="bg-btn" style="background:blue;color:white" onclick="changeBg(${i}, '#0000ff')">Biru</button>
                </div>
                <button onclick="downloadSingle(${i})" style="font-size:10px; margin-top:5px; cursor:pointer">💾 PNG</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function changeBg(index, color) {
    const photo = photos[index];
    if (color === 'original') {
        photo.current = photo.original;
    } else {
        const canvas = document.getElementById('tempCanvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = photo.noBg;
        await new Promise(r => img.onload = r);
        canvas.width = img.width; canvas.height = img.height;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        photo.current = canvas.toDataURL('image/png');
    }
    renderPhotoList();
    updatePreview();
}

function downloadSingle(i) {
    const a = document.createElement('a');
    a.download = `foto-${Date.now()}.png`;
    a.href = photos[i].current;
    a.click();
}

function updateQty(index, val) { photos[index].qty = parseInt(val) || 1; updatePreview(); }

function updatePreview() {
    const paper = document.getElementById('paper');
    paper.innerHTML = '';
    const selectedSize = sizes[document.getElementById('size').value];
    const scale = (paper.offsetWidth - 20) / 210; 
    let x = 10, y = 10;

    photos.forEach(p => {
        for(let i=0; i<p.qty; i++) {
            const w = selectedSize.w * scale, h = selectedSize.h * scale;
            if (x + w > paper.offsetWidth - 10) { x = 10; y += h + 4; }
            if (y + h > paper.offsetHeight - 10) break;
            const div = document.createElement('div');
            div.className = 'preview-photo';
            Object.assign(div.style, { width: w+'px', height: h+'px', left: x+'px', top: y+'px', backgroundImage: `url(${p.current})` });
            paper.appendChild(div);
            x += w + 4;
        }
    });
}

async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const sz = sizes[document.getElementById('size').value];
    let x = 10, y = 10;
    for (let p of photos) {
        for (let i=0; i<p.qty; i++) {
            if (x + sz.w > 200) { x = 10; y += sz.h + 2; }
            if (y + sz.h > 285) { pdf.addPage(); x = 10; y = 10; }
            pdf.addImage(p.current, 'PNG', x, y, sz.w, sz.h);
            x += sz.w + 2;
        }
    }
    pdf.save("cetak.pdf");
}