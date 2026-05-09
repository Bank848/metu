// AppError carries an HTTP status + machine code + human message;
// caught by middleware/error.ts and serialised as { error, message }.
// DEFAULT_MESSAGES supplies copy when no explicit message is passed.
const DEFAULT_MESSAGES: Record<string, string> = {
  Unauthorized: "You need to sign in to do that.",
  Forbidden: "You don't have permission to do that.",
  NotFound: "We couldn't find what you were looking for.",
  BadId: "That doesn't look like a valid ID.",
  ValidationError: "Some of the fields below need to be fixed.",
  InvalidCredentials: "Email or password is wrong.",
  EmailNotVerified: "Confirm your email to finish signing in.",
  PhoneNotVerified: "Verify your phone to finish signing in.",
  EmailTaken: "An account with that email already exists.",
  UsernameTaken: "That username is already taken — pick another.",
  ProfanityRejected: "That word isn't allowed here. Please pick something else.",
  InvalidCode: "That code didn't match. Request a new one if needed.",
  InvalidOtp: "That OTP didn't match. Try again or request a new one.",
  OtpExpired: "That OTP has expired — request a new one.",
  NoPendingOtp: "No code is waiting to be verified — send a new one first.",
  InvalidTotp: "That two-factor code didn't match. Try again.",
  NeedsTotp: "Two-factor code required.",
  CaptchaFailed: "Please complete the CAPTCHA and try again.",
  TooManyRequests: "Too many attempts — wait a moment and try again.",
  EmptyCart: "Your cart is empty.",
  AlreadyOwned: "You already own this product — view your order instead.",
  OutOfStock: "Not enough stock left for that quantity.",
  QuantityExceedsCap: "That quantity is over the per-order limit.",
  CouponLimitReached: "This coupon has reached its usage limit.",
  CouponAlreadyUsed: "You've already used this coupon.",
  InvalidTotal: "Order total must be greater than zero.",
  MultiStoreCheckoutUnsupported:
    "Your cart has items from multiple stores — please check out one store at a time.",
  MustPurchaseToReview: "You can only review products you've bought.",
  AlreadyReviewed: "You've already reviewed this product.",
  ReviewNotFound: "We couldn't find that review.",
  StoreNotFound: "We couldn't find that store.",
  ProductNotFound: "We couldn't find that product.",
  OrderNotFound: "We couldn't find that order.",
  UserNotFound: "We couldn't find that user.",
  CartItemNotFound: "We couldn't find that cart item.",
  SelfDeleteForbidden: "You can't delete your own account from the admin tools.",
  SelfDemoteForbidden: "You can't remove your own admin role.",
  LastAdminCannotBeRemoved:
    "You're the only admin — promote someone else before removing yourself.",
  PendingOrderBlocksSelfDelete:
    "You have an order in flight. Cancel or finish the checkout first, then try again.",
  StripeNotConfigured: "Payments aren't set up on this server yet.",
  PaymentServiceUnavailable:
    "Payment service is temporarily unavailable. Please try again in a moment.",
  IpBanned: "Access from your network has been blocked.",
  Conflict: "That conflicts with something else — try a different value.",
  SellerNotReadyForPayments:
    "This seller hasn't finished setting up payments yet. Try a different store or come back later.",
  NotOnboarded: "Finish Stripe Connect onboarding before requesting a payout.",
};

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  /** Optional structured payload echoed in the JSON response. */
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(message ?? DEFAULT_MESSAGES[code] ?? code);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = "AppError";
  }
}
