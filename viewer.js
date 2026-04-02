import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCt-jjPPowg2rWffoz0aeUo6bkhHaisTFg',
  authDomain: 'tracking-nomad.firebaseapp.com',
  projectId: 'tracking-nomad',
  storageBucket: 'tracking-nomad.firebasestorage.app',
  messagingSenderId: '735736477673',
  appId: '1:735736477673:web:e016d70bd963141bc0bd78'
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const COLLECTION_NAME = 'tracks';

const FLOW_BY_SAMPLE = {
  sangre: { label: 'Sangre' },
  tejido: { label: 'Tejido' },
  tejido_sangre: { label: 'Tejido y sangre' }
};

const STAGE_ICONS = {
  pedido: '🛒',
  validacion: '🔬',
  transito: '📦',
  curso: '🧪',
  informe: '📄'
};

const STATUS_LABELS = {
  completada: 'Completada',
  cancelada: 'Cancelada',
  en_revision: 'En revisión',
  valida: 'Válida',
  no_valida: 'No válida',
  en_transito: 'En tránsito',
  enviada: 'Enviada',
  entregada: 'Entregada',
  retraso_aduana: 'Retraso de aduana',
  en_curso: 'En curso',
  nueva_muestra: 'Se solicita nueva muestra',
  fallido: 'Fallido',
  entregado: 'Entregado'
};

const params = new URLSearchParams(window.location.search);
const role = document.body.dataset.role || 'publico';

const ROLE_META = {
  publico: { title: 'Consulta general', subtitle: 'Vista simplificada para consulta general.' },
  medico: { title: 'Consulta médica', subtitle: 'Vista médico con mayor detalle del seguimiento.' },
  kam: { title: 'Consulta KAM', subtitle: 'Vista operativa y comercial de solo lectura para seguimiento interno.' }
};

const els = {
  searchInput: document.getElementById('searchCode'),
  searchBtn: document.getElementById('searchBtn'),
  result: document.getElementById('result'),
  currentCode: document.getElementById('currentCode')
};

function escapeHtml(text){
  return (text || '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function formatDate(dateString){
  if (!dateString) return 'Sin fecha';
  const date = new Date(dateString + 'T00:00:00');
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
}

function statusLabel(value){
  return STATUS_LABELS[value] || 'Pendiente';
}

function currentStageIndex(stages = []){
  const doneCount = stages.filter(s => s.status && s.status !== 'cancelada').length;
  return Math.min(doneCount, Math.max(stages.length - 1, 0));
}

function stageState(stage, currentIndex, index){
  if (stage.status === 'cancelada') return 'cancelled';
  if (stage.status) return 'done';
  return index === currentIndex ? 'current' : 'pending';
}

function normalizedCode(record){
  return (record.publicCode || record.caseId || record.orderNumber || '').toString().trim();
}

async function fetchAllRecords(){
  const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function findRecord(records, term){
  const normalized = term.trim().toLowerCase();
  return records.find(record => {
    const haystack = [record.publicCode, record.caseId, record.orderNumber, record.patientName]
      .filter(Boolean)
      .join(' | ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

function renderTimeline(stages = []){
  const currentIndex = currentStageIndex(stages);
  const completedCount = stages.filter(s => s.status && s.status !== 'cancelada').length;
  const fill = stages.length > 1 ? ((Math.max(completedCount - 1, 0)) / (stages.length - 1)) * 100 : 0;
  return `
    <div class="timeline-shell">
      <div class="timeline-mobile-note">En celular puedes tocar cada paso para acercarlo y ver el avance.</div>
      <div class="flow-track viewer-track interactive-track" style="--steps:${stages.length}; --fill:${fill}%" data-current-index="${currentIndex}">
        ${stages.map((stage, index) => `
          <article class="flow-step ${stageState(stage, currentIndex, index)} ${index === currentIndex ? 'is-focus' : ''}" data-step-index="${index}" tabindex="0">
            <div class="flow-step-icon-wrap"><span class="flow-step-icon">${STAGE_ICONS[stage.id] || '•'}</span></div>
            <span class="flow-step-index">Paso ${index + 1}</span>
            <h4 class="flow-step-title">${escapeHtml(stage.title || '')}</h4>
            <p class="flow-step-sub">${escapeHtml(stage.desc || '')}</p>
            <span class="flow-step-status-label">${escapeHtml(statusLabel(stage.status))}</span>
            <span class="flow-dot"></span>
          </article>
        `).join('')}
        <div class="flow-line"><div class="flow-line-fill" style="width:${fill}%"></div></div>
      </div>
    </div>`;
}

function renderPublic(record){
  els.result.innerHTML = `
    <div class="viewer-summary-card">
      <div>
        <p class="viewer-label">Código de seguimiento</p>
        <strong>${escapeHtml(normalizedCode(record) || 'Sin código')}</strong>
      </div>
      <div>
        <p class="viewer-label">Paciente</p>
        <strong>${escapeHtml(record.patientName || '—')}</strong>
      </div>
      <div>
        <p class="viewer-label">Tipo de muestra</p>
        <strong>${escapeHtml(FLOW_BY_SAMPLE[record.sampleType]?.label || record.sampleType || '—')}</strong>
      </div>
      <div>
        <p class="viewer-label">Prueba</p>
        <strong>${escapeHtml(record.testType || '—')}</strong>
      </div>
    </div>
    <section class="panel viewer-panel">
      <div class="section-head"><div><h2>Estatus del seguimiento</h2><p>Vista simplificada para consulta general.</p></div></div>
      ${renderTimeline(record.stages || [])}
    </section>`;
}

function renderMedico(record){
  els.result.innerHTML = `
    <div class="viewer-summary-card medico-grid">
      <div><p class="viewer-label">Código / folio</p><strong>${escapeHtml(normalizedCode(record) || 'Sin código')}</strong></div>
      <div><p class="viewer-label">Paciente</p><strong>${escapeHtml(record.patientName || '—')}</strong></div>
      <div><p class="viewer-label">Médico solicitante</p><strong>${escapeHtml(record.requestingDoctor || '—')}</strong></div>
      <div><p class="viewer-label">Implanta / KAM / Cuenta</p><strong>${escapeHtml(record.doctor || '—')}</strong></div>
      <div><p class="viewer-label">Fecha estimada</p><strong>${record.eta ? formatDate(record.eta) : '—'}</strong></div>
      <div><p class="viewer-label">Tipo de pago</p><strong>${escapeHtml(record.paymentType || '—')}</strong></div>
      <div><p class="viewer-label">Tipo de muestra</p><strong>${escapeHtml(FLOW_BY_SAMPLE[record.sampleType]?.label || record.sampleType || '—')}</strong></div>
      <div><p class="viewer-label">Prueba</p><strong>${escapeHtml(record.testType || '—')}</strong></div>
    </div>
    <section class="panel viewer-panel">
      <div class="section-head"><div><h2>Avance del caso</h2><p>Vista médico con mayor detalle del seguimiento.</p></div></div>
      ${renderTimeline(record.stages || [])}
    </section>`;
}


function renderKam(record){
  const stageHistory = (record.stages || []).map(stage => `
    <article class="med-stage-card">
      <div class="med-stage-top">
        <strong>${escapeHtml(stage.title || '')}</strong>
        <span class="tag soft-tag">${escapeHtml(statusLabel(stage.status))}</span>
      </div>
      <p class="med-stage-meta">${stage.date ? `Fecha: ${formatDate(stage.date)}` : 'Sin fecha'}${stage.owner ? ` · Responsable: ${escapeHtml(stage.owner)}` : ''}</p>
      ${stage.comment ? `<div class="history-comment">${escapeHtml(stage.comment)}</div>` : '<div class="history-comment muted">Sin comentario registrado.</div>'}
    </article>
  `).join('');

  const dates = Array.isArray(record.dynamicDates) ? record.dynamicDates.filter(Boolean) : [];
  const dynamicDatesHtml = dates.length
    ? dates.map(item => `<div><p class="viewer-label">${escapeHtml(item.label || 'Fecha')}</p><strong>${item.value ? formatDate(item.value) : '—'}</strong></div>`).join('')
    : '<div><p class="viewer-label">Fechas de muestra</p><strong>—</strong></div>';

  const biomarkerText = Array.isArray(record.biomarkers) && record.biomarkers.length ? record.biomarkers.join(' · ') : '—';
  const algorithmText = Array.isArray(record.algorithms) && record.algorithms.length ? record.algorithms.join(' · ') : '—';

  els.result.innerHTML = `
    <div class="viewer-summary-card medico-grid">
      <div><p class="viewer-label">Código / folio</p><strong>${escapeHtml(normalizedCode(record) || 'Sin código')}</strong></div>
      <div><p class="viewer-label">Número de orden</p><strong>${escapeHtml(record.orderNumber || '—')}</strong></div>
      <div><p class="viewer-label">Paciente</p><strong>${escapeHtml(record.patientName || '—')}</strong></div>
      <div><p class="viewer-label">Médico solicitante</p><strong>${escapeHtml(record.requestingDoctor || '—')}</strong></div>
      <div><p class="viewer-label">Implanta / KAM / Cuenta</p><strong>${escapeHtml(record.doctor || '—')}</strong></div>
      <div><p class="viewer-label">Responsable de edición</p><strong>${escapeHtml(record.editorName || '—')}</strong></div>
      <div><p class="viewer-label">Fecha estimada</p><strong>${record.eta ? formatDate(record.eta) : '—'}</strong></div>
      <div><p class="viewer-label">Tipo de pago</p><strong>${escapeHtml(record.paymentType || '—')}</strong></div>
      <div><p class="viewer-label">Tipo de muestra</p><strong>${escapeHtml(FLOW_BY_SAMPLE[record.sampleType]?.label || record.sampleType || '—')}</strong></div>
      <div><p class="viewer-label">Prueba</p><strong>${escapeHtml(record.testType || '—')}</strong></div>
      <div><p class="viewer-label">Biomarcador</p><strong>${escapeHtml(biomarkerText)}</strong></div>
      <div><p class="viewer-label">Algoritmo</p><strong>${escapeHtml(algorithmText)}</strong></div>
      ${dynamicDatesHtml}
    </div>
    <section class="panel viewer-panel">
      <div class="section-head"><div><h2>Avance del caso</h2><p>${ROLE_META.kam.subtitle}</p></div></div>
      ${renderTimeline(record.stages || [])}
    </section>
    <section class="panel viewer-panel">
      <div class="section-head"><div><h2>Detalle por etapa</h2><p>Consulta de solo lectura para KAM.</p></div></div>
      <div class="med-stage-list">${stageHistory}</div>
    </section>`;
}


function centerTimelineStep(track, index){
  if (!track) return;
  const steps = Array.from(track.querySelectorAll('.flow-step'));
  const target = steps[index];
  if (!target) return;
  steps.forEach((step, i) => step.classList.toggle('is-focus', i === index));
  if (window.innerWidth <= 768) {
    const left = target.offsetLeft - ((track.clientWidth - target.clientWidth) / 2);
    track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }
}

function initInteractiveTimelines(){
  const tracks = Array.from(document.querySelectorAll('.interactive-track'));
  tracks.forEach(track => {
    const current = Number(track.dataset.currentIndex || 0);
    const steps = Array.from(track.querySelectorAll('.flow-step'));
    steps.forEach((step, index) => {
      const activate = () => centerTimelineStep(track, index);
      step.addEventListener('click', activate);
      step.addEventListener('focus', activate);
      step.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
    });
    requestAnimationFrame(() => centerTimelineStep(track, current));
  });
}

async function searchAndRender(term){
  const searchTerm = term.trim();
  if (!searchTerm){
    els.result.innerHTML = '<div class="empty-message">Escribe número de orden, folio o código de seguimiento.</div>';
    return;
  }
  els.result.innerHTML = '<div class="empty-message">Buscando seguimiento...</div>';
  try {
    const records = await fetchAllRecords();
    const record = findRecord(records, searchTerm);
    if (!record){
      els.result.innerHTML = '<div class="empty-message">No encontramos un seguimiento con ese dato.</div>';
      return;
    }
    els.currentCode.textContent = normalizedCode(record) || 'Sin código';
    if (role === 'medico') renderMedico(record);
    else if (role === 'kam') renderKam(record);
    else renderPublic(record);
    initInteractiveTimelines();
  } catch (error) {
    console.error(error);
    els.result.innerHTML = '<div class="empty-message">No se pudo consultar Firebase. Revisa reglas y conexión.</div>';
  }
}

els.searchBtn?.addEventListener('click', () => searchAndRender(els.searchInput.value));
els.searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchAndRender(els.searchInput.value);
  }
});

const initialCode = params.get('code') || params.get('folio') || '';
if (initialCode) {
  els.searchInput.value = initialCode;
  searchAndRender(initialCode);
}
