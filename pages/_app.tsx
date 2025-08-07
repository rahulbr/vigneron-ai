// pages/_app.tsx
import type { AppProps } from "next/app";
import { AuthWrapper } from "../components/AuthWrapper";
import { VineyardProvider } from "../components/VineyardContext";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthWrapper>
      <VineyardProvider>
        <Component {...pageProps} />
      </VineyardProvider>
    </AuthWrapper>
  );
}