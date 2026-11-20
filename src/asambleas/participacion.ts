/**
 * Participación de una asamblea (H27): unidades que votaron entre unidades
 * activas, por 100, con un decimal. Sin unidades activas es 0.
 * Compartida con el panel de salud (H19) para que ambas cifras coincidan.
 */
export function calcularParticipacion(unidadesQueVotaron: number, totalUnidades: number): number {
  return totalUnidades > 0 ? Math.round((unidadesQueVotaron / totalUnidades) * 1000) / 10 : 0;
}
