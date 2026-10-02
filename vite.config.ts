import { defineConfig } from 'vite';

// GitHub Pages serves the project at /I-am-Bison/.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/I-am-Bison/' : '/',
});
