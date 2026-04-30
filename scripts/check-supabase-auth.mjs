/**
 * Read-only diagnostic: count credential `account` rows on Supabase
 * for the seeded demo users. If the count is 0, login is broken
 * because better-auth's signInEmail looks up account.password where
 * provider_id='credential' AND account_id=<email>.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const usersWithLegacy = await prisma.user.count({ where: { password: { not: null } } });
const credentialAccounts = await prisma.account.count({ where: { providerId: "credential" } });

console.log("users with legacy password :", usersWithLegacy);
console.log("credential account rows    :", credentialAccounts);

const demos = await prisma.user.findMany({
  where: { email: { in: ["admin@metu.dev", "seller@metu.dev", "buyer@metu.dev"] } },
  select: { userId: true, email: true, password: true, accounts: { where: { providerId: "credential" }, select: { password: true } } },
});

console.log("\nDemo accounts:");
for (const u of demos) {
  const legacy = u.password ? "yes" : "no";
  const auth = (u.accounts[0]?.password) ? "yes" : "no";
  console.log(`  ${u.email.padEnd(20)}  legacy_pwd=${legacy}  auth_account_pwd=${auth}`);
}
await prisma.$disconnect();
