import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // 프론트(5173)와 FastAPI(8000)를 같은 오리진처럼 보이게 만든다.
    // 세션 쿠키를 쓰기로 했으므로 이 프록시가 없으면 로그인이 유지되지 않는다.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // 빌드 산출물을 FastAPI가 서빙하는 자리에 바로 떨군다.
    // 과정 실습 코드의 app/static/ 관례를 그대로 유지한다.
    //
    // emptyOutDir 이 이 폴더를 통째로 비운다. 손으로 고친 것은 사라진다.
    outDir: "../app/static",
    emptyOutDir: true,
  },
});
