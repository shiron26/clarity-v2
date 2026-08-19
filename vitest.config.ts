import { defineConfig } from 'vitest/config'

// Config SÉPARÉE de `vite.config.ts`, délibérément.
//
// Y ajouter un bloc `test` aurait chargé `VitePWA` et `@tailwindcss/vite` à chaque
// exécution, pour des fonctions pures qui n'en ont aucun besoin. Et les tests unitaires
// n'ont rien à faire dans la configuration du build de production.
export default defineConfig({
  test: {
    // `node`, pas `jsdom` : ces tests portent sur des fonctions pures. Le seul module
    // qui touche au navigateur est `dashboardLayout`, dont le test pose un faux
    // `localStorage` en trois lignes — moins cher, et plus honnête, qu'un DOM entier.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Chaque test importe explicitement `describe`/`it`/`expect` : pas de globals
    // implicites, donc pas de `types` à ajouter dans les tsconfig.
    globals: false,
  },
})
