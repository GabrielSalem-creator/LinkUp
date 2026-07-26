import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#FFF2E2" />
        <meta name="color-scheme" content="light dark" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: shellCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/** Full-bleed Côte Sport shell — kills white letterbox bars on phones/desktops */
const shellCss = `
html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}
html {
  background-color: #FFF2E2;
}
body {
  overflow: hidden;
  background-color: #FFF2E2;
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}
#root {
  display: flex;
  flex: 1;
  min-height: 100%;
  min-height: 100dvh;
  background-color: #FFF2E2;
}
#root > div {
  flex: 1;
  min-height: 100%;
  min-height: 100dvh;
  width: 100%;
}
@media (prefers-color-scheme: dark) {
  html, body, #root {
    background-color: #0C1A20;
  }
}
`;
