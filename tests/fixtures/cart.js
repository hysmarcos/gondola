// Carrito real (6 productos, sucursal 200), 2026-11-09, con los datos de búsqueda por PLU.
// [id, nombre, cantidad, precioLista, url, product_format, formatPrice, discountPrice, discountText, takingText]
const ROWS = [
  ["prod00579144", "Limpiador Liquido Aroma De Primavera Heroe 4l", 1, 5750.99, "_/R-00579144-00579144-200", "Litro", 1437.75, null, null, null],
  ["prod00575398", "Enjuague Bucal LISTERINE Cuidado Total Frescura Intensa X 500 Ml.", 1, 9739.99, "_/R-00575398-00575398-200", "Litro", 19479.98, "$6330.99", "35%Dto", null],
  ["prod00299912", "Jabón De Tocador DOVE Karité Y Vainilla 90 G", 3, 2738.99, "_/R-00299912-00299912-200", "Kilo", 30433.22, "$1826.08", "3x2", "Llevando 3"],
  ["prod00577935", "Bolsa Residuo Grande 60x90 Flowi 10u", 2, 2299.99, "_/R-00577935-00577935-200", "Unidad", 230, null, null, null],
  ["prod00623387", "Capellettis cuatro quesos VILLA DAGRI 1Kg", 1, 8165, "_/R-00623387-00623387-200", "Kilogramo", 8165, null, null, null],
  ["prod00608118", "Shampoo TRESEMME Keratina Antifrizz 500 Ml", 1, 11882.99, "_/R-00608118-00608118-200", "Litro", 23765.98, "$7128.61", "40%Dto", null],
];

export function searchData([id, name, , list, url, format, formatPrice, discountPrice, discountText, takingText]) {
  return {
    id, url, sku_display_name: name, product_format: format, product_format_quantity: 1,
    price: [{ store: "200", listPrice: list, formatPrice }],
    discounts: discountPrice ? [{ discountText, takingText, discountPrice }] : [],
    discounts_payment_methods: discountPrice ? [{ precioCuota: discountPrice, cantidadCuotas: "1" }] : [],
  };
}

export const CART_ROWS = ROWS;

// Entrada de analyzeCart.
export const CART_LINES = ROWS.map((r) => ({ id: r[0], name: r[1], qty: r[2], list: r[3], data: searchData(r) }));

// Respuesta de getCarrito (solo lo que usamos).
export const CARRITO_BODY = {
  output: {
    totalCarro: "6",
    montoTotal: 48355.92,
    productoItems: Object.fromEntries(ROWS.map(([id, nombre, cantidad, precioLista, url]) => [
      id,
      { cantidad, producto: { id, nombre, urlProducto: `/productos/x/${url}` }, precio: { precioLista } },
    ])),
  },
};
