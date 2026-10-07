/** A grid of big choice buttons (maps, sites, sides). */
export default function ChoiceGrid({ children, className = '' }) {
  return <ul className={`choice-grid ${className}`}>{children}</ul>;
}
