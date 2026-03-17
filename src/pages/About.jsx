import PageHeader from '@/components/PageHeader';
import { Mail, MessageCircle, Heart, Shield, Zap } from 'lucide-react';

export default function About() {
  return (
    <div className="pb-8">
      <PageHeader title="Acerca de" subtitle="FamilyFlow" />

      <div className="px-4 space-y-4">
        {/* App identity */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-primary-foreground font-black text-4xl">F</span>
          </div>
          <h2 className="text-2xl font-black text-foreground mb-1">FamilyFlow</h2>
          <p className="text-sm text-muted-foreground mb-3">Sistema integral de finanzas familiares</p>
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">Versión 1.0.0</span>
        </div>

        {/* Description */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-2">Acerca de FamilyFlow</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            FamilyFlow es una solución moderna y completa para la gestión de finanzas familiares,
            diseñada para parejas y familias que desean tener control real de sus ingresos, egresos,
            inversiones y compromisos financieros.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            Proporciona herramientas intuitivas para registrar movimientos con captura por voz,
            autodetección de categorías, reportes dinámicos exportables y seguimiento de pagos
            programados, todo sin depender de inteligencia artificial en el uso diario.
          </p>
        </div>

        {/* Features */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-3">Características Principales</h3>
          <div className="space-y-3">
            {[
              { icon: Zap, title: '0 créditos en uso diario', desc: 'Toda la inteligencia es local: motor de reglas, voz nativa del dispositivo, reportes en frontend.' },
              { icon: Shield, title: 'Privacidad y seguridad', desc: 'Tus datos financieros son privados. El reconocimiento de voz usa la API nativa del dispositivo.' },
              { icon: Heart, title: 'Diseño para familias', desc: 'Configuración personalizada por familia, soporte para múltiples personas y métodos de pago.' },
            ].map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Developer info */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-3">Equipo Desarrollador</h3>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-white font-black text-lg">A</span>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">ACACIA Consultoría</p>
              <p className="text-xs text-muted-foreground">en Informática y Cómputo</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Desarrollado con dedicación para ofrecerte la mejor experiencia en la gestión de tus finanzas familiares.
          </p>
        </div>

        {/* Contact */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-3">Contacto y Soporte</h3>
          <div className="space-y-3">
            <a href="mailto:soporte@acaciaco.com.mx" className="flex items-center gap-3 p-3 bg-muted rounded-xl hover:bg-muted/70 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Email</p>
                <p className="text-xs text-muted-foreground">soporte@acaciaco.com.mx</p>
              </div>
            </a>
            <a href="https://wa.me/524498958291" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-muted rounded-xl hover:bg-muted/70 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground">+52 449 895 8291</p>
              </div>
            </a>
          </div>
        </div>

        {/* Legal */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-2">Derechos Reservados</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            © 2026 ACACIA Consultoría en Informática y Cómputo{'\n'}
            Todos los derechos reservados.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Licencia registrada a: <span className="text-foreground font-medium">h.josepablo@gmail.com</span>
          </p>
        </div>

        {/* Made with love */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            Hecho con <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> para las familias
          </p>
        </div>
      </div>
    </div>
  );
}