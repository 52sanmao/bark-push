// Bark Push - App Logic

(function () {
  'use strict';

  const { invoke } = window.__TAURI__.core;
  const { getCurrentWindow } = window.__TAURI__.window;

  // ── State ────────────────────────────────────────────

  let devices = [];
  let selectedDeviceIds = new Set();
  let editingDeviceId = null;
  let settings = {};
  const appWindow = getCurrentWindow();

  // ── Toast ────────────────────────────────────────────

  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    var icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    toast.innerHTML = (icons[type] || icons.info) + '<span>' + escHtml(message) + '</span>';
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // ── Utilities ────────────────────────────────────────

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatTime(dateStr) {
    try {
      var d = new Date(dateStr);
      var pad = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    } catch (e) {
      return dateStr;
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  // ── Title Bar ────────────────────────────────────────

  document.getElementById('btn-minimize').addEventListener('click', function () { appWindow.minimize(); });
  document.getElementById('btn-maximize').addEventListener('click', function () { appWindow.toggleMaximize(); });
  document.getElementById('btn-close').addEventListener('click', function () { appWindow.close(); });

  // ── Navigation ───────────────────────────────────────

  function navigateTo(pageName) {
    // Update nav items
    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].classList.remove('active');
      if (navItems[i].getAttribute('data-page') === pageName) {
        navItems[i].classList.add('active');
      }
    }
    // Update pages
    var pages = document.querySelectorAll('.page');
    for (var j = 0; j < pages.length; j++) {
      pages[j].classList.remove('active');
    }
    var targetPage = document.getElementById('page-' + pageName);
    if (targetPage) {
      targetPage.classList.add('active');
    }
    // Load data for specific pages
    if (pageName === 'history') loadHistory();
    if (pageName === 'devices') loadDevices();
  }

  // Event delegation for navigation - more robust than per-element binding
  document.querySelector('.nav').addEventListener('click', function (e) {
    var btn = e.target.closest('.nav-item');
    if (btn) {
      var page = btn.getAttribute('data-page');
      if (page) navigateTo(page);
    }
  });

  // ── Devices ──────────────────────────────────────────

  function loadDevices() {
    invoke('get_devices').then(function (result) {
      devices = result;
      renderDeviceList();
      renderPushDeviceSelector();
      updateHistoryFilter();
      updateDeviceCount();
    }).catch(function (e) {
      showToast('加载设备失败: ' + e, 'error');
    });
  }

  function updateDeviceCount() {
    var el = document.getElementById('device-count');
    el.textContent = devices.length === 0 ? '暂无设备' : devices.length + ' 个设备';
  }

  function renderDeviceList() {
    var list = document.getElementById('device-list');
    if (devices.length === 0) {
      list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg><h3>暂无设备</h3><p>添加一个 Bark 设备即可开始使用</p></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < devices.length; i++) {
      var d = devices[i];
      html += '<div class="device-item" data-id="' + d.id + '">';
      html += '<div class="device-info"><div class="device-name">' + escHtml(d.name) + '</div>';
      html += '<div class="device-server">' + escHtml(d.server) + '</div></div>';
      html += '<div class="device-actions">';
      html += '<button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="' + d.id + '" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
      html += '<button class="btn btn-ghost btn-icon btn-sm" data-action="remove" data-id="' + d.id + '" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
      html += '</div></div>';
    }
    list.innerHTML = html;
  }

  // Event delegation for device list actions
  document.getElementById('device-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');
    if (action === 'edit') editDevice(id);
    else if (action === 'remove') removeDevice(id);
  });

  function renderPushDeviceSelector() {
    var container = document.getElementById('push-device-list');
    if (devices.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:12px"><p>暂无设备，请先<a href="#" id="link-add-device" style="color:var(--foreground);text-decoration:underline">添加设备</a></p></div>';
      return;
    }
    var html = '';
    var allChecked = selectedDeviceIds.size === devices.length;
    for (var i = 0; i < devices.length; i++) {
      var d = devices[i];
      var checked = selectedDeviceIds.has(d.id);
      html += '<label class="device-chip' + (checked ? ' selected' : '') + '" data-device-id="' + d.id + '">';
      html += '<input type="checkbox" ' + (checked ? 'checked' : '') + ' data-device-check="' + d.id + '">';
      html += escHtml(d.name);
      html += '</label>';
    }
    container.innerHTML = html;
    document.getElementById('select-all-devices').checked = allChecked;
  }

  // Device chip click delegation
  document.getElementById('push-device-list').addEventListener('change', function (e) {
    if (e.target.hasAttribute('data-device-check')) {
      var id = e.target.getAttribute('data-device-check');
      if (e.target.checked) selectedDeviceIds.add(id);
      else selectedDeviceIds.delete(id);
      renderPushDeviceSelector();
    }
  });

  document.getElementById('push-device-list').addEventListener('click', function (e) {
    var link = e.target.closest('#link-add-device');
    if (link) {
      e.preventDefault();
      showAddDeviceModal();
    }
  });

  document.getElementById('select-all-devices').addEventListener('change', function () {
    if (this.checked) {
      for (var i = 0; i < devices.length; i++) selectedDeviceIds.add(devices[i].id);
    } else {
      selectedDeviceIds.clear();
    }
    renderPushDeviceSelector();
  });

  // ── Device Modal ─────────────────────────────────────

  document.getElementById('btn-add-device').addEventListener('click', showAddDeviceModal);

  function showAddDeviceModal() {
    editingDeviceId = null;
    document.getElementById('modal-title').textContent = '添加设备';
    document.getElementById('modal-name').value = '';
    document.getElementById('modal-key').value = '';
    document.getElementById('modal-server').value = '';
    document.getElementById('modal-encrypt-key').value = '';
    document.getElementById('device-modal').classList.add('active');
  }

  function editDevice(id) {
    var device = null;
    for (var i = 0; i < devices.length; i++) {
      if (devices[i].id === id) { device = devices[i]; break; }
    }
    if (!device) return;
    editingDeviceId = id;
    document.getElementById('modal-title').textContent = '编辑设备';
    document.getElementById('modal-name').value = device.name;
    document.getElementById('modal-key').value = device.key;
    document.getElementById('modal-server').value = device.server;
    document.getElementById('modal-encrypt-key').value = device.encryption_key || '';
    document.getElementById('device-modal').classList.add('active');
  }

  document.getElementById('modal-cancel').addEventListener('click', function () {
    document.getElementById('device-modal').classList.remove('active');
  });

  document.getElementById('modal-save').addEventListener('click', function () {
    var name = document.getElementById('modal-name').value.trim();
    var key = document.getElementById('modal-key').value.trim();
    var server = document.getElementById('modal-server').value.trim();
    var encryptionKey = document.getElementById('modal-encrypt-key').value.trim();

    if (!name || !key) {
      showToast('名称和密钥不能为空', 'error');
      return;
    }

    if (editingDeviceId) {
      invoke('update_device', { id: editingDeviceId, name: name, key: key, server: server, encryptionKey: encryptionKey || null }).then(function () {
        showToast('设备已更新', 'success');
        document.getElementById('device-modal').classList.remove('active');
        loadDevices();
      }).catch(function (e) { showToast('更新失败: ' + e, 'error'); });
    } else {
      invoke('add_device', { name: name, key: key, server: server }).then(function () {
        if (encryptionKey) {
          invoke('get_devices').then(function (devs) {
            var newDev = devs[devs.length - 1];
            if (newDev) {
              invoke('update_device', { id: newDev.id, name: name, key: key, server: server, encryptionKey: encryptionKey }).then(function () {
                showToast('设备已添加', 'success');
                document.getElementById('device-modal').classList.remove('active');
                loadDevices();
              });
            }
          });
        } else {
          showToast('设备已添加', 'success');
          document.getElementById('device-modal').classList.remove('active');
          loadDevices();
        }
      }).catch(function (e) { showToast('添加失败: ' + e, 'error'); });
    }
  });

  document.getElementById('modal-test').addEventListener('click', function () {
    var key = document.getElementById('modal-key').value.trim();
    var server = document.getElementById('modal-server').value.trim();
    if (!key) {
      showToast('请先输入设备密钥', 'error');
      return;
    }
    showToast('正在发送测试通知...', 'info');
    invoke('test_device', { deviceKey: key, server: server }).then(function (resp) {
      if (resp.code === 200) {
        showToast('测试通知发送成功！', 'success');
      } else {
        showToast('测试失败: ' + (resp.message || '未知错误'), 'error');
      }
    }).catch(function (e) { showToast('测试失败: ' + e, 'error'); });
  });

  function removeDevice(id) {
    if (!confirm('确定删除此设备？')) return;
    invoke('remove_device', { id: id }).then(function () {
      selectedDeviceIds.delete(id);
      showToast('设备已删除', 'success');
      loadDevices();
    }).catch(function (e) { showToast('删除失败: ' + e, 'error'); });
  }

  // ── Send Push ────────────────────────────────────────

  document.getElementById('btn-send-push').addEventListener('click', function () {
    var ids = Array.from(selectedDeviceIds);
    if (ids.length === 0) {
      showToast('请至少选择一个设备', 'error');
      return;
    }

    var body = document.getElementById('push-body').value.trim();
    if (!body) {
      showToast('消息正文不能为空', 'error');
      return;
    }

    var title = document.getElementById('push-title').value.trim() || null;
    var subtitle = document.getElementById('push-subtitle').value.trim() || null;
    var url = document.getElementById('push-url').value.trim() || null;
    var copy = document.getElementById('push-copy').value.trim() || null;
    var sound = document.getElementById('push-sound').value || null;
    var level = document.getElementById('push-level').value || null;
    var group = document.getElementById('push-group').value.trim() || null;
    var icon = document.getElementById('push-icon').value.trim() || null;
    var call = document.getElementById('push-call').checked ? '1' : null;

    var btn = document.getElementById('btn-send-push');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 发送中...';

    function resetBtn() {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg> 发送推送';
    }

    if (ids.length === 1) {
      var request = { title: title, subtitle: subtitle, body: body, ciphertext: null, url: url, group: group, icon: icon, sound: sound, call: call, level: level, copy: copy, is_archive: null, automatically_copy: null };
      invoke('send_push', { deviceId: ids[0], request: request }).then(function (resp) {
        if (resp.code === 200) {
          showToast('推送发送成功！', 'success');
          if (settings.auto_copy !== false) copyToClipboard(body);
        } else {
          showToast('推送失败: ' + (resp.message || '未知错误'), 'error');
        }
        resetBtn();
      }).catch(function (e) { showToast('推送失败: ' + e, 'error'); resetBtn(); });
    } else {
      var batchReq = { device_ids: ids, title: title, subtitle: subtitle, body: body, url: url, group: group, icon: icon, sound: sound, call: document.getElementById('push-call').checked ? true : null, level: level, copy: copy };
      invoke('send_batch_push', { request: batchReq }).then(function (results) {
        var ok = 0, fail = 0;
        for (var i = 0; i < results.length; i++) {
          if (results[i].success) ok++; else fail++;
        }
        if (fail === 0) {
          showToast('全部 ' + ok + ' 个设备推送成功！', 'success');
        } else {
          showToast(ok + ' 个成功，' + fail + ' 个失败', fail > 0 ? 'error' : 'info');
        }
        if (settings.auto_copy !== false) copyToClipboard(body);
        resetBtn();
      }).catch(function (e) { showToast('推送失败: ' + e, 'error'); resetBtn(); });
    }
  });

  document.getElementById('btn-clear-push').addEventListener('click', function () {
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
    var sel = document.getElementById('history-filter');
    var currentVal = sel.value;
    sel.innerHTML = '<option value="">全部设备</option>';
    for (var i = 0; i < devices.length; i++) {
      sel.innerHTML += '<option value="' + devices[i].id + '">' + escHtml(devices[i].name) + '</option>';
    }
    sel.value = currentVal;
  }

  function loadHistory() {
    var filter = document.getElementById('history-filter').value || null;
    invoke('get_history', { deviceId: filter }).then(function (history) {
      var tbody = document.getElementById('history-body');
      if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state" style="padding:30px"><p>暂无推送记录</p></div></td></tr>';
        return;
      }
      var sorted = history.slice().reverse();
      var html = '';
      for (var i = 0; i < sorted.length; i++) {
        var h = sorted[i];
        html += '<tr>';
        html += '<td><span class="badge ' + (h.success ? 'badge-success' : 'badge-destructive') + '">' + (h.success ? '成功' : '失败') + '</span></td>';
        html += '<td>' + escHtml(h.title || '-') + '</td>';
        html += '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(h.body) + '</td>';
        html += '<td style="white-space:nowrap;color:var(--muted-foreground)">' + formatTime(h.sent_at) + '</td>';
        html += '</tr>';
      }
      tbody.innerHTML = html;
    }).catch(function (e) { showToast('加载记录失败: ' + e, 'error'); });
  }

  document.getElementById('history-filter').addEventListener('change', loadHistory);

  document.getElementById('btn-clear-history').addEventListener('click', function () {
    if (!confirm('确定清空所有推送记录？')) return;
    var filter = document.getElementById('history-filter').value || null;
    invoke('clear_history', { deviceId: filter }).then(function () {
      loadHistory();
      showToast('记录已清空', 'success');
    }).catch(function (e) { showToast('清空失败: ' + e, 'error'); });
  });

  // ── Encryption ───────────────────────────────────────

  document.getElementById('btn-encrypt').addEventListener('click', function () {
    var text = document.getElementById('enc-plaintext').value;
    var key = document.getElementById('enc-key').value;
    if (!text || !key) { showToast('明文和密钥不能为空', 'error'); return; }
    invoke('encrypt_text', { text: text, key: key }).then(function (result) {
      var el = document.getElementById('enc-result');
      el.textContent = result;
      el.style.display = 'block';
      document.getElementById('btn-copy-encrypted').style.display = 'inline-flex';
      showToast('加密成功', 'success');
    }).catch(function (e) { showToast('加密失败: ' + e, 'error'); });
  });

  document.getElementById('btn-copy-encrypted').addEventListener('click', function () {
    var text = document.getElementById('enc-result').textContent;
    copyToClipboard(text);
    showToast('已复制到剪贴板', 'success');
  });

  document.getElementById('btn-decrypt').addEventListener('click', function () {
    var ciphertext = document.getElementById('dec-ciphertext').value;
    var key = document.getElementById('dec-key').value;
    if (!ciphertext || !key) { showToast('密文和密钥不能为空', 'error'); return; }
    invoke('decrypt_text', { ciphertext: ciphertext, key: key }).then(function (result) {
      var el = document.getElementById('dec-result');
      el.textContent = result;
      el.style.display = 'block';
      showToast('解密成功', 'success');
    }).catch(function (e) { showToast('解密失败: ' + e, 'error'); });
  });

  // ── Settings ─────────────────────────────────────────

  function loadSettings() {
    invoke('get_settings').then(function (result) {
      settings = result;
      document.getElementById('set-server').value = settings.default_server || '';
      document.getElementById('set-sound').value = settings.default_sound || '';
      document.getElementById('set-level').value = settings.default_level || 'active';
      document.getElementById('set-group').value = settings.default_group || '';
      setToggle('set-autocopy', settings.auto_copy !== false);
      setToggle('set-savehistory', settings.save_history !== false);
    }).catch(function (e) { showToast('加载设置失败: ' + e, 'error'); });
  }

  document.getElementById('btn-save-settings').addEventListener('click', function () {
    var newSettings = {
      default_server: document.getElementById('set-server').value.trim() || 'https://api.day.app',
      default_sound: document.getElementById('set-sound').value,
      default_level: document.getElementById('set-level').value,
      default_group: document.getElementById('set-group').value.trim(),
      auto_copy: document.getElementById('set-autocopy').classList.contains('active'),
      save_history: document.getElementById('set-savehistory').classList.contains('active'),
      theme: settings.theme || 'dark'
    };
    invoke('update_settings', { settings: newSettings }).then(function () {
      settings = newSettings;
      showToast('设置已保存', 'success');
    }).catch(function (e) { showToast('保存失败: ' + e, 'error'); });
  });

  // Toggle handlers
  var toggles = document.querySelectorAll('.toggle');
  for (var t = 0; t < toggles.length; t++) {
    toggles[t].addEventListener('click', function () { this.classList.toggle('active'); });
  }

  function setToggle(id, value) {
    var el = document.getElementById(id);
    if (value) el.classList.add('active');
    else el.classList.remove('active');
  }

  // ── Init ─────────────────────────────────────────────

  loadDevices();
  loadSettings();

})();
