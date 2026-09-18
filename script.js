(function(){
  const GRADES = [
    {g:"O",  p:10},
    {g:"A+", p:9},
    {g:"A",  p:8},
    {g:"B+", p:7},
    {g:"B",  p:6},
    {g:"C",  p:5},
    {g:"U",  p:0},
  ];

  const semestersEl = document.getElementById('semesters');
  const cgpaValueEl = document.getElementById('cgpaValue');
  const creditsLineEl = document.getElementById('creditsLine');
  const scaleGrid = document.getElementById('scaleGrid');

  GRADES.forEach(gr=>{
    const d = document.createElement('div');
    d.className = 'scale-item';
    d.innerHTML = `<div class="g">${gr.g}</div><div class="p">${gr.p} pts</div>`;
    scaleGrid.appendChild(d);
  });

  let semCounter = 0;
  let rowCounter = 0;
  const state = []; // { id, name, rows: [{id, name, credit, grade}] }

  function romanize(n){
    const numerals = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    return numerals[n-1] || n;
  }

  function newRow(){
    rowCounter++;
    return { id: rowCounter, name: "", credit: 3, grade: "O" };
  }

  function addSemester(){
    semCounter++;
    state.push({
      id: semCounter,
      name: `Semester ${romanize(semCounter)}`,
      rows: [newRow(), newRow(), newRow()]
    });
    render();
  }

  function removeSemester(id){
    const idx = state.findIndex(s=>s.id===id);
    if(idx>-1) state.splice(idx,1);
    render();
  }

  function addRow(semId){
    const sem = state.find(s=>s.id===semId);
    sem.rows.push(newRow());
    render();
  }

  function removeRow(semId, rowId){
    const sem = state.find(s=>s.id===semId);
    if(sem.rows.length<=1) return;
    sem.rows = sem.rows.filter(r=>r.id!==rowId);
    render();
  }

  function gradePoint(g){
    const found = GRADES.find(x=>x.g===g);
    return found ? found.p : 0;
  }

  function computeSemester(sem){
    let creditSum=0, weighted=0;
    sem.rows.forEach(r=>{
      const c = parseFloat(r.credit) || 0;
      creditSum += c;
      weighted += c * gradePoint(r.grade);
    });
    const sgpa = creditSum>0 ? weighted/creditSum : 0;
    return { creditSum, weighted, sgpa };
  }

  function computeOverall(){
    let creditSum=0, weighted=0;
    state.forEach(sem=>{
      const r = computeSemester(sem);
      creditSum += r.creditSum;
      weighted += r.weighted;
    });
    const cgpa = creditSum>0 ? weighted/creditSum : 0;
    return { creditSum, cgpa };
  }

  function render(){
    semestersEl.innerHTML = "";

    state.forEach(sem=>{
      const { sgpa, creditSum } = computeSemester(sem);

      const card = document.createElement('div');
      card.className = 'semester';

      const head = document.createElement('div');
      head.className = 'sem-head';
      head.innerHTML = `
        <div class="sem-title-group">
          <span class="sem-tag">${romanize(state.indexOf(sem)+1).toString().padStart(2,'0')}</span>
          <input type="text" class="sem-name-input" value="${escapeAttr(sem.name)}" data-sem="${sem.id}" aria-label="Semester name">
        </div>
        <div class="sem-sgpa">SGPA <b>${sgpa.toFixed(2)}</b></div>
      `;
      card.appendChild(head);

      const rows = document.createElement('div');
      rows.className = 'rows';

      const colLabels = document.createElement('div');
      colLabels.className = 'subject-row col-labels-row';
      colLabels.innerHTML = `<span>Subject</span><span>Credit</span><span>Grade</span><span></span>`;
      rows.appendChild(colLabels);

      sem.rows.forEach((row, i)=>{
        const rowEl = document.createElement('div');
        rowEl.className = 'subject-row';

        const gradeOptions = GRADES.map(gr=>
          `<option value="${gr.g}" ${row.grade===gr.g?'selected':''}>${gr.g}</option>`
        ).join('');

        rowEl.innerHTML = `
          <input type="text" placeholder="Subject ${i+1}" value="${escapeAttr(row.name)}" data-sem="${sem.id}" data-row="${row.id}" data-field="name">
          <input type="number" min="0" max="10" step="1" value="${row.credit}" data-sem="${sem.id}" data-row="${row.id}" data-field="credit">
          <select data-sem="${sem.id}" data-row="${row.id}" data-field="grade">${gradeOptions}</select>
          <button class="row-del" data-sem="${sem.id}" data-row="${row.id}" aria-label="Remove subject" type="button">&times;</button>
        `;
        rows.appendChild(rowEl);
      });

      card.appendChild(rows);

      const foot = document.createElement('div');
      foot.className = 'sem-foot';
      foot.innerHTML = `
        <button class="add-subject" data-sem="${sem.id}" type="button">+ Subject</button>
        <button class="del-sem" data-sem="${sem.id}" type="button">Remove semester</button>
      `;
      card.appendChild(foot);

      semestersEl.appendChild(card);
    });

    attachEvents();
    updateSeal();
  }

  function escapeAttr(str){
    return String(str).replace(/"/g,'&quot;');
  }

  function attachEvents(){
    semestersEl.querySelectorAll('input[data-field], select[data-field]').forEach(el=>{
      el.addEventListener('input', (e)=>{
        const semId = parseInt(e.target.dataset.sem);
        const rowId = parseInt(e.target.dataset.row);
        const field = e.target.dataset.field;
        const sem = state.find(s=>s.id===semId);
        const row = sem.rows.find(r=>r.id===rowId);
        row[field] = e.target.value;
        // update SGPA display without full re-render (keeps focus)
        updateInline(sem);
      });
    });

    semestersEl.querySelectorAll('.sem-name-input').forEach(el=>{
      el.addEventListener('input', (e)=>{
        const semId = parseInt(e.target.dataset.sem);
        const sem = state.find(s=>s.id===semId);
        sem.name = e.target.value;
        updateDashboard();
        saveState();
      });
    });

    semestersEl.querySelectorAll('.row-del').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        removeRow(parseInt(btn.dataset.sem), parseInt(btn.dataset.row));
      });
    });

    semestersEl.querySelectorAll('.add-subject').forEach(btn=>{
      btn.addEventListener('click', ()=> addRow(parseInt(btn.dataset.sem)));
    });

    semestersEl.querySelectorAll('.del-sem').forEach(btn=>{
      btn.addEventListener('click', ()=> removeSemester(parseInt(btn.dataset.sem)));
    });
  }

  function updateInline(sem){
    const { sgpa } = computeSemester(sem);
    const card = [...semestersEl.children][state.indexOf(sem)];
    if(card){
      const b = card.querySelector('.sem-sgpa b');
      if(b) b.textContent = sgpa.toFixed(2);
    }
    updateSeal();
  }

  function updateSeal(){
    const { creditSum, cgpa } = computeOverall();
    cgpaValueEl.textContent = cgpa.toFixed(2);
    creditsLineEl.innerHTML = `<b>${creditSum}</b> credits across <b>${state.length}</b> semester${state.length===1?'':'s'}`;
    updateDashboard();
    updateChart();
    saveState();
  }

  function saveState(){
    try {
      localStorage.setItem('cgpa_calculator_state', JSON.stringify(state));
    } catch(e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  function loadState(){
    try {
      const saved = localStorage.getItem('cgpa_calculator_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.length = 0;
          parsed.forEach(sem => {
            semCounter = Math.max(semCounter, sem.id);
            sem.rows.forEach(row => {
              rowCounter = Math.max(rowCounter, row.id);
            });
            state.push(sem);
          });
          return true;
        }
      }
    } catch(e) {
      console.error('Failed to load state from localStorage:', e);
    }
    return false;
  }

  function updateDashboard() {
    const dashboardSummary = document.getElementById('dashboardSummary');
    if (state.length === 0) {
      dashboardSummary.style.display = 'none';
      return;
    }
    dashboardSummary.style.display = 'block';
    
    let html = `<div class="dash-title"><span>GPA & CGPA Summary</span><span style="font-family:'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); font-weight: normal;">CGPA: ${computeOverall().cgpa.toFixed(2)}</span></div>`;
    html += `<div class="dash-grid">`;
    
    state.forEach(sem => {
      const { sgpa } = computeSemester(sem);
      html += `
        <div class="dash-item">
          <div class="dash-sem-name" title="${escapeAttr(sem.name)}">${sem.name}</div>
          <div class="dash-sem-gpa">${sgpa.toFixed(2)}</div>
        </div>
      `;
    });
    
    html += `</div>`;
    dashboardSummary.innerHTML = html;
  }

  function updateChart() {
    const chartContainer = document.getElementById('chartContainer');
    if (state.length < 2) {
      chartContainer.style.display = 'none';
      return;
    }
    chartContainer.style.display = 'block';

    const width = 500;
    const height = 100;
    const paddingX = 40;
    const paddingY = 15;

    const data = state.map((sem, idx) => {
      const { sgpa } = computeSemester(sem);
      return { label: romanize(idx + 1), val: sgpa };
    });

    const minVal = 0;
    const maxVal = 10;

    const getX = (index) => {
      if (data.length === 1) return width / 2;
      return paddingX + (index * (width - 2 * paddingX) / (data.length - 1));
    };

    const getY = (val) => {
      return height - paddingY - (val * (height - 2 * paddingY) / maxVal);
    };

    let svgContent = '';
    
    [2.5, 5, 7.5, 10].forEach(gridVal => {
      const y = getY(gridVal);
      svgContent += `<line x1="${paddingX - 10}" y1="${y}" x2="${width - paddingX + 10}" y2="${y}" class="chart-grid-line" />`;
      svgContent += `<text x="${paddingX - 20}" y="${y + 3}" class="chart-text" style="text-anchor: end; font-size: 8px;">${gridVal}</text>`;
    });

    let points = '';
    data.forEach((d, idx) => {
      points += `${getX(idx)},${getY(d.val)} `;
    });

    svgContent += `<polyline points="${points.trim()}" class="chart-line" />`;

    data.forEach((d, idx) => {
      const x = getX(idx);
      const y = getY(d.val);
      svgContent += `
        <circle cx="${x}" cy="${y}" r="4.5" class="chart-point" />
        <text x="${x}" y="${y - 10}" class="chart-text" style="fill: var(--text); font-weight: 600;">${d.val.toFixed(2)}</text>
        <text x="${x}" y="${height - 2}" class="chart-text">Sem ${d.label}</text>
      `;
    });

    chartContainer.innerHTML = `
      <div class="chart-title">SGPA Progression</div>
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg">
        ${svgContent}
      </svg>
    `;
  }

  document.getElementById('addSemBtn').addEventListener('click', addSemester);
  document.getElementById('resetBtn').addEventListener('click', ()=>{
    if (confirm("Are you sure you want to clear all semesters?")) {
      localStorage.removeItem('cgpa_calculator_state');
      state.length = 0;
      semCounter = 0;
      rowCounter = 0;
      addSemester();
    }
  });

  // load state from localStorage or start with one semester
  if (!loadState()) {
    addSemester();
  } else {
    render();
  }

  /* ================= PDF import (AI-powered) ================= */

  // Frontend and backend are deployed together in the same Vercel project,
  // so a relative path works regardless of the domain.
  const PARSE_API_URL = "/api/parse-result";

  const pdfInput = document.getElementById('pdfInput');
  const importStatusEl = document.getElementById('importStatus');
  const importPreviewEl = document.getElementById('importPreview');

  let importIdCounter = 0;
  let pendingGroups = []; // [{ key, label, rows: [{importId, name, credit, grade, include}] }]

  function setImportStatus(msg, isError){
    importStatusEl.textContent = msg || '';
    importStatusEl.classList.toggle('error', !!isError);
  }

  async function importPdfs(files){
    importPreviewEl.innerHTML = '';
    setImportStatus('Analyzing PDFs with AI…', false);
    pendingGroups = [];
    importIdCounter = 0;
    
    let totalFound = 0;
    let errors = [];

    const promises = Array.from(files).map(async (file, idx) => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(PARSE_API_URL, { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok || !data.success) {
          errors.push(`${file.name}: ${data.error || 'Failed to parse'}`);
          return;
        }

        const semesters = data.semesters || [];
        semesters.forEach((sem, semIdx) => {
          const rows = (sem.subjects || []).map(sub => {
            importIdCounter++;
            return {
              importId: importIdCounter,
              name: sub.name || '',
              credit: sub.credit || 0,
              grade: sub.grade || 'O',
              include: true
            };
          });
          totalFound += rows.length;
          let label = sem.label || `Group ${idx + 1}`;
          if (files.length > 1) {
            label = `${label} (${file.name.replace(/\.[^/.]+$/, "")})`;
          }
          pendingGroups.push({ key: `${idx}-${semIdx}`, label, rows });
        });
      } catch (err) {
        console.error(err);
        errors.push(`${file.name}: Couldn't reach AI service`);
      }
    });

    await Promise.all(promises);

    if (errors.length > 0 && pendingGroups.length === 0) {
      setImportStatus(`Failed to analyze: ${errors.join('; ')}`, true);
      return;
    }

    let statusMsg = `Found ${totalFound} subject${totalFound===1?'':'s'} across ${pendingGroups.length} group${pendingGroups.length===1?'':'s'}.`;
    if (errors.length > 0) {
      statusMsg += ` (Some errors occurred: ${errors.length} file(s) failed)`;
    }
    statusMsg += ` Review below, then add.`;
    
    setImportStatus(statusMsg, errors.length > 0);
    renderImportPreview();
  }

  function renderImportPreview(){
    if(!pendingGroups.length){ importPreviewEl.innerHTML=''; return; }

    const panel = document.createElement('div');
    panel.className = 'review-panel';

    const head = document.createElement('div');
    head.className = 'review-head';
    head.textContent = 'Review imported subjects';
    panel.appendChild(head);

    const sub = document.createElement('div');
    sub.className = 'review-sub';
    sub.textContent = 'Uncheck anything that looks wrong, fix names/credits/grades if needed, then add it in.';
    panel.appendChild(sub);

    pendingGroups.forEach(group=>{
      const g = document.createElement('div');
      g.className = 'review-group';
      const title = document.createElement('div');
      title.className = 'review-group-title';
      title.textContent = group.label;
      g.appendChild(title);

      group.rows.forEach(row=>{
        const rowEl = document.createElement('div');
        rowEl.className = 'review-row';
        const gradeOptions = GRADES.map(gr=>
          `<option value="${gr.g}" ${row.grade===gr.g?'selected':''}>${gr.g}</option>`
        ).join('');
        rowEl.innerHTML = `
          <input type="checkbox" ${row.include?'checked':''} data-group="${group.key}" data-import="${row.importId}" data-field="include">
          <input type="text" value="${escapeAttr(row.name)}" data-group="${group.key}" data-import="${row.importId}" data-field="name">
          <input type="number" min="0" max="10" step="0.5" value="${row.credit}" data-group="${group.key}" data-import="${row.importId}" data-field="credit">
          <select data-group="${group.key}" data-import="${row.importId}" data-field="grade">${gradeOptions}</select>
        `;
        g.appendChild(rowEl);
      });
      panel.appendChild(g);
    });

    const actions = document.createElement('div');
    actions.className = 'review-actions';
    actions.innerHTML = `
      <button class="review-cancel" type="button" id="reviewCancelBtn">Discard</button>
      <button class="review-confirm" type="button" id="reviewConfirmBtn">Add to calculator</button>
    `;
    panel.appendChild(actions);

    importPreviewEl.innerHTML = '';
    importPreviewEl.appendChild(panel);

    panel.querySelectorAll('input[data-field], select[data-field]').forEach(el=>{
      const evt = el.type==='checkbox' ? 'change' : 'input';
      el.addEventListener(evt, (e)=>{
        const key = parseInt(e.target.dataset.group);
        const importId = parseInt(e.target.dataset.import);
        const field = e.target.dataset.field;
        const group = pendingGroups.find(g=>g.key===key);
        const row = group.rows.find(r=>r.importId===importId);
        row[field] = field==='include' ? e.target.checked : e.target.value;
      });
    });

    document.getElementById('reviewCancelBtn').addEventListener('click', ()=>{
      pendingGroups = [];
      importPreviewEl.innerHTML = '';
      setImportStatus('');
      pdfInput.value = '';
    });

    document.getElementById('reviewConfirmBtn').addEventListener('click', ()=>{
      const isInitialEmpty = state.length === 1 && state[0].rows.every(r => !r.name.trim());
      if (isInitialEmpty) {
        state.length = 0;
        semCounter = 0;
        rowCounter = 0;
      }
      
      pendingGroups.forEach(group=>{
        const included = group.rows.filter(r=>r.include);
        if(!included.length) return;
        semCounter++;
        state.push({
          id: semCounter,
          name: group.label,
          rows: included.map(r=>{
            rowCounter++;
            return { id: rowCounter, name: r.name, credit: parseFloat(r.credit)||0, grade: r.grade };
          })
        });
      });
      pendingGroups = [];
      importPreviewEl.innerHTML = '';
      setImportStatus('Added to your calculator below.', false);
      pdfInput.value = '';
      render();
    });
  }

  pdfInput.addEventListener('change', (e)=>{
    const files = e.target.files;
    if(files && files.length > 0) importPdfs(files);
  });
})();
