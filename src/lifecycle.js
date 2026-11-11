// Lo que hace el service worker fuera de buscar datos: la bienvenida al instalar
// y abrir los ajustes cuando lo pide el menú de Coto.
// api: el objeto chrome (o uno falso en los tests).

// Solo al instalar. En una actualización no se abre nada.
export function welcomeOnInstall(details, api) {
  if (details?.reason !== "install") return false;
  api.tabs.create({ url: api.runtime.getURL("welcome.html") });
  return true;
}

// Abre el popup en Ajustes. Si Chrome no deja abrirlo solo, lo abre como página.
export async function openSettings(api) {
  await api.storage.local.set({ popupTab: "ajustes" });
  try {
    await api.action.openPopup();
    return "popup";
  } catch {
    await api.tabs.create({ url: api.runtime.getURL("popup.html?page=1&tab=ajustes") });
    return "tab";
  }
}
