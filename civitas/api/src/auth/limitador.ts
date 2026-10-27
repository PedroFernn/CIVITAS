/** Limita intentos fallidos de acceso por identificador (en memoria: se reinicia con la API; suficiente como freno básico). */
export class LimitadorIntentos {
  private readonly fallos = new Map<string, { n: number; hasta: number }>();
  constructor(private readonly max = 5, private readonly ventanaMs = 15 * 60_000, private readonly ahora = () => Date.now()) {}

  /** Segundos que faltan para poder reintentar, o 0 si puede intentar. */
  bloqueadoPor(clave: string): number {
    const f = this.fallos.get(clave);
    if (!f) return 0;
    if (this.ahora() >= f.hasta) { this.fallos.delete(clave); return 0; }
    return f.n >= this.max ? Math.ceil((f.hasta - this.ahora()) / 1000) : 0;
  }

  fallo(clave: string): void {
    const f = this.fallos.get(clave);
    if (!f || this.ahora() >= f.hasta) this.fallos.set(clave, { n: 1, hasta: this.ahora() + this.ventanaMs });
    else f.n++;
    if (this.fallos.size > 10_000) for (const [k, v] of this.fallos) if (this.ahora() >= v.hasta) this.fallos.delete(k);
  }

  exito(clave: string): void {
    this.fallos.delete(clave);
  }
}
