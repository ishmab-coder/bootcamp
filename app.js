/* ============================================================
   FORMAI — APP.JS
   All logic: fields, validation, preview, export, templates
   No AI integration yet — that comes next phase
   ============================================================ */

// ─── STATE ──────────────────────────────────────────────────
let fields = [];          // Array of field objects
let editingFieldId = null; // ID of field being edited in modal
let dragSrcIndex = null;   // For drag-and-drop reordering
let activeTab = 'builder';

// ─── FIELD STRUCTURE ────────────────────────────────────────
// Each field looks like:
// {
//   id:          'f_1234',
//   label:       'Email Address',
//   type:        'email',
//   placeholder: 'Enter your email',
//   required:    true,
//   options:     [],   // for select / radio
//   min:         null, // for number
//   max:         null
// }

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderTemplatesTab();
  initTabSwitching();
  initChatInputKeydown();
  updateFieldCount();
  setAIStatus('ready');
  autoSaveLoop();
});

// ─── TAB SWITCHING ──────────────────────────────────────────
function initTabSwitching() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      switchTab(name);
    });
  });
}

function switchTab(name) {
  activeTab = name;

  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });

  // Show/hide panels
  const builder   = document.querySelector('.app-grid');
  const exportP   = document.getElementById('exportPanel');
  const templatesP = document.getElementById('templatesPanel');

  builder.style.display    = name === 'builder'   ? 'grid'  : 'none';
  exportP.style.display    = name === 'export'    ? 'block' : 'none';
  templatesP.style.display = name === 'templates' ? 'block' : 'none';

  if (name === 'export') generateCode();
}

// ─── AI STATUS DOT ──────────────────────────────────────────
function setAIStatus(state) {
  const dot = document.getElementById('aiStatus');
  dot.className = 'status-dot ' + state;
}

// ─── CHAT ───────────────────────────────────────────────────
function initChatInputKeydown() {
  const input = document.getElementById('chatInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function usePrompt(el) {
  const text = el.textContent.replace(/["'"]/g, '').trim();
  document.getElementById('chatInput').value = text;
  document.getElementById('chatInput').focus();
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  appendChatMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  // Simulate AI thinking (placeholder until Groq API added)
  setAIStatus('loading');
  showTypingIndicator();

  setTimeout(() => {
    removeTypingIndicator();
    setAIStatus('ready');

    // Check if the message sounds like a form request
    const lower = text.toLowerCase();
    const matched = tryMatchTemplate(lower);

    if (matched) {
      appendChatMessage('ai',
        `Got it! I've loaded a <strong>${matched}</strong> for you. ` +
        `You can edit the fields in the editor panel on the right, or ask me to modify anything.`
      );
    } else {
      appendChatMessage('ai',
        `I understand you want: "<em>${text}</em>".<br><br>` +
        `AI generation coming soon! For now, you can:<br>` +
        `• Use the <strong>Templates</strong> tab to pick a starter form<br>` +
        `• Or click <strong>+ Add Field</strong> in the editor to build manually`
      );
    }
  }, 1200);
}

function tryMatchTemplate(text) {
  if (text.includes('login') || text.includes('sign in')) {
    loadTemplate('login');
    return 'Login Form';
  }
  if (text.includes('register') || text.includes('signup') || text.includes('sign up')) {
    loadTemplate('registration');
    return 'Registration Form';
  }
  if (text.includes('contact')) {
    loadTemplate('contact');
    return 'Contact Form';
  }
  if (text.includes('survey')) {
    loadTemplate('survey');
    return 'Survey Form';
  }
  if (text.includes('job') || text.includes('application')) {
    loadTemplate('job');
    return 'Job Application Form';
  }
  if (text.includes('payment') || text.includes('card')) {
    loadTemplate('payment');
    return 'Payment Form';
  }
  return null;
}

function appendChatMessage(role, html) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message message-${role}`;
  div.innerHTML = `
    <div class="message-avatar">${role === 'ai' ? 'AI' : 'You'}</div>
    <div class="message-bubble">${html}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message message-ai';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="message-bubble">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ─── FIELD MANAGEMENT ───────────────────────────────────────
function generateId() {
  return 'f_' + Math.random().toString(36).substr(2, 9);
}

function addField(fieldData) {
  fields.push({ id: generateId(), ...fieldData });
  renderEditor();
  renderPreview();
  updateFieldCount();
  saveToStorage();
}

function deleteField(id) {
  fields = fields.filter(f => f.id !== id);
  renderEditor();
  renderPreview();
  updateFieldCount();
  saveToStorage();
}

function updateField(id, newData) {
  const idx = fields.findIndex(f => f.id === id);
  if (idx !== -1) {
    fields[idx] = { ...fields[idx], ...newData };
    renderEditor();
    renderPreview();
    saveToStorage();
  }
}

function clearAllFields() {
  if (fields.length === 0) return;
  if (!confirm('Clear all fields? This cannot be undone.')) return;
  fields = [];
  renderEditor();
  renderPreview();
  updateFieldCount();
  saveToStorage();
}

function updateFormTitle(val) {
  const title = document.getElementById('formTitle');
  if (title) title.textContent = val || 'My Form';
  saveToStorage();
}

// ─── MODAL ──────────────────────────────────────────────────
function openAddFieldModal() {
  editingFieldId = null;
  document.getElementById('modalTitle').textContent = 'Add New Field';
  document.getElementById('modalSaveBtn').textContent = 'Add Field';
  clearModal();
  openModal();
}

function openEditFieldModal(id) {
  const field = fields.find(f => f.id === id);
  if (!field) return;
  editingFieldId = id;
  document.getElementById('modalTitle').textContent = 'Edit Field';
  document.getElementById('modalSaveBtn').textContent = 'Save Changes';

  document.getElementById('fieldLabel').value       = field.label || '';
  document.getElementById('fieldType').value        = field.type || 'text';
  document.getElementById('fieldPlaceholder').value = field.placeholder || '';
  document.getElementById('fieldRequired').checked  = field.required || false;
  document.getElementById('fieldOptions').value     = (field.options || []).join('\n');
  document.getElementById('fieldMin').value         = field.min || '';
  document.getElementById('fieldMax').value         = field.max || '';

  updateModalConditionals(field.type);
  openModal();
}

function clearModal() {
  document.getElementById('fieldLabel').value       = '';
  document.getElementById('fieldType').value        = 'text';
  document.getElementById('fieldPlaceholder').value = '';
  document.getElementById('fieldRequired').checked  = false;
  document.getElementById('fieldOptions').value     = '';
  document.getElementById('fieldMin').value         = '';
  document.getElementById('fieldMax').value         = '';
  updateModalConditionals('text');
}

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fieldLabel').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingFieldId = null;
}

// Show/hide conditional fields based on type
document.addEventListener('change', (e) => {
  if (e.target.id === 'fieldType') {
    updateModalConditionals(e.target.value);
  }
});

function updateModalConditionals(type) {
  const optGroup = document.getElementById('optionsGroup');
  const numGroup = document.getElementById('numberGroup');
  optGroup.style.display = (type === 'select' || type === 'radio') ? 'flex' : 'none';
  numGroup.style.display = type === 'number' ? 'flex' : 'none';
}

function saveField() {
  const label = document.getElementById('fieldLabel').value.trim();
  if (!label) {
    document.getElementById('fieldLabel').focus();
    document.getElementById('fieldLabel').style.borderColor = 'var(--error)';
    setTimeout(() => document.getElementById('fieldLabel').style.borderColor = '', 1500);
    return;
  }

  const type        = document.getElementById('fieldType').value;
  const placeholder = document.getElementById('fieldPlaceholder').value.trim();
  const required    = document.getElementById('fieldRequired').checked;
  const optionsRaw  = document.getElementById('fieldOptions').value;
  const options     = optionsRaw.split('\n').map(s => s.trim()).filter(Boolean);
  const min         = document.getElementById('fieldMin').value;
  const max         = document.getElementById('fieldMax').value;

  const data = { label, type, placeholder, required, options, min: min || null, max: max || null };

  if (editingFieldId) {
    updateField(editingFieldId, data);
  } else {
    addField(data);
  }

  closeModal();
}

// ─── RENDER EDITOR ──────────────────────────────────────────
function renderEditor() {
  const list = document.getElementById('fieldsList');

  if (fields.length === 0) {
    list.innerHTML = '<div class="fields-empty">No fields yet. Add one above or use the chat.</div>';
    return;
  }

  list.innerHTML = '';
  fields.forEach((field, index) => {
    const item = document.createElement('div');
    item.className = 'field-item';
    item.dataset.id = field.id;
    item.dataset.index = index;
    item.draggable = true;

    item.innerHTML = `
      <span class="field-drag-handle" title="Drag to reorder">⠿</span>
      <div class="field-item-info">
        <div class="field-item-label">${escapeHtml(field.label)}</div>
        <div class="field-item-meta">
          <span class="field-type-badge">${field.type}</span>
          ${field.required ? '<span class="field-required-badge">required</span>' : ''}
        </div>
      </div>
      <div class="field-item-actions">
        <button class="field-action-btn" title="Edit" onclick="openEditFieldModal('${field.id}')">✏️</button>
        <button class="field-action-btn delete" title="Delete" onclick="deleteField('${field.id}')">🗑️</button>
      </div>
    `;

    // Drag and drop events
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragover',  onDragOver);
    item.addEventListener('drop',      onDrop);
    item.addEventListener('dragend',   onDragEnd);

    list.appendChild(item);
  });
}

function updateFieldCount() {
  const el = document.getElementById('fieldCount');
  if (el) el.textContent = `${fields.length} field${fields.length !== 1 ? 's' : ''}`;
}

// ─── DRAG AND DROP ──────────────────────────────────────────
function onDragStart(e) {
  dragSrcIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.field-item').forEach(el => el.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  const targetIndex = parseInt(e.currentTarget.dataset.index);
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;

  const moved = fields.splice(dragSrcIndex, 1)[0];
  fields.splice(targetIndex, 0, moved);
  renderEditor();
  renderPreview();
  saveToStorage();
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.field-item').forEach(el => el.classList.remove('drag-over'));
  dragSrcIndex = null;
}

// ─── RENDER PREVIEW ─────────────────────────────────────────
function renderPreview() {
  const emptyState   = document.getElementById('emptyState');
  const liveForm     = document.getElementById('liveForm');
  const formFields   = document.getElementById('formFields');
  const formTitle    = document.getElementById('formTitle');

  formTitle.textContent = document.getElementById('formTitleInput').value || 'My Form';

  if (fields.length === 0) {
    emptyState.style.display = 'flex';
    liveForm.style.display   = 'none';
    return;
  }

  emptyState.style.display = 'none';
  liveForm.style.display   = 'flex';
  formFields.innerHTML = '';

  fields.forEach(field => {
    const group = document.createElement('div');
    group.className = 'field-group';
    group.dataset.fieldId = field.id;

    const labelHtml = `
      <label for="preview_${field.id}">
        ${escapeHtml(field.label)}
        ${field.required ? '<span class="required-star">*</span>' : ''}
      </label>
    `;

    let inputHtml = '';

    switch (field.type) {
      case 'textarea':
        inputHtml = `<textarea id="preview_${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}></textarea>`;
        break;

      case 'checkbox':
        inputHtml = `
          <label class="checkbox-label" for="preview_${field.id}">
            <input type="checkbox" id="preview_${field.id}" ${field.required ? 'required' : ''} />
            ${escapeHtml(field.label)}
          </label>
        `;
        group.innerHTML = inputHtml + '<div class="field-error" style="display:none;"></div>';
        formFields.appendChild(group);
        return; // skip default label

      case 'radio':
        const radioOptions = (field.options && field.options.length) ? field.options : ['Option 1', 'Option 2'];
        inputHtml = `<div class="radio-group">`;
        radioOptions.forEach((opt, i) => {
          inputHtml += `
            <label class="radio-label">
              <input type="radio" name="preview_${field.id}" value="${escapeHtml(opt)}" ${field.required && i === 0 ? 'required' : ''} />
              ${escapeHtml(opt)}
            </label>
          `;
        });
        inputHtml += '</div>';
        break;

      case 'select':
        const selectOptions = (field.options && field.options.length) ? field.options : ['Option 1', 'Option 2'];
        inputHtml = `<select id="preview_${field.id}" ${field.required ? 'required' : ''}>
          <option value="">Select an option...</option>
          ${selectOptions.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
        </select>`;
        break;

      case 'file':
        inputHtml = `<input type="file" id="preview_${field.id}" ${field.required ? 'required' : ''} />`;
        break;

      default:
        inputHtml = `
          <input
            type="${field.type}"
            id="preview_${field.id}"
            placeholder="${escapeHtml(field.placeholder || '')}"
            ${field.required ? 'required' : ''}
            ${field.min ? `min="${field.min}"` : ''}
            ${field.max ? `max="${field.max}"` : ''}
          />
        `;
    }

    group.innerHTML = labelHtml + inputHtml + '<div class="field-error" style="display:none;"></div>';
    formFields.appendChild(group);
  });
}

// ─── FORM SUBMISSION & VALIDATION ───────────────────────────
function handleSubmit(e) {
  e.preventDefault();
  const errors = validateForm();

  if (errors.length > 0) {
    showValidationToast(`Fix ${errors.length} error${errors.length > 1 ? 's' : ''} before submitting`, 'error');
    return;
  }

  const data = collectFormData();
  console.log('📋 Form Submitted:', data);
  showValidationToast('✓ Form submitted! Check the console for data.', 'success');
}

function validateForm() {
  const errors = [];

  fields.forEach(field => {
    const el = document.getElementById('preview_' + field.id);
    const errorEl = el?.closest('.field-group')?.querySelector('.field-error');

    if (!el) return;

    // Clear previous error
    el.classList.remove('error');
    if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }

    const value = el.value?.trim();

    // Required check
    if (field.required) {
      if (field.type === 'checkbox' && !el.checked) {
        markError(el, errorEl, 'This field is required');
        errors.push(field.id);
        return;
      }
      if (field.type !== 'checkbox' && !value) {
        markError(el, errorEl, 'This field is required');
        errors.push(field.id);
        return;
      }
    }

    if (!value) return; // optional empty field — skip further checks

    // Email format
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      markError(el, errorEl, 'Enter a valid email address');
      errors.push(field.id);
      return;
    }

    // Number range
    if (field.type === 'number') {
      const num = parseFloat(value);
      if (field.min && num < parseFloat(field.min)) {
        markError(el, errorEl, `Minimum value is ${field.min}`);
        errors.push(field.id);
        return;
      }
      if (field.max && num > parseFloat(field.max)) {
        markError(el, errorEl, `Maximum value is ${field.max}`);
        errors.push(field.id);
        return;
      }
    }
  });

  return errors;
}

function markError(el, errorEl, message) {
  el.classList.add('error');
  if (errorEl) {
    errorEl.textContent = '⚠ ' + message;
    errorEl.style.display = 'flex';
  }
}

function collectFormData() {
  const data = {};
  fields.forEach(field => {
    const el = document.getElementById('preview_' + field.id);
    if (!el) return;
    if (field.type === 'checkbox') {
      data[field.label] = el.checked;
    } else if (field.type === 'radio') {
      const checked = document.querySelector(`input[name="preview_${field.id}"]:checked`);
      data[field.label] = checked ? checked.value : '';
    } else {
      data[field.label] = el.value;
    }
  });
  return data;
}

function showValidationToast(message, type) {
  const toast = document.getElementById('validationToast');
  toast.textContent = message;
  toast.className = `validation-toast ${type} show`;
  setTimeout(() => toast.className = 'validation-toast', 3000);
}

// ─── PREVIEW MOBILE TOGGLE ──────────────────────────────────
function toggleMobile() {
  document.getElementById('previewWrapper').classList.add('mobile-mode');
  document.getElementById('phoneBar').style.display = 'flex';
}

function toggleDesktop() {
  document.getElementById('previewWrapper').classList.remove('mobile-mode');
  document.getElementById('phoneBar').style.display = 'none';
}

// ─── CODE EXPORT ────────────────────────────────────────────
function generateCode() {
  const title = document.getElementById('formTitleInput').value || 'MyForm';
  const componentName = title.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '') || 'MyForm';
  const code = buildReactComponent(componentName);
  document.getElementById('codeContent').textContent = code;
}

function buildReactComponent(name) {
  if (fields.length === 0) {
    return `// No fields yet — build your form first using the Builder tab`;
  }

  const stateInit = fields.map(f => {
    if (f.type === 'checkbox') return `    ${safeKey(f.label)}: false`;
    return `    ${safeKey(f.label)}: ''`;
  }).join(',\n');

  const validationRules = fields.filter(f => f.required || f.type === 'email' || f.type === 'number').map(f => {
    const key = safeKey(f.label);
    let rule = '';
    if (f.required && f.type !== 'checkbox') {
      rule += `    if (!formData.${key}) errors.${key} = '${f.label} is required';\n`;
    }
    if (f.required && f.type === 'checkbox') {
      rule += `    if (!formData.${key}) errors.${key} = 'This field is required';\n`;
    }
    if (f.type === 'email') {
      rule += `    if (formData.${key} && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.${key})) errors.${key} = 'Enter a valid email';\n`;
    }
    if (f.type === 'number' && f.min) {
      rule += `    if (formData.${key} && Number(formData.${key}) < ${f.min}) errors.${key} = 'Minimum is ${f.min}';\n`;
    }
    if (f.type === 'number' && f.max) {
      rule += `    if (formData.${key} && Number(formData.${key}) > ${f.max}) errors.${key} = 'Maximum is ${f.max}';\n`;
    }
    return rule;
  }).join('');

  const fieldJSX = fields.map(f => {
    const key = safeKey(f.label);
    const label = f.label + (f.required ? ' *' : '');

    if (f.type === 'textarea') {
      return `
      <div className="field-group">
        <label>${label}</label>
        <textarea
          value={formData.${key}}
          onChange={e => handleChange('${key}', e.target.value)}
          placeholder="${f.placeholder || ''}"
          className={errors.${key} ? 'error' : ''}
        />
        {errors.${key} && <span className="field-error">{errors.${key}}</span>}
      </div>`;
    }

    if (f.type === 'checkbox') {
      return `
      <div className="field-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.${key}}
            onChange={e => handleChange('${key}', e.target.checked)}
          />
          ${f.label}
        </label>
        {errors.${key} && <span className="field-error">{errors.${key}}</span>}
      </div>`;
    }

    if (f.type === 'select') {
      const opts = (f.options && f.options.length) ? f.options : ['Option 1', 'Option 2'];
      return `
      <div className="field-group">
        <label>${label}</label>
        <select
          value={formData.${key}}
          onChange={e => handleChange('${key}', e.target.value)}
          className={errors.${key} ? 'error' : ''}
        >
          <option value="">Select an option...</option>
          ${opts.map(o => `<option value="${o}">${o}</option>`).join('\n          ')}
        </select>
        {errors.${key} && <span className="field-error">{errors.${key}}</span>}
      </div>`;
    }

    if (f.type === 'radio') {
      const opts = (f.options && f.options.length) ? f.options : ['Option 1', 'Option 2'];
      return `
      <div className="field-group">
        <label>${label}</label>
        <div className="radio-group">
          ${opts.map(o => `
          <label className="radio-label">
            <input
              type="radio"
              name="${key}"
              value="${o}"
              checked={formData.${key} === '${o}'}
              onChange={e => handleChange('${key}', e.target.value)}
            />
            ${o}
          </label>`).join('')}
        </div>
        {errors.${key} && <span className="field-error">{errors.${key}}</span>}
      </div>`;
    }

    return `
      <div className="field-group">
        <label htmlFor="${key}">${label}</label>
        <input
          id="${key}"
          type="${f.type}"
          value={formData.${key}}
          onChange={e => handleChange('${key}', e.target.value)}
          placeholder="${f.placeholder || ''}"
          ${f.min ? `min={${f.min}}` : ''}
          ${f.max ? `max={${f.max}}` : ''}
          className={errors.${key} ? 'error' : ''}
        />
        {errors.${key} && <span className="field-error">{errors.${key}}</span>}
      </div>`;
  }).join('\n');

  return `import { useState } from 'react';

export default function ${name}() {
  const [formData, setFormData] = useState({
${stateInit}
  });

  const [errors, setErrors] = useState({});

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const errors = {};
${validationRules}
    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    console.log('Form submitted:', formData);
    // TODO: send formData to your API
  };

  return (
    <form onSubmit={handleSubmit} className="live-form">
      <h2 className="form-title">${document.getElementById('formTitleInput').value || name}</h2>
${fieldJSX}
      <button type="submit" className="btn-submit">Submit</button>
    </form>
  );
}
`;
}

function safeKey(label) {
  return label.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function copyCode() {
  const code = document.getElementById('codeContent').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showSaveToast('✓ Code copied to clipboard!', 'success');
  });
}

function downloadCode() {
  const code = document.getElementById('codeContent').textContent;
  const name = (document.getElementById('formTitleInput').value || 'MyForm')
    .replace(/\s+/g, '') + '.jsx';
  const blob = new Blob([code], { type: 'text/javascript' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  showSaveToast('⬇ Downloading ' + name, 'success');
}

// Export button in navbar
document.getElementById('exportBtn').addEventListener('click', () => {
  switchTab('export');
});

// ─── TEMPLATES ──────────────────────────────────────────────
const TEMPLATES = {
  login: {
    name: 'Login Form',
    icon: '🔐',
    desc: 'Simple sign-in with email, password, and remember me.',
    fields: [
      { label: 'Email Address', type: 'email', placeholder: 'you@example.com', required: true, options: [] },
      { label: 'Password',      type: 'password', placeholder: '••••••••',      required: true, options: [] },
      { label: 'Remember Me',   type: 'checkbox', placeholder: '',              required: false, options: [] },
    ]
  },
  registration: {
    name: 'Registration Form',
    icon: '📝',
    desc: 'Full sign-up with name, email, and password confirmation.',
    fields: [
      { label: 'Full Name',         type: 'text',     placeholder: 'John Doe',        required: true,  options: [] },
      { label: 'Email Address',     type: 'email',    placeholder: 'you@example.com', required: true,  options: [] },
      { label: 'Password',          type: 'password', placeholder: '••••••••',        required: true,  options: [] },
      { label: 'Confirm Password',  type: 'password', placeholder: '••••••••',        required: true,  options: [] },
    ]
  },
  contact: {
    name: 'Contact Form',
    icon: '✉️',
    desc: 'Name, email, subject, and a message textarea.',
    fields: [
      { label: 'Your Name',    type: 'text',     placeholder: 'John Doe',        required: true,  options: [] },
      { label: 'Email',        type: 'email',    placeholder: 'you@example.com', required: true,  options: [] },
      { label: 'Subject',      type: 'text',     placeholder: 'What is this about?', required: false, options: [] },
      { label: 'Message',      type: 'textarea', placeholder: 'Your message...', required: true,  options: [] },
    ]
  },
  survey: {
    name: 'Survey Form',
    icon: '📊',
    desc: 'Multiple choice, rating, and open comment.',
    fields: [
      { label: 'How did you hear about us?', type: 'select', placeholder: '', required: true,  options: ['Social Media', 'Friend', 'Search Engine', 'Advertisement'] },
      { label: 'Overall satisfaction',       type: 'radio',  placeholder: '', required: true,  options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'] },
      { label: 'Additional Comments',        type: 'textarea', placeholder: 'Tell us more...', required: false, options: [] },
    ]
  },
  payment: {
    name: 'Payment Form',
    icon: '💳',
    desc: 'Card number, expiry, and CVV fields.',
    fields: [
      { label: 'Cardholder Name', type: 'text',   placeholder: 'John Doe',    required: true,  options: [] },
      { label: 'Card Number',     type: 'text',   placeholder: '1234 5678 9012 3456', required: true, options: [] },
      { label: 'Expiry Date',     type: 'text',   placeholder: 'MM/YY',       required: true,  options: [] },
      { label: 'CVV',             type: 'number', placeholder: '•••',         required: true,  min: '100', max: '9999', options: [] },
    ]
  },
  job: {
    name: 'Job Application',
    icon: '💼',
    desc: 'Name, email, cover letter, and resume upload.',
    fields: [
      { label: 'Full Name',     type: 'text',     placeholder: 'John Doe',        required: true,  options: [] },
      { label: 'Email',         type: 'email',    placeholder: 'you@example.com', required: true,  options: [] },
      { label: 'Years of Experience', type: 'number', placeholder: '2', min: '0', max: '50', required: true, options: [] },
      { label: 'Cover Letter',  type: 'textarea', placeholder: 'Tell us about yourself...', required: true, options: [] },
      { label: 'Resume / CV',   type: 'file',     placeholder: '',                required: true,  options: [] },
    ]
  }
};

function renderTemplatesTab() {
  const grid = document.getElementById('templatesGrid');
  Object.entries(TEMPLATES).forEach(([key, tmpl]) => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `
      <div class="template-icon">${tmpl.icon}</div>
      <div class="template-name">${tmpl.name}</div>
      <div class="template-desc">${tmpl.desc}</div>
      <div class="template-fields">
        ${tmpl.fields.map(f => `<span class="template-field-chip">${f.label}</span>`).join('')}
      </div>
    `;
    card.addEventListener('click', () => {
      loadTemplate(key);
      switchTab('builder');
      showSaveToast(`✓ ${tmpl.name} loaded!`, 'success');
    });
    grid.appendChild(card);
  });
}

function loadTemplate(key) {
  const tmpl = TEMPLATES[key];
  if (!tmpl) return;
  fields = tmpl.fields.map(f => ({ id: generateId(), ...f }));
  document.getElementById('formTitleInput').value = tmpl.name;
  updateFormTitle(tmpl.name);
  renderEditor();
  renderPreview();
  updateFieldCount();
  saveToStorage();
  switchTab('builder');
}

// ─── SAVE & LOAD ────────────────────────────────────────────
function saveToStorage() {
  try {
    const data = {
      fields,
      title: document.getElementById('formTitleInput').value || 'My Form',
      savedAt: Date.now()
    };
    localStorage.setItem('formai_current', JSON.stringify(data));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('formai_current');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.fields) fields = data.fields;
    if (data.title) {
      document.getElementById('formTitleInput').value = data.title;
    }
    renderEditor();
    renderPreview();
    updateFieldCount();
  } catch (e) {
    console.warn('Load failed:', e);
  }
}

function autoSaveLoop() {
  setInterval(() => {
    saveToStorage();
  }, 30000); // every 30 seconds
}

// Manual save button
document.getElementById('saveBtn').addEventListener('click', () => {
  saveToStorage();
  showSaveToast('✓ Form saved!', 'success');
});

// ─── TOAST ──────────────────────────────────────────────────
function showSaveToast(message, type) {
  const toast = document.getElementById('saveToast');
  toast.textContent = message;
  toast.className = `save-toast ${type} show`;
  setTimeout(() => toast.className = 'save-toast', 2500);
}

// ─── HELPERS ────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
