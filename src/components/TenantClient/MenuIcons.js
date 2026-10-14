const iconStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 24,
  lineHeight: 0,
  verticalAlign: 'top'
};
const svgStyle = { display: 'block' };
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

const NavIcon = ({ children, ...props }) => (
  <span className="anticon" style={iconStyle} {...props}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={svgStyle}>
      {children}
    </svg>
  </span>
);

export const HomeMenuIcon = props => (
  <NavIcon {...props}>
    <path d="M3.2 9.1 10 3.4l6.8 5.7" {...strokeProps} />
    <path d="M5.1 8.4V16.2h3.3v-4h3.2v4h3.3V8.4" {...strokeProps} />
  </NavIcon>
);

export const TicketMenuIcon = props => (
  <NavIcon {...props}>
    <path d="M5.2 3.4h6.6l3 3V16.6H5.2z" {...strokeProps} />
    <path d="M11.6 3.6v3h2.9" {...strokeProps} />
    <path d="M7.4 9.4h5.2M7.4 12.2h5.2" {...strokeProps} />
  </NavIcon>
);

export const MailMenuIcon = props => (
  <NavIcon {...props}>
    <rect x="3.2" y="4.6" width="13.6" height="10.8" rx="1.4" {...strokeProps} />
    <path d="M3.6 5.4 10 10.2l6.4-4.8" {...strokeProps} />
  </NavIcon>
);

export const CompanyMenuIcon = props => (
  <NavIcon {...props}>
    <rect x="3.8" y="2.8" width="12.4" height="14.4" rx="1.2" {...strokeProps} />
    <path d="M7.2 6.4h1.5M11.3 6.4h1.5M7.2 9.6h1.5M11.3 9.6h1.5M7.2 12.8h1.5M11.3 12.8h1.5" {...strokeProps} />
  </NavIcon>
);

export const OrgMenuIcon = props => (
  <NavIcon {...props}>
    <circle cx="10" cy="4.3" r="1.7" {...strokeProps} />
    <circle cx="4.6" cy="15" r="1.7" {...strokeProps} />
    <circle cx="15.4" cy="15" r="1.7" {...strokeProps} />
    <path d="M10 6v2.6M4.6 13.3V10.2h10.8v3.1" {...strokeProps} />
  </NavIcon>
);

export const UserMenuIcon = props => (
  <NavIcon {...props}>
    <circle cx="10" cy="6.8" r="2.4" {...strokeProps} />
    <path d="M4.5 16.2c.7-2.7 2.8-4.1 5.5-4.1s4.8 1.4 5.5 4.1" {...strokeProps} />
  </NavIcon>
);

export const PermissionMenuIcon = props => (
  <NavIcon {...props}>
    <path d="M10 2.8 16.2 5.2v4.6c0 3.4-2.4 5.6-6.2 7.4-3.8-1.8-6.2-4-6.2-7.4V5.2L10 2.8z" {...strokeProps} />
    <path d="M7.6 10.1 9.2 11.7 12.6 8.3" {...strokeProps} />
  </NavIcon>
);

export const SwitchTenantMenuIcon = props => (
  <NavIcon {...props}>
    <circle cx="7.4" cy="7.2" r="2.2" {...strokeProps} />
    <path d="M3.6 15.6c.5-2.3 2-3.6 3.8-3.6 1.1 0 2.1.4 2.8 1.2" {...strokeProps} />
    <path d="M12.2 6.2h4.4M16.6 6.2 14.9 4.6M16.6 6.2 14.9 7.8" {...strokeProps} />
    <path d="M16.6 11.4h-4.4M12.2 11.4l1.7 1.6M12.2 11.4l1.7-1.6" {...strokeProps} />
  </NavIcon>
);

export const LogoutMenuIcon = props => (
  <NavIcon {...props}>
    <path d="M14.24 5.76A6 6 0 1 0 14.24 14.24" {...strokeProps} />
    <path d="M9.6 10h7.4M14.8 7.8 17 10l-2.2 2.2" {...strokeProps} />
  </NavIcon>
);
