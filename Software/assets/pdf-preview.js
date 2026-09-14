/**
 * Altiview — Aperçu avant export PDF
 * Fenêtre commune aux exports (performances, kneeboard urgences) : on voit le
 * document avant de l'imprimer ou de le télécharger, comme pour le dossier de vol.
 */
(function () {
    'use strict';

    function ensureStyles() {
        if (document.getElementById('pdfPreviewStyles')) return;
        const st = document.createElement('style');
        st.id = 'pdfPreviewStyles';
        st.textContent = `
            .pdfp-overlay { display:none; position:fixed; inset:0; background:rgba(4,8,14,.66); backdrop-filter:blur(4px); z-index:99990; align-items:center; justify-content:center; padding:20px; }
            .pdfp-overlay.open { display:flex; }
            .pdfp-card { background:var(--panel); border:1px solid var(--line); border-radius:16px; width:100%; max-width:940px; max-height:94vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:var(--shadow); }
            .pdfp-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 18px; border-bottom:1px solid var(--line); }
            .pdfp-title { font-family:var(--f-mono); font-size:12px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--cyan); }
            .pdfp-sub { font-size:11.5px; color:var(--text-secondary); margin-top:3px; }
            .pdfp-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
            .pdfp-btn { font-family:var(--f-mono); font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; padding:9px 14px; border-radius:8px;
                        cursor:pointer; border:1px solid var(--line-strong); background:transparent; color:var(--text); }
            .pdfp-btn:hover { border-color:var(--cyan); color:var(--cyan); background:var(--cyan-soft); }
            .pdfp-btn.primary { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
            .pdfp-btn.primary:hover { background:var(--accent-hover); color:var(--on-accent); }
            .pdfp-btn[disabled] { opacity:.55; cursor:default; }
            .pdfp-close { background:none; border:0; color:var(--muted); font-size:22px; line-height:1; cursor:pointer; }
            .pdfp-close:hover { color:var(--text); }
            .pdfp-body { flex:1; overflow:auto; background:#8a9199; padding:18px; }
            .pdfp-sheet { background:#fff; color:#0C1620; margin:0 auto; max-width:820px; box-shadow:0 10px 30px rgba(0,0,0,.35); }
            @media (max-width: 700px) { .pdfp-body { padding:10px; } .pdfp-head { flex-direction:column; align-items:stretch; } }
        `;
        document.head.appendChild(st);
    }

    function ensureModal() {
        ensureStyles();
        let el = document.getElementById('pdfPreviewModal');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'pdfPreviewModal';
        el.className = 'pdfp-overlay';
        el.innerHTML = `
            <div class="pdfp-card">
                <div class="pdfp-head">
                    <div>
                        <div class="pdfp-title" id="pdfpTitle">Aperçu</div>
                        <div class="pdfp-sub" id="pdfpSub"></div>
                    </div>
                    <div class="pdfp-actions">
                        <button type="button" class="pdfp-btn" id="pdfpPrint">Imprimer</button>
                        <button type="button" class="pdfp-btn primary" id="pdfpDownload">Télécharger le PDF</button>
                        <button type="button" class="pdfp-close" id="pdfpClose" aria-label="Fermer">&times;</button>
                    </div>
                </div>
                <div class="pdfp-body"><div class="pdfp-sheet" id="pdfpSheet"></div></div>
            </div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) close(); });
        document.getElementById('pdfpClose').addEventListener('click', close);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
        return el;
    }

    function close() {
        const el = document.getElementById('pdfPreviewModal');
        if (el) el.classList.remove('open');
    }

    // impression : le document est recopié dans un cadre isolé, styles compris
    function printSheet(sheet, title) {
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0;';
        document.body.appendChild(frame);
        const doc = frame.contentWindow.document;
        const styles = [...document.querySelectorAll('style')].map(s => s.outerHTML).join('');
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title || 'Altiview'}</title>${styles}
            <style>@page { size:A4 portrait; margin:10mm; } body { margin:0; background:#fff; }</style></head>
            <body>${sheet.innerHTML}</body></html>`);
        doc.close();
        frame.contentWindow.focus();
        setTimeout(() => { frame.contentWindow.print(); setTimeout(() => frame.remove(), 1200); }, 350);
    }

    const AltiviewPdfPreview = {
        open(opts) {
            const o = opts || {};
            ensureModal();
            const sheet = document.getElementById('pdfpSheet');
            document.getElementById('pdfpTitle').textContent = o.title || 'Aperçu avant export';
            document.getElementById('pdfpSub').textContent = o.subtitle || 'Vérifiez le document, puis imprimez ou téléchargez.';
            sheet.className = 'pdfp-sheet' + (o.sheetClass ? ' ' + o.sheetClass : '');
            sheet.innerHTML = o.html || '';

            const dl = document.getElementById('pdfpDownload');
            const pr = document.getElementById('pdfpPrint');
            dl.onclick = async () => {
                if (typeof window.html2pdf !== 'function') { printSheet(sheet, o.title); return; }
                const label = dl.textContent;
                dl.textContent = 'Génération…';
                dl.disabled = true;
                try {
                    if (document.fonts && document.fonts.ready) await document.fonts.ready;
                    await window.html2pdf().set({
                        margin: o.margin !== undefined ? o.margin : 0.35,
                        filename: o.filename || 'altiview.pdf',
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
                        jsPDF: o.jsPDF || { unit: 'in', format: 'a4', orientation: 'portrait' },
                        pagebreak: o.pagebreak || { mode: ['css', 'legacy'] }
                    }).from(sheet).save();
                } catch (e) {
                    console.warn('Export PDF impossible, passage par l\'impression :', e);
                    printSheet(sheet, o.title);
                }
                dl.textContent = label;
                dl.disabled = false;
            };
            pr.onclick = () => printSheet(sheet, o.title);

            document.getElementById('pdfPreviewModal').classList.add('open');
        },
        close
    };

    window.AltiviewPdfPreview = AltiviewPdfPreview;
})();
