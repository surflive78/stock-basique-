// PostgREST ne renvoie pas d'erreur quand une écriture ne touche aucune ligne.
// Une modification ou une suppression refusée par les politiques de sécurité, ou
// portant sur une ligne disparue entre-temps, passait donc pour un succès :
// l'écran affichait « enregistré » sans que rien n'ait changé en base.
//
// Chaîner .select() sur l'écriture fait remonter les lignes réellement touchées.
// Ce garde-fou transforme une liste vide en erreur explicite.

type WriteResponse = {
  data: unknown[] | null
  error: { message: string; code?: string } | null
}

export function writeError(response: WriteResponse, message: string) {
  if (response.error) return response.error
  if (!response.data?.length) return { message } as { message: string; code?: string }
  return null
}
