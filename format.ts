export function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}
export function qty(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/,"").replace(/\.$/,"");
}
