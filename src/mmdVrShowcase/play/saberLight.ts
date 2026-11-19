// A single hilt is shared across both presentations and both possible owners.
let lit = false;
export const saberLit = () => lit;
export const toggleBlade = () => { lit = !lit; };
export const retractBlade = () => { lit = false; };
