// ==UserScript==
// @name         Bulk ASINs Variations Lookup v3.1
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Batch query child ASINs + attributes, smart detection of no-variation/non-existent ASINs
// @match        https://variations.amazon.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        DELAY_BETWEEN_QUERIES: 3000,
        WAIT_FOR_RESULT: 4000,
        MAX_PAGINATION_PAGES: 20,
    };

    // ==================== Styles ====================
    const style = document.createElement('style');
    style.textContent = `
        #tm-batch-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 999999;
            background: #232f3e;
            color: #ffffff;
            padding: 20px;
            border-radius: 12px;
            font-family: 'Amazon Ember', Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            width: 540px;
            max-height: 90vh;
            overflow-y: auto;
            transition: all 0.3s ease;
        }
        #tm-batch-panel.tm-collapsed {
            width: auto;
            max-height: none;
            overflow: visible;
            padding: 10px 16px;
        }
        #tm-batch-panel.tm-collapsed .tm-collapsible { display: none; }
        #tm-batch-panel h3 { margin: 0 0 4px 0; font-size: 18px; color: #ff9900; }
        #tm-batch-panel .tm-subtitle { color: #999; font-size: 12px; margin-bottom: 14px; }
        #tm-batch-panel textarea {
            width: 100%; height: 120px; background: #1a1a2e; color: #00ff88;
            border: 1px solid #444; border-radius: 8px; padding: 10px;
            font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box;
        }
        #tm-batch-panel textarea:focus { outline: none; border-color: #ff9900; }
        #tm-batch-panel textarea::placeholder { color: #666; }
        .tm-btn {
            padding: 10px 16px; border: none; border-radius: 8px; cursor: pointer;
            font-weight: bold; font-size: 14px; transition: all 0.2s;
            display: inline-flex; align-items: center; gap: 6px;
        }
        .tm-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .tm-btn:active { transform: translateY(0); }
        .tm-btn-primary { background: #ff9900; color: #1a1a2e; }
        .tm-btn-success { background: #00ff88; color: #1a1a2e; }
        .tm-btn-danger { background: #ff6b6b; color: white; }
        .tm-btn-secondary { background: #444; color: white; }
        .tm-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .tm-btn-toggle {
            background: none; border: none; color: #ff9900;
            cursor: pointer; font-size: 16px; padding: 0 0 0 8px;
        }
        #tm-progress-container { margin-top: 12px; display: none; }
        #tm-progress-bar-bg {
            width: 100%; height: 24px; background: #1a1a2e;
            border-radius: 12px; overflow: hidden; position: relative;
        }
        #tm-progress-bar {
            height: 100%; background: linear-gradient(90deg, #ff9900, #ffb84d);
            border-radius: 12px; transition: width 0.5s ease; width: 0%;
        }
        #tm-progress-text {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%); font-size: 12px;
            font-weight: bold; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        #tm-status { margin-top: 8px; font-size: 12px; color: #aaa; min-height: 18px; }
        #tm-results-container { margin-top: 14px; display: none; }
        #tm-results-table {
            width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px;
        }
        #tm-results-table th {
            background: #ff9900; color: #1a1a2e; padding: 7px 8px;
            text-align: left; font-weight: bold; position: sticky;
            top: 0; white-space: nowrap; font-size: 11px;
        }
        #tm-results-table td {
            padding: 5px 8px; border-bottom: 1px solid #333; color: #ddd;
            max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        #tm-results-table td:hover { white-space: normal; overflow: visible; background: #2a2a4a; }
        #tm-results-table tr:hover td { background: #2a2a4a; }
        #tm-results-table-wrapper {
            max-height: 320px; overflow: auto; border-radius: 8px; border: 1px solid #333;
        }
        .tm-btn-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .tm-config-row {
            display: flex; align-items: center; gap: 8px;
            margin: 10px 0; font-size: 12px; color: #aaa;
        }
        .tm-config-row input[type="number"] {
            width: 60px; background: #1a1a2e; color: #ff9900;
            border: 1px solid #444; border-radius: 4px; padding: 4px 6px;
            font-size: 12px; text-align: center;
        }
        .tm-header-row { display: flex; justify-content: space-between; align-items: center; }
        .tm-parent-label { color: #ff9900; font-weight: bold; }
        .tm-field-tags { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
        .tm-field-tag {
            background: #1a1a2e; color: #00ff88; padding: 2px 8px;
            border-radius: 10px; font-size: 11px; border: 1px solid #333;
        }
        /* ====== v3.1: Status styles ====== */
        .tm-status-ok td:last-child { color: #00ff88; }
        .tm-status-no-variant td { color: #ff9900 !important; }
        .tm-status-not-found td { color: #ff6b6b !important; }
        .tm-status-error td { color: #ff6b6b !important; font-style: italic; }
        .tm-status-badge {
            display: inline-block; padding: 2px 8px; border-radius: 10px;
            font-size: 10px; font-weight: bold; white-space: nowrap;
        }
        .tm-badge-ok { background: #00ff8822; color: #00ff88; border: 1px solid #00ff8844; }
        .tm-badge-no-variant { background: #ff990022; color: #ff9900; border: 1px solid #ff990044; }
        .tm-badge-not-found { background: #ff6b6b22; color: #ff6b6b; border: 1px solid #ff6b6b44; }
        .tm-badge-error { background: #ff6b6b22; color: #ff6b6b; border: 1px solid #ff6b6b44; }
        /* Stats bar */
        #tm-stats-bar {
            display: flex; gap: 12px; margin-top: 8px; font-size: 11px; flex-wrap: wrap;
        }
        .tm-stat-item { display: flex; align-items: center; gap: 4px; }
        .tm-stat-dot {
            width: 8px; height: 8px; border-radius: 50%; display: inline-block;
        }
    `;
    document.head.appendChild(style);

    // ==================== Panel ====================
    const panel = document.createElement('div');
    panel.id = 'tm-batch-panel';
    panel.innerHTML = `
        <div class="tm-header-row">
            <h3>📦 Bulk ASINs Variations Lookup v3.1</h3>
            <button class="tm-btn-toggle" id="tm-toggle-panel" title="Collapse/Expand">▼</button>
        </div>
        <div class="tm-subtitle">Batch query child ASINs + attributes ｜ Smart detection of no-variation / inactive ASINs</div>
        <div class="tm-collapsible">
            <textarea id="tm-asin-input"
                placeholder="One parent ASIN per line, e.g.:&#10;B08N5WRWNW&#10;B09V3KXJPB&#10;B07FZ8S74R"></textarea>
            <div class="tm-config-row">
                ⏱ Query interval:
                <input type="number" id="tm-delay" value="3" min="1" max="30"> sec
                &nbsp;|&nbsp; Entered <strong id="tm-asin-count">0</strong> ASINs
            </div>
            <div class="tm-btn-row">
                <button class="tm-btn tm-btn-primary" id="tm-start">▶ Start Batch Query</button>
                <button class="tm-btn tm-btn-danger" id="tm-stop" disabled>⏹ Stop</button>
                <button class="tm-btn tm-btn-secondary" id="tm-clear">🗑 Clear</button>
            </div>
            <div id="tm-progress-container">
                <div id="tm-progress-bar-bg">
                    <div id="tm-progress-bar"></div>
                    <div id="tm-progress-text">0 / 0</div>
                </div>
                <div id="tm-status">Ready</div>
            </div>
            <div id="tm-results-container">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <strong style="color:#ff9900;">📊 Query Results</strong>
                    <span id="tm-result-count" style="font-size:12px;color:#aaa;"></span>
                </div>
                <div id="tm-stats-bar"></div>
                <div id="tm-detected-fields" class="tm-field-tags" style="display:none;"></div>
                <div id="tm-results-table-wrapper">
                    <table id="tm-results-table">
                        <thead id="tm-results-head">
                            <tr><th>Parent ASIN</th><th>Child ASIN</th><th>Status</th></tr>
                        </thead>
                        <tbody id="tm-results-body"></tbody>
                    </table>
                </div>
                <div class="tm-btn-row">
                    <button class="tm-btn tm-btn-success" id="tm-export-csv">📥 Export CSV</button>
                    <button class="tm-btn tm-btn-secondary" id="tm-copy-results">📋 Copy Results</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // ==================== Variables ====================
    let isRunning = false;
    let shouldStop = false;
    let allResults = [];
    // result structure: { parentAsin, children: [{asin, attributes:{}}], status: 'ok'|'no-variant'|'not-found'|'error', error: '' }
    let globalHeaders = [];
    let headersInitialized = false;

    // ==================== DOM ====================
    const asinInput = document.getElementById('tm-asin-input');
    const asinCount = document.getElementById('tm-asin-count');
    const startBtn = document.getElementById('tm-start');
    const stopBtn = document.getElementById('tm-stop');
    const clearBtn = document.getElementById('tm-clear');
    const progressContainer = document.getElementById('tm-progress-container');
    const progressBar = document.getElementById('tm-progress-bar');
    const progressText = document.getElementById('tm-progress-text');
    const statusDiv = document.getElementById('tm-status');
    const resultsContainer = document.getElementById('tm-results-container');
    const resultsBody = document.getElementById('tm-results-body');
    const resultsHead = document.getElementById('tm-results-head');
    const resultCount = document.getElementById('tm-result-count');
    const statsBar = document.getElementById('tm-stats-bar');
    const detectedFields = document.getElementById('tm-detected-fields');
    const toggleBtn = document.getElementById('tm-toggle-panel');

    // ==================== Utility Functions ====================
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function parseAsins(text) {
        return text.split(/[\n,;]+/).map(s => s.trim().toUpperCase())
            .filter(s => /^[A-Z0-9]{10}$/.test(s));
    }

    function getDelay() {
        return Math.max(1, Math.min(30, parseInt(document.getElementById('tm-delay').value) || 3)) * 1000;
    }

    function updateProgress(current, total, message) {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        progressBar.style.width = pct + '%';
        progressText.textContent = `${current} / ${total}`;
        statusDiv.textContent = message;
    }

    // ==================== v3.1 Stats Bar ====================
    function updateStatsBar() {
        const counts = { ok: 0, 'no-variant': 0, 'not-found': 0, error: 0 };
        allResults.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
        const totalChildren = allResults.reduce((s, r) => s + r.children.length, 0);

        statsBar.innerHTML = `
            <span class="tm-stat-item"><span class="tm-stat-dot" style="background:#00ff88;"></span> OK: ${counts.ok} (${totalChildren} child ASINs)</span>
            <span class="tm-stat-item"><span class="tm-stat-dot" style="background:#ff9900;"></span> No Variation: ${counts['no-variant']}</span>
            <span class="tm-stat-item"><span class="tm-stat-dot" style="background:#ff6b6b;"></span> Not Found: ${counts['not-found']}</span>
            ${counts.error > 0 ? `<span class="tm-stat-item"><span class="tm-stat-dot" style="background:#ff6b6b;"></span> Errors: ${counts.error}</span>` : ''}
        `;

        resultCount.textContent = `Total: ${allResults.length} parent ASINs`;
    }

    // ==================== Dynamic Table Headers ====================
    function updateTableHeaders(headers) {
        let changed = false;
        headers.forEach(h => {
            const n = h.trim();
            if (n && !globalHeaders.includes(n)) { globalHeaders.push(n); changed = true; }
        });
        if (changed || !headersInitialized) {
            resultsHead.innerHTML = `<tr>
                <th>Parent ASIN</th><th>Child ASIN</th>
                ${globalHeaders.map(h => `<th>${h}</th>`).join('')}
                <th>Status</th>
            </tr>`;
            detectedFields.style.display = 'flex';
            detectedFields.innerHTML =
                '<span style="color:#aaa;font-size:11px;">Detected fields:</span>' +
                globalHeaders.map(h => `<span class="tm-field-tag">${h}</span>`).join('');
            headersInitialized = true;
            rebuildAllRows();
        }
    }

    function rebuildAllRows() {
        resultsBody.innerHTML = '';
        allResults.forEach(r => renderResultRow(r));
    }

    // ==================== v3.1 Result Rendering (with status) ====================
    function getStatusBadge(status) {
        const map = {
            'ok':         '<span class="tm-status-badge tm-badge-ok">✅ OK</span>',
            'no-variant': '<span class="tm-status-badge tm-badge-no-variant">⚠️ No Variation (same parent/child)</span>',
            'not-found':  '<span class="tm-status-badge tm-badge-not-found">❌ Not Found / Delisted</span>',
            'error':      '<span class="tm-status-badge tm-badge-error">❌ Query Error</span>',
        };
        return map[status] || status;
    }

    function renderResultRow(result) {
        const { parentAsin, children, status, error } = result;
        const colSpan = globalHeaders.length + 2;

        if (status === 'not-found') {
            const tr = document.createElement('tr');
            tr.className = 'tm-status-not-found';
            tr.innerHTML = `
                <td class="tm-parent-label">${parentAsin}</td>
                <td colspan="${colSpan}">${getStatusBadge('not-found')}</td>
            `;
            resultsBody.appendChild(tr);

        } else if (status === 'no-variant') {
            const tr = document.createElement('tr');
            tr.className = 'tm-status-no-variant';
            tr.innerHTML = `
                <td class="tm-parent-label">${parentAsin}</td>
                <td>${parentAsin}</td>
                ${globalHeaders.map(() => '<td>—</td>').join('')}
                <td>${getStatusBadge('no-variant')}</td>
            `;
            resultsBody.appendChild(tr);

        } else if (status === 'error') {
            const tr = document.createElement('tr');
            tr.className = 'tm-status-error';
            tr.innerHTML = `
                <td class="tm-parent-label">${parentAsin}</td>
                <td colspan="${colSpan}">${getStatusBadge('error')} ${error}</td>
            `;
            resultsBody.appendChild(tr);

        } else {
            // Normal: has child ASINs
            if (children.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="tm-parent-label">${parentAsin}</td>
                    <td colspan="${colSpan}"><span class="tm-status-badge tm-badge-no-variant">No child ASINs</span></td>
                `;
                resultsBody.appendChild(tr);
            } else {
                children.forEach((child, i) => {
                    const tr = document.createElement('tr');
                    tr.className = 'tm-status-ok';
                    const parentCell = i === 0
                        ? `<td class="tm-parent-label" rowspan="${children.length}">${parentAsin}</td>`
                        : '';
                    const attrCells = globalHeaders.map(h => {
                        const val = child.attributes[h] || '—';
                        return `<td title="${val}">${val}</td>`;
                    }).join('');
                    tr.innerHTML = `${parentCell}<td>${child.asin}</td>${attrCells}<td>${getStatusBadge('ok')}</td>`;
                    resultsBody.appendChild(tr);
                });
            }
        }

        updateStatsBar();
    }

    // ==================== v3.1 Core: Status Detection + Data Collection ====================
    async function detectResultStatus(parentAsin) {
        await sleep(CONFIG.WAIT_FOR_RESULT);

        const resultDiv = document.getElementById('result');
        if (!resultDiv) return { status: 'not-found', children: [], tableHeaders: [] };

        const resultText = resultDiv.textContent || '';
        const resultHTML = resultDiv.innerHTML || '';

        // ====== Detection 1: No results ======
        if (/no\s*results?\s*(to\s*display)?/i.test(resultText) ||
            resultText.trim() === '' ||
            resultDiv.offsetParent === null) {
            return { status: 'not-found', children: [], tableHeaders: [] };
        }

        // ====== Detection 2: undefined fields → same parent/child ASIN, no variation ======
        const undefinedCount = (resultText.match(/undefined/gi) || []).length;
        if (undefinedCount >= 2) {
            return { status: 'no-variant', children: [], tableHeaders: [] };
        }

        // ====== Detection 3: Normal result, collect data ======
        const table = document.getElementById('childAsinTable');
        if (!table) {
            // No table but no anomalies above → page structure may have changed
            // Try extracting from text
            const matches = resultText.match(/\b[A-Z0-9]{10}\b/g);
            if (matches && matches.length > 0) {
                const unique = [...new Set(matches)].filter(a => a !== parentAsin);
                return {
                    status: unique.length > 0 ? 'ok' : 'no-variant',
                    children: unique.map(asin => ({ asin, attributes: {} })),
                    tableHeaders: []
                };
            }
            return { status: 'not-found', children: [], tableHeaders: [] };
        }

        // Read table headers
        const thElements = table.querySelectorAll('thead th');
        const allTableHeaders = Array.from(thElements).map(th => th.textContent.trim());

        // Locate ASIN column
        let asinColIndex = allTableHeaders.findIndex(h => /child/i.test(h) && /asin/i.test(h));
        if (asinColIndex === -1) asinColIndex = allTableHeaders.findIndex(h => /asin/i.test(h));
        if (asinColIndex === -1) asinColIndex = 0;

        const attrHeaders = allTableHeaders.filter((_, i) => i !== asinColIndex);

        // Paginated data collection
        const children = [];
        const seenAsins = new Set();
        let pageCount = 0;

        while (pageCount < CONFIG.MAX_PAGINATION_PAGES) {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length === 0) return;

                const asinCell = cells[asinColIndex];
                if (!asinCell) return;
                const asin = asinCell.textContent.trim();
                if (!asin || !/^[A-Z0-9]{10}$/.test(asin) || seenAsins.has(asin)) return;
                seenAsins.add(asin);

                const attributes = {};
                for (let i = 0; i < cells.length; i++) {
                    if (i === asinColIndex) continue;
                    const headerName = allTableHeaders[i] || `Column_${i}`;
                    const cellText = cells[i].textContent.trim();
                    // Skip undefined values
                    attributes[headerName] = (cellText === 'undefined' || cellText === '') ? '—' : cellText;
                }
                children.push({ asin, attributes });
            });

            const nextBtn = document.getElementById('childAsinTable_next');
            if (nextBtn && !nextBtn.classList.contains('disabled')) {
                nextBtn.click();
                await sleep(800);
                pageCount++;
            } else {
                break;
            }
        }

        // Filter out parent ASIN
        const filtered = children.filter(c => c.asin !== parentAsin);

        // If filtered is empty and original data only had the parent ASIN itself → no variation
        if (filtered.length === 0 && children.length <= 1) {
            return { status: 'no-variant', children: [], tableHeaders: attrHeaders };
        }

        return { status: 'ok', children: filtered, tableHeaders: attrHeaders };
    }

    // ==================== Single Query ====================
    async function querySingleAsin(parentAsin) {
        const input = document.getElementById('asin');
        const submitBtn = document.querySelector('button.btn.btn-primary');
        if (!input || !submitBtn) throw new Error('Cannot find input field or submit button');

        input.value = '';
        input.focus();
        const nativeSet = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        nativeSet.call(input, parentAsin);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(300);
        submitBtn.click();

        const { status, children, tableHeaders } = await detectResultStatus(parentAsin);

        if (tableHeaders.length > 0) {
            updateTableHeaders(tableHeaders);
        }

        return { status, children };
    }

    // ==================== Batch Query ====================
    async function startBatchQuery() {
        const asins = parseAsins(asinInput.value);
        if (asins.length === 0) {
            statusDiv.textContent = '⚠️ Please enter at least one valid ASIN';
            statusDiv.style.color = '#ff6b6b';
            return;
        }

        isRunning = true;
        shouldStop = false;
        allResults = [];
        globalHeaders = [];
        headersInitialized = false;
        resultsBody.innerHTML = '';
        resultsHead.innerHTML = '<tr><th>Parent ASIN</th><th>Child ASIN</th><th>Status</th></tr>';
        detectedFields.style.display = 'none';
        detectedFields.innerHTML = '';
        statsBar.innerHTML = '';
        startBtn.disabled = true;
        stopBtn.disabled = false;
        asinInput.disabled = true;
        progressContainer.style.display = 'block';
        resultsContainer.style.display = 'block';
        statusDiv.style.color = '#aaa';

        const delay = getDelay();

        for (let i = 0; i < asins.length; i++) {
            if (shouldStop) { updateProgress(i, asins.length, '⏹ Stopped manually'); break; }

            const parentAsin = asins[i];
            updateProgress(i, asins.length, `🔍 Querying: ${parentAsin}...`);

            try {
                const { status, children } = await querySingleAsin(parentAsin);
                const result = { parentAsin, children, status, error: '' };
                allResults.push(result);
                renderResultRow(result);
            } catch (err) {
                const result = { parentAsin, children: [], status: 'error', error: err.message };
                allResults.push(result);
                renderResultRow(result);
            }

            updateProgress(i + 1, asins.length,
                `✅ Completed ${i + 1}/${asins.length}` +
                (i < asins.length - 1 ? `, next in ${delay/1000}s...` : '')
            );

            if (i < asins.length - 1 && !shouldStop) await sleep(delay);
        }

        isRunning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        asinInput.disabled = false;

        if (!shouldStop) {
            const c = { ok: 0, 'no-variant': 0, 'not-found': 0, error: 0 };
            allResults.forEach(r => c[r.status]++);
            const totalChildren = allResults.reduce((s, r) => s + r.children.length, 0);
            updateProgress(asins.length, asins.length,
                `🎉 Done! OK: ${c.ok} (${totalChildren} child ASINs) | No Variation: ${c['no-variant']} | Not Found: ${c['not-found']}`
            );
        }
    }

    // ==================== v3.1 Export CSV (with status column) ====================
    function exportCSV() {
        if (allResults.length === 0) return;
        const csvHeaders = ['Parent ASIN', 'Child ASIN', ...globalHeaders, 'Status', 'Status Detail'];
        let csv = '\uFEFF' + csvHeaders.join(',') + '\n';

        allResults.forEach(r => {
            const statusMap = {
                'ok': 'OK',
                'no-variant': 'No Variation',
                'not-found': 'Not Found / Delisted',
                'error': 'Query Error'
            };
            const statusLabel = statusMap[r.status] || r.status;

            if (r.status === 'not-found') {
                csv += `${r.parentAsin},,${globalHeaders.map(() => '').join(',')},${statusLabel},ASIN may be delisted or does not exist\n`;
            } else if (r.status === 'no-variant') {
                csv += `${r.parentAsin},${r.parentAsin},${globalHeaders.map(() => '').join(',')},${statusLabel},Same parent/child ASIN - no variation relationship\n`;
            } else if (r.status === 'error') {
                csv += `${r.parentAsin},,${globalHeaders.map(() => '').join(',')},${statusLabel},${r.error}\n`;
            } else {
                r.children.forEach(child => {
                    const attrs = globalHeaders.map(h => {
                        let val = child.attributes[h] || '';
                        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                            val = '"' + val.replace(/"/g, '""') + '"';
                        }
                        return val;
                    });
                    csv += `${r.parentAsin},${child.asin},${attrs.join(',')},${statusLabel},\n`;
                });
            }
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bulk_ASIN_Variations_Lookup_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ==================== Copy Results ====================
    function copyResults() {
        if (allResults.length === 0) return;
        const headers = ['Parent ASIN', 'Child ASIN', ...globalHeaders, 'Status', 'Status Detail'];
        let text = headers.join('\t') + '\n';

        const statusMap = { 'ok': 'OK', 'no-variant': 'No Variation', 'not-found': 'Not Found / Delisted', 'error': 'Query Error' };

        allResults.forEach(r => {
            const sl = statusMap[r.status] || r.status;
            if (r.status === 'not-found') {
                text += `${r.parentAsin}\t\t${globalHeaders.map(() => '').join('\t')}\t${sl}\tASIN may be delisted or does not exist\n`;
            } else if (r.status === 'no-variant') {
                text += `${r.parentAsin}\t${r.parentAsin}\t${globalHeaders.map(() => '').join('\t')}\t${sl}\tSame parent/child ASIN - no variation relationship\n`;
            } else if (r.status === 'error') {
                text += `${r.parentAsin}\t\t${globalHeaders.map(() => '').join('\t')}\t${sl}\t${r.error}\n`;
            } else {
                r.children.forEach(child => {
                    const attrs = globalHeaders.map(h => child.attributes[h] || '').join('\t');
                    text += `${r.parentAsin}\t${child.asin}\t${attrs}\t${sl}\t\n`;
                });
            }
        });

        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('tm-copy-results');
            btn.textContent = '✅ Copied! Paste directly into Excel';
            setTimeout(() => { btn.textContent = '📋 Copy Results'; }, 2500);
        });
    }

    // ==================== Event Bindings ====================
    asinInput.addEventListener('input', () => {
        asinCount.textContent = parseAsins(asinInput.value).length;
    });
    startBtn.addEventListener('click', startBatchQuery);
    stopBtn.addEventListener('click', () => {
        shouldStop = true; stopBtn.disabled = true;
        statusDiv.textContent = '⏳ Stopping...';
    });
    clearBtn.addEventListener('click', () => {
        if (isRunning) return;
        asinInput.value = ''; asinCount.textContent = '0';
        resultsBody.innerHTML = ''; allResults = [];
        globalHeaders = []; headersInitialized = false;
        resultsHead.innerHTML = '<tr><th>Parent ASIN</th><th>Child ASIN</th><th>Status</th></tr>';
        progressContainer.style.display = 'none';
        resultsContainer.style.display = 'none';
        detectedFields.style.display = 'none';
        detectedFields.innerHTML = ''; statsBar.innerHTML = '';
        resultCount.textContent = '';
    });
    document.getElementById('tm-export-csv').addEventListener('click', exportCSV);
    document.getElementById('tm-copy-results').addEventListener('click', copyResults);
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('tm-collapsed');
        toggleBtn.textContent = panel.classList.contains('tm-collapsed') ? '▶' : '▼';
    });

    console.log('✅ Bulk ASINs Variations Lookup v3.1 loaded');
})();