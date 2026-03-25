// Selector de idioma y región para configuración de familia
// Rellena automáticamente moneda y símbolo al seleccionar una región

export const LOCALES = [
  { value: 'es-MX', label: '🇲🇽 México', currency: 'MXN', symbol: '$', lang: 'Español' },
  { value: 'es-US', label: '🇺🇸 Estados Unidos (USD)', currency: 'USD', symbol: '$', lang: 'English' },
  { value: 'es-CO', label: '🇨🇴 Colombia', currency: 'COP', symbol: '$', lang: 'Español' },
  { value: 'es-AR', label: '🇦🇷 Argentina', currency: 'ARS', symbol: '$', lang: 'Español' },
  { value: 'es-CL', label: '🇨🇱 Chile', currency: 'CLP', symbol: '$', lang: 'Español' },
  { value: 'es-PE', label: '🇵🇪 Perú', currency: 'PEN', symbol: 'S/', lang: 'Español' },
  { value: 'es-VE', label: '🇻🇪 Venezuela', currency: 'VES', symbol: 'Bs.', lang: 'Español' },
  { value: 'es-EC', label: '🇪🇨 Ecuador', currency: 'USD', symbol: '$', lang: 'Español' },
  { value: 'es-GT', label: '🇬🇹 Guatemala', currency: 'GTQ', symbol: 'Q', lang: 'Español' },
  { value: 'es-CR', label: '🇨🇷 Costa Rica', currency: 'CRC', symbol: '₡', lang: 'Español' },
  { value: 'es-PA', label: '🇵🇦 Panamá', currency: 'PAB', symbol: 'B/.', lang: 'Español' },
  { value: 'es-DO', label: '🇩🇴 República Dominicana', currency: 'DOP', symbol: 'RD$', lang: 'Español' },
  { value: 'es-BO', label: '🇧🇴 Bolivia', currency: 'BOB', symbol: 'Bs.', lang: 'Español' },
  { value: 'es-PY', label: '🇵🇾 Paraguay', currency: 'PYG', symbol: '₲', lang: 'Español' },
  { value: 'es-UY', label: '🇺🇾 Uruguay', currency: 'UYU', symbol: '$U', lang: 'Español' },
  { value: 'pt-BR', label: '🇧🇷 Brasil', currency: 'BRL', symbol: 'R$', lang: 'Português' },
  { value: 'en-GB', label: '🇬🇧 Reino Unido', currency: 'GBP', symbol: '£', lang: 'English' },
  { value: 'en-CA', label: '🇨🇦 Canadá', currency: 'CAD', symbol: '$', lang: 'English' },
  { value: 'en-AU', label: '🇦🇺 Australia', currency: 'AUD', symbol: '$', lang: 'English' },
  { value: 'fr-FR', label: '🇫🇷 Francia', currency: 'EUR', symbol: '€', lang: 'Français' },
  { value: 'de-DE', label: '🇩🇪 Alemania', currency: 'EUR', symbol: '€', lang: 'Deutsch' },
  { value: 'es-ES', label: '🇪🇸 España', currency: 'EUR', symbol: '€', lang: 'Español' },
  { value: 'ja-JP', label: '🇯🇵 Japón', currency: 'JPY', symbol: '¥', lang: '日本語' },
  { value: 'zh-CN', label: '🇨🇳 China', currency: 'CNY', symbol: '¥', lang: '中文' },
  { value: 'custom', label: '⚙️ Personalizado', currency: '', symbol: '', lang: '' },
];

export default function LocaleSelector({ value, onChange, onLocaleChange }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Idioma y Región</label>
      <select
        value={value || 'es-MX'}
        onChange={e => {
          const locale = LOCALES.find(l => l.value === e.target.value);
          onChange(e.target.value);
          if (locale && locale.value !== 'custom') onLocaleChange(locale);
        }}
        className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
      >
        {LOCALES.map(l => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground mt-1.5 ml-1">
        Al cambiar la región se actualizan automáticamente la moneda y el símbolo.
      </p>
    </div>
  );
}