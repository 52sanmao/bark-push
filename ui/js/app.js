var invoke = window.__TAURI__.core.invoke;
var appWindow = window.__TAURI__.window.getCurrentWindow();

// ── Navigation ───────────────────────────────────────

function goTo(name, btn) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var navs = document.querySelectorAll('.nav-item');
  for (var i = 0; i < navs.length; i++) navs[i].classList.remove('active');
  var page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'history') loadHistory();
  if (name === 'devices') loadDevices();
}

// ── Title Bar ────────────────────────────────────────

document.getElementById('btn-minimize').onclick = function() { appWindow.minimize(); };
document.getElementById('btn-maximize').onclick = function() { appWindow.toggleMaximize(); };
document.getElementById('btn-close').onclick = function() { appWindow.close(); };

// ── State ────────────────────────────────────────────

var devices = [];
var selectedIds = {};
var editId = null;
var appSettings = {};

// ── Toast ────────────────────────────────────────────

function toast(msg, type) {
  type = type || 'info';
  var c = document.getElementById('toast-container');
  var d = document.createElement('div');
  d.className = 'toast ' + type;
  var icon = type === 'success' ? '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' :
    type === 'error' ? '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' :
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  d.innerHTML = icon + '<span>' + esc(msg) + '</span>';
  c.appendChild(d);
  setTimeout(function() { d.style.opacity='0'; d.style.transition='opacity 0.3s'; setTimeout(function(){d.remove();},300); }, 3000);
}

function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function fmtTime(s) { try { var d = new Date(s); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds()); } catch(e){return s;} }
function p(n) { return String(n).padStart(2,'0'); }
function clip(t) { if(navigator.clipboard) navigator.clipboard.writeText(t).catch(function(){}); }

// ── Devices ──────────────────────────────────────────

function loadDevices() {
  invoke('get_devices').then(function(r) {
    devices = r;
    renderDevices();
    renderPushDevices();
    updateFilter();
    document.getElementById('device-count').textContent = devices.length === 0 ? '暂无设备' : devices.length + ' 个设备';
  });
}

function renderDevices() {
  var el = document.getElementById('device-list');
  if (!devices.length) { el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="48" height="48"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg><h3>暂无设备</h3><p>点击上方按钮添加</p></div>'; return; }
  var h = '';
  for (var i = 0; i < devices.length; i++) {
    var d = devices[i];
    h += '<div class="device-item"><div class="device-info"><div class="device-name">' + esc(d.name) + '</div><div class="device-server">' + esc(d.server) + '</div></div><div class="device-actions">';
    h += '<button class="btn btn-ghost btn-icon btn-sm" onclick="editDevice(\'' + d.id + '\')" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
    h += '<button class="btn btn-ghost btn-icon btn-sm" onclick="rmDevice(\'' + d.id + '\')" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
    h += '</div></div>';
  }
  el.innerHTML = h;
}

function renderPushDevices() {
  var el = document.getElementById('push-device-list');
  if (!devices.length) { el.innerHTML = '<div class="empty-state" style="padding:12px"><p>暂无设备，请先<a href="#" onclick="showAddModal();return false" style="color:var(--foreground);text-decoration:underline">添加设备</a></p></div>'; return; }
  var h = '';
  for (var i = 0; i < devices.length; i++) {
    var d = devices[i];
    var sel = selectedIds[d.id] ? ' selected' : '';
    var chk = selectedIds[d.id] ? 'checked' : '';
    h += '<label class="device-chip' + sel + '"><input type="checkbox" ' + chk + ' onchange="toggleDev(\'' + d.id + '\',this.checked)"> ' + esc(d.name) + '</label>';
  }
  el.innerHTML = h;
  document.getElementById('select-all-devices').checked = Object.keys(selectedIds).length === devices.length && devices.length > 0;
}

function toggleDev(id, on) { if (on) selectedIds[id] = true; else delete selectedIds[id]; renderPushDevices(); }
function toggleAllDevices(on) { selectedIds = {}; if (on) for (var i=0;i<devices.length;i++) selectedIds[devices[i].id]=true; renderPushDevices(); }

// ── Device Modal ─────────────────────────────────────

function showAddModal() {
  editId = null;
  document.getElementById('modal-title').textContent = '添加设备';
  document.getElementById('modal-name').value = '';
  document.getElementById('modal-key').value = '';
  document.getElementById('modal-server').value = '';
  document.getElementById('modal-enc-key').value = '';
  document.getElementById('device-modal').classList.add('active');
}

function editDevice(id) {
  var d = null;
  for (var i=0;i<devices.length;i++) if(devices[i].id===id){d=devices[i];break;}
  if (!d) return;
  editId = id;
  document.getElementById('modal-title').textContent = '编辑设备';
  document.getElementById('modal-name').value = d.name;
  document.getElementById('modal-key').value = d.key;
  document.getElementById('modal-server').value = d.server;
  document.getElementById('modal-enc-key').value = d.encryption_key || '';
  document.getElementById('device-modal').classList.add('active');
}

function closeModal() { document.getElementById('device-modal').classList.remove('active'); }

function saveDevice() {
  var name = document.getElementById('modal-name').value.trim();
  var key = document.getElementById('modal-key').value.trim();
  var server = document.getElementById('modal-server').value.trim();
  var enc = document.getElementById('modal-enc-key').value.trim();
  if (!name || !key) { toast('名称和密钥不能为空', 'error'); return; }
  if (editId) {
    invoke('update_device', {id:editId, name:name, key:key, server:server, encryptionKey:enc||null}).then(function() {
      toast('设备已更新','success'); closeModal(); loadDevices();
    }).catch(function(e){toast('更新失败: '+e,'error');});
  } else {
    invoke('add_device', {name:name, key:key, server:server, encryptionKey:enc||null}).then(function() {
      toast('设备已添加','success'); closeModal(); loadDevices();
    }).catch(function(e){toast('添加失败: '+e,'error');});
  }
}

function testModalDevice() {
  var key = document.getElementById('modal-key').value.trim();
  var server = document.getElementById('modal-server').value.trim();
  if (!key) { toast('请先输入密钥','error'); return; }
  toast('正在发送测试...','info');
  invoke('test_device', {deviceKey:key, server:server}).then(function(r) {
    if(r.code===200) toast('测试成功！','success'); else toast('测试失败: '+(r.message||'未知'),'error');
  }).catch(function(e){toast('测试失败: '+e,'error');});
}

function rmDevice(id) {
  if (!confirm('确定删除此设备？')) return;
  invoke('remove_device',{id:id}).then(function(){delete selectedIds[id];toast('已删除','success');loadDevices();}).catch(function(e){toast('删除失败: '+e,'error');});
}

// ── Push ─────────────────────────────────────────────

function sendPush() {
  var ids = Object.keys(selectedIds);
  if (!ids.length) { toast('请至少选择一个设备','error'); return; }
  var body = document.getElementById('push-body').value.trim();
  if (!body) { toast('正文不能为空','error'); return; }
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

  function done() { btn.disabled=false; btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>发送推送'; }

  if (ids.length === 1) {
    invoke('send_push', {deviceId:ids[0], request:{title:title,subtitle:subtitle,body:body,ciphertext:null,url:url,group:group,icon:icon,sound:sound,call:call,level:level,copy:copy,is_archive:null,automatically_copy:null}}).then(function(r) {
      if(r.code===200){toast('发送成功！','success');if(appSettings.auto_copy!==false)clip(body);}
      else toast('发送失败: '+(r.message||'未知'),'error');
      done();
    }).catch(function(e){toast('发送失败: '+e,'error');done();});
  } else {
    invoke('send_batch_push', {request:{device_ids:ids,title:title,subtitle:subtitle,body:body,url:url,group:group,icon:icon,sound:sound,call:document.getElementById('push-call').checked?true:null,level:level,copy:copy}}).then(function(results) {
      var ok=0,fail=0;
      for(var i=0;i<results.length;i++){if(results[i].success)ok++;else fail++;}
      if(fail===0)toast('全部'+ok+'个设备发送成功！','success');else toast(ok+'成功,'+fail+'失败',fail>0?'error':'info');
      if(appSettings.auto_copy!==false)clip(body);
      done();
    }).catch(function(e){toast('发送失败: '+e,'error');done();});
  }
}

function clearPush() {
  ['push-title','push-subtitle','push-body','push-url','push-copy','push-group','push-icon'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('push-sound').value='';
  document.getElementById('push-level').value='';
  document.getElementById('push-call').checked=false;
}

// ── History ──────────────────────────────────────────

function updateFilter() {
  var sel = document.getElementById('history-filter');
  var v = sel.value;
  sel.innerHTML = '<option value="">全部设备</option>';
  for(var i=0;i<devices.length;i++) sel.innerHTML += '<option value="'+devices[i].id+'">'+esc(devices[i].name)+'</option>';
  sel.value = v;
}

function loadHistory() {
  var f = document.getElementById('history-filter').value || null;
  invoke('get_history', {deviceId:f}).then(function(h) {
    var tbody = document.getElementById('history-body');
    if(!h.length){tbody.innerHTML='<tr><td colspan="4"><div class="empty-state" style="padding:30px"><p>暂无推送记录</p></div></td></tr>';return;}
    var s = h.slice().reverse();
    var html='';
    for(var i=0;i<s.length;i++){
      var r=s[i];
      html+='<tr><td><span class="badge '+(r.success?'badge-success':'badge-destructive')+'">'+(r.success?'成功':'失败')+'</span></td>';
      html+='<td>'+esc(r.title||'-')+'</td>';
      html+='<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.body)+'</td>';
      html+='<td style="white-space:nowrap;color:var(--muted-foreground)">'+fmtTime(r.sent_at)+'</td></tr>';
    }
    tbody.innerHTML=html;
  });
}

function clearHistory() {
  if(!confirm('确定清空记录？')) return;
  var f = document.getElementById('history-filter').value || null;
  invoke('clear_history',{deviceId:f}).then(function(){loadHistory();toast('已清空','success');}).catch(function(e){toast('失败: '+e,'error');});
}

// ── Encryption ───────────────────────────────────────

function doEncrypt() {
  var t=document.getElementById('enc-plaintext').value;
  var k=document.getElementById('enc-key').value;
  if(!t||!k){toast('明文和密钥不能为空','error');return;}
  invoke('encrypt_text',{text:t,key:k}).then(function(r){
    var el=document.getElementById('enc-result');el.textContent=r;el.style.display='block';
    document.getElementById('btn-copy-enc').style.display='inline-flex';
    toast('加密成功','success');
  }).catch(function(e){toast('加密失败: '+e,'error');});
}

function copyEncResult() { clip(document.getElementById('enc-result').textContent); toast('已复制','success'); }

function doDecrypt() {
  var t=document.getElementById('dec-ciphertext').value;
  var k=document.getElementById('dec-key').value;
  if(!t||!k){toast('密文和密钥不能为空','error');return;}
  invoke('decrypt_text',{ciphertext:t,key:k}).then(function(r){
    var el=document.getElementById('dec-result');el.textContent=r;el.style.display='block';
    toast('解密成功','success');
  }).catch(function(e){toast('解密失败: '+e,'error');});
}

// ── Settings ─────────────────────────────────────────

function loadSettings() {
  invoke('get_settings').then(function(s) {
    appSettings=s;
    document.getElementById('set-server').value=s.default_server||'';
    document.getElementById('set-sound').value=s.default_sound||'';
    document.getElementById('set-level').value=s.default_level||'active';
    document.getElementById('set-group').value=s.default_group||'';
    var ac=document.getElementById('set-autocopy');
    var sh=document.getElementById('set-savehistory');
    if(s.auto_copy!==false)ac.classList.add('active');else ac.classList.remove('active');
    if(s.save_history!==false)sh.classList.add('active');else sh.classList.remove('active');
  });
}

function saveSettings() {
  var s={
    default_server:document.getElementById('set-server').value.trim()||'https://api.day.app',
    default_sound:document.getElementById('set-sound').value,
    default_level:document.getElementById('set-level').value,
    default_group:document.getElementById('set-group').value.trim(),
    auto_copy:document.getElementById('set-autocopy').classList.contains('active'),
    save_history:document.getElementById('set-savehistory').classList.contains('active'),
    theme:'dark'
  };
  invoke('update_settings',{settings:s}).then(function(){appSettings=s;toast('设置已保存','success');}).catch(function(e){toast('保存失败: '+e,'error');});
}

// ── Init ─────────────────────────────────────────────

loadDevices();
loadSettings();
