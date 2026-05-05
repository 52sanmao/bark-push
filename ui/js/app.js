const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

// ── State ────────────────────────────────────────────

let devices = [];
let selectedDeviceIds = new Set();
let editingDeviceId = null;
let settings = {};

// ── Tauri Window Controls ────────────────────────────

const appWindow = getCurrentWindow();

document.getElementById('btn-minimize').addEventListener('click', () => appWindow.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => appWindow.toggleMaximize());
document.getElementById('btn-close').addEventListener('click', () => appWindow.close());

// ── Navigation ───────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + item.dataset.page).classList.add('active');
    if (item.dataset.page === 'history') loadHistory();
  });
});

// ── Toast ────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Devices ──────────────────────────────────────────

async function loadDevices() {
  try {
    devices = await invoke('get_devices');
    renderDeviceList();
    renderPushDeviceSelector();
    updateHistoryFilter();
    updateDeviceCount();
  } catch (e) {
    showToast('Failed to load devices: ' + e, 'error');
  }
}

function updateDeviceCount() {
  const el = document.getElementById('device-count');
  el.textContent = devices.length === 0 ? 'No devices' : `${devices.length} device${devices.length > 1 ? 's' : ''}`;
}

function renderDeviceList() {
  const list = document.getElementById('device-list');
  if (devices.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      <h3>No devices</h3>
      <p>Add a Bark device to get started</p>
    </div>`;
    return;
  }
  list.innerHTML = devices.map(d => `
    <div class="device-item" data-id="${d.id}">
      <div class="device-info">
        <div class="device-name">${escHtml(d.name)}</div>
        <div class="device-server">${escHtml(d.server)}</div>
      </div>
      <div class="device-actions">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="editDevice('${d.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="removeDevice('${d.id}')" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function renderPushDeviceSelector() {
  const container = document.getElementById('push-device-list');
  if (devices.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No devices configured. <a href="#" onclick="showAddDeviceModal();return false" style="color:var(--foreground)">Add a device</a> first.</p></div>';
    return;
  }
  container.innerHTML = devices.map(d => {
    const checked = selectedDeviceIds.has(d.id) ? 'checked' : '';
    return `<label class="device-chip ${checked ? 'selected' : ''}" data-id="${d.id}">
      <input type="checkbox" ${checked} onchange="toggleDevice('${d.id}', this.checked)">
      ${escHtml(d.name)}
    </label>`;
  }).join('');
}

function toggleDevice(id, checked) {
  if (checked) selectedDeviceIds.add(id);
  else selectedDeviceIds.delete(id);
  renderPushDeviceSelector();
  document.getElementById('select-all-devices').checked = selectedDeviceIds.size === devices.length;
}

document.getElementById('select-all-devices').addEventListener('change', function () {
  if (this.checked) {
    devices.forEach(d => selectedDeviceIds.add(d.id));
  } else {
    selectedDeviceIds.clear();
  }
  renderPushDeviceSelector();
});

// ── Device Modal ─────────────────────────────────────

document.getElementById('btn-add-device').addEventListener('click', showAddDeviceModal);

function showAddDeviceModal() {
  editingDeviceId = null;
  document.getElementById('modal-title').textContent = 'Add Device';
  document.getElementById('modal-name').value = '';
  document.getElementById('modal-key').value = '';
  document.getElementById('modal-server').value = '';
  document.getElementById('modal-encrypt-key').value = '';
  document.getElementById('device-modal').classList.add('active');
}

function editDevice(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;
  editingDeviceId = id;
  document.getElementById('modal-title').textContent = 'Edit Device';
  document.getElementById('modal-name').value = device.name;
  document.getElementById('modal-key').value = device.key;
  document.getElementById('modal-server').value = device.server;
  document.getElementById('modal-encrypt-key').value = device.encryption_key || '';
  document.getElementById('device-modal').classList.add('active');
}

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('device-modal').classList.remove('active');
});

document.getElementById('modal-save').addEventListener('click', async () => {
  const name = document.getElementById('modal-name').value.trim();
  const key = document.getElementById('modal-key').value.trim();
  const server = document.getElementById('modal-server').value.trim();
  const encryptionKey = document.getElementById('modal-encrypt-key').value.trim();

  if (!name || !key) {
    showToast('Name and key are required', 'error');
    return;
  }

  try {
    if (editingDeviceId) {
      await invoke('update_device', { id: editingDeviceId, name, key, server, encryptionKey: encryptionKey || null });
      showToast('Device updated', 'success');
    } else {
      await invoke('add_device', { name, key, server });
      if (encryptionKey) {
        const devs = await invoke('get_devices');
        const newDev = devs[devs.length - 1];
        if (newDev) {
          await invoke('update_device', { id: newDev.id, name, key, server, encryptionKey });
        }
      }
      showToast('Device added', 'success');
    }
    document.getElementById('device-modal').classList.remove('active');
    await loadDevices();
  } catch (e) {
    showToast('Error: ' + e, 'error');
  }
});

document.getElementById('modal-test').addEventListener('click', async () => {
  const key = document.getElementById('modal-key').value.trim();
  const server = document.getElementById('modal-server').value.trim();
  if (!key) {
    showToast('Enter a device key first', 'error');
    return;
  }
  try {
    showToast('Sending test notification...', 'info');
    const resp = await invoke('test_device', { deviceKey: key, server });
    if (resp.code === 200) {
      showToast('Test notification sent successfully!', 'success');
    } else {
      showToast('Test failed: ' + (resp.message || 'Unknown error'), 'error');
    }
  } catch (e) {
    showToast('Test failed: ' + e, 'error');
  }
});

async function removeDevice(id) {
  if (!confirm('Remove this device?')) return;
  try {
    await invoke('remove_device', { id });
    selectedDeviceIds.delete(id);
    showToast('Device removed', 'success');
    await loadDevices();
  } catch (e) {
    showToast('Error: ' + e, 'error');
  }
}

// ── Send Push ────────────────────────────────────────

document.getElementById('btn-send-push').addEventListener('click', async () => {
  const ids = Array.from(selectedDeviceIds);
  if (ids.length === 0) {
    showToast('Select at least one device', 'error');
    return;
  }

  const body = document.getElementById('push-body').value.trim();
  if (!body) {
    showToast('Message body is required', 'error');
    return;
  }

  const title = document.getElementById('push-title').value.trim() || null;
  const subtitle = document.getElementById('push-subtitle').value.trim() || null;
  const url = document.getElementById('push-url').value.trim() || null;
  const copy = document.getElementById('push-copy').value.trim() || null;
  const sound = document.getElementById('push-sound').value || null;
  const level = document.getElementById('push-level').value || null;
  const group = document.getElementById('push-group').value.trim() || null;
  const icon = document.getElementById('push-icon').value.trim() || null;
  const call = document.getElementById('push-call').checked ? '1' : null;

  const btn = document.getElementById('btn-send-push');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending...';

  try {
    if (ids.length === 1) {
      const request = { title, subtitle, body, ciphertext: null, url, group, icon, sound, call, level, copy, is_archive: null, automatically_copy: null };
      const resp = await invoke('send_push', { deviceId: ids[0], request });
      if (resp.code === 200) {
        showToast('Push sent successfully!', 'success');
        if (settings.auto_copy) copyToClipboard(body);
      } else {
        showToast('Push failed: ' + (resp.message || 'Unknown'), 'error');
      }
    } else {
      // Batch push
      const results = await invoke('send_batch_push', {
        request: { device_ids: ids, title, subtitle, body, url, group, icon, sound, call: document.getElementById('push-call').checked ? true : null, level, copy }
      });
      const ok = results.filter(r => r.success).length;
      const fail = results.filter(r => !r.success).length;
      if (fail === 0) {
        showToast(`All ${ok} pushes sent!`, 'success');
      } else {
        showToast(`${ok} sent, ${fail} failed`, fail > 0 ? 'error' : 'info');
      }
      if (settings.auto_copy) copyToClipboard(body);
    }
  } catch (e) {
    showToast('Push failed: ' + e, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg> Send Push';
  }
});

document.getElementById('btn-clear-push').addEventListener('click', () => {
  document.getElementById('push-title').value = '';
  document.getElementById('push-subtitle').value = '';
  document.getElementById('push-body').value = '';
  document.getElementById('push-url').value = '';
  document.getElementById('push-copy').value = '';
  document.getElementById('push-sound').value = '';
  document.getElementById('push-level').value = '';
  document.getElementById('push-group').value = '';
  document.getElementById('push-icon').value = '';
  document.getElementById('push-call').checked = false;
});

// ── History ──────────────────────────────────────────

function updateHistoryFilter() {
  const sel = document.getElementById('history-filter');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">All devices</option>';
  devices.forEach(d => {
    sel.innerHTML += `<option value="${d.id}">${escHtml(d.name)}</option>`;
  });
  sel.value = currentVal;
}

async function loadHistory() {
  try {
    const filter = document.getElementById('history-filter').value || null;
    const history = await invoke('get_history', { deviceId: filter });
    const tbody = document.getElementById('history-body');
    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state" style="padding:30px"><p>No push history</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = history.reverse().map(h => `
      <tr>
        <td><span class="badge ${h.success ? 'badge-success' : 'badge-destructive'}">${h.success ? 'OK' : 'Fail'}</span></td>
        <td>${escHtml(h.title || '-')}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(h.body)}</td>
        <td style="white-space:nowrap;color:var(--muted-foreground)">${formatTime(h.sent_at)}</td>
      </tr>
    `).join('');
  } catch (e) {
    showToast('Failed to load history: ' + e, 'error');
  }
}

document.getElementById('history-filter').addEventListener('change', loadHistory);

document.getElementById('btn-clear-history').addEventListener('click', async () => {
  if (!confirm('Clear all push history?')) return;
  try {
    const filter = document.getElementById('history-filter').value || null;
    await invoke('clear_history', { deviceId: filter });
    await loadHistory();
    showToast('History cleared', 'success');
  } catch (e) {
    showToast('Error: ' + e, 'error');
  }
});

// ── Encryption ───────────────────────────────────────

document.getElementById('btn-encrypt').addEventListener('click', async () => {
  const text = document.getElementById('enc-plaintext').value;
  const key = document.getElementById('enc-key').value;
  if (!text || !key) {
    showToast('Both text and key are required', 'error');
    return;
  }
  try {
    const result = await invoke('encrypt_text', { text, key });
    const el = document.getElementById('enc-result');
    el.textContent = result;
    el.style.display = 'block';
    document.getElementById('btn-copy-encrypted').style.display = 'inline-flex';
    showToast('Encrypted successfully', 'success');
  } catch (e) {
    showToast('Encryption failed: ' + e, 'error');
  }
});

document.getElementById('btn-copy-encrypted').addEventListener('click', () => {
  const text = document.getElementById('enc-result').textContent;
  copyToClipboard(text);
  showToast('Copied to clipboard', 'success');
});

document.getElementById('btn-decrypt').addEventListener('click', async () => {
  const ciphertext = document.getElementById('dec-ciphertext').value;
  const key = document.getElementById('dec-key').value;
  if (!ciphertext || !key) {
    showToast('Both ciphertext and key are required', 'error');
    return;
  }
  try {
    const result = await invoke('decrypt_text', { ciphertext, key });
    const el = document.getElementById('dec-result');
    el.textContent = result;
    el.style.display = 'block';
    showToast('Decrypted successfully', 'success');
  } catch (e) {
    showToast('Decryption failed: ' + e, 'error');
  }
});

// ── Settings ─────────────────────────────────────────

async function loadSettings() {
  try {
    settings = await invoke('get_settings');
    document.getElementById('set-server').value = settings.default_server || '';
    document.getElementById('set-sound').value = settings.default_sound || '';
    document.getElementById('set-level').value = settings.default_level || 'active';
    document.getElementById('set-group').value = settings.default_group || '';
    setToggle('set-autocopy', settings.auto_copy !== false);
    setToggle('set-savehistory', settings.save_history !== false);
  } catch (e) {
    showToast('Failed to load settings: ' + e, 'error');
  }
}

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const newSettings = {
    default_server: document.getElementById('set-server').value.trim() || 'https://api.day.app',
    default_sound: document.getElementById('set-sound').value,
    default_level: document.getElementById('set-level').value,
    default_group: document.getElementById('set-group').value.trim(),
    auto_copy: document.getElementById('set-autocopy').classList.contains('active'),
    save_history: document.getElementById('set-savehistory').classList.contains('active'),
    theme: settings.theme || 'dark',
  };
  try {
    await invoke('update_settings', { settings: newSettings });
    settings = newSettings;
    showToast('Settings saved', 'success');
  } catch (e) {
    showToast('Error: ' + e, 'error');
  }
});

document.querySelectorAll('.toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
  });
});

function setToggle(id, value) {
  const el = document.getElementById(id);
  if (value) el.classList.add('active');
  else el.classList.remove('active');
}

// ── Utilities ────────────────────────────────────────

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatTime(dateStr) {
  try {
    const d = new Date(dateStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return dateStr;
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

// ── Init ─────────────────────────────────────────────

(async function init() {
  await loadDevices();
  await loadSettings();
})();
