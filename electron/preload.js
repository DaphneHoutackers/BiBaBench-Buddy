import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setMenuContext: (context) => ipcRenderer.invoke('set-menu-context', context),
  onNoteFormat: (callback) => {
    const subscription = (_event, format) => callback(format);
    ipcRenderer.on('note-format', subscription);
    return () => ipcRenderer.removeListener('note-format', subscription);
  },
  onFileAction: (callback) => {
    const subscription = (_event, action) => callback(action);
    ipcRenderer.on('file-action', subscription);
    return () => ipcRenderer.removeListener('file-action', subscription);
  },
  exportNotePdf: (data) => ipcRenderer.invoke('export-note-pdf', data),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openAuthUrl: (url) => ipcRenderer.invoke('open-auth-url', url),
  consumeAuthCallback: () => ipcRenderer.invoke('consume-auth-callback'),
  onAuthCallbackAvailable: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('auth-callback-available', subscription);
    return () => ipcRenderer.removeListener('auth-callback-available', subscription);
  },
});
