// Starlight Café – saving and loading, and asset lookup.
// Inside PortD: saves to P:\User\Config\<program id>\save.json and loads art from PortD.assets.
// Outside PortD (opened straight from disk): uses localStorage when the browser allows it.
window.SC = window.SC || {};

SC.inPortD = typeof window.PortD === 'object' && window.PortD !== null;

SC.asset = function (path) {
  if (SC.inPortD && PortD.assets && PortD.assets[path]) return PortD.assets[path];
  return path; // relative path works when the folder is opened directly
};

SC.storage = {
  key: 'starlight-cafe-save',
  async load() {
    try {
      if (SC.inPortD) return (await PortD.fs.exists('save.json')) ? JSON.parse(Host.decode(await PortD.fs.read('save.json'))) : null;
      const t = localStorage.getItem(this.key);
      return t ? JSON.parse(t) : null;
    } catch (e) { return null; }
  },
  async save(state) {
    const text = JSON.stringify(state);
    try {
      if (SC.inPortD) await PortD.fs.write('save.json', text);
      else localStorage.setItem(this.key, text);
      return true;
    } catch (e) { return false; }
  },
  async wipe() {
    try {
      if (SC.inPortD) await PortD.fs.remove('save.json');
      else localStorage.removeItem(this.key);
    } catch (e) {}
  }
};
