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
      const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN;
      if (!allowedDomain) return true; // no restriction if env not set
      const email = (profile as { email?: string })?.email ?? "";
      return email.endsWith(`@${allowedDomain}`);
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};
