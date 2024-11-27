import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    root: ".", // Rădăcina proiectului
    build: {
        outDir: "dist", // Folderul unde va fi plasat build-ul
        emptyOutDir: true,
    },
    server: {
        port: 5173, // Portul de dezvoltare Vite
    },

});
