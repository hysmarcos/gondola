// Promos digitales reales de Coto (getPromocionesMulticanal), 2026-11-09.
// [id, banco, icono, dias (1 = domingo), textoDescuento, descripcion, observacion]
const ROWS = [
  ["445", 49, "logo_columbia_1.png", [5], "30% DE DESCUENTO", "En un pago con tarjetas de crédito Visa y Mastercard.", "Sin tope de reintegro. Aplican exclusiones. Ver legales."],
  ["457", 5, "logo_icbc_1.png", [2], "30% DE DESCUENTO", "PLAN SUELDO En un pago con tarjetas de crédito Visa, Mastercard y Visa débito.", "Tope de Reintegro de $20.000 por transacción. Aplican exclusiones. Ver legales."],
  ["468", 0, "logo_comunidad.png", [4], "15% DE DESCUENTO", "En un pago si sos miembro de nuestra Comunidad.", "Siendo miembro de Comunidad Coto - Aplican exclusiones. Ver legales - Sin límite de reintegro."],
  ["482", 8, "logo_tci.png", [3], "20% DE DESCUENTO", "En un pago con tarjetas de crédito TCI", "Sin tope de reintegro. Aplican exclusiones. Ver legal."],
  ["456", 5, "logo_icbc_1.png", [2], "20% DE DESCUENTO", "En un pago con tarjetas de crédito Visa, Mastercard y Visa débito.", "Tope de reintegro de $15.000 por transacción. Aplican exclusiones. Ver legales."],
  ["461", 20, "logo_patagonia2.png", [5], "20% DE DESCUENTO", "En un pago con tarjetas crédito y débito Visa", "Tope de reintegro $25.000 por transacción. Aplican exclusiones. Ver legales."],
  ["465", 62, "logo_supervielle2.png", [3], "25% DE DESCUENTO", "SGTO IDENTITÉ En un pago con tarjetas de crédito Visa y Mastercard.", "Sin tope de reintegro. Aplican exclusiones. Ver legales."],
  ["464", 62, "logo_supervielle2.png", [3], "20% DE DESCUENTO", "En un pago con tarjetas de crédito Visa y Mastercard.", "Sin tope de reintegro. Aplican exclusiones. Ver legales."],
  ["440", 16, "logo_ciudad1.png", [2], "25% DE DESCUENTO", "En un pago con tarjetas de crédito Visa, Mastercard y Cabal", "Tope de reintegro $30.000. En compras en un pago. Aplica en los productos sin oferta, aplican excluidos, ver legales."],
  ["449", 35, "logo_credicoop.png", [3], "30% DE DESCUENTO", "En un pago con tarjetas de crédito Cabal y Débito Cabal", "Sin tope de reintegro. Aplican exclusiones. Ver legal"],
  ["447", 17, "logo_comafi2.png", [3], "35% DE DESCUENTO", "En un pago con tarjetas crédito y débito Visa", "Cartera general con tope de reintegro $ 15.000 por transacción, para Segmento Unico tope de reintegro $ 25.000"],
  ["477", 76, "logo_naranjax2.png", [3], "30% DE DESCUENTO", "En un pago con tarjeta de crédito Naranja X o tarjeta Débito Naranja X", "Tope de reintegro $12.000 por semana para clientes adheridos a Plan Épico de NaranjaX"],
  ["475", 76, "logo_naranjax2.png", [3], "25% DE DESCUENTO", "En un pago con tarjeta de crédito Naranja X o tarjeta Débito Naranja X", "Tope de reintegro $ 9.500 por semana para clientes adheridos a Plan Turbo de NaranjaX"],
  ["473", 76, "logo_naranjax2.png", [3], "20% DE DESCUENTO", "En un pago con tarjeta de crédito Naranja X o tarjeta Débito Naranja X", "Tope de reintegro: $3.000 por semana para clientes adheridos a planes de suscripción - Plan inicial"],
  ["500", 7, "logo_galicia.png", [2, 3, 4, 5, 6, 7, 1], "12 CUOTAS SIN INTERÉS", "3-6-9-12 cuotas sin interés con tarjetas de crédito Visa del Banco Galicia.", "Aplican exclusiones. Ver legales."],
];

export const PROMOS_RESULT = {
  promocionesDigitales: ROWS.map(([id, banco, icono, dias, textoDescuento, descripcion, observacion]) => ({
    id, banco, icono, textoDescuento, descripcion, observacion,
    dias: dias.map((d) => ({ id: d })),
  })),
  promocionesSucursalesFisicas: [],
};
