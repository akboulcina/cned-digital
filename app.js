import { alertInstances, conversations, demoAccounts, documents, portfolioValues, projects } from './data/demo.js';

const app = document.querySelector('#app');
const saved = (key, fallback, storage = localStorage) => {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Invalid local prototype state in ${key}; resetting this value.`, error);
    storage.removeItem(key);
    return fallback;
  }
};

let reference;
try {
  const referenceResponse = await fetch('./data/reference.json');
  if (!referenceResponse.ok) throw new Error(`Impossible de charger le référentiel KPI (${referenceResponse.status}).`);
  reference = await referenceResponse.json();
} catch (error) {
  console.error(error);
  app.innerHTML = `<main class="container py-5"><div class="card"><div class="card-body"><h4>Chargement impossible</h4><p class="text-muted">Le référentiel local n’a pas pu être chargé. Ouvrez l’application avec un serveur web local, puis rechargez la page.</p><pre class="small text-danger">${String(error.message).replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char])}</pre></div></div></main>`;
}
if (!reference) throw new Error('Référentiel non chargé; le prototype ne peut pas démarrer.');

const state = {
  user: saved('cned-demo-user', null) || saved('cned-demo-session', null, sessionStorage),
  lang: saved('cned-language', 'fr'),
  page: 'dashboard',
  projectId: null,
  projectTab: 'overview',
  alertTab: 'instances',
  kpiFilters: saved('cned-kpi-filters', {}),
  alertFilters: saved('cned-alert-filters', {}),
  documentFilters: saved('cned-document-filters', {}),
  mapFilters: saved('cned-map-filters', {}),
  projectStatus: saved('cned-project-status', ''),
  projectSort: saved('cned-project-sort', 'name'),
  reportPeriod: saved('cned-report-period', '12 derniers mois'),
  selectedMapProject: null,
  mapView: 'map',
  selectedConversation: 'project-001',
  tablePages: {},
  alertChanges: saved('cned-alert-changes', {}),
  localDocuments: saved('cned-local-documents', []),
  fieldReports: saved('cned-field-reports', []),
  messages: saved('cned-messages', {}),
  notificationsRead: saved('cned-notifications-read', []),
  globalSearch: '',
  pendingMessageAttachment: '',
  photoPreviewUrl: '',
  chatAttachmentPreviewUrl: '',
  toastTimer: null
};

const roles = {
  direction: {
    name: 'Direction CNED',
    workspace: 'I7 · Pilotage CNED',
    nav: ['dashboard', 'portfolio', 'kpis', 'alerts', 'map', 'reports', 'notifications'],
    intro: 'Vision nationale, arbitrages et décisions stratégiques.',
    projectAction: 'Consultation seule'
  },
  pmo: {
    name: 'CNED / PMO',
    workspace: 'I7 · Pilotage CNED',
    nav: ['dashboard', 'portfolio', 'kpis', 'alerts', 'finance', 'planning', 'map', 'documents', 'messages', 'reports', 'notifications'],
    intro: 'Analyse du portefeuille, fiabilité des données et coordination des actions.',
    projectAction: 'Pilotage analytique'
  },
  mo: {
    name: 'Maître d’ouvrage',
    workspace: 'I2 · MO local',
    nav: ['dashboard', 'portfolio', 'technical', 'finance', 'planning', 'field', 'kpis', 'alerts', 'documents', 'messages', 'reports', 'notifications'],
    intro: 'Suivi opérationnel limité aux projets de votre maîtrise d’ouvrage.',
    projectAction: 'Saisie opérationnelle'
  },
  bet: {
    name: 'BET / Contrôle',
    workspace: 'I4 · BET / CTC',
    nav: ['dashboard', 'portfolio', 'technical', 'planning', 'field', 'kpis', 'alerts', 'documents', 'messages', 'reports'],
    intro: 'Contrôle technique, qualité, non-conformités et réceptions.',
    projectAction: 'Suivi technique'
  },
  contractor: {
    name: 'Contractant',
    workspace: 'I1 · Terrain',
    nav: ['dashboard', 'portfolio', 'technical', 'planning', 'field', 'kpis', 'alerts', 'documents', 'messages', 'notifications'],
    intro: 'Activité de vos contrats uniquement — aucune donnée de concurrents.',
    projectAction: 'Déclaration terrain'
  },
  finance: {
    name: 'Contrôle budgétaire',
    workspace: 'I3 · Financier',
    nav: ['dashboard', 'portfolio', 'finance', 'kpis', 'alerts', 'documents', 'reports', 'notifications'],
    intro: 'Suivi AE, CP et paiements dans le périmètre budgétaire attribué.',
    projectAction: 'Suivi financier'
  }
};

const roleKeyFor = (user) => {
  if (!user) return null;
  return ({ national: user.username === 'direction' ? 'direction' : 'pmo', mo: 'mo', bet: 'bet', contractor: 'contractor', finance: 'finance' })[user.scope] || 'pmo';
};

const pageMeta = {
  dashboard: ['Tableau de bord', 'bx-grid-alt'],
  portfolio: ['Portefeuille des projets', 'bx-briefcase-alt-2'],
  technical: ['Suivi technique', 'bx-hard-hat'],
  finance: ['Suivi financier', 'bx-wallet'],
  planning: ['Planning & jalons', 'bx-calendar'],
  field: ['Terrain & rapports', 'bx-map-pin'],
  kpis: ['KPI & performance', 'bx-bar-chart-alt-2'],
  alerts: ['Risques & alertes', 'bx-bell'],
  map: ['Carte nationale', 'bx-map'],
  documents: ['Documents', 'bx-folder-open'],
  messages: ['Communication', 'bx-message-rounded-dots'],
  reports: ['Rapports & analyses', 'bx-file'],
  notifications: ['Notifications', 'bx-notification']
};

const translations = {
  fr: {},
  ar: {
    'Tableau de bord': 'لوحة القيادة',
    'Portefeuille des projets': 'محفظة المشاريع',
    'Suivi technique': 'المتابعة التقنية',
    'Suivi financier': 'المتابعة المالية',
    'Planning & jalons': 'التخطيط والمراحل',
    'Terrain & rapports': 'الميدان والتقارير',
    'KPI & performance': 'مؤشرات الأداء',
    'Risques & alertes': 'المخاطر والتنبيهات',
    'Carte nationale': 'الخريطة الوطنية',
    Documents: 'الوثائق',
    Communication: 'التواصل',
    'Rapports & analyses': 'التقارير والتحليلات',
    Notifications: 'الإشعارات',
    'Déconnexion': 'تسجيل الخروج',
    'KPI & performance': 'مؤشرات الأداء',
    'Risques & alertes': 'المخاطر والتنبيهات',
    'Suivi financier': 'المتابعة المالية',
    'Documents': 'الوثائق',
    'Démo locale · données illustratives': 'نسخة تجريبية · بيانات توضيحية',
    'Bonjour': 'مرحباً',
    'Rechercher un projet, KPI…': 'البحث عن مشروع أو مؤشر…',
    'Accès à votre espace': 'الدخول إلى مساحتك',
    'Se connecter': 'تسجيل الدخول',
    'Mot de passe oublié ?': 'هل نسيت كلمة المرور؟',
    'Mes projets': 'مشاريعي',
    'Projets visibles': 'المشاريع المتاحة',
    'Centre des alertes': 'مركز التنبيهات',
    'Catalogue des indicateurs': 'دليل المؤشرات',
    'Aucune alerte active dans votre périmètre.': 'لا توجد تنبيهات نشطة ضمن نطاقك.',
    Portefeuille: 'المحفظة',
    'Nouvelle alerte': 'تنبيه جديد'
  }
};

const t = (text) => translations[state.lang]?.[text] || text;
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const numeric = (value) => Number.parseFloat(String(value ?? '').replace(',', '.'));
const role = () => roles[roleKeyFor(state.user)];
const matrixRole = () => state.user?.role;
const rolePermission = (type, id) => reference.permissions[type]?.[id]?.[matrixRole()] || '';
const canViewFinancialData = () => visibleKPIs().some((item) => item.Famille?.startsWith('FI'));
const projectById = (id) => projects.find((project) => project.id === id);
const kpiById = (id) => reference.kpis.find((item) => item.KPI_ID === id);
const alertRule = (id) => reference.alerts.find((item) => item.Regle_ID === id);
const allScopedProjects = () => {
  if (!state.user) return [];
  if (state.user.scope === 'national') return projects;
  if (state.user.scope === 'contractor') return projects.filter((project) => project.contractor === state.user.contractor);
  if (state.user.scope === 'bet') return projects.filter((project) => project.bet === state.user.organization);
  if (state.user.scope === 'mo') return projects.filter((project) => project.owner === state.user.organization);
  if (state.user.scope === 'finance') return projects.filter((project) => project.assigned.includes('finance'));
  return [];
};
const scopedProjectIds = () => new Set(allScopedProjects().map((project) => project.id));
const visibleKPIs = () => reference.kpis.filter((item) => rolePermission('kpis', item.KPI_ID));
const currentInstances = () => alertInstances.filter((instance) => {
  const permitted = rolePermission('alerts', instance.ruleId);
  return permitted && scopedProjectIds().has(instance.projectId);
});
const visibleAlertRules = () => reference.alerts.filter((item) => rolePermission('alerts', item.Regle_ID));
const visibleDocuments = () => [...documents, ...state.localDocuments].filter((document) => {
  if (!scopedProjectIds().has(document.projectId)) return false;
  if (document.access?.includes('financier') && !['direction', 'pmo', 'finance', 'mo'].includes(roleKeyFor(state.user))) return false;
  if (document.access?.includes('juridique') && !['direction', 'pmo', 'mo'].includes(roleKeyFor(state.user))) return false;
  return true;
});

const valueFor = (item, project = null) => {
  if (project) return project.values?.[item.KPI_ID] ?? '—';
  if (state.user?.scope === 'national') return portfolioValues[item.KPI_ID] ?? '—';
  const values = allScopedProjects().map((entry) => entry.values?.[item.KPI_ID]).filter((value) => value !== undefined && value !== null);
  if (!values.length) return '—';
  if (item.KPI_ID === 'QR5') return Math.max(...values.map(Number));
  if (item.KPI_ID === 'QR6') return values.includes('Oui') ? 'Oui' : 'Non';
  if (item.KPI_ID === 'QR8') return values.reduce((total, value) => total + Number(value), 0);
  if (values.every((value) => typeof value === 'string')) return values[0];
  return values.reduce((total, value) => total + Number(value), 0) / values.length;
};

function statusFor(item, value, project = null) {
  if (value === '—' || value === null || value === undefined) return 'info';
  const sens = item.Sens || '';
  if (sens === 'Information' || sens === 'Règle spéciale') {
    if (item.KPI_ID === 'QR5') {
      const solutionValidated = project
        ? Boolean(project.values?.QR5Solution)
        : allScopedProjects().some((entry) => Number(entry.values?.QR5) > 0 && entry.values?.QR5Solution);
      return Number(value) === 0 ? 'green' : solutionValidated ? 'orange' : 'red';
    }
    if (item.KPI_ID === 'QR6') return value === 'Oui' ? 'red' : 'green';
    if (item.KPI_ID === 'QR8') return Number(value) > 0 ? 'red' : 'green';
    return 'info';
  }
  const actual = Number(value);
  const green = numeric(item.Seuil_Vert);
  const red = numeric(item.Seuil_Rouge);
  if (!Number.isFinite(actual) || !Number.isFinite(green) || !Number.isFinite(red)) return 'info';
  if (sens === 'Écart absolu') {
    if (Math.abs(actual) <= green) return 'green';
    return Math.abs(actual) > red ? 'red' : 'orange';
  }
  if (sens === 'Plus haut = mieux') {
    if (actual >= green) return 'green';
    return actual < red ? 'red' : 'orange';
  }
  if (actual <= green) return 'green';
  return actual > red ? 'red' : 'orange';
}

function formatValue(item, value) {
  if (value === 'Oui' || value === 'Non') return value;
  if (typeof value !== 'number' && !Number.isFinite(numeric(value))) return String(value);
  const n = Number(value);
  const digits = Math.abs(n) < 10 && !Number.isInteger(n) ? 2 : 0;
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n);
  if (item.Unité === '%') return `${formatted} %`;
  if (item.Unité === 'ratio') return formatted;
  if (item.Unité === 'pts') return `${formatted} pts`;
  if (item.Unité === 'j') return `${formatted} j`;
  if (item.Unité === 'mois') return `${formatted} mois`;
  if (item.Unité === 'nombre') return formatted;
  if (item.Unité === '0–100') return `${formatted} / 100`;
  return `${formatted} ${item.Unité || ''}`.trim();
}

const statusNames = { red: 'ROUGE', orange: 'ORANGE', green: 'VERT', info: 'INFORMATION' };
const statusClass = (status) => ({ red: 'status-red', orange: 'status-orange', green: 'status-green', info: 'status-info' })[status] || 'status-info';
const statusPill = (status, label = statusNames[status] || status) => `<span class="status-pill ${statusClass(status)}">${escapeHTML(t(label))}</span>`;
const alertCondition = (rule) => rule?.['Condition (lisible)'] || '—';
const importanceBadge = (value) => `<span class="priority-mark">${escapeHTML(value || '—')}</span>`;
const projectStatusClass = (status) => {
  if (status === 'À l’arrêt' || status === 'En retard') return 'red';
  if (status === 'À surveiller' || status === 'Données à vérifier') return 'orange';
  return 'green';
};
const projectStatus = (project) => statusPill(projectStatusClass(project.status), project.status);
const shortDate = (date) => new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar-DZ' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
const money = (value) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} Md DA`;
const sum = (items, getter) => items.reduce((total, item) => total + getter(item), 0);
const initials = (name = '') => name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();

function pageHeading(title, subtitle, actions = '') {
  return `<div class="page-heading"><div><h4>${escapeHTML(t(title))}</h4><p class="page-subtitle">${escapeHTML(subtitle)}</p></div><div class="d-flex flex-wrap gap-2">${actions}</div></div>`;
}

function demoBanner() {
  return `<div class="demo-banner"><i class="bx bx-info-circle"></i><span>${escapeHTML(t('Démo locale · données illustratives'))}. Les projets, valeurs et alertes sont fictifs et ne constituent pas une information officielle CNED.</span></div>`;
}

function metricCard(label, value, iconName, context = '', click = '') {
  if (click && !rolePermission('kpis', click)) return '';
  const target = click ? `data-kpi-id="${escapeHTML(click)}"` : '';
  const clickable = click ? ' is-clickable' : '';
  return `<div class="col-sm-6 col-xl-3"><div class="card metric-card${clickable}" ${target}><div class="card-body"><div class="d-flex align-items-center justify-content-between"><span class="metric-icon"><i class="bx ${iconName}"></i></span>${context ? `<span class="metric-context">${escapeHTML(context)}</span>` : ''}</div><span class="metric-label">${escapeHTML(t(label))}</span><div class="metric-value">${escapeHTML(value)}</div></div></div></div>`;
}

function lineChart(label, points, labels = ['Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.']) {
  const width = 620;
  const height = 190;
  const left = 32;
  const top = 14;
  const usableWidth = width - left - 12;
  const usableHeight = height - 35;
  const min = Math.min(...points) - 5;
  const max = Math.max(...points) + 5;
  const coords = points.map((point, index) => {
    const x = left + (usableWidth * index) / Math.max(points.length - 1, 1);
    const y = top + usableHeight - ((point - min) / Math.max(max - min, 1)) * usableHeight;
    return [x, y];
  });
  const path = coords.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${path} L ${coords.at(-1)[0].toFixed(1)} ${height - 24} L ${coords[0][0].toFixed(1)} ${height - 24} Z`;
  const grid = [0, 1, 2].map((row) => {
    const y = top + (usableHeight * row) / 2;
    return `<line class="chart-grid" x1="${left}" y1="${y}" x2="${width - 10}" y2="${y}"/>`;
  }).join('');
  const marks = coords.map(([x, y]) => `<circle class="chart-dot" cx="${x}" cy="${y}" r="4"/>`).join('');
  const labelsSvg = labels.map((item, index) => `<text class="chart-label" x="${coords[index]?.[0] || left}" y="${height - 5}" text-anchor="middle">${escapeHTML(item)}</text>`).join('');
  return `<div class="chart-wrap"><div class="d-flex align-items-center justify-content-between mb-2"><span class="small text-muted">${escapeHTML(label)}</span><span class="small text-muted">${points.length} périodes illustratives</span></div><svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(label)}">${grid}<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>${marks}${labelsSvg}</svg></div>`;
}

function horizontalBars(rows) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return rows.map((row) => `<div class="financial-bar"><span class="financial-bar-label">${escapeHTML(row.label)}</span><div class="financial-bar-track" role="progressbar" aria-valuenow="${row.value}" aria-valuemin="0" aria-valuemax="${max}"><span style="width:${Math.min(100, row.value / max * 100)}%"></span></div><span class="financial-bar-value">${escapeHTML(row.display)}</span></div>`).join('');
}

function latestAlertRows(limit = 4) {
  const current = currentInstances().filter((instance) => !['Résolue', 'Clôturée'].includes(state.alertChanges[instance.id]?.status || instance.status)).slice(0, limit);
  if (!current.length) return '<div class="empty-state"><i class="bx bx-check-circle"></i>Aucune alerte active dans votre périmètre.</div>';
  return current.map((instance) => {
    const rule = alertRule(instance.ruleId);
    const project = projectById(instance.projectId);
    return `<div class="alert-row clickable" data-alert-id="${escapeHTML(instance.id)}"><span class="alert-severity ${rule?.Niveau === 'ORANGE' ? 'orange' : ''}"></span><span class="alert-row-content"><strong>${escapeHTML(instance.ruleId)} · ${escapeHTML(rule?.Nom || '')}</strong><span>${escapeHTML(project?.shortName || '')} · ${escapeHTML(instance.values)}</span></span>${statusPill(rule?.Niveau === 'ROUGE' ? 'red' : 'orange', rule?.Niveau || '')}</div>`;
  }).join('');
}

function smallProjectRows(items, limit = 5) {
  const rows = items.slice(0, limit);
  if (!rows.length) return '<tr><td colspan="5"><div class="empty-state">Aucun projet dans votre périmètre.</div></td></tr>';
  return rows.map((project) => `<tr><td><button class="btn btn-link p-0 text-start table-project-name" data-project-id="${escapeHTML(project.id)}">${escapeHTML(project.name)}</button><span class="table-project-meta">${escapeHTML(project.id)} · ${escapeHTML(project.owner)}</span></td><td>${escapeHTML(project.wilaya)}</td><td><div class="d-flex align-items-center gap-2"><div class="progress-slim"><span style="width:${project.physical}%"></span></div>${project.physical} %</div></td><td>${canViewFinancialData() ? money(project.budgetRevised) : '—'}</td><td>${projectStatus(project)}</td></tr>`).join('');
}

function roleDashboard() {
  const scoped = allScopedProjects();
  const totalBudget = sum(scoped, (project) => project.budgetRevised);
  const delayed = scoped.filter((project) => ['En retard', 'À l’arrêt'].includes(project.status));
  const alertCount = currentInstances().filter((instance) => !['Résolue', 'Clôturée'].includes(state.alertChanges[instance.id]?.status || instance.status)).length;
  const pageHeader = pageHeading('Tableau de bord', `${role().intro} · ${shortDate('2026-11-13')}`, `<span class="role-chip"><i class="bx bx-shield-quarter"></i>${escapeHTML(role().workspace)}</span>`);
  let cards;
  let focus;
  let secondPanel;
  if (roleKeyFor(state.user) === 'direction') {
    const inProgress = scoped.filter((project) => project.status === 'En cours').length;
    const completed = scoped.filter((project) => project.status === 'Achevé').length;
    const physicalAverage = scoped.length ? Math.round(sum(scoped, (project) => project.physical) / scoped.length) : 0;
    const critical = scoped.filter((project) => project.status === 'À l’arrêt').length;
    cards = [
      metricCard('Projets au portefeuille', scoped.length, 'bx-buildings', 'National'),
      metricCard('AE actuelle portefeuille', money(totalBudget), 'bx-wallet', 'Md DA'),
      metricCard('Projets en cours', inProgress, 'bx-trending-up', 'National'),
      metricCard('Projets achevés', completed, 'bx-check-circle', 'National'),
      metricCard('Projets en retard / arrêt', delayed.length, 'bx-time-five', 'À arbitrer', 'DL3'),
      metricCard('Avancement physique moyen', `${physicalAverage} %`, 'bx-bar-chart-alt-2', 'National'),
      metricCard('Alertes ROUGE', currentInstances().filter((instance) => alertRule(instance.ruleId)?.Niveau === 'ROUGE').length, 'bx-error-circle', `${critical} sujets critiques`)
    ].join('');
    focus = `<div class="row g-4"><div class="col-xl-8"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><span>Repères stratégiques du portefeuille</span><button class="btn btn-sm btn-label-primary" data-nav="kpis">Catalogue KPI</button></div><div class="card-body"><div class="row g-3">${['AV2', 'FI4', 'DL3', 'CO6'].map((id) => kpiMetric(id)).join('')}</div>${lineChart('Avancement physique consolidé · portefeuille illustratif', [42, 45, 49, 52, 55, 58])}</div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><span>Arbitrages prioritaires</span><span class="badge bg-label-danger">${critical}</span></div><div class="card-body"><div class="access-note mb-3">Lecture nationale · consultation seule. Les alertes sont des signaux d’aide à la décision, sans déclenchement automatique d’actes administratifs.</div>${latestAlertRows(4)}<button class="btn btn-sm btn-outline-secondary w-100 mt-3" data-nav="alerts">Ouvrir les alertes visibles</button></div></div></div></div>`;
    secondPanel = `<div class="row g-4 mt-0"><div class="col-xl-8"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span>Projets nécessitant une attention institutionnelle</span><button class="btn btn-sm btn-link" data-nav="portfolio">Portefeuille national</button></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet / référence</th><th>Wilaya</th><th>Avancement physique</th><th>AE actuelle</th><th>État</th></tr></thead><tbody>${smallProjectRows([...scoped].sort((a, b) => b.alertCount - a.alertCount), 5)}</tbody></table></div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header">Répartition nationale · aperçu</div><div class="card-body"><div class="map-mini">${nationalMap(scoped, true)}</div><div class="d-flex justify-content-between mt-2"><span class="small text-muted">${scoped.length} projets · ${new Set(scoped.map((project) => project.wilaya)).size} wilayas</span><button class="btn btn-sm btn-link" data-nav="map">Carte détaillée</button></div></div></div></div></div>`;
  } else if (roleKeyFor(state.user) === 'pmo') {
    const red = currentInstances().filter((instance) => alertRule(instance.ruleId)?.Niveau === 'ROUGE').length;
    cards = [
      metricCard('Projets suivis', scoped.length, 'bx-buildings', 'National'),
      metricCard('AE actuelle', money(totalBudget), 'bx-wallet', 'Périmètre suivi'),
      metricCard('Alertes à traiter', alertCount, 'bx-bell', `${red} critiques`),
      metricCard('Données à vérifier', `${formatValue(kpiById('DO2'), portfolioValues.DO2)}`, 'bx-data', 'Complétude', 'DO2')
    ].join('');
    focus = `<div class="row g-4"><div class="col-xl-8"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span>Performance & qualité des données</span><span class="badge bg-label-info">DO1 · DO2 · DO3</span></div><div class="card-body"><div class="row g-3">${['DO1', 'DO2', 'DO3', 'AV2'].map((id) => kpiMetric(id)).join('')}</div>${lineChart('Avancement consolidé · évolution illustrative', [43, 46, 48, 51, 56, 58])}</div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><span>Alertes actives</span><span class="badge bg-label-danger">${alertCount}</span></div><div class="card-body">${latestAlertRows(5)}<button class="btn btn-sm btn-outline-secondary w-100 mt-3" data-nav="alerts">Centre de traitement</button></div></div></div></div>`;
    secondPanel = `<div class="row g-4 mt-0"><div class="col-xl-8"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span>Portefeuille national</span><button class="btn btn-sm btn-link" data-nav="portfolio">Tout voir</button></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet / référence</th><th>Wilaya</th><th>Avancement</th><th>AE actuelle</th><th>État</th></tr></thead><tbody>${smallProjectRows(scoped, 5)}</tbody></table></div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header">Qualité de la donnée</div><div class="card-body">${horizontalBars([{ label: 'Fraîcheur DO1', value: 76, display: '1,4×' }, { label: 'Complétude DO2', value: 82, display: '82 %' }, { label: 'Cohérence DO3', value: 86, display: '14 %' }])}<div class="access-note mt-3">Les alertes dont la donnée est insuffisante restent à vérifier avant diffusion.</div></div></div></div></div>`;
  } else if (roleKeyFor(state.user) === 'mo') {
    cards = [
      metricCard('Mes projets', scoped.length, 'bx-buildings', state.user.organization),
      metricCard('Avancement physique moyen', `${Math.round(sum(scoped, (project) => project.physical) / Math.max(scoped.length, 1))} %`, 'bx-trending-up', 'Projets attribués', 'AV1'),
      metricCard('Échéances à surveiller', scoped.filter((project) => new Date(project.forecast) > new Date(project.end)).length, 'bx-calendar-exclamation', 'Délai contractuel'),
      metricCard('Actions & alertes', alertCount, 'bx-bell', 'Dans mon périmètre')
    ].join('');
    focus = `<div class="row g-4"><div class="col-xl-8"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span>Mes projets · suivi opérationnel</span><button class="btn btn-sm btn-primary" data-nav="field"><i class="bx bx-plus me-1"></i>Nouvelle situation terrain</button></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet / référence</th><th>Wilaya</th><th>Avancement</th><th>Échéance</th><th>État</th></tr></thead><tbody>${smallProjectRows(scoped, 6)}</tbody></table></div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header">Points de coordination</div><div class="card-body">${latestAlertRows(5)}<button class="btn btn-sm btn-outline-secondary w-100 mt-3" data-nav="alerts">Répondre aux alertes</button></div></div></div></div>`;
    secondPanel = `<div class="row g-4 mt-0"><div class="col-xl-6"><div class="card"><div class="card-header">Indicateurs de mes projets</div><div class="card-body"><div class="row g-3">${['AV1', 'DL1', 'QR1', 'GV1'].map((id) => kpiMetric(id)).join('')}</div></div></div></div><div class="col-xl-6"><div class="card"><div class="card-header">Actions à suivre</div><div class="card-body">${taskList(scoped)}</div></div></div></div>`;
  } else if (roleKeyFor(state.user) === 'bet') {
    cards = [
      metricCard('Projets contrôlés', scoped.length, 'bx-buildings', 'Affectations BET'),
      metricCard('Observations ouvertes', scoped.reduce((total, project) => total + (project.id === 'PRJ-2025-004' ? 3 : 1), 0), 'bx-search-alt', 'Technique'),
      metricCard('Non-conformités critiques', scoped.some((project) => project.values.QR7 > 30) ? 1 : 0, 'bx-error', 'Action requise', 'QR7'),
      metricCard('Réceptions à préparer', 2, 'bx-check-square', 'Suivi technique')
    ].join('');
    focus = `<div class="row g-4"><div class="col-xl-8"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span>Suivi des projets contrôlés</span><button class="btn btn-sm btn-primary" data-nav="field"><i class="bx bx-plus me-1"></i>Rapport d’inspection</button></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet / marché</th><th>Wilaya</th><th>Avancement</th><th>Observation ouverte</th><th>État</th></tr></thead><tbody>${smallProjectRows(scoped, 6)}</tbody></table></div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header">Qualité & contrôle</div><div class="card-body"><div class="row g-3">${['QR7', 'QR6', 'QR8'].map((id) => kpiMetric(id)).join('')}</div>${latestAlertRows(3)}</div></div></div></div>`;
    secondPanel = `<div class="row g-4 mt-0"><div class="col-xl-6"><div class="card"><div class="card-header">Non-conformités & actions correctives</div><div class="card-body">${taskList(scoped, true)}</div></div></div><div class="col-xl-6"><div class="card"><div class="card-header">Planning de réception</div><div class="card-body">${lineChart('Réserves levées · suivi illustratif', [31, 39, 43, 58, 64, 71])}</div></div></div></div>`;
  } else if (roleKeyFor(state.user) === 'contractor') {
    const physical = Math.round(sum(scoped, (project) => project.physical) / Math.max(scoped.length, 1));
    const ownScore = scoped.length ? Math.round(sum(scoped, (project) => Number(project.values.CO1 || 65)) / scoped.length) : 0;
    cards = [
      metricCard('Mes contrats', scoped.length, 'bx-briefcase', 'Périmètre entreprise'),
      metricCard('Avancement déclaré', `${physical} %`, 'bx-trending-up', 'Chantiers affectés'),
      metricCard('Mobilisation effective', `${formatValue(kpiById('PP2'), scoped[0]?.values.PP2 ?? portfolioValues.PP2)}`, 'bx-hard-hat', 'PP2', 'PP2'),
      metricCard('Ma santé contractant', `${ownScore} / 100`, 'bx-check-shield', 'CO1 · mes marchés', 'CO1')
    ].join('');
    focus = `<div class="row g-4"><div class="col-xl-8"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span>Mes chantiers & livrables</span><button class="btn btn-sm btn-primary" data-nav="field"><i class="bx bx-upload me-1"></i>Déclarer l’avancement</button></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Contrat / projet</th><th>Wilaya</th><th>Avancement</th><th>Prochaine étape</th><th>État</th></tr></thead><tbody>${smallProjectRows(scoped, 6)}</tbody></table></div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header">Observations à traiter</div><div class="card-body">${latestAlertRows(4)}<button class="btn btn-sm btn-outline-secondary w-100 mt-3" data-nav="messages">Échanger avec l’équipe projet</button></div></div></div></div>`;
    secondPanel = `<div class="row g-4 mt-0"><div class="col-xl-6"><div class="card"><div class="card-header">Planning hebdomadaire</div><div class="card-body">${taskList(scoped)}<button class="btn btn-sm btn-outline-primary mt-2" data-nav="planning">Consulter les jalons</button></div></div></div><div class="col-xl-6"><div class="card"><div class="card-header">Vos indicateurs contractuels uniquement</div><div class="card-body"><div class="access-note mb-3">Les scores et données d’autres entreprises ne sont pas accessibles.</div><div class="row g-3">${['CO1', 'PP1', 'PP2', 'FI6'].map((id) => kpiMetric(id)).join('')}</div></div></div></div></div>`;
  } else {
    const initial = sum(scoped, (project) => project.budgetInitial);
    const revised = sum(scoped, (project) => project.budgetRevised);
    cards = [
      metricCard('Projets du périmètre financier', scoped.length, 'bx-buildings', 'Accès budgétaire attribué'),
      metricCard('AE initiale', money(initial), 'bx-wallet', 'Périmètre suivi'),
      metricCard('AE actuelle', money(revised), 'bx-transfer-alt', 'Révisée', 'FI4'),
      metricCard('Situations à surveiller', currentInstances().filter((instance) => ['AL03', 'AL08', 'AL11'].includes(instance.ruleId)).length, 'bx-time-five', 'Alertes financières')
    ].join('');
    focus = `<div class="row g-4"><div class="col-xl-8"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span>Exécution budgétaire · périmètre attribué</span><button class="btn btn-sm btn-link" data-nav="finance">Détail financier</button></div><div class="card-body">${horizontalBars([{ label: 'AE initiale', value: initial, display: money(initial) }, { label: 'AE actuelle', value: revised, display: money(revised) }, { label: 'Paiements exécutés', value: revised * 0.46, display: money(revised * 0.46) }, { label: 'Engagements', value: revised * 0.72, display: money(revised * 0.72) }])}${lineChart('Crédits de paiement & règlements · illustratif', [38, 42, 40, 48, 53, 61])}</div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header">Alertes financières</div><div class="card-body">${latestAlertRows(5)}<button class="btn btn-sm btn-outline-secondary w-100 mt-3" data-nav="alerts">Ouvrir les alertes financières</button></div></div></div></div>`;
    secondPanel = `<div class="row g-4 mt-0"><div class="col-xl-8"><div class="card"><div class="card-header">Projets du périmètre financier</div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet / référence</th><th>Wilaya</th><th>AE actuelle</th><th>Progression financière</th><th>État</th></tr></thead><tbody>${smallProjectRows(scoped, 5)}</tbody></table></div></div></div><div class="col-xl-4"><div class="card"><div class="card-header">Repères financiers</div><div class="card-body"><div class="row g-3">${['FI1', 'FI3', 'FI4', 'FI5'].map((id) => kpiMetric(id)).join('')}</div></div></div></div></div>`;
  }
  return `${pageHeader}${demoBanner()}<div class="row g-4 mb-4">${cards}</div>${focus}${secondPanel}`;
}

function kpiMetric(id) {
  const item = kpiById(id);
  if (!item || !rolePermission('kpis', id)) return '';
  const value = valueFor(item);
  const status = statusFor(item, value);
  return `<div class="col-6"><button class="kpi-summary-card text-start w-100" data-kpi-id="${id}"><span class="d-flex align-items-center justify-content-between gap-2"><span class="kpi-id">${id}</span>${statusPill(status, statusNames[status])}</span><strong>${escapeHTML(formatValue(item, value))}</strong><span>${escapeHTML(item.Nom_KPI)}</span></button></div>`;
}

function taskList(scoped = allScopedProjects(), technical = false) {
  const tasks = technical
    ? [{ label: 'Lever la non-conformité critique · bibliothèque centrale', due: '14 nov.', status: 'À vérifier' }, { label: 'Valider les réservations techniques', due: '18 nov.', status: 'En cours' }, { label: 'Préparer la réception partielle', due: '25 nov.', status: 'Planifiée' }]
    : [{ label: `Confirmer le plan d’action · ${scoped[0]?.shortName || 'projet affecté'}`, due: '14 nov.', status: 'Prioritaire' }, { label: 'Mettre à jour le point de situation mensuel', due: '18 nov.', status: 'À compléter' }, { label: 'Préparer la revue de jalons', due: '24 nov.', status: 'Planifiée' }];
  return tasks.map((task) => `<div class="d-flex align-items-center justify-content-between gap-2 border-bottom py-2"><span class="small text-muted">${escapeHTML(task.label)}</span><span class="text-nowrap small">${escapeHTML(task.due)} <span class="badge bg-label-warning">${escapeHTML(task.status)}</span></span></div>`).join('');
}

function portfolioPage() {
  const items = allScopedProjects();
  const query = state.globalSearch.trim().toLowerCase();
  const filtered = items.filter((project) => (!query || [project.name, project.id, project.wilaya, project.sector].join(' ').toLowerCase().includes(query)) && (!state.projectStatus || project.status === state.projectStatus));
  const sortBy = ['name', 'wilaya', 'budget', 'progress', 'status'].includes(state.projectSort) ? state.projectSort : 'name';
  const sortGetters = {
    name: (project) => project.name,
    wilaya: (project) => project.wilaya,
    budget: (project) => project.budgetRevised,
    progress: (project) => project.physical,
    status: (project) => project.status
  };
  filtered.sort((a, b) => typeof sortGetters[sortBy](a) === 'number' ? sortGetters[sortBy](b) - sortGetters[sortBy](a) : sortGetters[sortBy](a).localeCompare(sortGetters[sortBy](b), 'fr'));
  const page = state.tablePages.portfolio || 1;
  const pageSize = 6;
  const subset = filtered.slice((page - 1) * pageSize, page * pageSize);
  const financeColumn = roleKeyFor(state.user) !== 'contractor' && visibleKPIs().some((kpi) => kpi.Famille?.startsWith('FI'));
  const title = roleKeyFor(state.user) === 'direction' || roleKeyFor(state.user) === 'pmo' ? 'Portefeuille des projets' : 'Mes projets';
  const rows = subset.map((project) => `<tr><td><button class="btn btn-link p-0 text-start table-project-name" data-project-id="${escapeHTML(project.id)}">${escapeHTML(project.name)}</button><span class="table-project-meta">${escapeHTML(project.id)} · ${escapeHTML(project.owner)}</span></td><td>${escapeHTML(project.sector)}</td><td>${escapeHTML(project.wilaya)}</td><td>${financeColumn ? money(project.budgetRevised) : '—'}</td><td><div class="d-flex align-items-center gap-2"><div class="progress-slim"><span style="width:${project.physical}%"></span></div>${project.physical} %</div></td><td>${shortDate(project.end)}</td><td>${projectStatus(project)}</td><td><button class="btn btn-sm btn-icon btn-text-secondary" aria-label="Ouvrir le projet" data-project-id="${escapeHTML(project.id)}"><i class="bx bx-chevron-right"></i></button></td></tr>`).join('');
  return `${pageHeading(title, role().intro, `<button class="btn btn-outline-secondary btn-sm" data-export="projects"><i class="bx bx-download me-1"></i>Exporter CSV</button>${roleKeyFor(state.user) !== 'direction' ? `<button class="btn btn-primary btn-sm" data-nav="field"><i class="bx bx-plus me-1"></i>Nouvelle saisie</button>` : ''}`)}${demoBanner()}<div class="card"><div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-3"><div><strong>Projets visibles</strong><span class="text-muted small ms-2">${filtered.length} résultat(s) · périmètre : ${escapeHTML(state.user.scope === 'national' ? 'national' : role().name)}</span></div><form class="toolbar" data-form="project-search"><input class="form-control form-control-sm" name="query" value="${escapeHTML(state.globalSearch)}" placeholder="Projet, référence, secteur…" aria-label="Rechercher dans les projets"><select class="form-select form-select-sm" name="status"><option value="">Tous les états</option>${['En cours', 'En retard', 'À l’arrêt', 'À surveiller', 'Données à vérifier'].map((status) => `<option ${state.projectStatus === status ? 'selected' : ''}>${status}</option>`).join('')}</select><select class="form-select form-select-sm" name="sort" aria-label="Trier les projets"><option value="name" ${sortBy === 'name' ? 'selected' : ''}>Trier · nom</option><option value="wilaya" ${sortBy === 'wilaya' ? 'selected' : ''}>Trier · wilaya</option><option value="budget" ${sortBy === 'budget' ? 'selected' : ''}>Trier · AE actuelle</option><option value="progress" ${sortBy === 'progress' ? 'selected' : ''}>Trier · avancement</option><option value="status" ${sortBy === 'status' ? 'selected' : ''}>Trier · état</option></select><button class="btn btn-sm btn-outline-primary">Filtrer</button></form></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet / référence</th><th>Secteur</th><th>Wilaya</th><th>AE actuelle</th><th>Avancement physique</th><th>Fin contractuelle</th><th>État</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="8"><div class="empty-state">Aucun projet ne correspond à la recherche.</div></td></tr>'}</tbody></table></div><div class="table-pagination"><span>${filtered.length ? `Affichage ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} sur ${filtered.length}` : 'Aucun résultat'}</span><div class="d-flex gap-2"><button class="btn btn-outline-secondary" data-page="portfolio" data-delta="-1" ${page <= 1 ? 'disabled' : ''}>Précédent</button><button class="btn btn-outline-secondary" data-page="portfolio" data-delta="1" ${page * pageSize >= filtered.length ? 'disabled' : ''}>Suivant</button></div></div></div>`;
}

function projectPage(project) {
  const tabNames = [
    ['overview', 'Vue d’ensemble'], ['technical', 'Technique'], ['finance', 'Financier'], ['planning', 'Planning & jalons'],
    ['contracts', 'Marchés & avenants'], ['resources', 'Ressources'], ['field', 'Terrain'], ['risks', 'Risques & blocages'],
    ['kpis', 'KPI'], ['alerts', 'Alertes'], ['documents', 'Documents'], ['discussion', 'Discussions'], ['location', 'Localisation'], ['history', 'Historique']
  ].filter(([id]) => id !== 'finance' || canViewFinancialData());
  const tab = state.projectTab;
  const tabBody = projectTabContent(project, tab);
  const editable = rolePermission('kpis', 'AV1') === 'R' || ['mo', 'bet', 'contractor'].includes(roleKeyFor(state.user));
  return `${pageHeading(project.name, `${project.id} · ${project.sector} · ${project.wilaya}`, `<button class="btn btn-outline-secondary btn-sm" data-nav="portfolio"><i class="bx bx-arrow-back me-1"></i>Retour aux projets</button>${editable ? '<button class="btn btn-primary btn-sm" data-nav="field"><i class="bx bx-edit-alt me-1"></i>Ajouter une mise à jour</button>' : ''}`)}${demoBanner()}<div class="card mb-4"><div class="card-body pb-3"><div class="row g-3 align-items-center"><div class="col-lg-5"><div class="d-flex align-items-center gap-3"><span class="shell-brand-icon"><i class="bx bx-buildings"></i></span><div><span class="text-muted small">${escapeHTML(project.id)}</span><h5 class="mb-1">${escapeHTML(project.shortName)}</h5><span class="text-muted small">${escapeHTML(project.owner)} · ${escapeHTML(project.contractor)}</span></div></div></div><div class="col-6 col-lg-2"><span class="text-muted small">Avancement physique</span><strong class="d-block mt-1">${project.physical} %</strong><div class="progress-slim mt-2 w-100"><span style="width:${project.physical}%"></span></div></div>${canViewFinancialData() ? `<div class="col-6 col-lg-2"><span class="text-muted small">AE actuelle</span><strong class="d-block mt-1">${money(project.budgetRevised)}</strong><span class="text-muted small">Initiale ${money(project.budgetInitial)}</span></div>` : ''}<div class="col-6 col-lg-2"><span class="text-muted small">Fin contractuelle</span><strong class="d-block mt-1">${shortDate(project.end)}</strong><span class="text-muted small">Prévision ${shortDate(project.forecast)}</span></div><div class="col-6 col-lg-1">${projectStatus(project)}</div></div></div><div class="project-tabs">${tabNames.map(([id, name]) => `<button class="project-tab ${tab === id ? 'active' : ''}" data-project-tab="${id}">${escapeHTML(name)}</button>`).join('')}</div><div class="card-body">${tabBody}</div></div>`;
}

function projectTabContent(project, tab) {
  const kpis = visibleKPIs();
  const projectAlerts = currentInstances().filter((instance) => instance.projectId === project.id);
  if (tab === 'overview' && !canViewFinancialData()) {
    const facts = [['Wilaya', project.wilaya], ['Secteur', project.sector], ['Dernière mise à jour', shortDate(project.updated)], ['État', project.status]];
    return `<div class="project-overview-grid"><div><div class="row g-3 mb-4">${metricCard('Avancement physique', `${project.physical} %`, 'bx-trending-up', 'Illustratif', 'AV1')}${metricCard('Échéance contractuelle', shortDate(project.end), 'bx-calendar', 'En vigueur', 'DL3')}${metricCard('Alertes visibles', projectAlerts.length, 'bx-bell', 'Périmètre projet')}</div><div class="card"><div class="card-header">Situation du projet</div><div class="card-body">${lineChart('Avancement physique · séries simulées', [24, 31, 36, 44, 51, project.physical])}<div class="row g-3 mt-2">${['Chef de projet', 'Maître d’ouvrage', 'Bureau de contrôle', 'Entreprise'].map((label, index) => `<div class="col-sm-6"><div class="project-fact"><span>${label}</span><strong>${escapeHTML([state.user.scope === 'national' ? 'Équipe projet' : 'Équipe locale', project.owner, project.bet, project.contractor][index])}</strong></div></div>`).join('')}</div></div></div></div><div><div class="card mb-3"><div class="card-header">Informations clés</div><div class="card-body">${facts.map(([label, value]) => `<div class="project-fact"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('')}</div></div><div class="card"><div class="card-header">Alertes dans le périmètre</div><div class="card-body">${projectAlerts.map((instance) => alertRow(instance)).join('') || '<div class="empty-state py-3">Aucune alerte visible.</div>'}</div></div></div></div>`;
  }
  if (tab === 'finance' && !canViewFinancialData()) return '<div class="access-note">Les données financières ne sont pas incluses dans votre périmètre.</div>';
  if (tab === 'contracts' && !canViewFinancialData()) {
    return `<div class="row g-4"><div class="col-lg-8"><div class="card"><div class="card-header">Marchés & avenants</div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Marché</th><th>Titulaire</th><th>Avenants</th><th>Dernier visa</th></tr></thead><tbody><tr><td class="primary-cell">Marché travaux · lot principal</td><td>${escapeHTML(project.contractor)}</td><td>${project.values.BU2 ?? 4}</td><td><span class="badge bg-label-warning">En suivi</span></td></tr><tr><td class="primary-cell">Contrôle technique</td><td>${escapeHTML(project.bet)}</td><td>1</td><td><span class="badge bg-label-success">Visé</span></td></tr></tbody></table></div></div></div><div class="col-lg-4"><div class="card"><div class="card-header">Avenants & délais</div><div class="card-body"><div class="row g-3">${['BU1', 'BU2', 'DL2', 'GV2'].filter((id) => rolePermission('kpis', id)).map((id) => kpiMetric(id)).join('')}</div></div></div></div></div>`;
  }
  if (tab === 'overview') return `<div class="project-overview-grid"><div><div class="row g-3 mb-4">${metricCard('Avancement physique', `${project.physical} %`, 'bx-trending-up', 'Illustratif', 'AV1')}${metricCard('Avancement financier', `${project.financial} %`, 'bx-wallet', 'Hors avances', 'FI1')}${metricCard('Échéance contractuelle', shortDate(project.end), 'bx-calendar', 'En vigueur', 'DL3')}${metricCard('Alertes visibles', projectAlerts.length, 'bx-bell', 'Périmètre projet')}</div><div class="card"><div class="card-header">Situation du projet</div><div class="card-body">${lineChart('Avancement physique · séries simulées', [24, 31, 36, 44, 51, project.physical])}<div class="row g-3 mt-2">${['Chef de projet', 'Maître d’ouvrage', 'Bureau de contrôle', 'Entreprise'].map((label, index) => `<div class="col-sm-6"><div class="project-fact"><span>${label}</span><strong>${escapeHTML([state.user.scope === 'national' ? 'Équipe projet' : 'Équipe locale', project.owner, project.bet, project.contractor][index])}</strong></div></div>`).join('')}</div></div></div></div><div><div class="card mb-3"><div class="card-header">Informations clés</div><div class="card-body">${[['Wilaya', project.wilaya], ['Secteur', project.sector], ['Budget initial', money(project.budgetInitial)], ['Budget révisé', money(project.budgetRevised)], ['Dernière mise à jour', shortDate(project.updated)], ['État', project.status]].map(([label, value]) => `<div class="project-fact"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('')}</div></div><div class="card"><div class="card-header">Alertes dans le périmètre</div><div class="card-body">${projectAlerts.map((instance) => alertRow(instance)).join('') || '<div class="empty-state py-3">Aucune alerte visible.</div>'}</div></div></div></div>`;
  if (tab === 'technical') return `<div class="row g-4"><div class="col-lg-8"><div class="card"><div class="card-header d-flex justify-content-between"><span>Suivi technique & observations</span>${roleKeyFor(state.user) === 'bet' || roleKeyFor(state.user) === 'mo' ? '<button class="btn btn-sm btn-primary" data-nav="field">Ajouter une observation</button>' : ''}</div><div class="card-body"><div class="row g-3">${['AV1', 'QR2', 'QR6', 'QR7'].filter((id) => rolePermission('kpis', id)).map((id) => kpiMetric(id)).join('')}</div>${taskList([project], true)}</div></div></div><div class="col-lg-4"><div class="card"><div class="card-header">Contrôle qualité</div><div class="card-body"><div class="project-fact"><span>Dernière visite</span><strong>10 nov. 2026 · équipe BET</strong></div><div class="project-fact"><span>Observations ouvertes</span><strong>${project.id === 'PRJ-2025-004' ? '3 observations · 1 critique' : '1 observation · 0 critique'}</strong></div><div class="project-fact"><span>Actions correctives</span><strong>Suivi par le responsable de lot</strong></div></div></div></div></div>`;
  if (tab === 'finance') return roleKeyFor(state.user) === 'contractor' ? `<div class="access-note">Les montants des autres contrats ne sont pas accessibles. Cet espace présente uniquement les éléments financiers liés à vos propres marchés.</div><div class="row g-3 mt-2">${['FI1', 'FI6', 'FI7'].filter((id) => rolePermission('kpis', id)).map((id) => kpiMetric(id)).join('')}</div>` : `<div class="row g-4"><div class="col-lg-8"><div class="card"><div class="card-header">Crédits et dépenses · données de démonstration</div><div class="card-body">${horizontalBars([{ label: 'AE initiale', value: project.budgetInitial, display: money(project.budgetInitial) }, { label: 'AE actuelle', value: project.budgetRevised, display: money(project.budgetRevised) }, { label: 'Engagements', value: project.budgetRevised * 0.72, display: money(project.budgetRevised * 0.72) }, { label: 'Paiements réalisés', value: project.budgetRevised * project.financial / 100, display: money(project.budgetRevised * project.financial / 100) }])}${lineChart('Progression physique et financière · série illustrative', [25, 32, 38, 42, 51, project.financial])}</div></div></div><div class="col-lg-4"><div class="card"><div class="card-header">Indicateurs financiers visibles</div><div class="card-body"><div class="row g-3">${['FI1', 'FI2', 'FI3', 'FI4', 'FI5', 'FI6', 'FI7', 'BU1'].filter((id) => rolePermission('kpis', id)).map((id) => kpiMetric(id)).join('')}</div></div></div></div></div>`;
  if (tab === 'planning') return planningRows([project]);
  if (tab === 'contracts') return `<div class="row g-4"><div class="col-lg-8"><div class="card"><div class="card-header">Marchés & avenants</div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Marché</th><th>Titulaire</th><th>Montant initial</th><th>Avenants</th><th>Dernier visa</th></tr></thead><tbody><tr><td class="primary-cell">Marché travaux · lot principal</td><td>${escapeHTML(project.contractor)}</td><td>${money(project.budgetInitial)}</td><td>${project.values.BU2 ?? 4}</td><td><span class="badge bg-label-warning">En suivi</span></td></tr><tr><td class="primary-cell">Contrôle technique</td><td>${escapeHTML(project.bet)}</td><td>${money(project.budgetInitial * 0.035)}</td><td>1</td><td><span class="badge bg-label-success">Visé</span></td></tr></tbody></table></div></div></div><div class="col-lg-4"><div class="card"><div class="card-header">Avenants & délais</div><div class="card-body"><div class="row g-3">${['BU1', 'BU2', 'DL2', 'GV2'].filter((id) => rolePermission('kpis', id)).map((id) => kpiMetric(id)).join('')}</div></div></div></div></div>`;
  if (tab === 'resources') return `<div class="row g-4"><div class="col-md-6"><div class="card"><div class="card-header">Moyens mobilisés</div><div class="card-body">${horizontalBars([{ label: 'Équipe terrain', value: 73, display: '73 %' }, { label: 'Équipements', value: 61, display: '61 %' }, { label: 'Matériaux disponibles', value: 88, display: '88 %' }])}<div class="access-note mt-3">Indicateurs illustratifs · aucune donnée de concurrent n’est affichée.</div></div></div></div><div class="col-md-6"><div class="card"><div class="card-header">Point hebdomadaire</div><div class="card-body"><div class="project-fact"><span>Semaine</span><strong>46 · 9–15 novembre 2026</strong></div><div class="project-fact"><span>Planifié</span><strong>12 tâches · 4 jalons</strong></div><div class="project-fact"><span>Exécuté</span><strong>${project.physical} % · point de situation fictif</strong></div></div></div></div></div>`;
  if (tab === 'field') return fieldForm([project], true);
  if (tab === 'risks') return `<div class="row g-4"><div class="col-lg-8"><div class="card"><div class="card-header">Blocages & risques institutionnels</div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Nature</th><th>Âge</th><th>Responsable</th><th>Échéance cible</th><th>Situation</th></tr></thead><tbody><tr><td class="primary-cell">Libération d’emprise · accès chantier</td><td>${project.values.QR3 ?? 42} j</td><td>${project.owner}</td><td>20 nov. 2026</td><td><span class="badge bg-label-warning">En cours</span></td></tr><tr><td class="primary-cell">Interférence réseau · déplacement</td><td>28 j</td><td>Gestionnaire de réseau</td><td>30 nov. 2026</td><td><span class="badge bg-label-info">À confirmer</span></td></tr></tbody></table></div></div></div><div class="col-lg-4"><div class="card"><div class="card-header">Indicateurs de blocage</div><div class="card-body"><div class="row g-3">${['QR1', 'QR2', 'QR3', 'QR4', 'GV1'].filter((id) => rolePermission('kpis', id)).map((id) => kpiMetric(id)).join('')}</div></div></div></div></div>`;
  if (tab === 'kpis') return `<div class="row g-3">${kpis.map((item) => projectKpiRow(item, project)).join('') || '<div class="empty-state">Aucun KPI visible pour ce rôle.</div>'}</div>`;
  if (tab === 'alerts') return `<div class="row g-3">${projectAlerts.map((instance) => alertRow(instance)).join('') || '<div class="empty-state">Aucune alerte visible sur ce projet.</div>'}</div>`;
  if (tab === 'documents') return `<div class="row g-3">${visibleDocuments().filter((document) => document.projectId === project.id).map(documentCard).join('') || '<div class="empty-state">Aucun document visible pour ce projet.</div>'}<button class="btn btn-outline-primary btn-sm" data-nav="documents">Ouvrir le dossier documentaire</button></div>`;
  if (tab === 'discussion') return `<div class="alert alert-secondary">La discussion de projet est conservée dans l’espace de communication et associée à ce projet.</div><button class="btn btn-primary btn-sm" data-nav="messages">Ouvrir la discussion projet</button>`;
  if (tab === 'location') return `<div class="row g-4"><div class="col-lg-8"><div class="algeria-map">${nationalMap([project], false, project.id)}</div></div><div class="col-lg-4"><div class="card"><div class="card-header">Localisation du projet</div><div class="card-body">${[['Wilaya', project.wilaya], ['Secteur', project.sector], ['Coordonnées', 'Localisation indicative · démonstration'], ['Mise à jour', shortDate(project.updated)]].map(([label, value]) => `<div class="project-fact"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('')}</div></div></div></div>`;
  return `<div class="card"><div class="card-header">Historique d’activité · données illustratives</div><div class="card-body">${[['11 nov. 2026', 'Actualisation du suivi mensuel', 'CNED / PMO'], ['08 nov. 2026', 'Rapport de visite déposé', project.owner], ['04 nov. 2026', 'Observation technique consignée', project.bet], ['30 oct. 2026', 'Réunion de coordination', 'Équipe projet']].map(([date, text, actor]) => `<div class="alert-row"><span class="alert-severity orange"></span><span class="alert-row-content"><strong>${escapeHTML(text)}</strong><span>${escapeHTML(date)} · ${escapeHTML(actor)}</span></span></div>`).join('')}</div></div>`;
}

function projectKpiRow(item, project) {
  const value = valueFor(item, project);
  const status = statusFor(item, value, project);
  const permission = rolePermission('kpis', item.KPI_ID);
  return `<div class="col-md-6 col-xl-4"><button class="card kpi-summary-card text-start w-100 h-100" data-kpi-id="${escapeHTML(item.KPI_ID)}"><div class="card-body"><div class="d-flex justify-content-between align-items-center"><span class="kpi-id">${escapeHTML(item.KPI_ID)}</span>${statusPill(status)}</div><strong class="d-block mt-3">${escapeHTML(formatValue(item, value))}</strong><span class="d-block small text-muted">${escapeHTML(item.Nom_KPI)}</span><span class="d-block mt-2 small text-muted">Droit : ${escapeHTML(permission)} · ${escapeHTML(item.Fréquence_cible || '')}</span></div></button></div>`;
}

function financePage() {
  const scoped = allScopedProjects();
  const initial = sum(scoped, (project) => project.budgetInitial);
  const revised = sum(scoped, (project) => project.budgetRevised);
  const committed = revised * 0.72;
  const paid = revised * 0.46;
  const pending = Math.max(0, committed - paid);
  const financeKpis = ['FI1', 'FI2', 'FI3', 'FI4', 'FI5', 'FI6', 'FI7', 'BU1', 'BU3'].filter((id) => rolePermission('kpis', id));
  const projectsRows = scoped.map((project) => `<tr><td><button class="btn btn-link p-0 text-start table-project-name" data-project-id="${escapeHTML(project.id)}">${escapeHTML(project.shortName)}</button><span class="table-project-meta">${escapeHTML(project.id)} · ${escapeHTML(project.wilaya)}</span></td><td>${money(project.budgetInitial)}</td><td>${money(project.budgetRevised)}</td><td>${money(project.budgetRevised * 0.72)}</td><td>${money(project.budgetRevised * project.financial / 100)}</td><td>${money(project.budgetRevised * 0.72 - project.budgetRevised * project.financial / 100)}</td><td>${project.financial} %</td><td>${projectStatus(project)}</td></tr>`).join('');
  return `${pageHeading('Suivi financier', `AE, crédits de paiement et situations · ${scoped.length} projet(s) dans le périmètre attribué`, `<button class="btn btn-outline-secondary btn-sm" data-export="projects"><i class="bx bx-download me-1"></i>Exporter</button>`)}${demoBanner()}<div class="row g-4 mb-4">${metricCard('AE initiale', money(initial), 'bx-wallet', 'Périmètre visible')}${metricCard('AE actuelle', money(revised), 'bx-transfer-alt', 'Après révisions', 'FI4')}${metricCard('Engagements', money(committed), 'bx-check-circle', '72 % · illustration')}${metricCard('Paiements exécutés', money(paid), 'bx-credit-card', '46 % · illustration', 'FI6')}</div><div class="row g-4 mb-4"><div class="col-xl-8"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><span>AE, engagements & paiements</span><span class="small text-muted">Données de démonstration · Md DA</span></div><div class="card-body">${horizontalBars([{ label: 'AE initiale', value: initial, display: money(initial) }, { label: 'AE actuelle', value: revised, display: money(revised) }, { label: 'Engagements', value: committed, display: money(committed) }, { label: 'Paiements effectués', value: paid, display: money(paid) }, { label: 'Encours estimé', value: pending, display: money(pending) }])}${lineChart('Évolution des paiements · séries illustratives', [20, 27, 35, 38, 48, 57])}</div></div></div><div class="col-xl-4"><div class="card h-100"><div class="card-header">Indicateurs financiers autorisés</div><div class="card-body"><div class="row g-3">${financeKpis.map((id) => kpiMetric(id)).join('') || '<div class="empty-state">Aucun KPI financier visible.</div>'}</div></div></div></div></div><div class="card mb-4"><div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2"><span>Situation financière par projet</span><span class="small text-muted">Paiements et soldes illustratifs · aucune connexion Trésor / Finances</span></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet / wilaya</th><th>AE initiale</th><th>AE actuelle</th><th>Engagements</th><th>Dépenses payées</th><th>Reste engagé</th><th>Progression financière</th><th>État</th></tr></thead><tbody>${projectsRows || '<tr><td colspan="8"><div class="empty-state">Aucun projet financier attribué.</div></td></tr>'}</tbody></table></div></div><div class="row g-4"><div class="col-lg-7"><div class="card"><div class="card-header">Situations & réévaluations en attente</div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Référence</th><th>Projet</th><th>Montant</th><th>Ancienneté</th><th>Statut</th></tr></thead><tbody>${scoped.slice(0, 4).map((project, index) => `<tr><td class="primary-cell">ST-${2026}-${String(18 + index).padStart(3, '0')}</td><td>${escapeHTML(project.shortName)}</td><td>${money(project.budgetRevised * 0.035)}</td><td>${[76, 34, 128, 52][index]} j</td><td><span class="badge ${index === 2 ? 'bg-label-danger' : 'bg-label-warning'}">${index === 2 ? 'À régulariser' : 'En instruction'}</span></td></tr>`).join('') || '<tr><td colspan="5" class="text-muted">Aucune situation dans le périmètre.</td></tr>'}</tbody></table></div></div></div><div class="col-lg-5"><div class="card"><div class="card-header">Cohérence physique – financière</div><div class="card-body">${scoped.slice(0, 4).map((project) => `<div class="financial-bar"><span class="financial-bar-label">${escapeHTML(project.shortName)}</span><div class="d-flex gap-1"><div class="financial-bar-track flex-fill"><span style="width:${project.physical}%"></span></div><div class="financial-bar-track flex-fill"><span style="width:${project.financial}%;background:#79a98f"></span></div></div><span class="financial-bar-value">${project.physical} / ${project.financial} %</span></div>`).join('')}<div class="d-flex gap-3 small text-muted mt-2"><span><i class="bx bx-square text-primary me-1"></i>Physique</span><span><i class="bx bx-square text-success me-1"></i>Financier</span></div></div></div></div></div>`;
}

function planningRows(items) {
  const monthNames = ['Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.', 'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai'];
  const rows = items.flatMap((project) => [
    { title: `${project.shortName} · études et visas`, start: 5, width: 23, cls: 'complete' },
    { title: `${project.shortName} · travaux principaux`, start: 2, width: 59, cls: project.status === 'En retard' || project.status === 'À l’arrêt' ? 'critical' : 'delayed' },
    { title: `${project.shortName} · essais & réception`, start: 8, width: 25, cls: 'complete' }
  ]);
  return `<div class="gantt-wrap"><div class="gantt"><div class="gantt-months"><strong>Projet / activité</strong>${monthNames.map((month) => `<span>${month}</span>`).join('')}</div>${rows.map((row) => `<div class="gantt-row"><span class="gantt-title">${escapeHTML(row.title)}</span><div class="gantt-track"><span class="gantt-bar ${row.cls}" style="left:${row.start / 12 * 100}%;width:${row.width / 12 * 100}%" title="${escapeHTML(row.title)}"></span></div></div>`).join('')}</div></div>`;
}

function planningPage() {
  const scoped = allScopedProjects();
  const delayed = scoped.filter((project) => new Date(project.forecast) > new Date(project.end));
  return `${pageHeading('Planning & jalons', `Dates contractuelles, prévisions et planification · ${scoped.length} projets visibles`, `<select class="form-select form-select-sm" data-planning-range aria-label="Période"><option>12 prochains mois</option><option>6 prochains mois</option><option>24 prochains mois</option></select>`)}${demoBanner()}<div class="row g-4 mb-4">${metricCard('Jalons suivis', scoped.length * 3, 'bx-flag', '12 prochains mois')}${metricCard('Projets en dérive', delayed.length, 'bx-time-five', 'Prévision après échéance')}${metricCard('Échéances contractuelles', scoped.filter((project) => project.end >= '2026-11-13').length, 'bx-calendar-check', 'En vigueur')}${metricCard('Actions hebdomadaires', scoped.length * 4, 'bx-list-check', 'Saisies illustratives')}</div><div class="card mb-4"><div class="card-header d-flex flex-wrap justify-content-between gap-2"><span>Calendrier prévisionnel · juin 2026 à mai 2027</span><span class="small text-muted">Les durées et dépendances sont illustratives</span></div><div class="card-body">${planningRows(scoped)}</div></div><div class="card"><div class="card-header">Jalons contractuels & points de contrôle</div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet</th><th>Jalon</th><th>Échéance contractuelle</th><th>Date prévisionnelle</th><th>Écart</th><th>Responsable</th><th>État</th></tr></thead><tbody>${scoped.map((project, index) => `<tr><td><button class="btn btn-link p-0 text-start" data-project-id="${escapeHTML(project.id)}">${escapeHTML(project.shortName)}</button></td><td>${['Achèvement gros œuvre', 'Libération emprise', 'Essais et mise en service'][index % 3]}</td><td>${shortDate(project.end)}</td><td>${shortDate(project.forecast)}</td><td>${new Date(project.forecast) > new Date(project.end) ? '<span class="text-warning">+ ' + (index + 2) + ' mois</span>' : '<span class="text-success">Dans le délai</span>'}</td><td>${escapeHTML(project.owner)}</td><td>${projectStatus(project)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function technicalPage() {
  const scoped = allScopedProjects();
  const betView = roleKeyFor(state.user) === 'bet';
  return `${pageHeading('Suivi technique', `${betView ? 'Projets et marchés surveillés par votre BET' : 'Avancement, qualité et mesures correctives dans votre périmètre'}`, `<button class="btn btn-primary btn-sm" data-nav="field"><i class="bx bx-plus me-1"></i>Nouvelle observation</button>`)}${demoBanner()}<div class="row g-4 mb-4">${metricCard('Projets suivis', scoped.length, 'bx-buildings', betView ? 'Affectations BET' : 'Projets accessibles')}${metricCard('Observations ouvertes', scoped.length + 2, 'bx-search-alt', 'Contrôle qualité')}${metricCard('Non-conformités critiques', scoped.some((project) => (project.values.QR7 || 0) > 30) ? 1 : 0, 'bx-error', 'Action à vérifier', 'QR7')}${metricCard('Réceptions à préparer', Math.max(1, scoped.length), 'bx-check-square', 'Réserves & essais', 'GV4')}</div><div class="row g-4"><div class="col-xl-8"><div class="card"><div class="card-header d-flex justify-content-between"><span>Projets & observations techniques</span><button class="btn btn-sm btn-outline-secondary" data-nav="portfolio">Voir les projets</button></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet / wilaya</th><th>Avancement</th><th>Observations ouvertes</th><th>NC la plus ancienne</th><th>Prochaine revue</th></tr></thead><tbody>${scoped.map((project, index) => `<tr><td><button class="btn btn-link p-0 text-start table-project-name" data-project-id="${escapeHTML(project.id)}">${escapeHTML(project.shortName)}</button><span class="table-project-meta">${escapeHTML(project.wilaya)} · ${escapeHTML(project.bet)}</span></td><td>${project.physical} %</td><td>${index + 1}</td><td>${project.values.QR7 || 0} j</td><td>${shortDate('2026-11-20')}</td></tr>`).join('')}</tbody></table></div></div></div><div class="col-xl-4"><div class="card mb-4"><div class="card-header">Indicateurs techniques autorisés</div><div class="card-body"><div class="row g-3">${['AV1', 'QR2', 'QR5', 'QR6', 'QR7', 'QR8', 'GV4'].filter((id) => rolePermission('kpis', id)).map((id) => kpiMetric(id)).join('') || '<div class="empty-state">Aucun KPI technique visible.</div>'}</div></div></div><div class="card"><div class="card-header">Alertes techniques visibles</div><div class="card-body">${latestAlertRows(4)}</div></div></div></div>`;
}

function fieldForm(scoped = allScopedProjects(), compact = false) {
  const selected = state.projectId && scoped.some((project) => project.id === state.projectId) ? state.projectId : scoped[0]?.id;
  const disabled = !scoped.length;
  return `<form class="field-mobile-frame" data-form="field-report"><div class="field-mobile-header"><div><strong class="small">Nouveau rapport terrain</strong><span class="d-block small text-muted">Saisie locale · données de démonstration</span></div><span class="offline-pill"><i class="bx bx-wifi-off"></i>Hors ligne · 2 en attente</span></div><div class="p-3"><div class="mb-3"><label class="form-label">Projet concerné</label><select class="form-select" name="projectId" required ${disabled ? 'disabled' : ''}>${scoped.map((project) => `<option value="${escapeHTML(project.id)}" ${project.id === selected ? 'selected' : ''}>${escapeHTML(project.shortName)} · ${escapeHTML(project.wilaya)}</option>`).join('')}</select></div><div class="row g-3"><div class="col-sm-6"><label class="form-label">Type de rapport</label><select class="form-select" name="type"><option>Visite de chantier</option><option>Avancement hebdomadaire</option><option>Observation technique</option><option>Blocage / emprise</option><option>Mobilisation des moyens</option></select></div><div class="col-sm-6"><label class="form-label">Avancement physique (%)</label><input class="form-control" type="number" min="0" max="100" name="progress" placeholder="ex. 62"></div></div><div class="mt-3"><label class="form-label">Observation / action à suivre</label><textarea class="form-control" name="note" rows="3" required placeholder="Décrire la situation observée et l’action proposée…"></textarea></div><div class="mt-3"><label class="form-label">Photographie ou justificatif</label><div class="d-flex align-items-center gap-3"><input class="form-control" type="file" name="photo" accept="image/*,.pdf" capture="environment"><span class="photo-preview" data-photo-preview><i class="bx bx-camera"></i></span></div><small class="form-text">Aperçu local uniquement · aucun fichier n’est transmis à un serveur.</small></div><div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-4"><span class="small text-muted"><i class="bx bx-map-pin me-1"></i>Position GPS non collectée</span><button class="btn btn-primary" type="submit" ${disabled ? 'disabled' : ''}><i class="bx bx-save me-1"></i>Enregistrer le rapport</button></div></div></form>`;
}

function fieldPage() {
  const scoped = allScopedProjects();
  const reports = state.fieldReports.filter((report) => scopedProjectIds().has(report.projectId));
  return `${pageHeading('Terrain & rapports', 'Interface mobile-first · visites, avancement, moyens et observations de chantier', `<span class="offline-pill"><i class="bx bx-wifi-off"></i>Mode hors ligne simulé</span>`)}${demoBanner()}<div class="row g-4"><div class="col-xl-7"><div class="field-mobile-frame"><div class="field-mobile-header"><div><strong>Activité de terrain</strong><span class="d-block small text-muted">${escapeHTML(state.user.organization)}</span></div><span class="offline-pill"><i class="bx bx-cloud-upload"></i>${reports.length + 2} en attente de synchro</span></div><div class="p-3"><div class="row g-3 mb-4">${metricCard('Projets affectés', scoped.length, 'bx-map-pin', 'Votre périmètre')}${metricCard('Rapports récents', reports.length + 4, 'bx-file', 'Dernière semaine')}${metricCard('Avancement hebdomadaire', '72 %', 'bx-trending-up', 'PP1', 'PP1')}${metricCard('Moyens mobilisés', '68 %', 'bx-hard-hat', 'PP2', 'PP2')}</div>${fieldForm(scoped)}</div></div></div><div class="col-xl-5"><div class="card mb-4"><div class="card-header d-flex justify-content-between"><span>Rapports récents</span><span class="badge bg-label-warning">${reports.length} en attente</span></div><div class="card-body">${reports.map((report) => `<div class="alert-row"><span class="alert-severity orange"></span><span class="alert-row-content"><strong>${escapeHTML(report.type)} · ${escapeHTML(projectById(report.projectId)?.shortName || '')}</strong><span>${escapeHTML(report.author)} · ${escapeHTML(report.date)} · ${escapeHTML(report.status)}</span><span>${escapeHTML(report.note)}${report.fileName ? ` · ${escapeHTML(report.fileName)}` : ''}</span></span></div>`).join('') || '<div class="empty-state py-3">Les rapports enregistrés apparaîtront ici.</div>'}</div></div><div class="card"><div class="card-header">Points de situation par projet</div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>Projet</th><th>Emprise</th><th>Réseaux</th><th>Statut chantier</th></tr></thead><tbody>${scoped.map((project) => `<tr><td><button class="btn btn-link p-0 text-start" data-project-id="${escapeHTML(project.id)}">${escapeHTML(project.shortName)}</button></td><td>${project.values.QR1 ?? '—'} %</td><td>${project.values.QR2 ?? '—'} %</td><td>${project.status === 'À l’arrêt' ? '<span class="badge bg-label-danger">Arrêt en cours</span>' : '<span class="badge bg-label-success">En activité</span>'}</td></tr>`).join('')}</tbody></table></div></div></div></div>`;
}

function nationalMap(items, mini = false, focusId = null) {
  const region = 'M153 103 218 75 277 83 331 99 368 88 417 111 456 107 493 132 523 164 555 193 568 232 589 262 579 302 600 336 583 371 600 400 574 433 542 441 517 463 488 474 460 491 425 489 398 503 361 490 334 509 299 493 271 477 238 476 216 451 187 433 197 401 177 376 190 343 174 313 190 281 180 250 198 220 189 185 170 153Z';
  const visible = items;
  const mapContent = `<defs><pattern id="map-grid" width="56" height="56" patternUnits="userSpaceOnUse"><path class="map-gridline" d="M56 0H0V56" fill="none"/></pattern></defs><rect width="700" height="560" fill="url(#map-grid)"/><path class="map-region" d="${region}"/><path d="M215 227c55-23 96-20 142-5M244 300c76-23 137-18 205 0M236 376c74-19 151-11 236 13" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 5" opacity=".8"/><text x="329" y="286" fill="#78918b" font-size="17" font-weight="600">ALGÉRIE</text><text x="340" y="309" fill="#91a49c" font-size="10">2 381 741 km²</text>${visible.map((project) => {
    const [xNorm, yNorm] = project.coordinates;
    const x = Math.round(193 + xNorm * 370);
    const y = Math.round(126 + yNorm * 342);
    const status = projectStatusClass(project.status);
    const focused = project.id === focusId ? 'r="11"' : 'r="8"';
    const label = mini ? '' : `<text x="${x + 12}" y="${y + 3}">${escapeHTML(project.wilaya)}</text>`;
    return `<g class="map-marker ${status}" data-map-project="${escapeHTML(project.id)}" tabindex="0" role="button" aria-label="${escapeHTML(project.shortName)} · ${escapeHTML(project.wilaya)}"><circle cx="${x}" cy="${y}" ${focused}/>${label}</g>`;
  }).join('')}`;
  return `<svg viewBox="0 0 700 560" role="img" aria-label="Carte schématique de l’Algérie et des projets visibles">${mapContent}</svg>`;
}

function mapPage() {
  const scoped = allScopedProjects();
  const filterWilaya = state.mapFilters?.wilaya || '';
  const filterSector = state.mapFilters?.sector || '';
  const visible = scoped.filter((project) => (!filterWilaya || project.wilaya === filterWilaya) && (!filterSector || project.sector === filterSector));
  const selected = visible.find((project) => project.id === state.selectedMapProject) || visible[0];
  if (selected) state.selectedMapProject = selected.id;
  const projectList = visible.map((project) => `<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selected?.id === project.id ? 'active' : ''}" data-map-project="${escapeHTML(project.id)}"><span><strong class="d-block small">${escapeHTML(project.shortName)}</strong><small>${escapeHTML(project.wilaya)} · ${escapeHTML(project.sector)}</small></span>${statusPill(projectStatusClass(project.status), project.status)}</button>`).join('');
  return `${pageHeading('Carte nationale des projets', 'Cartographie locale schématique · marqueurs limités à votre périmètre', `<button class="btn btn-outline-secondary btn-sm" data-map-toggle><i class="bx bx-list-ul me-1"></i>${state.mapView === 'map' ? 'Vue liste' : 'Vue carte'}</button>`)}${demoBanner()}<div class="card"><div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-3"><div><strong>Distribution territoriale</strong><span class="small text-muted ms-2">${visible.length} projets visibles · ${new Set(visible.map((project) => project.wilaya)).size} wilayas</span></div><form class="toolbar" data-form="map-filters"><select class="form-select form-select-sm" name="wilaya"><option value="">Toutes wilayas</option>${[...new Set(scoped.map((project) => project.wilaya))].map((item) => `<option ${filterWilaya === item ? 'selected' : ''}>${escapeHTML(item)}</option>`).join('')}</select><select class="form-select form-select-sm" name="sector"><option value="">Tous secteurs</option>${[...new Set(scoped.map((project) => project.sector))].map((item) => `<option ${filterSector === item ? 'selected' : ''}>${escapeHTML(item)}</option>`).join('')}</select><button class="btn btn-sm btn-outline-primary">Appliquer</button></form></div><div class="card-body"><div class="map-layout">${state.mapView === 'map' ? `<div class="algeria-map">${nationalMap(visible, false, selected?.id)}</div>` : `<div class="list-group">${projectList || '<div class="empty-state">Aucun projet dans ce filtre.</div>'}</div>`}<div><div class="map-legend mb-3"><span><i class="legend-dot" style="background:#bf5550"></i>Critique / à l’arrêt</span><span><i class="legend-dot" style="background:#d28a35"></i>À surveiller</span><span><i class="legend-dot" style="background:#428b6e"></i>En cours</span></div>${selected ? `<div class="map-selection"><span class="eyebrow">Projet sélectionné</span><h5 class="mt-2 mb-1">${escapeHTML(selected.shortName)}</h5><p class="small text-muted">${escapeHTML(selected.id)} · ${escapeHTML(selected.wilaya)} · ${escapeHTML(selected.sector)}</p>${projectStatus(selected)}<div class="project-fact mt-3"><span>AE actuelle</span><strong>${money(selected.budgetRevised)}</strong></div><div class="project-fact"><span>Avancement physique</span><strong>${selected.physical} %</strong><div class="progress-slim mt-2 w-100"><span style="width:${selected.physical}%"></span></div></div><div class="project-fact"><span>Avancement financier</span><strong>${selected.financial} %</strong></div><div class="project-fact"><span>Alertes actives visibles</span><strong>${currentInstances().filter((instance) => instance.projectId === selected.id).length}</strong></div><div class="project-fact"><span>Dernière mise à jour</span><strong>${shortDate(selected.updated)}</strong></div><button class="btn btn-primary w-100 mt-3" data-project-id="${escapeHTML(selected.id)}">Ouvrir le projet</button></div>` : '<div class="empty-state">Aucun projet dans ce périmètre.</div>'}<div class="small text-muted mt-4"><i class="bx bx-info-circle me-1"></i>Carte de démonstration hors ligne · coordonnées indicatives, aucun service cartographique externe.</div></div></div></div></div>`;
}

function documentCard(document) {
  const project = projectById(document.projectId);
  return `<div class="col-md-6 col-xl-4"><div class="card h-100"><div class="card-body"><div class="d-flex align-items-start gap-3"><span class="document-type">${escapeHTML(document.type)}</span><div class="min-w-0 flex-grow-1"><button class="btn btn-link p-0 text-start fw-semibold small text-truncate d-block w-100" data-doc-preview="${escapeHTML(document.name)}">${escapeHTML(document.name)}</button><span class="d-block small text-muted mt-1">${escapeHTML(project?.shortName || '')}</span></div></div><div class="d-flex justify-content-between align-items-center mt-3"><span class="badge bg-label-secondary">${escapeHTML(document.category)}</span><span class="small text-muted">${escapeHTML(document.version)}</span></div><div class="d-flex justify-content-between align-items-center mt-3 small text-muted"><span>${escapeHTML(document.owner)}</span><span>${shortDate(document.date)}</span></div><div class="d-flex justify-content-between align-items-center border-top pt-2 mt-2"><span class="small ${document.access.includes('Restreint') ? 'doc-private' : 'text-muted'}"><i class="bx ${document.access.includes('Restreint') ? 'bx-lock-alt' : 'bx-group'} me-1"></i>${escapeHTML(document.access)}</span><button class="btn btn-sm btn-icon btn-text-secondary" data-doc-preview="${escapeHTML(document.name)}" aria-label="Prévisualiser"><i class="bx bx-show"></i></button></div></div></div></div>`;
}

function documentsPage() {
  const all = visibleDocuments();
  const category = state.documentFilters.category || '';
  const query = (state.documentFilters.query || '').trim().toLowerCase();
  const filtered = all.filter((item) => (!category || item.category === category) && (!query || `${item.name} ${item.category} ${projectById(item.projectId)?.shortName}`.toLowerCase().includes(query)));
  const categories = [...new Set(all.map((item) => item.category))];
  return `${pageHeading('Documents', 'Dossiers projets, rapports, études et documents de démonstration', `<button class="btn btn-primary btn-sm" data-action="show-upload"><i class="bx bx-upload me-1"></i>Ajouter un document</button>`)}${demoBanner()}<div class="card mb-4"><div class="card-body"><form class="toolbar" data-form="document-filter"><input class="form-control form-control-sm" name="document-query" value="${escapeHTML(query)}" placeholder="Rechercher un fichier, projet…" aria-label="Rechercher un document"><select class="form-select form-select-sm" name="document-category"><option value="">Toutes catégories</option>${categories.map((item) => `<option ${category === item ? 'selected' : ''}>${escapeHTML(item)}</option>`).join('')}</select><button class="btn btn-sm btn-outline-primary">Filtrer</button><span class="ms-auto small text-muted">${filtered.length} document(s) · accès par périmètre de projet</span></form></div></div><div class="row g-4">${filtered.map(documentCard).join('') || '<div class="col-12"><div class="empty-state"><i class="bx bx-folder-open"></i>Aucun document visible pour ces critères.</div></div>'}</div><div class="mt-4"><div class="access-note">Les documents sont simulés localement. Un ajout conserve les métadonnées du fichier dans le navigateur, sans transfert ni stockage serveur.</div></div>`;
}

function messagesPage() {
  const visible = conversations.filter((conversation) => scopedProjectIds().has(conversation.projectId));
  if (!visible.some((conversation) => conversation.id === state.selectedConversation)) state.selectedConversation = visible[0]?.id;
  const selected = visible.find((conversation) => conversation.id === state.selectedConversation);
  const messages = selected ? (state.messages[selected.id] || selected.messages) : [];
  return `${pageHeading('Communication', 'Échanges contextualisés par projet · messages locaux de démonstration')}${demoBanner()}
    <div class="card"><div class="card-body p-0"><div class="row g-0">
      <div class="col-md-4 conversation-list">
        <div class="p-3 border-bottom"><input class="form-control form-control-sm" data-conversation-search placeholder="Rechercher une conversation…" aria-label="Rechercher une conversation"></div>
        ${visible.map((conversation) => `<div class="conversation-item ${selected?.id === conversation.id ? 'active' : ''}" data-conversation-id="${escapeHTML(conversation.id)}"><span class="avatar-initials">${escapeHTML(initials(conversation.participants[0]))}</span><span><span class="conversation-title d-block">${escapeHTML(conversation.title)}</span><span class="conversation-meta">${escapeHTML(conversation.participants.join(' · '))}</span></span>${conversation.unread ? `<span class="badge bg-primary rounded-pill ms-auto">${conversation.unread}</span>` : ''}</div>`).join('') || '<div class="empty-state">Aucune discussion dans votre périmètre.</div>'}
      </div>
      <div class="col-md-8">
        <div class="d-flex align-items-center justify-content-between border-bottom p-3"><div><strong class="small">${escapeHTML(selected?.title || 'Discussion projet')}</strong><span class="d-block small text-muted">${escapeHTML(selected?.participants.join(' · ') || '')}</span></div>${selected ? `<button class="btn btn-sm btn-outline-secondary" data-project-id="${escapeHTML(selected.projectId)}">Ouvrir le projet</button>` : ''}</div>
        <div class="p-3" style="min-height:320px;max-height:460px;overflow:auto" data-message-list>${messages.map((message) => `<div class="message-bubble ${message.author === state.user.name ? 'mine' : ''}"><span class="message-author">${escapeHTML(message.author)}</span><span>${escapeHTML(message.text)}</span>${message.attachment ? `<span class="badge bg-label-secondary d-block mt-2"><i class="bx bx-paperclip me-1"></i>${escapeHTML(message.attachment)}</span>` : ''}<span class="message-time">${escapeHTML(message.time)}</span></div>`).join('') || '<div class="empty-state">Aucun message.</div>'}</div>
        <form class="border-top p-3" data-form="message-send">
          <div class="input-group"><input class="form-control" name="message" placeholder="Écrire un message lié au projet…" required ${selected ? '' : 'disabled'}><button class="btn btn-primary" type="submit" ${selected ? '' : 'disabled'}><i class="bx bx-send me-1"></i>Envoyer</button></div>
          <div class="d-flex flex-wrap align-items-center gap-3 small text-muted mt-2"><label class="btn btn-sm btn-outline-secondary mb-0"><i class="bx bx-paperclip me-1"></i>Joindre un fichier<input class="visually-hidden" type="file" name="attachment" data-message-attachment></label><span data-chat-attachment-label>${escapeHTML(state.pendingMessageAttachment || 'Aucun fichier sélectionné')}</span><button class="btn btn-link btn-sm p-0" type="button" data-action="mention">Mentionner un participant</button><span><i class="bx bx-check-circle me-1"></i>Historique local</span></div><div class="mt-2" data-chat-attachment-preview></div>
        </form>
      </div>
    </div></div></div>`;
}

function reportsPage() {
  const scoped = allScopedProjects();
  const reports = [
    ['Vue exécutive du portefeuille', 'Synthèse de l’avancement, des risques majeurs et des arbitrages.', 'bx-pie-chart-alt-2', 'portfolio-report'],
    ['Rapport d’avancement projet', 'Avancement physique, délais contractuels et jalons.', 'bx-trending-up', 'progress-report'],
    ['Rapport financier', 'AE, crédits de paiement, engagements et situations.', 'bx-wallet', 'financial-report'],
    ['Rapport retards & délais', 'Dérives contractuelles, prévisions et plans de rattrapage.', 'bx-time-five', 'delay-report'],
    ['Rapport risques & blocages', 'Emprises, réseaux, arrêts et décisions en attente.', 'bx-error-circle', 'risk-report'],
    ['Rapport KPI', 'Indicateurs visibles selon la matrice de rôles.', 'bx-bar-chart-alt-2', 'kpis'],
    ['Synthèse des alertes', 'Événements et actions correctives dans le périmètre.', 'bx-bell', 'alerts'],
    ['Répartition géographique', 'Projets, secteurs et wilayas autorisés.', 'bx-map', 'map']
  ];
  const period = state.reportPeriod || '12 derniers mois';
  const seriesByPeriod = {
    '12 derniers mois': [32, 36, 39, 42, 44, 46, 49, 51, 53, 56, 57, 58],
    '6 derniers mois': [46, 49, 51, 53, 56, 58],
    'Année en cours': [42, 44, 49, 51, 56, 58]
  };
  const labelsByPeriod = {
    '12 derniers mois': ['Déc.', 'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.'],
    '6 derniers mois': ['Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.'],
    'Année en cours': ['Janv.', 'Mars', 'Mai', 'Juil.', 'Sept.', 'Nov.']
  };
  const series = seriesByPeriod[period] || seriesByPeriod['12 derniers mois'];
  return `
    ${pageHeading('Rapports & analyses', 'Vues d’aide à la décision · filtres limités au périmètre autorisé', '<button class="btn btn-outline-secondary btn-sm" data-export="portfolio-report"><i class="bx bx-download me-1"></i>Exporter synthèse CSV</button>')}
    ${demoBanner()}
    <div class="row g-4 mb-4">${reports.map(([title, description, iconName, action]) => {
    const navigates = ['kpis', 'alerts', 'map'].includes(action);
    return `<div class="col-md-6 col-xl-3"><div class="card report-card" ${navigates ? `data-nav="${action}"` : `data-export="${action}"`}><div class="card-body"><span class="metric-icon"><i class="bx ${iconName}"></i></span><h6 class="mt-3 mb-2">${escapeHTML(title)}</h6><p class="small text-muted">${escapeHTML(description)}</p><span class="btn btn-sm btn-outline-primary">${navigates ? 'Ouvrir la vue' : 'Générer le rapport'} <i class="bx bx-right-arrow-alt ms-1"></i></span></div></div></div>`;
  }).join('')}</div>
    <div class="row g-4">
      <div class="col-xl-8"><div class="card">
        <div class="card-header d-flex justify-content-between"><span>Synthèse illustrative du périmètre</span><select class="form-select form-select-sm" style="width:auto" data-report-period>${Object.keys(seriesByPeriod).map((option) => `<option ${period === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
        <div class="card-body">${lineChart(`Avancement physique consolidé · ${period}`, series, labelsByPeriod[period] || labelsByPeriod['12 derniers mois'])}<div class="row g-3 mt-2">${kpiMetric('AV2')}${kpiMetric('DL3')}${kpiMetric('FI4')}${kpiMetric('CO6')}</div></div>
      </div></div>
      <div class="col-xl-4"><div class="card h-100">
        <div class="card-header">Périmètre de ce rapport</div><div class="card-body">
          <div class="project-fact"><span>Projets</span><strong>${scoped.length} projets accessibles</strong></div>
          <div class="project-fact"><span>Budget révisé</span><strong>${money(sum(scoped, (project) => project.budgetRevised))}</strong></div>
          <div class="project-fact"><span>Rôle</span><strong>${escapeHTML(role().name)}</strong></div>
          <div class="project-fact"><span>Source</span><strong>Référentiel TAQADDUM · données fictives</strong></div>
          <div class="access-note mt-3">Les exports sont générés dans le navigateur et n’incluent que les données autorisées au rôle connecté.</div>
        </div>
      </div></div>
    </div>`;
}

function notificationsPage() {
  const instances = currentInstances().slice(0, 8);
  const allNotices = [
    ...instances.map((instance) => ({ id: instance.id, title: `${instance.ruleId} · ${alertRule(instance.ruleId)?.Nom}`, detail: `${projectById(instance.projectId)?.shortName} · ${instance.values}`, date: instance.detected, icon: 'bx-bell', nav: 'alerts' })),
    ...state.fieldReports.filter((report) => scopedProjectIds().has(report.projectId)).slice(0, 3).map((report) => ({ id: report.id, title: 'Rapport terrain enregistré', detail: `${projectById(report.projectId)?.shortName} · ${report.status}`, date: report.date, icon: 'bx-file', nav: 'field' })),
    ...visibleDocuments().slice(0, 2).map((document) => ({ id: document.name, title: 'Document disponible', detail: `${document.name} · ${projectById(document.projectId)?.shortName}`, date: document.date, icon: 'bx-folder-open', nav: 'documents' }))
  ].sort((a, b) => b.date.localeCompare(a.date));
  return `${pageHeading('Notifications', 'Alertes attribuées, rapports de terrain et documents visibles dans votre périmètre')}${demoBanner()}<div class="card"><div class="card-header d-flex justify-content-between"><span>Activité récente</span><button class="btn btn-sm btn-link" data-action="mark-read">Tout marquer comme lu</button></div><div class="card-body">${allNotices.map((notice) => `<button class="alert-row clickable w-100 text-start bg-transparent border-0" data-nav="${escapeHTML(notice.nav)}" data-notification-id="${escapeHTML(notice.id)}"><span class="metric-icon"><i class="bx ${notice.icon}"></i></span><span class="alert-row-content"><strong>${escapeHTML(notice.title)}</strong><span>${escapeHTML(notice.detail)} · ${shortDate(notice.date)}</span></span>${state.notificationsRead.includes(notice.id) ? '<span class="badge bg-label-secondary">Lue</span>' : '<span class="badge bg-label-primary">Nouvelle</span>'}</button>`).join('') || '<div class="empty-state">Aucune notification visible.</div>'}</div></div>`;
}

function showUploadModal() {
  showModal(`<div class="modal-header"><h5 class="modal-title">Ajouter un document au dossier</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><form data-form="document-upload"><div class="modal-body"><div class="alert alert-info py-2 small">Ajout simulé : seuls les métadonnées sont conservées dans le navigateur. Aucun document n’est transmis à un serveur.</div><div class="mb-3"><label class="form-label">Projet</label><select class="form-select" name="projectId" required>${allScopedProjects().map((project) => `<option value="${escapeHTML(project.id)}">${escapeHTML(project.shortName)}</option>`).join('')}</select></div><div class="mb-3"><label class="form-label">Catégorie</label><select class="form-select" name="category">${['Rapports', 'Études techniques', 'Financier', 'Terrain', 'Comptes rendus', 'Avenants', 'Réception'].map((item) => `<option>${item}</option>`).join('')}</select></div><div><label class="form-label">Fichier</label><input class="form-control" name="file" type="file" required></div></div><div class="modal-footer"><button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Annuler</button><button class="btn btn-primary" type="submit">Ajouter au dossier</button></div></form>`);
}

function kpiCatalogPage() {
  const allowed = visibleKPIs();
  const family = state.kpiFilters.family || '';
  const importance = state.kpiFilters.importance || '';
  const phase = state.kpiFilters.phase || '';
  const statusFilter = state.kpiFilters.status || '';
  const responsible = state.kpiFilters.responsible || '';
  const projectId = state.kpiFilters.project || '';
  const currentProject = scopedProjectIds().has(projectId) ? projectById(projectId) : null;
  const query = state.globalSearch.toLowerCase();
  const reportingDate = state.kpiFilters.reportingDate || '2026-11';
  const hasSnapshot = reportingDate === '2026-11';
  const filtered = (hasSnapshot ? allowed : []).filter((item) => {
    const value = valueFor(item, currentProject);
    return (!family || item.Famille === family) &&
      (!importance || item.Importance === importance) &&
      (!phase || item.Phase === phase) &&
      (!responsible || item.Responsable === responsible) &&
      (!statusFilter || statusFor(item, value, currentProject) === statusFilter) &&
      (!query || `${item.KPI_ID} ${item.Nom_KPI}`.toLowerCase().includes(query));
  });
  const rows = filtered.map((item) => {
    const value = valueFor(item, currentProject);
    const status = statusFor(item, value, currentProject);
    const permission = rolePermission('kpis', item.KPI_ID);
    return `<tr><td><span class="kpi-id">${escapeHTML(item.KPI_ID)}</span></td><td><button class="btn btn-link p-0 text-start kpi-name" data-kpi-id="${escapeHTML(item.KPI_ID)}">${escapeHTML(item.Nom_KPI)}<small>${escapeHTML(item.Famille)}</small></button></td><td>${importanceBadge(item.Importance)}</td><td>${escapeHTML(item.Phase)}</td><td class="fw-semibold">${escapeHTML(formatValue(item, value))}</td><td>${statusPill(status)}</td><td>${escapeHTML(permission)}</td><td>${escapeHTML(item.Fréquence_cible || '')}</td></tr>`;
  }).join('');
  const familyOptions = [...new Set(allowed.map((item) => item.Famille))];
  const responsibleOptions = [...new Set(allowed.map((item) => item.Responsable).filter(Boolean))];
  return `${pageHeading('KPI & performance', `${allowed.length} KPI visibles pour ${role().name} · droits issus de la matrice TAQADDUM`, `<button class="btn btn-outline-secondary btn-sm" data-export="kpis"><i class="bx bx-download me-1"></i>Exporter CSV</button>`)}${demoBanner()}<div class="card"><div class="card-header"><div class="d-flex flex-wrap align-items-center justify-content-between gap-3"><div><strong>Catalogue des indicateurs</strong><span class="text-muted small ms-2">${filtered.length} résultat(s) · reporting ${escapeHTML(reportingDate)}</span></div><div class="kpi-filter-grid"><input class="form-control form-control-sm" data-kpi-search placeholder="Rechercher un KPI…" value="${escapeHTML(state.globalSearch)}" aria-label="Rechercher un KPI"><select class="form-select form-select-sm" name="kpi-family" aria-label="Famille"><option value="">Toutes les familles</option>${familyOptions.map((option) => `<option value="${escapeHTML(option)}" ${family === option ? 'selected' : ''}>${escapeHTML(option)}</option>`).join('')}</select><select class="form-select form-select-sm" name="kpi-importance" aria-label="Importance"><option value="">Toutes importances</option>${['[M]', '[A]', '[S]'].map((option) => `<option ${importance === option ? 'selected' : ''}>${option}</option>`).join('')}</select><select class="form-select form-select-sm" name="kpi-phase" aria-label="Phase"><option value="">Toutes phases</option>${['MVP', 'V2', 'Vision'].map((option) => `<option ${phase === option ? 'selected' : ''}>${option}</option>`).join('')}</select><select class="form-select form-select-sm" name="kpi-responsible" aria-label="Responsable KPI"><option value="">Tous responsables</option>${responsibleOptions.map((option) => `<option ${responsible === option ? 'selected' : ''}>${escapeHTML(option)}</option>`).join('')}</select><select class="form-select form-select-sm" name="kpi-status" aria-label="Statut"><option value="">Tous statuts</option><option value="green" ${statusFilter === 'green' ? 'selected' : ''}>VERT</option><option value="orange" ${statusFilter === 'orange' ? 'selected' : ''}>ORANGE</option><option value="red" ${statusFilter === 'red' ? 'selected' : ''}>ROUGE</option><option value="info" ${statusFilter === 'info' ? 'selected' : ''}>Information</option></select><select class="form-select form-select-sm" name="kpi-project" aria-label="Projet"><option value="">Valeur ${state.user.scope === 'national' ? 'portefeuille' : 'périmètre'}</option>${allScopedProjects().map((project) => `<option value="${escapeHTML(project.id)}" ${projectId === project.id ? 'selected' : ''}>${escapeHTML(project.shortName)}</option>`).join('')}</select><input class="form-control form-control-sm" type="month" value="${escapeHTML(reportingDate)}" name="kpi-reporting-date" aria-label="Date de reporting"></div></div><div class="d-flex flex-wrap gap-2 mt-3"><span class="small text-muted">Droits :</span><span class="badge bg-label-primary">R · responsable</span><span class="badge bg-label-info">S · alimente</span><span class="badge bg-label-secondary">V · consultation</span><span class="small text-muted ms-auto">${hasSnapshot ? 'Valeurs illustratives disponibles pour novembre 2026 uniquement.' : 'Aucune donnée illustrative disponible pour cette période ; les valeurs ne sont pas extrapolées.'}</span></div></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>ID</th><th>Indicateur</th><th>Importance</th><th>Phase</th><th>Valeur illustrative</th><th>État seuil</th><th>Mon droit</th><th>Fréquence</th></tr></thead><tbody>${rows || `<tr><td colspan="8"><div class="empty-state">${hasSnapshot ? 'Aucun KPI ne correspond aux filtres.' : 'Aucun point de reporting disponible pour la période sélectionnée.'}</div></td></tr>`}</tbody></table></div></div>`;
}

function alertsPage() {
  const allowedRules = visibleAlertRules();
  const visible = currentInstances();
  const statusFilter = state.alertFilters.status || '';
  const severityFilter = state.alertFilters.severity || '';
  const query = (state.alertFilters.query || '').trim().toLowerCase();
  const rows = visible.filter((instance) => {
    const rule = alertRule(instance.ruleId);
    const currentStatus = state.alertChanges[instance.id]?.status || instance.status;
    return (!statusFilter || currentStatus === statusFilter) &&
      (!severityFilter || rule?.Niveau === severityFilter) &&
      (!query || `${rule?.Nom} ${instance.projectId} ${projectById(instance.projectId)?.name} ${instance.ruleId}`.toLowerCase().includes(query));
  }).map((instance) => alertTableRow(instance)).join('');
  const rulesRows = allowedRules.map((item) => `<tr><td><span class="kpi-id">${escapeHTML(item.Regle_ID)}</span></td><td><button class="btn btn-link p-0 text-start kpi-name" data-rule-id="${escapeHTML(item.Regle_ID)}">${escapeHTML(item.Nom)}</button><small class="d-block text-muted mt-1">${escapeHTML(alertCondition(item))}</small></td><td>${statusPill(item.Niveau === 'ROUGE' ? 'red' : 'orange', item.Niveau)}</td><td>${importanceBadge(item.Importance)}</td><td>${escapeHTML(item.Phase || '')}</td><td>${escapeHTML(item.Destinataire || '')}</td><td>${escapeHTML(item.Action || '')}</td><td>${escapeHTML(item['Fréquence'] || '')}</td></tr>`).join('');
  const instancesTab = state.alertTab === 'instances';
  return `${pageHeading('Risques & alertes', `${visible.length} événements illustratifs · ${allowedRules.length} règles autorisées par la matrice`, `<span class="role-chip"><i class="bx bx-shield-quarter"></i>${escapeHTML(role().name)}</span>`)}${demoBanner()}<div class="card"><div class="card-header pb-0"><div class="d-flex flex-wrap align-items-center justify-content-between gap-2"><div><strong>Centre des alertes</strong><span class="text-muted small ms-2">Signal d’aide à la décision · validation institutionnelle requise</span></div><div class="nav nav-pills"><button class="nav-link ${instancesTab ? 'active' : ''}" data-alert-tab="instances">Événements (${visible.length})</button><button class="nav-link ${!instancesTab ? 'active' : ''}" data-alert-tab="rules">Règles (${allowedRules.length})</button></div></div></div>${instancesTab ? `<div class="card-body pb-2"><div class="toolbar"><input class="form-control form-control-sm" name="alert-query" placeholder="Projet, alerte, identifiant…" value="${escapeHTML(query)}"><select class="form-select form-select-sm" name="alert-severity"><option value="">Toutes sévérités</option><option value="ROUGE" ${severityFilter === 'ROUGE' ? 'selected' : ''}>ROUGE</option><option value="ORANGE" ${severityFilter === 'ORANGE' ? 'selected' : ''}>ORANGE</option></select><select class="form-select form-select-sm" name="alert-status"><option value="">Tous les statuts</option>${['Nouvelle', 'À traiter', 'En cours', 'En attente', 'Escaladée', 'Résolue', 'Clôturée'].map((value) => `<option ${statusFilter === value ? 'selected' : ''}>${value}</option>`).join('')}</select><span class="ms-auto small text-muted">${currentInstances().filter((instance) => ['Fiable', 'Partielle', 'À vérifier', 'Insuffisante'].includes(instance.confidence)).length} événements · confiance à vérifier au cas par cas</span></div></div><div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>ID / sévérité</th><th>Alerte</th><th>Projet</th><th>Détectée le</th><th>Valeurs déclenchantes</th><th>Fiabilité</th><th>Responsable</th><th>État</th></tr></thead><tbody>${rows || '<tr><td colspan="8"><div class="empty-state">Aucun événement ne correspond à vos filtres.</div></td></tr>'}</tbody></table></div>` : `<div class="table-responsive"><table class="table table-enterprise"><thead><tr><th>ID</th><th>Règle & condition</th><th>Niveau</th><th>Importance</th><th>Phase</th><th>Destinataires</th><th>Action attendue</th><th>Fréquence</th></tr></thead><tbody>${rulesRows || '<tr><td colspan="8"><div class="empty-state">Aucune règle visible selon la matrice de rôles.</div></td></tr>'}</tbody></table></div>`}</div><div class="row g-4 mt-1"><div class="col-md-4"><div class="card"><div class="card-body d-flex align-items-center gap-3"><span class="metric-icon text-danger"><i class="bx bx-error-circle"></i></span><div><strong>${visible.filter((instance) => alertRule(instance.ruleId)?.Niveau === 'ROUGE').length}</strong><span class="d-block small text-muted">Alertes ROUGE visibles</span></div></div></div></div><div class="col-md-4"><div class="card"><div class="card-body d-flex align-items-center gap-3"><span class="metric-icon text-warning"><i class="bx bx-error"></i></span><div><strong>${visible.filter((instance) => alertRule(instance.ruleId)?.Niveau === 'ORANGE').length}</strong><span class="d-block small text-muted">Alertes ORANGE visibles</span></div></div></div></div><div class="col-md-4"><div class="card"><div class="card-body d-flex align-items-center gap-3"><span class="metric-icon"><i class="bx bx-data"></i></span><div><strong>${visible.filter((instance) => ['À vérifier', 'Insuffisante'].includes(instance.confidence)).length}</strong><span class="d-block small text-muted">Vérification de données nécessaire</span></div></div></div></div></div>`;
}

function ruleKpiIds(rule) {
  const raw = [rule?.C1_KPI_ou_champ, rule?.C2_KPI_ou_champ, rule?.C3_KPI_ou_champ].filter(Boolean).join(' ');
  return [...new Set(raw.match(/\b(?:AV|FI|DL|BU|QR|DO|PP|CO|GV)\d\b/g) || [])];
}

function ruleThresholds(rule) {
  return [1, 2, 3].map((number) => ({
    field: rule?.[`C${number}_KPI_ou_champ`],
    operator: rule?.[`C${number}_Op`],
    threshold: rule?.[`C${number}_Seuil`]
  })).filter((condition) => condition.field);
}

function alertTableRow(instance) {
  const rule = alertRule(instance.ruleId);
  const project = projectById(instance.projectId);
  const change = state.alertChanges[instance.id] || {};
  const status = change.status || instance.status;
  const action = rolePermission('alerts', instance.ruleId) === 'D';
  return `<tr class="clickable" data-alert-id="${escapeHTML(instance.id)}"><td><span class="kpi-id">${escapeHTML(instance.ruleId)}</span><div class="mt-1">${statusPill(rule?.Niveau === 'ROUGE' ? 'red' : 'orange', rule?.Niveau || '')}</div></td><td class="primary-cell">${escapeHTML(rule?.Nom || '')}</td><td><button class="btn btn-link p-0 text-start small" data-project-id="${escapeHTML(project?.id || '')}">${escapeHTML(project?.shortName || '')}</button><small class="d-block text-muted">${escapeHTML(project?.wilaya || '')}</small></td><td>${shortDate(instance.detected)}</td><td>${escapeHTML(instance.values)}</td><td>${statusPill(instance.confidence === 'Fiable' ? 'green' : instance.confidence === 'Insuffisante' ? 'red' : 'orange', instance.confidence)}</td><td>${escapeHTML(change.assignee || instance.assignee)}</td><td>${escapeHTML(status)}${action ? '<i class="bx bx-edit-alt ms-1 text-primary"></i>' : ''}</td></tr>`;
}

function alertRow(instance) {
  const rule = alertRule(instance.ruleId);
  return `<div class="alert-row clickable" data-alert-id="${escapeHTML(instance.id)}"><span class="alert-severity ${rule?.Niveau === 'ORANGE' ? 'orange' : ''}"></span><span class="alert-row-content"><strong>${escapeHTML(instance.ruleId)} · ${escapeHTML(rule?.Nom || '')}</strong><span>${escapeHTML(instance.values)} · ${escapeHTML(instance.status)}</span></span></div>`;
}

function render() {
  if (!state.user) {
    renderLogin();
    return;
  }
  if (!roles[roleKeyFor(state.user)]) {
    state.user = null;
    localStorage.removeItem('cned-demo-user');
    sessionStorage.removeItem('cned-demo-session');
    renderLogin();
    return;
  }
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.add('layout-menu-fixed');
  app.innerHTML = shell();
  renderCurrentPage();
}

function shell() {
  const config = role();
  const notificationCount = Math.min(9, currentInstances().filter((instance) => !state.notificationsRead.includes(instance.id)).length);
  const roleNav = config.nav.map((page) => {
    const [label, iconName] = pageMeta[page];
    const active = page === state.page || (state.page === 'project' && page === 'portfolio');
    return `<li class="menu-item ${active ? 'active' : ''}"><a class="menu-link" data-nav="${page}"><i class="menu-icon tf-icons bx ${iconName}"></i><div>${escapeHTML(t(label))}</div>${page === 'alerts' && currentInstances().length ? `<span class="badge badge-center rounded-pill bg-danger ms-auto">${currentInstances().length}</span>` : ''}</a></li>`;
  }).join('');
  return `<div class="layout-wrapper layout-content-navbar"><div class="layout-container"><aside id="layout-menu" class="layout-menu menu-vertical menu bg-menu-theme"><div class="app-brand demo shell-brand"><a class="app-brand-link" data-nav="dashboard"><span class="shell-brand-icon"><i class="bx bx-building-house"></i></span><span class="app-brand-text demo menu-text fw-bolder ms-2">CNED DIGITAL</span></a><a href="javascript:void(0)" class="layout-menu-toggle menu-link text-large ms-auto d-block d-xl-none" aria-label="Fermer le menu"><i class="bx bx-chevron-left bx-sm align-middle"></i></a></div><div class="menu-inner-shadow"></div><div class="px-4 pb-2"><div class="role-chip w-100 justify-content-start"><i class="bx bx-shield-quarter"></i><span>${escapeHTML(config.name)}</span></div><small class="d-block text-muted mt-2 px-1">${escapeHTML(config.workspace)}</small></div><ul class="menu-inner py-1"><li class="menu-header small text-uppercase"><span class="menu-header-text">Espace de travail</span></li>${roleNav}<li class="menu-header small text-uppercase"><span class="menu-header-text">Session de démonstration</span></li><li class="menu-item"><a class="menu-link" data-action="logout"><i class="menu-icon tf-icons bx bx-log-out"></i><div>${escapeHTML(t('Déconnexion'))}</div></a></li></ul></aside><div class="layout-page"><nav class="layout-navbar container-xxl navbar navbar-expand-xl navbar-detached align-items-center bg-navbar-theme" id="layout-navbar"><div class="layout-menu-toggle navbar-nav align-items-xl-center me-3 me-xl-0 d-xl-none"><a class="nav-item nav-link px-0 me-xl-4" href="javascript:void(0)" aria-label="Ouvrir le menu"><i class="bx bx-menu bx-sm"></i></a></div><div class="navbar-nav-right d-flex align-items-center" id="navbar-collapse"><form class="navbar-search d-flex align-items-center" data-form="global-search"><i class="bx bx-search fs-4 lh-0 text-muted"></i><input type="search" class="form-control border-0 shadow-none ms-2" name="query" placeholder="${escapeHTML(t('Rechercher un projet, KPI…'))}" aria-label="Rechercher" value="${escapeHTML(state.globalSearch)}"></form><ul class="navbar-nav flex-row align-items-center ms-auto"><li class="nav-item me-2"><span class="role-chip d-none d-lg-inline-flex">${escapeHTML(config.workspace)}</span></li><li class="nav-item me-2"><button class="btn btn-sm btn-text-secondary" data-action="language" aria-label="Changer de langue">${state.lang === 'fr' ? 'عربي' : 'FR'}</button></li><li class="nav-item me-2"><button class="btn btn-sm btn-icon btn-text-secondary position-relative" data-nav="notifications" aria-label="Notifications"><i class="bx bx-bell bx-sm"></i>${notificationCount ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">${notificationCount}</span>` : ''}</button></li><li class="nav-item navbar-dropdown dropdown-user dropdown"><a class="nav-link dropdown-toggle hide-arrow" href="javascript:void(0)" data-bs-toggle="dropdown"><div class="avatar avatar-online"><span class="avatar-initials">${escapeHTML(state.user.initials)}</span></div></a><ul class="dropdown-menu dropdown-menu-end"><li><a class="dropdown-item" href="javascript:void(0)"><span class="d-flex align-items-center"><span class="avatar-initials me-3">${escapeHTML(state.user.initials)}</span><span><strong class="d-block">${escapeHTML(state.user.name)}</strong><small class="text-muted">${escapeHTML(state.user.title)}</small></span></span></a></li><li><hr class="dropdown-divider"></li><li><a class="dropdown-item" href="javascript:void(0)"><i class="bx bx-building me-2"></i>${escapeHTML(state.user.organization)}</a></li><li><a class="dropdown-item" data-action="logout"><i class="bx bx-log-out me-2"></i>${escapeHTML(t('Déconnexion'))}</a></li></ul></li></ul></div></nav><div class="content-wrapper"><div class="container-xxl flex-grow-1 container-p-y" id="page-content"><div class="app-content-area"></div></div><footer class="content-footer footer bg-footer-theme"><div class="container-xxl d-flex flex-wrap justify-content-between py-2 flex-md-row flex-column"><div class="mb-2 mb-md-0 text-muted small">CNED DIGITAL · Prototype de démonstration frontend · Référentiel TAQADDUM v1</div><div class="text-muted small">Données fictives · aucune connexion à un système institutionnel</div></div></footer><div class="content-backdrop fade"></div></div></div></div><div class="layout-overlay layout-menu-toggle"></div></div><div class="modal fade" id="detail-modal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"></div></div></div>`;
}

function renderCurrentPage() {
  const host = document.querySelector('.app-content-area');
  if (!host) return;
  const selectedProject = projectById(state.projectId);
  const page = state.page === 'project' && selectedProject ? projectPage(selectedProject) : renderPageByKey(state.page);
  host.innerHTML = page;
  bindMenuPlugin();
}

function renderPageByKey(page) {
  if (page === 'dashboard') return roleDashboard();
  if (page === 'portfolio') return portfolioPage();
  if (page === 'project') return portfolioPage();
  if (page === 'kpis') return kpiCatalogPage();
  if (page === 'alerts') return alertsPage();
  if (page === 'finance') return financePage();
  if (page === 'planning') return planningPage();
  if (page === 'technical') return technicalPage();
  if (page === 'field') return fieldPage();
  if (page === 'map') return mapPage();
  if (page === 'documents') return documentsPage();
  if (page === 'messages') return messagesPage();
  if (page === 'reports') return reportsPage();
  if (page === 'notifications') return notificationsPage();
  return `<div class="empty-state"><i class="bx bx-error-circle"></i>Cette section n’est pas disponible pour ce rôle.</div>`;
}

function bindMenuPlugin() {
  if (window.Helpers?.initAccordions) window.Helpers.initAccordions();
}

function renderLogin(error = '') {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.remove('layout-menu-fixed');
  const authHeading = state.lang === 'ar' ? 'دخول مؤسسي آمن' : 'Accès à votre espace';
  const authCopy = state.lang === 'ar' ? 'استخدم حساب العرض التجريبي المخصص لدورك.' : 'Connectez-vous à votre espace institutionnel pour accéder aux projets et indicateurs autorisés.';
  app.innerHTML = `<main class="login-page"><section class="login-identity"><div class="identity-top"><div class="cned-mark"><span class="cned-mark-icon"><i class="bx bx-building-house"></i></span><span class="cned-mark-name"><strong>CNED DIGITAL</strong><span>GOUVERNANCE · PERFORMANCE · TERRITOIRES</span></span></div></div><div class="identity-copy"><span class="identity-kicker">Caisse Nationale d’Équipement pour le Développement</span><h1>Piloter les investissements publics.<br>Coordonner les acteurs.<br>Maîtriser la performance.</h1><p>Une plateforme de gouvernance et d’intelligence dédiée au suivi des projets d’infrastructure et des investissements publics.</p></div><div class="identity-footer"><span>République Algérienne Démocratique et Populaire</span><span class="arabic">الصندوق الوطني للتجهيز والتنمية</span></div></section><section class="login-panel"><button class="btn btn-sm btn-outline-secondary login-language" data-action="language">${state.lang === 'fr' ? 'العربية' : 'Français'}</button><div class="login-panel-inner"><span class="eyebrow">Portail institutionnel</span><h2>${escapeHTML(authHeading)}</h2><p class="login-intro">${escapeHTML(authCopy)}</p>${error ? `<div class="alert alert-danger py-2" role="alert">${escapeHTML(error)}</div>` : ''}<form data-form="login" novalidate><div class="mb-3"><label class="form-label" for="login-user">${state.lang === 'ar' ? 'اسم المستخدم أو البريد المؤسسي' : 'Identifiant ou courriel institutionnel'}</label><input class="form-control" id="login-user" name="username" autocomplete="username" required placeholder="ex. pmo" /></div><div class="mb-3"><label class="form-label" for="login-password">${state.lang === 'ar' ? 'كلمة المرور' : 'Mot de passe'}</label><div class="input-group input-group-merge"><input class="form-control" id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"><button class="btn btn-outline-secondary" type="button" data-action="toggle-password" aria-label="Afficher le mot de passe"><i class="bx bx-hide"></i></button></div></div><div class="d-flex align-items-center justify-content-between mb-4"><div class="form-check"><input class="form-check-input" type="checkbox" id="remember" name="remember"><label class="form-check-label small" for="remember">Se souvenir de moi</label></div><button class="btn btn-link p-0 small" type="button" data-action="forgot-password">Mot de passe oublié ?</button></div><button class="btn btn-primary w-100 py-2" type="submit"><span data-login-label>Se connecter</span><span class="spinner-border spinner-border-sm ms-2 d-none" data-login-spinner></span></button></form><details class="login-demo"><summary>Accès de démonstration — comptes locaux</summary><p class="small text-muted mt-2 mb-2">Prototype frontend uniquement. Ces identifiants fictifs ne constituent pas un mécanisme d’authentification sécurisé.</p><div class="demo-account-list">${demoAccounts.map((account) => `<button class="demo-account" type="button" data-demo-user="${escapeHTML(account.username)}"><strong>${escapeHTML(account.role)}</strong><span>${escapeHTML(account.username)} · ${escapeHTML(account.password)}</span></button>`).join('')}</div></details><div class="d-flex justify-content-between mt-4 small text-muted"><span>© CNED DIGITAL · Démonstrateur</span><span>FR / AR</span></div></div></section></main>`;
}

function appToast(message) {
  const stack = document.querySelector('#toast-stack');
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = message;
  stack.append(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function showModal(html, size = '') {
  const modal = document.querySelector('#detail-modal');
  if (!modal) return;
  const dialog = modal.querySelector('.modal-dialog');
  dialog.className = `modal-dialog modal-dialog-centered ${size}`.trim();
  modal.querySelector('.modal-content').innerHTML = html;
  if (window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modal).show();
  else modal.classList.add('show');
}

function closeModal() {
  const modal = document.querySelector('#detail-modal');
  if (modal && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modal).hide();
}

function openKpiDetail(id) {
  const item = kpiById(id);
  if (!item || !rolePermission('kpis', id)) {
    appToast('Cet indicateur n’est pas visible selon la matrice de rôles.');
    return;
  }
  const value = valueFor(item, state.projectId ? projectById(state.projectId) : null);
  const detailProject = state.projectId ? projectById(state.projectId) : null;
  const status = statusFor(item, value, detailProject);
  const related = allScopedProjects().filter((project) => project.values[item.KPI_ID] !== undefined).slice(0, 5);
  const relatedAlerts = currentInstances().filter((instance) => ruleKpiIds(alertRule(instance.ruleId)).includes(item.KPI_ID));
  showModal(`<div class="modal-header"><div><span class="kpi-id">${escapeHTML(item.KPI_ID)}</span><h5 class="modal-title mt-2">${escapeHTML(item.Nom_KPI)}</h5><small class="text-muted">${escapeHTML(item.Famille)} · ${escapeHTML(item.Phase)} · ${escapeHTML(item.Importance)}</small></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button></div><div class="modal-body"><div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4"><div><span class="small text-muted">Valeur illustrative</span><strong class="d-block fs-3">${escapeHTML(formatValue(item, value))}</strong></div>${statusPill(status)}<span class="badge bg-label-secondary">${escapeHTML(item.Sens || 'Information')}</span></div><div class="row g-4"><div class="col-md-7"><div class="threshold-line"><span class="threshold-label">Définition</span><span>${escapeHTML(item.Définition || '')}</span></div><div class="threshold-line"><span class="threshold-label">Formule</span><span>${escapeHTML(item.Formule || '—')}</span></div><div class="threshold-line"><span class="threshold-label">Source</span><span>${escapeHTML(item.Alimenté_par || '')} · ${escapeHTML(item.Tables_sources || '')}</span></div><div class="threshold-line"><span class="threshold-label">Responsable</span><span>${escapeHTML(item.Responsable || '—')} · droit ${escapeHTML(rolePermission('kpis', id))}</span></div><div class="threshold-line"><span class="threshold-label">Fréquence</span><span>${escapeHTML(item.Fréquence_cible || '—')} · ${escapeHTML(item.Calculabilité || '')}</span></div></div><div class="col-md-5"><div class="card bg-lighter shadow-none"><div class="card-body"><strong class="small">Seuils de lecture</strong><div class="threshold-line mt-2"><span class="threshold-label text-success">VERT</span><span>${escapeHTML(item.Vert || '—')}</span></div><div class="threshold-line"><span class="threshold-label text-warning">ORANGE</span><span>${escapeHTML(item.Orange || '—')}</span></div><div class="threshold-line"><span class="threshold-label text-danger">ROUGE</span><span>${escapeHTML(item.Rouge || '—')}</span></div><p class="small text-muted mt-3 mb-0">Interprétation conforme au sens de cet indicateur. Les seuils de référence sont ceux du classeur TAQADDUM.</p></div></div></div></div><div class="mt-4"><strong class="small">Tendance illustrative</strong>${lineChart(`${item.KPI_ID} · ${item.Unité || ''}`, [48, 53, 51, 55, 57, Number.isFinite(numeric(value)) ? numeric(value) : 58])}</div><div class="row g-4 mt-1"><div class="col-md-6"><strong class="small">Projets visibles associés</strong><div class="mt-2">${related.map((project) => `<div class="d-flex justify-content-between border-bottom py-2 small"><span>${escapeHTML(project.shortName)}</span><span>${escapeHTML(formatValue(item, valueFor(item, project)))}</span></div>`).join('') || '<p class="small text-muted">Aucun projet.</p>'}</div></div><div class="col-md-6"><strong class="small">Alertes visibles liées</strong><div class="mt-2">${relatedAlerts.map((instance) => `<button class="btn btn-link p-0 d-block small" data-alert-id="${escapeHTML(instance.id)}">${escapeHTML(instance.ruleId)} · ${escapeHTML(alertRule(instance.ruleId)?.Nom || '')}</button>`).join('') || '<span class="small text-muted">Aucune instance visible.</span>'}</div></div></div></div><div class="modal-footer"><span class="small text-muted me-auto">Dernière mise à jour illustrative · ${shortDate('2026-11-10')}</span><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Fermer</button></div>`);
}

function openAlertDetail(id) {
  const instance = currentInstances().find((item) => item.id === id);
  if (!instance) {
    appToast('Cette alerte n’est pas accessible dans votre périmètre.');
    return;
  }
  const rule = alertRule(instance.ruleId);
  const project = projectById(instance.projectId);
  const permission = rolePermission('alerts', instance.ruleId);
  const current = { ...instance, ...state.alertChanges[id] };
  const canAct = permission === 'D';
  const history = current.comments || [];
  const statuses = ['Nouvelle', 'À traiter', 'En cours', 'En attente', 'Escaladée', 'Résolue', 'Clôturée'];
  const underlyingKpis = ruleKpiIds(rule);
  const triggerDetails = ruleThresholds(rule).map((trigger) => `<div class="threshold-line"><span class="threshold-label">${escapeHTML(trigger.field)}</span><span>${escapeHTML(`${trigger.operator || ''} ${trigger.threshold || ''}`.trim())}</span></div>`).join('');
  const kpiLinks = underlyingKpis.map((kpiId) => rolePermission('kpis', kpiId)
    ? `<button type="button" class="btn btn-sm btn-outline-secondary me-1 mb-1" data-kpi-id="${escapeHTML(kpiId)}">${escapeHTML(kpiId)} · détail</button>`
    : `<span class="kpi-id me-1">${escapeHTML(kpiId)}</span>`).join('') || '<span class="text-muted">Champ opérationnel · aucun KPI direct</span>';
  showModal(`
    <div class="modal-header">
      <div>
        <span class="kpi-id">${escapeHTML(instance.ruleId)}</span>
        <h5 class="modal-title mt-2">${escapeHTML(rule?.Nom || '')}</h5>
        <small class="text-muted">${escapeHTML(project?.name || '')} · ${escapeHTML(project?.id || '')}</small>
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
    </div>
    <form data-form="alert-update" data-alert-id="${escapeHTML(id)}">
      <div class="modal-body alert-modal-content">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          ${statusPill(rule?.Niveau === 'ROUGE' ? 'red' : 'orange', rule?.Niveau || '')}
          ${importanceBadge(rule?.Importance)}
          <span class="badge bg-label-secondary">Droit : ${permission === 'D' ? 'Destinataire · action' : 'Informé · lecture seule'}</span>
        </div>
        <div class="threshold-line"><span class="threshold-label">Condition</span><span>${escapeHTML(alertCondition(rule))}</span></div>
        <div class="threshold-line"><span class="threshold-label">Logique</span><span>${escapeHTML(rule?.Logique || '—')}</span></div>
        <div class="threshold-line"><span class="threshold-label">Valeurs déclenchantes</span><span>${escapeHTML(instance.values)}</span></div>
        <div class="threshold-line"><span class="threshold-label">Conditions détaillées</span><div>${triggerDetails || '—'}</div></div>
        <div class="threshold-line"><span class="threshold-label">KPI sous-jacents</span><span>${kpiLinks}</span></div>
        <div class="row g-3 mt-2">
          <div class="col-md-6"><strong>Action attendue</strong><p>${escapeHTML(rule?.Action || '')}</p></div>
          <div class="col-md-6"><strong>Détectée le</strong><p>${shortDate(instance.detected)} · ${escapeHTML(rule?.Fréquence || '')}</p></div>
          <div class="col-md-6"><strong>Fiabilité des données</strong><p>${statusPill(instance.confidence === 'Fiable' ? 'green' : instance.confidence === 'Insuffisante' ? 'red' : 'orange', instance.confidence)}<br><span class="small">Vérifier DO1, DO2 et DO3 avant toute conclusion opérationnelle.</span></p></div>
          <div class="col-md-6"><strong>Destinataires</strong><p>${escapeHTML(rule?.Destinataire || '')} · Mon droit : ${permission}</p></div>
        </div>
        <div class="access-note mb-3">Alerte de démonstration. Un signal ne déclenche jamais automatiquement une mise en demeure, une sanction, une résiliation ou une décision administrative.</div>
        ${canAct ? `
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label">État de traitement</label><select class="form-select" name="status">${statuses.map((status) => `<option ${current.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>
            <div class="col-md-6"><label class="form-label">Responsable</label><input class="form-control" name="assignee" value="${escapeHTML(current.assignee || '')}" required></div>
            <div class="col-md-6"><label class="form-label">Échéance cible</label><input class="form-control" name="due" type="date" value="${escapeHTML(current.due || '')}"></div>
            <div class="col-12"><label class="form-label">Action corrective / commentaire</label><textarea class="form-control" name="comment" rows="2" placeholder="Consigner une action ou un commentaire…" required></textarea></div>
          </div>` : `
          <div class="project-fact"><span>Responsable</span><strong>${escapeHTML(current.assignee || '')}</strong></div>
          <div class="project-fact"><span>Échéance</span><strong>${current.due ? shortDate(current.due) : 'Non définie'}</strong></div>`}
        <div class="mt-3"><strong>Historique de suivi</strong><p class="small text-muted mt-1">${escapeHTML(instance.note)}</p>${history.map((comment) => `<div class="border-top py-2"><span class="small fw-semibold">${escapeHTML(comment.author)}</span><span class="small text-muted ms-2">${escapeHTML(comment.date)}</span><p class="small mb-0">${escapeHTML(comment.text)}</p></div>`).join('')}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Fermer</button>
        ${canAct ? '<button class="btn btn-primary" type="submit">Enregistrer le suivi</button>' : ''}
      </div>
    </form>`);
}

function renderFatal(error) {
  console.error(error);
  app.innerHTML = `<main class="container py-5"><div class="card"><div class="card-body"><h4>Chargement impossible</h4><p class="text-muted">Le référentiel local n’a pas pu être chargé. Ouvrez l’application avec un serveur web local, puis rechargez la page.</p><pre class="small text-danger">${escapeHTML(error.message)}</pre></div></div></main>`;
}

function openProject(id) {
  if (!scopedProjectIds().has(id)) {
    appToast('Ce projet ne relève pas de votre périmètre.');
    return;
  }
  state.projectId = id;
  state.projectTab = 'overview';
  state.page = 'project';
  render();
}

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-nav], [data-project-id], [data-kpi-id], [data-alert-id], [data-rule-id], [data-project-tab], [data-alert-tab], [data-action], [data-demo-user], [data-page], [data-export], [data-map-project], [data-map-toggle], [data-conversation-id], [data-doc-preview], [data-notification-id]');
  if (!target) return;
  if (target.dataset.demoUser) {
    const account = demoAccounts.find((item) => item.username === target.dataset.demoUser);
    document.querySelector('[name="username"]').value = account.username;
    document.querySelector('[name="password"]').value = account.password;
    return;
  }
  if (target.dataset.action === 'language') {
    state.lang = state.lang === 'fr' ? 'ar' : 'fr';
    localStorage.setItem('cned-language', JSON.stringify(state.lang));
    render();
    return;
  }
  if (target.dataset.action === 'toggle-password') {
    const input = document.querySelector('#login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
    return;
  }
  if (target.dataset.action === 'forgot-password') {
    appToast('Compte de démonstration : aucun service de réinitialisation réel n’est connecté.');
    return;
  }
  if (target.dataset.action === 'mention') {
    const conversation = conversations.find((item) => item.id === state.selectedConversation);
    const participant = conversation?.participants.find((name) => name !== state.user.name);
    const input = document.querySelector('[data-form="message-send"] [name="message"]');
    if (participant && input) {
      input.value = `${input.value}${input.value ? ' ' : ''}@${participant} `;
      input.focus();
    }
    return;
  }
  if (target.dataset.action === 'show-upload') {
    showUploadModal();
    return;
  }
  if (target.dataset.action === 'mark-read') {
    state.notificationsRead = [...new Set([...state.notificationsRead, ...currentInstances().map((item) => item.id)])];
    localStorage.setItem('cned-notifications-read', JSON.stringify(state.notificationsRead));
    renderCurrentPage();
    appToast('Notifications visibles marquées comme lues.');
    return;
  }
  if (target.dataset.action === 'logout') {
    localStorage.removeItem('cned-demo-user');
    sessionStorage.removeItem('cned-demo-session');
    state.user = null;
    state.page = 'dashboard';
    render();
    return;
  }
  if (target.dataset.nav) {
    const requested = target.dataset.nav;
    if (!role().nav.includes(requested)) {
      appToast('Cette section n’est pas autorisée pour votre rôle.');
      return;
    }
    state.page = requested;
    state.projectId = null;
    state.globalSearch = '';
    render();
    return;
  }
  if (target.dataset.projectId) {
    openProject(target.dataset.projectId);
    return;
  }
  if (target.dataset.kpiId) {
    openKpiDetail(target.dataset.kpiId);
    return;
  }
  if (target.dataset.alertId) {
    openAlertDetail(target.dataset.alertId);
    return;
  }
  if (target.dataset.ruleId) {
    const rule = alertRule(target.dataset.ruleId);
    if (!rule || !rolePermission('alerts', rule.Regle_ID)) {
      appToast('Cette règle n’est pas visible selon la matrice de rôles.');
      return;
    }
    showModal(`<div class="modal-header"><div><span class="kpi-id">${escapeHTML(rule.Regle_ID)}</span><h5 class="modal-title mt-2">${escapeHTML(rule.Nom)}</h5></div><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body alert-modal-content"><div class="d-flex gap-2 mb-3">${statusPill(rule.Niveau === 'ROUGE' ? 'red' : 'orange', rule.Niveau)}${importanceBadge(rule.Importance)}<span class="badge bg-label-info">${escapeHTML(rule.Phase)}</span></div><div class="threshold-line"><span class="threshold-label">Condition</span><span>${escapeHTML(alertCondition(rule))}</span></div><div class="threshold-line"><span class="threshold-label">Logique</span><span>${escapeHTML(rule.Logique || '')}</span></div><div class="threshold-line"><span class="threshold-label">Déclencheurs</span><span>${[rule.C1_KPI_ou_champ, rule.C2_KPI_ou_champ, rule.C3_KPI_ou_champ].filter(Boolean).map(escapeHTML).join(' · ') || '—'}</span></div><div class="threshold-line"><span class="threshold-label">Destinataire</span><span>${escapeHTML(rule.Destinataire || '')} · Mon droit ${rolePermission('alerts', rule.Regle_ID)}</span></div><div class="threshold-line"><span class="threshold-label">Action / fréquence</span><span>${escapeHTML(rule.Action || '')} · ${escapeHTML(rule['Fréquence'] || '')}</span></div></div><div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Fermer</button></div>`);
    return;
  }
  if (target.dataset.projectTab) {
    state.projectTab = target.dataset.projectTab;
    renderCurrentPage();
    return;
  }
  if (target.dataset.alertTab) {
    state.alertTab = target.dataset.alertTab;
    renderCurrentPage();
    return;
  }
  if (target.dataset.page) {
    state.tablePages[target.dataset.page] = Math.max(1, (state.tablePages[target.dataset.page] || 1) + Number(target.dataset.delta));
    renderCurrentPage();
    return;
  }
  if (target.dataset.export) {
    exportData(target.dataset.export);
    return;
  }
  if (target.dataset.mapProject) {
    state.selectedMapProject = target.dataset.mapProject;
    renderCurrentPage();
    return;
  }
  if (target.hasAttribute('data-map-toggle')) {
    state.mapView = state.mapView === 'map' ? 'list' : 'map';
    renderCurrentPage();
    return;
  }
  if (target.dataset.conversationId) {
    const conversation = conversations.find((item) => item.id === target.dataset.conversationId);
    if (conversation && scopedProjectIds().has(conversation.projectId)) {
      state.selectedConversation = conversation.id;
      renderCurrentPage();
    }
    return;
  }
  if (target.dataset.docPreview) {
    const document = visibleDocuments().find((item) => item.name === target.dataset.docPreview);
    if (!document) {
      appToast('Ce document n’est pas accessible dans votre périmètre.');
      return;
    }
    showModal(`<div class="modal-header"><h5 class="modal-title">Aperçu du document</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="text-center py-4"><span class="document-type mx-auto">${escapeHTML(document.type)}</span><h6 class="mt-3">${escapeHTML(document.name)}</h6><p class="text-muted small">${escapeHTML(projectById(document.projectId)?.shortName || '')} · ${escapeHTML(document.category)} · ${shortDate(document.date)}</p><div class="alert alert-secondary text-start small mb-0">Aperçu simulé. Le prototype ne stocke ni ne transmet le contenu du fichier.</div></div></div><div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Fermer</button><button class="btn btn-primary" data-download-document="${escapeHTML(document.name)}">Télécharger l’exemple</button></div>`);
    return;
  }
  if (target.dataset.notificationId) {
    if (!state.notificationsRead.includes(target.dataset.notificationId)) {
      state.notificationsRead.push(target.dataset.notificationId);
      localStorage.setItem('cned-notifications-read', JSON.stringify(state.notificationsRead));
    }
  }
});

app.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  if (form.dataset.form === 'login') {
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');
    const account = demoAccounts.find((item) => item.username === username && item.password === password);
    if (!account) {
      renderLogin('Identifiant ou mot de passe invalide. Utilisez un compte local de démonstration.');
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.querySelector('[data-login-label]').textContent = 'Ouverture de votre espace…';
    form.querySelector('[data-login-spinner]').classList.remove('d-none');
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    state.user = account;
    if (data.get('remember')) {
      localStorage.setItem('cned-demo-user', JSON.stringify(account));
      sessionStorage.removeItem('cned-demo-session');
    } else {
      sessionStorage.setItem('cned-demo-session', JSON.stringify(account));
      localStorage.removeItem('cned-demo-user');
    }
    state.page = 'dashboard';
    render();
    return;
  }
  if (form.dataset.form === 'global-search') {
    const query = String(data.get('query') || '').trim();
    state.globalSearch = query;
    const kpiMatch = visibleKPIs().some((item) => `${item.KPI_ID} ${item.Nom_KPI}`.toLowerCase().includes(query.toLowerCase()));
    state.page = kpiMatch && !allScopedProjects().some((project) => `${project.name} ${project.id}`.toLowerCase().includes(query.toLowerCase())) ? 'kpis' : 'portfolio';
    state.projectId = null;
    render();
    return;
  }
  if (form.dataset.form === 'project-search') {
    state.globalSearch = String(data.get('query') || '').trim();
    state.projectStatus = String(data.get('status') || '');
    state.projectSort = String(data.get('sort') || 'name');
    localStorage.setItem('cned-project-status', JSON.stringify(state.projectStatus));
    localStorage.setItem('cned-project-sort', JSON.stringify(state.projectSort));
    state.tablePages.portfolio = 1;
    renderCurrentPage();
    return;
  }
  if (form.dataset.form === 'map-filters') {
    state.mapFilters = { wilaya: String(data.get('wilaya') || ''), sector: String(data.get('sector') || '') };
    localStorage.setItem('cned-map-filters', JSON.stringify(state.mapFilters));
    state.selectedMapProject = null;
    renderCurrentPage();
    return;
  }
  if (form.dataset.form === 'document-filter') {
    state.documentFilters = { query: String(data.get('document-query') || '').trim(), category: String(data.get('document-category') || '') };
    renderCurrentPage();
    return;
  }
  if (form.dataset.form === 'alert-update') {
    const id = form.dataset.alertId;
    if (!currentInstances().some((item) => item.id === id) || rolePermission('alerts', alertInstances.find((item) => item.id === id)?.ruleId) !== 'D') {
      appToast('Seul un destinataire autorisé peut mettre à jour le suivi de cette alerte.');
      closeModal();
      return;
    }
    const comment = String(data.get('comment') || '').trim();
    if (!comment) {
      form.querySelector('[name="comment"]').classList.add('is-invalid');
      appToast('Ajoutez un commentaire ou une action corrective avant l’enregistrement.');
      return;
    }
    const previous = state.alertChanges[id] || {};
    state.alertChanges[id] = {
      ...previous,
      status: String(data.get('status')),
      assignee: String(data.get('assignee')).trim(),
      due: String(data.get('due') || ''),
      comments: [...(previous.comments || []), { author: state.user.name, text: comment, date: shortDate('2026-11-13') }]
    };
    localStorage.setItem('cned-alert-changes', JSON.stringify(state.alertChanges));
    closeModal();
    render();
    appToast('Le suivi local de l’alerte a été enregistré.');
    return;
  }
  if (form.dataset.form === 'message-send') {
    const conversation = conversations.find((item) => item.id === state.selectedConversation);
    const text = String(data.get('message') || '').trim();
    if (!conversation || !text) return;
    const currentMessages = state.messages[conversation.id] || conversation.messages;
    state.messages[conversation.id] = [...currentMessages, { author: state.user.name, initials: state.user.initials, text, attachment: state.pendingMessageAttachment, time: 'À l’instant' }];
    localStorage.setItem('cned-messages', JSON.stringify(state.messages));
    state.pendingMessageAttachment = '';
    if (state.chatAttachmentPreviewUrl) URL.revokeObjectURL(state.chatAttachmentPreviewUrl);
    state.chatAttachmentPreviewUrl = '';
    renderCurrentPage();
    return;
  }
  if (form.dataset.form === 'field-report') {
    const projectId = String(data.get('projectId') || '');
    const project = projectById(projectId);
    if (!project || !scopedProjectIds().has(project.id)) {
      appToast('Sélectionnez un projet de votre périmètre.');
      return;
    }
    const report = { id: `FIELD-${Date.now()}`, projectId, author: state.user.name, date: '2026-11-13', type: String(data.get('type') || 'Visite de chantier'), progress: String(data.get('progress') || ''), note: String(data.get('note') || '').trim(), status: 'En attente de synchronisation', fileName: form.querySelector('[name="photo"]')?.files?.[0]?.name || '' };
    if (!report.note) {
      form.querySelector('[name="note"]').classList.add('is-invalid');
      appToast('Ajoutez une observation avant de transmettre le rapport.');
      return;
    }
    state.fieldReports.unshift(report);
    localStorage.setItem('cned-field-reports', JSON.stringify(state.fieldReports));
    renderCurrentPage();
    appToast('Rapport enregistré localement · synchronisation en attente.');
    return;
  }
  if (form.dataset.form === 'document-upload') {
    const file = form.querySelector('[name="file"]')?.files?.[0];
    const projectId = String(data.get('projectId') || '');
    if (!file || !scopedProjectIds().has(projectId)) {
      appToast('Choisissez un fichier et un projet autorisé.');
      return;
    }
    const item = { name: file.name, projectId, category: String(data.get('category') || 'Terrain'), type: file.name.split('.').pop().toUpperCase(), owner: state.user.name, date: '2026-11-13', version: 'v1.0', access: 'Projet', localOnly: true };
    state.localDocuments.unshift(item);
    localStorage.setItem('cned-local-documents', JSON.stringify(state.localDocuments));
    renderCurrentPage();
    appToast('Document ajouté au dossier de démonstration (métadonnées locales uniquement).');
  }
});

app.addEventListener('change', (event) => {
  const filterNames = {
    'kpi-family': 'family',
    'kpi-importance': 'importance',
    'kpi-phase': 'phase',
    'kpi-responsible': 'responsible',
    'kpi-status': 'status',
    'kpi-project': 'project',
    'kpi-reporting-date': 'reportingDate'
  };
  if (filterNames[event.target.name]) {
    state.kpiFilters[filterNames[event.target.name]] = event.target.value;
    localStorage.setItem('cned-kpi-filters', JSON.stringify(state.kpiFilters));
    renderCurrentPage();
  }
  if (event.target.matches('[name="alert-status"], [name="alert-severity"], [name="alert-query"]')) {
    state.alertFilters = {
      status: document.querySelector('[name="alert-status"]')?.value || '',
      severity: document.querySelector('[name="alert-severity"]')?.value || '',
      query: document.querySelector('[name="alert-query"]')?.value || ''
    };
    localStorage.setItem('cned-alert-filters', JSON.stringify(state.alertFilters));
    renderCurrentPage();
  }
  if (event.target.matches('[data-report-period]')) {
    state.reportPeriod = event.target.value;
    localStorage.setItem('cned-report-period', JSON.stringify(state.reportPeriod));
    renderCurrentPage();
  }
  if (event.target.matches('[name="document-category"], [name="document-query"]')) {
    state.documentFilters = {
      category: document.querySelector('[name="document-category"]')?.value || '',
      query: document.querySelector('[name="document-query"]')?.value || ''
    };
    localStorage.setItem('cned-document-filters', JSON.stringify(state.documentFilters));
    renderCurrentPage();
  }
  if (event.target.matches('[data-planning-range]')) {
    state.planningRange = event.target.value;
    appToast(`Période de planning : ${state.planningRange} · vue illustrative.`);
  }
  if (event.target.matches('[name="photo"]')) {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = document.querySelector('[data-photo-preview]');
    if (preview && file.type.startsWith('image/')) {
      if (state.photoPreviewUrl) URL.revokeObjectURL(state.photoPreviewUrl);
      state.photoPreviewUrl = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${state.photoPreviewUrl}" alt="Aperçu de la photo sélectionnée">`;
    } else if (preview) preview.textContent = file.name;
  }
  if (event.target.matches('[data-message-attachment]')) {
    const file = event.target.files?.[0];
    if (!file) return;
    state.pendingMessageAttachment = file.name;
    document.querySelector('[data-chat-attachment-label]').textContent = file.name;
    const preview = document.querySelector('[data-chat-attachment-preview]');
    if (state.chatAttachmentPreviewUrl) URL.revokeObjectURL(state.chatAttachmentPreviewUrl);
    state.chatAttachmentPreviewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    if (preview) preview.innerHTML = state.chatAttachmentPreviewUrl
      ? `<span class="photo-preview"><img src="${state.chatAttachmentPreviewUrl}" alt="Aperçu de la pièce jointe"></span>`
      : `<span class="small text-muted">${escapeHTML(file.name)} · aperçu simulé</span>`;
  }
}
);

app.addEventListener('input', (event) => {
  if (event.target.matches('[data-kpi-search]')) {
    state.globalSearch = event.target.value;
    renderCurrentPage();
    const input = document.querySelector('[data-kpi-search]');
    input?.focus();
    input?.setSelectionRange(state.globalSearch.length, state.globalSearch.length);
  }
  if (event.target.matches('[data-conversation-search]')) {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll('.conversation-item').forEach((item) => {
      item.hidden = !item.textContent.toLowerCase().includes(query);
    });
  }
});

document.addEventListener('click', (event) => {
  const download = event.target.closest('[data-download-document]');
  if (!download) return;
  const name = download.dataset.downloadDocument;
  const documentRecord = visibleDocuments().find((item) => item.name === name);
  if (!documentRecord) {
    appToast('Ce document n’est pas accessible dans votre périmètre.');
    return;
  }
  const content = `CNED DIGITAL — Exemple de téléchargement\n${documentRecord.name}\n${projectById(documentRecord.projectId)?.shortName || ''}\nDonnées de démonstration uniquement.`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name}.exemple.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
});

function exportData(type) {
  let rows = [];
  if (type === 'projects') {
    const financialAccess = canViewFinancialData();
    const headers = ['Référence', 'Projet', 'Secteur', 'Wilaya', 'Maître d’ouvrage'];
    if (financialAccess) headers.push('AE initiale (Md DA)', 'AE actuelle (Md DA)', 'Avancement financier (%)');
    headers.push('Avancement physique (%)', 'Fin contractuelle', 'État');
    rows = [headers, ...allScopedProjects().map((project) => {
      const row = [project.id, project.name, project.sector, project.wilaya, project.owner];
      if (financialAccess) row.push(project.budgetInitial, project.budgetRevised, project.financial);
      row.push(project.physical, project.end, project.status);
      return row;
    })];
  } else if (type === 'kpis') {
    const hasSnapshot = (state.kpiFilters.reportingDate || '2026-11') === '2026-11';
    const selectedProject = scopedProjectIds().has(state.kpiFilters.project) ? projectById(state.kpiFilters.project) : null;
    rows = [['KPI_ID', 'Nom_KPI', 'Importance', 'Phase', 'Valeur illustrative', 'Unité', 'Droit', 'Sens', 'Vert', 'Orange', 'Rouge'], ...visibleKPIs().map((item) => {
      const value = hasSnapshot ? valueFor(item, selectedProject) : '—';
      return [item.KPI_ID, item.Nom_KPI, item.Importance, item.Phase, formatValue(item, value), item.Unité, rolePermission('kpis', item.KPI_ID), item.Sens, item.Vert, item.Orange, item.Rouge];
    })];
  } else {
    rows = [['Type', 'Périmètre', 'Date', 'Note'], [type, role().name, '2026-11-13', 'Rapport illustratif CNED DIGITAL']];
  }
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cned-digital-${type}-illustratif.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  appToast('Export CSV généré à partir des données locales de démonstration.');
}

function start() {
  render();
}

try {
  start();
} catch (error) {
  renderFatal(error);
}
