// Les quatre écrans de première connexion, repris de la maquette.
// Ils expliquent le parti pris du produit — trois objectifs, la régularité
// plutôt que la quantité, la review du dimanche — avant que l'utilisateur ne
// crée quoi que ce soit.

export type OnboardingStep = {
  icon: string
  gradient: string
  title: string
  body: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    icon: '◎',
    gradient: 'linear-gradient(150deg,#1420ff,#00c2ff)',
    title: '3 objectifs principaux',
    body:
      'Une année ne tient pas quinze priorités.\n' +
      'Sur Clarity, vous en choisissez trois : celles qui décideront si votre année a compté. ' +
      'Le reste passe en objectifs secondaires, rangé mais toujours là. Chaque semaine vous dit ' +
      'où vous en êtes, et chaque trimestre vous faites le point.',
  },
  {
    icon: '✓',
    gradient: 'linear-gradient(150deg,#5b00f5,#c44dff)',
    title: 'Chaque tâche vous fait avancer',
    body:
      'Créez une tâche en deux secondes, reliez-la à un objectif en un clic : elle prend sa ' +
      'couleur, et chaque coche compte un jour de plus sur cet objectif. Ce sont les jours ' +
      'distincts qui comptent, pas le nombre de tâches — trois tâches le lundi valent un jour.',
  },
  {
    icon: '▦',
    gradient: 'linear-gradient(150deg,#009e54,#2aeb8d)',
    title: 'Votre régularité devient visible',
    body:
      'Chaque jour actif allume une case sur la carte de son objectif. Une semaine qui atteint ' +
      'sa cadence s’entoure, et les semaines tenues d’affilée réchauffent la couleur. ' +
      'Vous allez adorer voir vos semaines se remplir, et détester les trous.',
  },
  {
    icon: '▲',
    gradient: 'linear-gradient(90deg,#0044e0,#2f8bff)',
    title: 'Votre rituel du dimanche soir',
    body:
      'Deux minutes en fin de semaine : vos victoires, votre régularité, une note par objectif. ' +
      'Au sol, en vol ou en orbite — l’important, c’est de décoller.\n\nÀ vous de jouer 🚀',
  },
]
