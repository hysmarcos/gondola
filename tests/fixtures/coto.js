// Datos reales de la API de Coto (sucursal 200), tomados el 2026-11-09.
// Formato compacto: [url, nombre, product_format, product_format_quantity,
//   listPrice, formatPrice, discountPrice, precioCuota, cantidadCuotas]

export function row([url, name, format, qty, listPrice, formatPrice, discountPrice, precioCuota, cuotas]) {
  return {
    data: {
      url,
      sku_display_name: name,
      product_format: format ?? undefined,
      product_format_quantity: qty,
      price: [{ store: "200", listPrice, formatPrice: formatPrice ?? undefined }],
      discounts: discountPrice ? [{ discountText: "", takingText: null, discountPrice }] : [],
      discounts_payment_methods: precioCuota ? [{ precioCuota, cantidadCuotas: cuotas }] : [],
    },
  };
}

export const SORT_OPTIONS = [
  { sort_by: "relevance", display_name: "Lo más relevante", sort_order: "descending", status: "selected", hidden: false },
  { sort_by: "name", display_name: "Nombre de A a Z", sort_order: "ascending", status: "", hidden: false },
  { sort_by: "name", display_name: "Nombre de Z a A", sort_order: "descending", status: "", hidden: false },
  { sort_by: "price", display_name: "Precio: de menor a mayor", sort_order: "ascending", status: "", hidden: false },
  { sort_by: "price", display_name: "Precio: de mayor a menor", sort_order: "descending", status: "", hidden: false },
];

export const PASTAS = [
  ["_/R-00286626-00286626-200", "Ravioles Jamón y queso CIUDAD DEL LAGO 500g", "Kilo", 1, 3459, 6918, "$2588.72", "$2588.72", "1"],
  ["_/R-00012849-00012849-200", "Panzotti Pollo Verdura Jamón Coto 500g", "Kilo", 1, 9599, 13331.94, "$4798.54", "$4798.54", "1"],
  ["_/R-00568035-00568035-200", "Sorrentinos Ricota Jamón Muzzarella Ciudad Del Lago 500g", "Kilo", 1, 4589, 9178, "$3441.75", "$3441.75", "1"],
  ["_/R-00565172-00565172-200", "Ravioles Jamon Y Mozzarella La Salteña 450g", "Kilo", 1, 4550, 10111.11, null, null, null],
  ["_/R-00011731-00011731-200", "Sorrentinos Mediterráneos Coto 320g", "Kilo", 1, 5999, 18746.87, null, null, null],
  ["_/R-00044281-00044281-200", "Ravioles De Pollo Y Verdura 560g", "Kilo", 1, 9899, 17676.78, null, null, null],
  ["_/R-00217832-00217832-200", "Ravioles De Ricota Y Espinaca VILLA DAGRI 500g", "Kilo", 1, 3915, 7830, "$2738.54", "$2738.54", "1"],
  ["_/R-00634718-00634718-200", "Ravioles Rina Matarazzo Al Huevo Doble Relleno Queso 300g", "Kilo", 1, 5399, 17996.66, null, null, null],
  ["_/R-00586167-00586167-200", "Ravioles Pollo Y Verdura Amici 400g", "Kilo", 1, 2639, 6597.5, null, null, null],
  ["_/R-00256086-00256086-200", "Ravioles De Pollo Y Verdura MENDIA 500g", "Kilo", 1, 3445, 6890, null, null, null],
].map(row);

export const ACEITE = [
  ["_/R-00014076-00014076-200", "Aceite Girasol NATURA Botella 1.5 L", "Litro", 1, 7464, 4976, null, null, null],
  ["_/R-00099437-00099437-200", "Aceite Girasol CAÑUELAS Botella 1.5 L", "Litro", 1, 6990, 4660, null, null, null],
  ["_/R-00011760-00011760-200", "Aceite Girasol COCINERO Bot 1.5 Ltr", "Litro", 1, 6925, 4616.67, null, null, null],
  ["_/R-00163580-00163580-200", "Aceite Girasol NATURA Botella 900 Ml", "Litro", 1, 4715, 5238.88, null, null, null],
  ["_/R-00183553-00183553-200", "Aceite Girasol COCINERO Botella 900 Ml", "Litro", 1, 4370, 4855.55, null, null, null],
  ["_/R-00050520-00050520-200", "Aceite Girasol CAÑUELAS Botella 900 Ml", "Litro", 1, 4410, 4900, null, null, null],
  ["_/R-00179316-00179316-200", "Aceite Mezcla Cocinero Pet 900 Ml", "Litro", 1, 3465, 3850, null, null, null],
  ["_/R-00263797-00263797-200", "Aceite Girasol NATURA Rocio Vegetal Aerosol 120 Gr", "Litro", 1, 4645, 36865.07, null, null, null],
  ["_/R-00579337-00579337-200", "Aceite Fritolim Clasico 120g", "Kilo", 1, 4900, 40833.33, "$3675.00", "$3675", "1"],
  ["_/R-00011362-00011362-200", "Sal Fina CELUSAL 500g", "Kilo", 1, 1790, 3580, "$1163.50", "$1163.5", "1"],
  ["_/R-00589889-00589889-200", "Sal Fina Dos Anclas 500g", "Kilo", 1, 1561, 3122, null, null, null],
  ["_/R-00283953-00283953-200", "Aceite Oliva Virgen NATURA Aerosol 120 Gr", "Kilo", 1, 6106, 50883.33, null, null, null],
].map(row);

export const MIXTA = [
  ["_/R-00595308-00595308-200", "Playmobil Pirates Búsqueda Del Tesoro 55 Piezas", null, 0, 84989, null, null, "$28329.67", "3"],
  ["_/R-00618921-00618921-200", "Tequeños MERIDA 500g", "Kilo", 1, 19089, 38178, "$13327.94", "$13327.94", "1"],
  ["_/R-00623371-00623371-200", "Panquequera ATMA Crm025ap 650 W", null, 0, 39999, null, "$29999.25", "$3333.25", "12"],
  ["_/R-00493029-00493029-200", "Set Destornill. X6 + Buscapolo 43408109 . . .", null, 0, 10999, null, "$8249.25", "$1374.88", "6"],
  ["_/R-00143499-00143499-200", "Maquillaje Arqueador Pest Tao Cja 1 Uni", "Unidad", 1, 2724.99, 2724.99, null, null, null],
  ["_/R-00038486-00038486-200", "Anchoita Boqueron En Aceite X Kg", null, 0, 55990, null, "$44792.00", "$44792", "1"],
  ["_/R-00514044-00514044-200", "Queso Azul Clasico Bavaria Paq 125 Grm", "Kilo", 1, 6295, 50360, null, null, null],
  ["_/R-00511148-00511148-200", "Biscuits Bañado C/Choco SORIANO 20grm", "Gramos", 100, 1122.99, 5614.95, null, null, null],
  ["_/R-00081779-00081779-200", "Biscuits . H.J. Paq 130 Grm", "Kilo", 1, 3062.99, 23561.46, null, null, null],
].map(row);

export function apiBody(results, total = results.length) {
  return { response: { total_num_results: total, sort_options: structuredClone(SORT_OPTIONS), results: structuredClone(results) } };
}
