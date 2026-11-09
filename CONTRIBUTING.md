# Cómo colaborar

Góndola mejora la web de cada supermercado. Las mejores ideas vienen de la gente que compra todas las semanas, así que cualquier aporte suma: un error, una idea, un voto o código.

No hace falta saber programar.

## Cinco formas de ayudar

| Forma | Cómo | Tiempo |
|---|---|---|
| Reportar un error | Formulario [Reportar un error](https://github.com/hysmarcos/gondola/issues/new?template=reportar-error.yml) | 3 minutos |
| Proponer una mejora | Formulario [Proponer una mejora](https://github.com/hysmarcos/gondola/issues/new?template=proponer-mejora.yml) | 5 minutos |
| Pedir otro súper | Formulario [Pedir otro súper](https://github.com/hysmarcos/gondola/issues/new?template=pedir-super.yml) | 2 minutos |
| Votar | Sumá 👍 a las [ideas](https://github.com/hysmarcos/gondola/issues?q=is%3Aopen+label%3Amejora+sort%3Areactions-%2B1-desc) y a los [súper pedidos](https://github.com/hysmarcos/gondola/issues?q=is%3Aopen+label%3Anuevo-super+sort%3Areactions-%2B1-desc) que querés primero | 10 segundos |
| Mandar código | Un pull request. Mirá [Mandar código](#mandar-código). | Lo que quieras |

También podés abrir los formularios desde la extensión: popup → pestaña **Colaborá**. Así la versión ya viene completa.

Para abrir un issue o votar necesitás una cuenta de GitHub, que es gratis.

## Cómo se elige qué se hace primero

1. **Errores que dan un precio falso.** Van antes que todo. Un número equivocado es peor que ningún número.
2. **Errores que rompen algo de Coto.** Agregar, cantidades, carrito o pago tienen que andar siempre.
3. **Ideas y súper con más 👍.** Los votos ordenan la lista. Por eso conviene votar en vez de abrir un pedido repetido.

Cada issue tiene una etiqueta:

| Etiqueta | Qué significa |
|---|---|
| `error` | Algo no anda o muestra un dato equivocado |
| `mejora` | Idea de función nueva o de diseño |
| `nuevo-super` | Pedido para sumar un supermercado |
| `buena-primera-tarea` | Tarea chica y clara, buena para un primer pull request |
| `ayuda-buscada` | Necesitamos a alguien que la tome |

## Reconocimiento

Toda persona que aporta aparece en la sección [Gracias](README.md#gracias) del README: los que mandan código, y también los que reportan errores o proponen ideas que se hacen. Cada versión nombra en sus notas los issues y los pull requests que incluye.

## Mandar código

Necesitás Node 24 y Chrome.

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

Para probar en Chrome, abrí `chrome://extensions`, activá **Modo de desarrollador**, tocá **Cargar descomprimida** y elegí la carpeta del repositorio.

### Reglas

- **Primero el test.** Cada cambio trae un test que falla sin el cambio y pasa con él. Los tests están en `tests/` y usan Vitest.
- **Coto sigue funcionando.** La extensión agrega elementos y los oculta con un atributo. Nunca borra nodos ni cambia cómo funciona la web.
- **Ante la duda, no mostrar.** Si un dato no cierra, no se muestra. Un precio falso es el peor error.
- **Sin servidores ni datos personales.** No agregues servidores, analítica ni permisos nuevos sin hablarlo antes en un issue. Los tests no llevan datos personales.
- **Español simple.** Los textos de la extensión van en español de Argentina, cortos y claros.
- **Un tema por pull request.** Es más fácil de revisar y de deshacer.

### Dónde está cada cosa

| Si querés cambiar... | Mirá |
|---|---|
| Cómo se calcula el precio por unidad | `src/unit-price.js`, `src/size.js`, `src/paper.js` |
| Promos bancarias | `src/banks.js`, `src/exclusions.js` |
| Promos 2x1 y 3x2 | `src/promo.js`, `src/promo-clicks.js`, `src/promo-ui.js` |
| Carrito | `src/cart.js`, `src/cart-summary.js`, `src/cart-ui.js` |
| Comparación con otros súper | `src/stores.js`, `src/vtex.js`, `src/compare-*.js` |
| Tarjetas de producto | `src/badge.js`, `src/badge.css` |
| Popup | `src/popup.js`, `src/popup.css` |

Los diseños de cada versión están en `docs/superpowers/specs/`. Leelos antes de un cambio grande.

## Seguridad

Si encontrás un problema de seguridad, no abras un issue público. Reportalo en privado desde [Security → Report a vulnerability](https://github.com/hysmarcos/gondola/security/advisories/new).

---

# Contributing (English summary)

Góndola upgrades each supermarket's website. Any help counts, and you do not need to code.

**Five ways to help**

1. **Report a bug** with the [bug form](https://github.com/hysmarcos/gondola/issues/new?template=reportar-error.yml).
2. **Suggest an improvement** with the [idea form](https://github.com/hysmarcos/gondola/issues/new?template=proponer-mejora.yml).
3. **Request another store** with the [store form](https://github.com/hysmarcos/gondola/issues/new?template=pedir-super.yml).
4. **Vote** with a 👍 on the [ideas](https://github.com/hysmarcos/gondola/issues?q=is%3Aopen+label%3Amejora+sort%3Areactions-%2B1-desc) you want first.
5. **Send code** in a pull request.

You can also open the forms from the extension popup, in the **Colaborá** tab.

**Priorities:** first, bugs that show a wrong price. Then, bugs that break Coto. Then, ideas and stores with the most 👍.

**Credit:** everyone who contributes code, bug reports or ideas that ship is listed in the README's [Gracias](README.md#gracias) section and in the release notes.

**Code rules:** test first (Vitest). Never remove or break Coto's own elements. If a value does not add up, show nothing. No servers, analytics or new permissions without an issue first. UI copy in plain Argentine Spanish. One topic per pull request.

**Security:** do not open a public issue. Report it privately from [Security → Report a vulnerability](https://github.com/hysmarcos/gondola/security/advisories/new).
