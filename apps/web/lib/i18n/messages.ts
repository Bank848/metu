/**
 * Scoped TH/EN dictionaries — covers TopNav, footer, cart, login/register,
 * empty states, and a couple of high-traffic CTAs. Everything else stays
 * English (the brand voice is English-first; Thai is a Phase 1 add for
 * Bangkok visitors browsing on mobile).
 *
 * The dictionary is a flat record keyed by dot-paths so every consumer
 * does the same `t("nav.cart")` lookup — no nesting, no per-page JSON.
 */

export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  th: "ไทย",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  th: "🇹🇭",
};

export type Messages = Record<string, string>;

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    // Top navigation
    "nav.search.placeholder": "Search products, stores, tags…",
    "nav.cart": "Cart",
    "nav.favorites": "Favourites",
    "nav.reviews": "My reviews",
    "nav.topRated": "Top rated",
    "nav.messages": "Messages",
    "nav.admin": "Admin",
    "nav.dashboard": "Dashboard",
    "nav.addStore": "+ Add Store",
    "nav.becomeSeller": "Become a seller",

    // Auth
    "auth.login": "Log in",
    "auth.register": "Sign up",
    "auth.logout": "Log out",
    "auth.profile": "Profile",
    "auth.email": "Email",
    "auth.password": "Password",

    // Messaging
    "messages.empty.title": "No conversations yet",
    "messages.empty.description": "Reach out to a store from any product or order page.",
    "messages.compose.placeholder": "Type your message…",
    "messages.cta.messageStore": "Message store",
    "messages.cta.askSeller": "Ask the seller",
    "messages.context.about": "About: {name}",
    "messages.context.order": "Order #{id}",

    // Cart
    "cart.title": "Your cart",
    "cart.subtitle": "Review your items and apply a coupon before checking out.",
    "cart.empty.title": "Your cart is empty",
    "cart.empty.description": "Pick something from the marketplace to get started.",
    "cart.empty.cta": "Browse marketplace",
    "cart.subtotal": "Subtotal",
    "cart.discount": "Discount",
    "cart.total": "Total",
    "cart.checkout": "Checkout",
    "cart.couponCode": "Coupon code",
    "cart.applyCoupon": "Apply",
    "cart.removeItem": "Remove",
    "cart.saveForLater": "Save for later",

    // Footer
    "footer.tagline": "Digital marketplace for Thai creators.",
    "footer.about": "About",
    "footer.help": "Help",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
    "footer.copyright": "© {year} METU. All rights reserved.",

    // Empty states (most-visited)
    "empty.noResults": "No results found",
    "empty.tryAgain": "Try a different search.",
    "empty.audit.title": "No moderation events yet",
    "empty.audit.description":
      "Destructive admin and seller actions (review deletes, refunds, role changes) will appear here as they happen.",
    "empty.responseTime": "New seller — no response data yet",
    "empty.avgRating": "No ratings yet",
  },
  th: {
    // Top navigation
    "nav.search.placeholder": "ค้นหาสินค้า ร้านค้า แท็ก…",
    "nav.cart": "ตะกร้า",
    "nav.favorites": "รายการโปรด",
    "nav.reviews": "รีวิวของฉัน",
    "nav.topRated": "เรตติ้งสูงสุด",
    "nav.messages": "ข้อความ",
    "nav.admin": "แอดมิน",
    "nav.dashboard": "แดชบอร์ด",
    "nav.addStore": "+ เปิดร้าน",
    "nav.becomeSeller": "เป็นผู้ขาย",

    // Auth
    "auth.login": "เข้าสู่ระบบ",
    "auth.register": "สมัครสมาชิก",
    "auth.logout": "ออกจากระบบ",
    "auth.profile": "โปรไฟล์",
    "auth.email": "อีเมล",
    "auth.password": "รหัสผ่าน",

    // Messaging
    "messages.empty.title": "ยังไม่มีบทสนทนา",
    "messages.empty.description": "เริ่มต้นส่งข้อความถึงร้านได้จากหน้าสินค้าหรือออเดอร์",
    "messages.compose.placeholder": "พิมพ์ข้อความ…",
    "messages.cta.messageStore": "ส่งข้อความถึงร้าน",
    "messages.cta.askSeller": "ถามผู้ขาย",
    "messages.context.about": "เกี่ยวกับ: {name}",
    "messages.context.order": "ออเดอร์ #{id}",

    // Cart
    "cart.title": "ตะกร้าของคุณ",
    "cart.subtitle": "ตรวจสอบรายการและใส่โค้ดส่วนลดก่อนชำระเงิน",
    "cart.empty.title": "ตะกร้าของคุณยังว่างอยู่",
    "cart.empty.description": "ลองหยิบสินค้าจากตลาดเข้ามาก่อนนะ",
    "cart.empty.cta": "เลือกชมตลาด",
    "cart.subtotal": "ยอดรวม",
    "cart.discount": "ส่วนลด",
    "cart.total": "ราคารวมทั้งหมด",
    "cart.checkout": "ชำระเงิน",
    "cart.couponCode": "โค้ดส่วนลด",
    "cart.applyCoupon": "ใช้",
    "cart.removeItem": "ลบ",
    "cart.saveForLater": "บันทึกไว้ทีหลัง",

    // Footer
    "footer.tagline": "ตลาดดิจิทัลสำหรับครีเอเตอร์ไทย",
    "footer.about": "เกี่ยวกับ",
    "footer.help": "ช่วยเหลือ",
    "footer.privacy": "ความเป็นส่วนตัว",
    "footer.terms": "ข้อตกลง",
    "footer.copyright": "© {year} METU สงวนลิขสิทธิ์",

    // Empty states
    "empty.noResults": "ไม่พบผลลัพธ์",
    "empty.tryAgain": "ลองค้นหาด้วยคำอื่นดู",
    "empty.audit.title": "ยังไม่มีการดำเนินการจากผู้ดูแล",
    "empty.audit.description":
      "การกระทำสำคัญของแอดมินและผู้ขาย (ลบรีวิว คืนเงิน เปลี่ยนสิทธิ์) จะปรากฏที่นี่เมื่อเกิดขึ้น",
    "empty.responseTime": "ผู้ขายใหม่ — ยังไม่มีข้อมูลการตอบกลับ",
    "empty.avgRating": "ยังไม่มีรีวิว",
  },
};

/**
 * Lightweight {var} interpolation — supports `{year}` and friends.
 * Pure function so it's easy to unit-test outside React.
 */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
