// Jembatan aman renderer <-> proses utama (v2.0): halaman hanya melihat window.jakaBridge,
// tidak punya akses Node. Semua perintah robot diteruskan main.js ke proses Python robot_bridge.py.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jakaBridge', {
  start: opts => ipcRenderer.invoke('bridge:start', opts || {}),
  call: (cmd, args) => ipcRenderer.invoke('bridge:call', cmd, args || {}),
  send: (cmd, args) => ipcRenderer.send('bridge:send', cmd, args || {}),
  stop: () => ipcRenderer.invoke('bridge:stop'),
  onEvent: cb => {
    const f = (e, m) => cb(m);
    ipcRenderer.on('bridge:event', f);
    return () => ipcRenderer.removeListener('bridge:event', f);
  }
});
