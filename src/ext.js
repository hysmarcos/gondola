// Llamadas a la extensión que no rompen si la extensión se recargó o se actualizó.
// Cuando eso pasa, el script viejo sigue vivo en las pestañas de Coto ya abiertas, pero Chrome
// le corta el acceso: chrome.runtime.getURL y sendMessage tiran "Extension context
// invalidated". Ese error, suelto en un clic o en un repintado, aparece en la página de
// extensiones. Acá se lo atrapa: la pestaña vieja se queda sin logos ni datos nuevos hasta que
// se recarga, y no tira errores.
// api: el objeto chrome (o uno falso en los tests).

export function createExt(api) {
  return {
    // Dirección de un archivo de la extensión, o null si ya no se puede pedir.
    getURL(path) {
      try {
        return api.runtime.getURL(path);
      } catch {
        return null;
      }
    },
    // Mensaje al service worker. Si ya no se puede mandar, una promesa rechazada (no un error suelto).
    send(message) {
      try {
        return Promise.resolve(api.runtime.sendMessage(message));
      } catch (err) {
        return Promise.reject(err);
      }
    },
  };
}
