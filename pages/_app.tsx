// pages/_app.tsx
import type { AppProps } from "next/app";
import AuthWrapper from "../components/AuthWrapper";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthWrapper>
      <Component {...pageProps} />
    </AuthWrapper>
  );
}
