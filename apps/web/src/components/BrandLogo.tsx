/** Display the supplied artwork with its outer whitespace outside the viewport. */
export default function BrandLogo() {
  return (
    <svg
      className="brand-logo"
      viewBox="250 250 1500 1500"
      width="48"
      height="48"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0, background: '#fff', borderRadius: 4 }}
    >
      <image href="/brand/horse-transport-logo.png" width="2048" height="2048" />
    </svg>
  );
}
