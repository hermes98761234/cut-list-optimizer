export type Colors = Map<string, number>
/** A distinct, readable fill per part, spread by the golden angle. */
export const fillOf = (colors: Colors, id: string) => `hsl(${Math.round(((colors.get(id) ?? 0) * 137.5) % 360)} 60% 68%)`
