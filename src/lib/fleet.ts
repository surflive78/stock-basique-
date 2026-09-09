// Le suivi VGP d'un camion-grue reposait sur la seule case « est_camion_grue ».
// Un camion saisi « Porteur Grue 32T » sans cette case cochée sortirait donc de
// l'alerte comme du registre à l'écran.
//
// La case reste la source principale, mais un type mentionnant « grue » sans
// case cochée doit rester surveillé : la règle est une union.

type CraneCandidate = { est_camion_grue: boolean; type_vehicule: string | null }

export function isCraneTruck(truck: CraneCandidate) {
  if (truck.est_camion_grue) return true
  return /grue/i.test(truck.type_vehicule || '')
}
