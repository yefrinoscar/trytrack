import { Link } from '@tanstack/react-router'

export default function Footer() {
  return (
    <footer className="site-footer mt-10 px-4">
      <div className="page-wrap flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-5 text-center text-xs uppercase tracking-[0.12em] text-foreground-faint">
        <span>Trytracker</span>
        <span aria-hidden="true">·</span>
        <Link className="hover:text-foreground" to="/privacy">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link className="hover:text-foreground" to="/terms">
          Terms
        </Link>
      </div>
    </footer>
  )
}
