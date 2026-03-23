import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = (profile as { email?: string })?.email ?? "";
      const allowedEmails = process.env.GOOGLE_ALLOWED_EMAILS?.split(",").map((e) => e.trim());
      if (allowedEmails && allowedEmails.length > 0) {
        return allowedEmails.includes(email);
      }
      const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN;
      if (allowedDomain) return email.endsWith(`@${allowedDomain}`);
      return true;
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};
