import { type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withStore } from "@/lib/server/seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/seller/orders/export — stream a CSV of every order containing
 * one of the seller's products. Browser will download it as a file
 * because we send `Content-Disposition: attachment`.
 *
 * Columns mirror what's useful for Excel / Google Sheets: order id, date,
 * status, buyer, product, qty, unit price, line subtotal, order total.
 */
export async function GET(req: NextRequest) {
  const r = await withStore(req);
  if (!r.ok) return r.response;

  const orders = await prisma.order.findMany({
    where: {
      items: { some: { productItem: { product: { storeId: r.store.storeId } } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      cart: { include: { user: { select: { username: true, email: true, firstName: true, lastName: true } } } },
      items: {
        include: {
          productItem: {
            include: { product: { select: { storeId: true, name: true } } },
          },
        },
      },
    },
  });

  const header = [
    "order_id",
    "order_date",
    "order_status",
    "order_total",
    "buyer_username",
    "buyer_name",
    "buyer_email",
    "product_name",
    "delivery_method",
    "quantity",
    "unit_price",
    "line_subtotal",
  ];
  const rows: string[] = [header.join(",")];

  for (const o of orders) {
    for (const li of o.items) {
      // Skip lines that aren't this seller's — the order may contain
      // multi-store items.
      if (li.productItem.product.storeId !== r.store.storeId) continue;
      const subtotal = Number(li.priceAtPurchase) * li.quantity;
      const cells = [
        o.orderId,
        o.createdAt.toISOString(),
        o.status,
        Number(o.totalPrice).toFixed(2),
        o.cart.user.username,
        `${o.cart.user.firstName} ${o.cart.user.lastName}`.trim(),
        o.cart.user.email,
        li.productItem.product.name,
        li.productItem.deliveryMethod,
        li.quantity,
        Number(li.priceAtPurchase).toFixed(2),
        subtotal.toFixed(2),
      ];
      rows.push(cells.map(escapeCsv).join(","));
    }
  }

  const body = rows.join("\n");
  const filename = `metu-orders-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Minimal CSV escape — wraps the cell in double quotes if it contains
 *  a comma, quote, or newline; doubles up any internal quotes. */
function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
