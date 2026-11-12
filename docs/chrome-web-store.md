# Publicar en la Chrome Web Store

Esta guía tiene todo para subir Góndola a la Chrome Web Store: el paquete, los textos para copiar y pegar, las imágenes y las respuestas de la pestaña de privacidad.

## 1. Antes de empezar

| Qué | Detalle |
|---|---|
| Cuenta de desarrollador | En el [panel de la Chrome Web Store](https://chrome.google.com/webstore/devconsole). Se paga una sola vez (USD 5) con tu cuenta de Google. |
| Verificación en dos pasos | Google la pide en esa cuenta para publicar. |
| Correo de contacto | Lo pide la pestaña "Cuenta" del panel. Se muestra en la ficha. |

## 2. Armar el paquete

Desde la carpeta del repositorio:

```bash
npm run package
```

El comando corre el build y arma `release/gondola-<versión>.zip`. El ZIP lleva solo lo que la extensión usa: `manifest.json`, `popup.html`, `dist/`, los CSS, los íconos, los logos de bancos y la fuente. No lleva código fuente, tests ni herramientas. Si falta un archivo que pide el manifest, el comando avisa y no arma nada.

Cada versión nueva tiene que subir el número de `version` en `manifest.json`. La tienda no acepta dos veces el mismo número.

## 3. Subir y completar la ficha

En el panel: **Elemento nuevo** (New item) → subí el ZIP. Los nombres de las pestañas pueden variar según el idioma del panel. Después completá cada pestaña.

### Pestaña "Ficha de la tienda" (Store listing)

**Nombre** (sale del manifest, máximo 75 caracteres):

```text
Góndola para Coto: diseño claro, precio por kilo, nutrición y comparador
```

**Resumen** (sale del manifest, máximo 132 caracteres):

```text
Mejora Coto Digital: diseño más claro, precio real por kilo o litro, tu banco, otros súper, información nutricional y alergias.
```

**Descripción** (copiar tal cual):

```text
Góndola mejora la web de tu supermercado. Empieza por Coto Digital.

Hace tres cosas: ordena la página con un diseño más claro, te muestra el precio real de cada producto y te dice qué tiene adentro.

En Coto, un paquete de 500 g y uno de 1 kg no se comparan a simple vista, las ofertas tienen muchas formas, no sabés si tu banco aplica y no hay tabla nutricional. Góndola agrega lo que falta para elegir bien, sin romper nada de Coto: agregar al carrito, las cantidades y el pago siguen igual.

QUÉ AGREGA
• Diseño Góndola: un diseño nuevo para la lista de productos y la página de producto. Se apaga en el popup y vuelve el de Coto.
• Ordenar por precio por kg/L: una opción nueva en "Ordenar por", en categorías y búsquedas.
• Precio real en cada producto: el precio final con la mejor oferta, el original tachado y el precio por kilo, litro o unidad.
• Tu banco: elegí tus tarjetas (con su plan, si tiene) y el día. Valen para Coto y para los otros súper. Ves el precio con la promo solo si se aplica a ese producto.
• Más barato de la categoría: una etiqueta en el producto que menos cuesta por kilo.
• Promos 2x1 y 3x2: si agregás 1 de un 2x1, suma el segundo. Se apaga en Ajustes.
• Carrito real: subtotal, descuentos de Coto, reintegro del banco con su tope y total final.
• Otros súper: busca el mismo producto por código de barras en Carrefour, Día y Más, con el link. Elegís con cuáles comparar en Ajustes. Las promos de banco de otros súper son solo de compra online; de Carrefour todavía no se pueden leer.
• Carrito comparado: en el carrito y en el mini-carrito, el total de los productos que están en los dos súper, sin envío.
• Información nutricional: en cada producto de comida, la tabla de Open Food Facts (cada 100 g, por porción y %VD), lo que rinde por proteína y por calorías, fotos del envase, ingredientes, alérgenos y NOVA.
• Sin TACC: lo que marca Coto, con un aviso si el producto menciona trigo, avena, cebada o centeno. Verificá siempre el símbolo oficial en el envase.
• Mi perfil: elegí si sos celíaco/a, si cuidás el sodio o el azúcar, y tus alergias. Cada producto te muestra lo que te importa. No es consejo médico.
• Nutrición del carrito: kcal, azúcares y sodio de toda tu compra.
• Alergias en la lista: con el diseño Góndola y tu perfil cargado, las tarjetas de comida marcan los productos que declaran tus alergias, o dicen que no hay datos. Sin etiqueta no significa que sea seguro.

PRIVACIDAD
• Sin servidores propios, sin cuentas, sin publicidad y sin analítica.
• Tus ajustes quedan en tu navegador.
• Para comparar, envía el código de barras de los productos a las búsquedas públicas de Carrefour, Día y Más. Con el carrito o el mini-carrito abierto, envía también las cantidades para simular la compra, y lee sus páginas públicas de promos. Sin cookies ni datos personales. Se apaga en Ajustes.
• Para la información nutricional, solo envía el código de barras a Open Food Facts: el del producto de comida que abrís, los de tu carrito y, con el diseño Góndola prendido y celiaquía o alguna alergia en tu perfil, los de los productos de comida de la lista que se ven en pantalla. Se apaga en Ajustes.
• Tu perfil (celíaco/a, sodio, azúcar, alergias) queda solo en tu navegador.

CÓDIGO ABIERTO
El código es abierto (licencia MIT): https://github.com/hysmarcos/gondola
Reportá errores, proponé mejoras o votá ideas desde la pestaña "Colaborá" de la extensión.

Información nutricional: Open Food Facts (ODbL). Íconos de alérgenos: Food Standards Agency del Reino Unido (Open Government Licence v3.0).

Góndola no está afiliada a Coto, Carrefour, Día ni Más. Las marcas son de sus dueños.
```

| Campo | Valor |
|---|---|
| Categoría | Compras |
| Idioma | Español (Latinoamérica) |
| Ícono de la tienda (128x128) | `assets/icon/icon-128.png` |
| Capturas (1280x800) | `docs/store/captura-1-lista.png`, `captura-2-producto.png`, `captura-3-nutricion.png`, `captura-4-comparar.png`, `captura-5-tarjetas.png` |
| Mosaico promocional chico (440x280) | `docs/store/mosaico-chico-440x280.png` |
| Mosaico de marquesina (1400x560, opcional) | `docs/store/marquesina-1400x560.png` |
| Video de YouTube (opcional) | Subí `docs/img/readme/gondola-demo.mp4` a YouTube y pegá el link |
| Sitio web oficial | `https://hysmarcos.github.io/gondola/` |
| URL de asistencia | `https://github.com/hysmarcos/gondola/issues` |

### Pestaña "Prácticas de privacidad" (Privacy practices)

**Propósito único:**

```text
Mejorar la web de compras de Coto Digital (coto.com.ar) para comparar productos antes de comprar: un diseño más claro de la lista y de la página de producto, precio por kilo o litro, promos bancarias, total real del carrito, el precio del mismo producto en otros supermercados y su información nutricional.
```

**Justificación de permisos:**

| Permiso | Justificación (copiar) |
|---|---|
| `storage` | Guarda en el navegador las tarjetas, el día de compra y los ajustes que elige el usuario. |
| Acceso a `www.coto.com.ar` (content scripts) | Agrega el precio por kilo, el orden por precio por kilo, las promos bancarias y el total real del carrito en las páginas de Coto. |
| Acceso a `www.carrefour.com.ar`, `diaonline.supermercadosdia.com.ar` y `www.masonline.com.ar` | Busca el mismo producto por código de barras en la búsqueda pública de cada súper para mostrar su precio, simula el carrito con las cantidades (solo con el carrito o el mini-carrito abierto) y lee sus páginas públicas de promos. Sin cookies ni datos personales. El usuario lo puede apagar. |
| Acceso a `world.openfoodfacts.org` | Pide la tabla nutricional por código de barras a la base abierta Open Food Facts, del producto que el usuario abre y de los productos de su carrito. Con el diseño Góndola prendido y el perfil con celiaquía o alguna alergia, también la pide para los productos de comida de la lista que se ven en pantalla, para marcarles las alergias. El usuario lo puede apagar. |

**¿Usa código remoto?** No. Todo el código va en el paquete.

**Uso de datos.** Marcá solo **Contenido del sitio web**, con esta explicación: la extensión envía el código de barras (EAN) de los productos que el usuario ve en Coto a las búsquedas públicas de Carrefour, Día y Más, para mostrar el precio del mismo producto, y las cantidades del carrito, solo con el carrito o el mini-carrito abierto, para simular la compra, además de leer sus páginas públicas de promos (sin cookies), y el de los productos de comida que abre o tiene en el carrito a Open Food Facts, para mostrar su tabla nutricional (con el diseño Góndola prendido y celiaquía o alguna alergia en el perfil, también el de los productos de comida de la lista que se ven, para marcar las alergias). No envía datos de la persona: ni nombre, ni cuenta, ni tarjetas. Del carrito, solo códigos de barras y cantidades. Todo lo demás pasa en el navegador.

Marcá las tres certificaciones:

1. No vendo ni transfiero datos de usuarios a terceros, fuera de los casos de uso aprobados.
2. No uso ni transfiero datos de usuarios para fines no relacionados con el propósito único del elemento.
3. No uso ni transfiero datos de usuarios para determinar la solvencia crediticia ni para otorgar préstamos.

**Política de privacidad:**

```text
https://hysmarcos.github.io/gondola/privacidad.html
```

### Pestaña "Distribución" (Distribution)

| Campo | Valor |
|---|---|
| Visibilidad | Pública |
| Regiones | Argentina (Coto vende solo ahí). Podés sumar todas las regiones. |
| Precio | Gratis |

### Notas para la revisión

En "Enviar para revisión" hay un campo de notas. Pegá esto:

```text
No hace falta cuenta. Para probar: abrí https://www.coto.com.ar/productos/categorias/catalogo-almac%C3%A9n-aceites-y-condimentos-aceites/catv00001264 . Cada producto muestra el precio por litro y un botón que compara con Carrefour, Día y Más. En "Ordenar por" aparece "Precio por kg/L: menor a mayor". En un producto de comida, por ejemplo https://www.coto.com.ar/productos/x/_/R-00508911-00508911-200 , aparece "Información nutricional" con datos de Open Food Facts (permiso world.openfoodfacts.org: solo se envía el código de barras; con un perfil cargado, también el de los productos de la lista que se ven). En el popup se eligen tarjetas bancarias, el día y, opcionalmente, el perfil (queda en el navegador). Código abierto: https://github.com/hysmarcos/gondola
```

## 4. Después de publicar

- La revisión suele tardar de unos días a un par de semanas.
- Cuando se publique, agregá el link de la tienda al README y al sitio.
- Para una versión nueva: subí `version` en `manifest.json`, corré `npm run package` y subí el ZIP en **Paquete → Subir paquete nuevo**.

## Cómo rehacer las imágenes

Las capturas salen de la página real de Coto, sin sesión iniciada:

```bash
node scripts/capture-readme.mjs
```

```bash
node scripts/store-media.mjs
```

Antes corré `npm run build`. El primero abre Chrome dos veces, sin Góndola y con la extensión real, y captura Coto: no toques la ventana mientras corre. El segundo arma las imágenes de la tienda con esas capturas. La animación del README la arma `node scripts/readme-media.mjs` (necesita ffmpeg).
