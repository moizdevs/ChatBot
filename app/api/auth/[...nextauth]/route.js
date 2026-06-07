import NextAuth from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions = NextAuth({
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_ID,
      clientSecret: process.env.FACEBOOK_SECRET,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (
        account.provider === "github" ||
        account.provider === "facebook" ||
        account.provider === "google"
      ) {
        const currentUser = await prisma.user.findUnique({
          where: {
            email: user.email,
          },
        });

        if (!currentUser) {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              imageUrl: user.image,
            },
          });
        }

        return true;
      }

      return true;
    },
    async session({ session, user, token }) {
      const dbUser = await prisma.user.findUnique({
        where:{email: session.user.email,}
      });
      session.user.id = dbUser.id;
      return session;
    },
  },
});

export { authOptions as GET, authOptions as POST };
 