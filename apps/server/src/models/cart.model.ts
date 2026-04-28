/**
 * Cart data contracts.
 *
 * Request schemas come from `@metu/shared` so the BFF form components
 * AND the API parse with the same zod definition.
 */
export {
  addToCartSchema,
  updateCartItemSchema,
  type AddToCartInput,
  type UpdateCartItemInput,
} from "@metu/shared";

export interface CartLine {
  cartItemId: number;
  productItemId: number;
  productId: number;
  productName: string;
  storeId: number;
  storeName: string;
  image: string | null;
  deliveryMethod: string;
  /**
   * Stock snapshot so the cart UI can cap the quantity input. Digital
   * delivery methods are always capped at 1 client-side regardless of
   * this value.
   */
  stock: number;
  unitPrice: number;
  basePrice: number;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
}

export interface CartResponse {
  cartId: number;
  items: CartLine[];
  subtotal: number;
}
